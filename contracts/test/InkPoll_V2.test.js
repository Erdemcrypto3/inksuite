const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('InkPoll V2 (ETH)', function () {
  let poll, owner, admin, treasury, verifiedSender, regularSender, alice, bob, charlie;
  const DAY = 24 * 60 * 60;
  const CAT_DEFI = 1 << 0;
  const CAT_NFTS = 1 << 1;
  const CAT_GAMING = 1 << 2;

  const TIER1_PRICE = ethers.parseEther('0.005');
  const TIER2_PRICE = ethers.parseEther('0.01');

  beforeEach(async function () {
    [owner, admin, treasury, verifiedSender, regularSender, alice, bob, charlie] = await ethers.getSigners();

    const InkPoll = await ethers.getContractFactory('inkpoll/InkPoll_V2.sol:InkPoll');
    poll = await InkPoll.deploy(treasury.address);

    await poll.addAdmin(admin.address);
    await poll.verifySender(verifiedSender.address);

    for (const u of [alice, bob, charlie]) {
      await poll.connect(u).register(CAT_DEFI | CAT_NFTS);
    }
  });

  describe('constructor & state', function () {
    it('sets treasury', async function () {
      expect(await poll.treasury()).to.equal(treasury.address);
    });

    it('seeds default categories and 8 tiers', async function () {
      const cats = await poll.getAllCategories();
      expect(cats.length).to.equal(8);
      expect(cats[0]).to.equal('DeFi');
      expect(await poll.tierPrice(0)).to.equal(ethers.parseEther('0.005'));
      expect(await poll.tierPrice(7)).to.equal(ethers.parseEther('0.5'));
    });

    it('rejects zero address in constructor', async function () {
      const InkPoll = await ethers.getContractFactory('inkpoll/InkPoll_V2.sol:InkPoll');
      await expect(InkPoll.deploy(ethers.ZeroAddress)).to.be.revertedWith('Zero address');
    });
  });

  describe('register / respond', function () {
    it('awards 50 points on register', async function () {
      const p = await poll.users(alice.address);
      expect(p.registered).to.equal(true);
      expect(p.points).to.equal(50n);
    });

    it('rejects double register', async function () {
      await expect(poll.connect(alice).register(CAT_DEFI)).to.be.revertedWith('Already registered');
    });

    it('rejects invalid category mask (bit past MAX_CATEGORIES)', async function () {
      const newUser = (await ethers.getSigners())[10];
      const invalid = 1 << 10;
      await expect(poll.connect(newUser).register(invalid)).to.be.revertedWith('Invalid mask');
    });

    it('rejects responding to own poll', async function () {
      await poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE });
      await expect(poll.connect(verifiedSender).respond(0, 0)).to.be.revertedWith('Not registered');

      await poll.connect(verifiedSender).register(CAT_DEFI);
      await expect(poll.connect(verifiedSender).respond(0, 0)).to.be.revertedWith('Cannot respond to own poll');
    });
  });

  describe('submitPoll — verified sender', function () {
    it('transfers ETH to treasury, marks ACTIVE', async function () {
      const before = await ethers.provider.getBalance(treasury.address);
      await poll.connect(verifiedSender).submitPoll('cid', ['yes', 'no'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE });
      const after = await ethers.provider.getBalance(treasury.address);
      expect(after - before).to.equal(TIER1_PRICE);

      const p = await poll.polls(0);
      expect(p.status).to.equal(1n);
      expect(await ethers.provider.getBalance(await poll.getAddress())).to.equal(0n);
    });
  });

  describe('submitPoll — non-verified sender', function () {
    it('holds ETH in contract, marks PENDING', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE });
      const p = await poll.polls(0);
      expect(p.status).to.equal(0n);
      expect(await ethers.provider.getBalance(await poll.getAddress())).to.equal(TIER1_PRICE);
    });

    it('admin can approve — ETH moves to treasury', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE });
      const before = await ethers.provider.getBalance(treasury.address);
      await poll.connect(admin).approvePoll(0);
      const after = await ethers.provider.getBalance(treasury.address);
      expect(after - before).to.equal(TIER1_PRICE);
      expect((await poll.polls(0)).status).to.equal(1n);
    });

    it('admin can reject — sender refunded', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE });
      const beforeReject = await ethers.provider.getBalance(regularSender.address);
      await poll.connect(admin).rejectPoll(0);
      const afterReject = await ethers.provider.getBalance(regularSender.address);
      expect(afterReject - beforeReject).to.equal(TIER1_PRICE);
    });

    it('rejects approve after deadline (H-06)', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE });
      await time.increase(2 * DAY);
      await expect(poll.connect(admin).approvePoll(0)).to.be.revertedWith('Expired');
    });

    it('sender can self-refund expired PENDING via closePoll', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE });
      await time.increase(2 * DAY);
      const beforeClose = await ethers.provider.getBalance(regularSender.address);
      const tx = await poll.connect(regularSender).closePoll(0);
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;
      const afterClose = await ethers.provider.getBalance(regularSender.address);
      expect(afterClose + gasSpent - beforeClose).to.equal(TIER1_PRICE);
    });
  });

  describe('submitPoll — audience validation (H-02)', function () {
    it('reverts when claim < actual', async function () {
      await expect(
        poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 1, { value: TIER1_PRICE })
      ).to.be.revertedWith('Audience understated');
    });

    it('accepts claim >= actual; price scales with claim', async function () {
      const before = await ethers.provider.getBalance(treasury.address);
      await poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 600, { value: TIER2_PRICE });
      const after = await ethers.provider.getBalance(treasury.address);
      expect(after - before).to.equal(TIER2_PRICE);
    });

    it('reverts on zero claimed audience', async function () {
      await expect(
        poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_GAMING, 0, { value: TIER1_PRICE })
      ).to.be.revertedWith('No matching audience');
    });
  });

  describe('submitPoll — refund overpayment', function () {
    it('refunds excess ETH to sender', async function () {
      const overpay = ethers.parseEther('0.01');
      const before = await ethers.provider.getBalance(verifiedSender.address);
      const tx = await poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: overpay });
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;
      const after = await ethers.provider.getBalance(verifiedSender.address);
      expect(before - after - gasSpent).to.equal(TIER1_PRICE);
    });

    it('reverts on insufficient payment', async function () {
      await expect(
        poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: 1n })
      ).to.be.revertedWith('Insufficient payment');
    });
  });

  describe('pause / unpause', function () {
    it('blocks register, respond, submitPoll when paused', async function () {
      await poll.pause();
      const signer = (await ethers.getSigners())[10];
      await expect(poll.connect(signer).register(CAT_DEFI)).to.be.reverted;
      await expect(
        poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE })
      ).to.be.reverted;
    });
  });

  describe('access control (H-03)', function () {
    it('verifySender is onlyOwner — admin cannot call', async function () {
      await expect(poll.connect(admin).verifySender(alice.address)).to.be.reverted;
    });

    it('setPricing is onlyOwner', async function () {
      await expect(poll.connect(admin).setPricing([100], [ethers.parseEther('0.001')])).to.be.reverted;
      await expect(poll.connect(owner).setPricing([], [])).to.be.revertedWith('Invalid tiers');
      await poll.setPricing([100, 1000], [ethers.parseEther('0.001'), ethers.parseEther('0.005')]);
      expect(await poll.tierMaxAudience(0)).to.equal(100n);
    });
  });

  describe('sweepETH', function () {
    it('blocks ETH sweep while PENDING polls exist', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10, { value: TIER1_PRICE });
      await expect(poll.sweepETH(TIER1_PRICE))
        .to.be.revertedWith('Active pending polls');
    });
  });

  describe('sweepERC20', function () {
    it('allows ERC20 sweep regardless of poll state', async function () {
      const MockUSDC = await ethers.getContractFactory('MockUSDC');
      const token = await MockUSDC.deploy();
      await token.mint(await poll.getAddress(), 500n);
      await poll.sweepERC20(await token.getAddress(), 500n);
      expect(await token.balanceOf(owner.address)).to.equal(500n);
    });
  });
});
