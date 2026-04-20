const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('InkPoll V2', function () {
  let poll, usdc, owner, admin, treasury, verifiedSender, regularSender, alice, bob, charlie;
  const DAY = 24 * 60 * 60;
  const CAT_DEFI = 1 << 0;
  const CAT_NFTS = 1 << 1;
  const CAT_GAMING = 1 << 2;

  beforeEach(async function () {
    [owner, admin, treasury, verifiedSender, regularSender, alice, bob, charlie] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    usdc = await MockUSDC.deploy();

    const InkPoll = await ethers.getContractFactory('inkpoll/InkPoll_V2.sol:InkPoll');
    poll = await InkPoll.deploy(await usdc.getAddress(), treasury.address);

    await poll.addAdmin(admin.address);
    await poll.verifySender(verifiedSender.address);

    for (const s of [verifiedSender, regularSender]) {
      await usdc.mint(s.address, 1_000_000_000n);
      await usdc.connect(s).approve(await poll.getAddress(), 1_000_000_000n);
    }

    for (const u of [alice, bob, charlie]) {
      await poll.connect(u).register(CAT_DEFI | CAT_NFTS);
    }
  });

  describe('constructor & state', function () {
    it('sets paymentToken and treasury', async function () {
      expect(await poll.paymentToken()).to.equal(await usdc.getAddress());
      expect(await poll.treasury()).to.equal(treasury.address);
    });

    it('seeds default categories and tiers', async function () {
      const cats = await poll.getAllCategories();
      expect(cats.length).to.equal(8);
      expect(cats[0]).to.equal('DeFi');
    });

    it('rejects zero addresses in constructor', async function () {
      const InkPoll = await ethers.getContractFactory('inkpoll/InkPoll_V2.sol:InkPoll');
      await expect(InkPoll.deploy(ethers.ZeroAddress, treasury.address)).to.be.revertedWith('Zero address');
      await expect(InkPoll.deploy(await usdc.getAddress(), ethers.ZeroAddress)).to.be.revertedWith('Zero address');
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
      await poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10);
      await expect(poll.connect(verifiedSender).respond(0, 0)).to.be.revertedWith('Not registered');

      await poll.connect(verifiedSender).register(CAT_DEFI);
      await expect(poll.connect(verifiedSender).respond(0, 0)).to.be.revertedWith('Cannot respond to own poll');
    });
  });

  describe('submitPoll — verified sender (CRIT-03 fix)', function () {
    it('transfers payment directly to treasury, marks ACTIVE', async function () {
      const before = await usdc.balanceOf(treasury.address);
      await poll.connect(verifiedSender).submitPoll('cid', ['yes', 'no'], (await time.latest()) + DAY, CAT_DEFI, 10);
      const after = await usdc.balanceOf(treasury.address);
      expect(after - before).to.equal(5_000_000n);

      const p = await poll.polls(0);
      expect(p.status).to.equal(1); // ACTIVE
      expect(await usdc.balanceOf(await poll.getAddress())).to.equal(0n);
    });
  });

  describe('submitPoll — non-verified sender', function () {
    it('holds payment in contract, marks PENDING', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10);
      const p = await poll.polls(0);
      expect(p.status).to.equal(0); // PENDING
      expect(await usdc.balanceOf(await poll.getAddress())).to.equal(5_000_000n);
    });

    it('admin can approve — funds move to treasury', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10);
      const before = await usdc.balanceOf(treasury.address);
      await poll.connect(admin).approvePoll(0);
      const after = await usdc.balanceOf(treasury.address);
      expect(after - before).to.equal(5_000_000n);
      expect((await poll.polls(0)).status).to.equal(1);
    });

    it('admin can reject — sender refunded', async function () {
      const beforeSender = await usdc.balanceOf(regularSender.address);
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10);
      await poll.connect(admin).rejectPoll(0);
      const afterSender = await usdc.balanceOf(regularSender.address);
      expect(afterSender).to.equal(beforeSender);
    });

    it('rejects approve after deadline (H-06)', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10);
      await time.increase(2 * DAY);
      await expect(poll.connect(admin).approvePoll(0)).to.be.revertedWith('Expired');
    });

    it('sender can self-refund expired PENDING via closePoll', async function () {
      const before = await usdc.balanceOf(regularSender.address);
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10);
      await time.increase(2 * DAY);
      await poll.connect(regularSender).closePoll(0);
      expect(await usdc.balanceOf(regularSender.address)).to.equal(before);
    });
  });

  describe('submitPoll — audience validation (H-02)', function () {
    it('reverts when claim < actual', async function () {
      // 3 users (alice, bob, charlie) have CAT_DEFI
      await expect(
        poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 1)
      ).to.be.revertedWith('Audience understated');
    });

    it('accepts claim >= actual; price scales with claim', async function () {
      const before = await usdc.balanceOf(treasury.address);
      await poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 600);
      const after = await usdc.balanceOf(treasury.address);
      expect(after - before).to.equal(10_000_000n); // tier 2 price at 600 audience
    });

    it('reverts on zero claimed audience', async function () {
      // CAT_GAMING has no registered users → actualAudience=0; claimed=0 trips the "No matching audience" guard
      await expect(
        poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_GAMING, 0)
      ).to.be.revertedWith('No matching audience');
    });
  });

  describe('pause / unpause', function () {
    it('blocks register, respond, submitPoll when paused', async function () {
      await poll.pause();
      const signer = (await ethers.getSigners())[10];
      await expect(poll.connect(signer).register(CAT_DEFI)).to.be.reverted;
      await expect(
        poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10)
      ).to.be.reverted;
    });
  });

  describe('access control (H-03)', function () {
    it('verifySender is onlyOwner — admin cannot call', async function () {
      // OZ v5 Ownable emits OwnableUnauthorizedCaller custom error; matching by name via revertedWithCustomError
      // requires the ABI to include the error. We fall back to plain `reverted` to avoid ABI plumbing noise.
      await expect(poll.connect(admin).verifySender(alice.address)).to.be.reverted;
    });

    it('setPricing is onlyOwner', async function () {
      await expect(poll.connect(admin).setPricing([100], [1_000_000])).to.be.reverted;
      await expect(poll.connect(owner).setPricing([], [])).to.be.revertedWith('Invalid tiers');
      await poll.setPricing([100, 1000], [1_000_000, 5_000_000]);
      expect(await poll.tierMaxAudience(0)).to.equal(100n);
    });
  });

  describe('allowance=0 reverts', function () {
    it('submitPoll reverts when allowance insufficient', async function () {
      await usdc.connect(verifiedSender).approve(await poll.getAddress(), 0);
      await expect(
        poll.connect(verifiedSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10)
      ).to.be.reverted;
    });
  });

  describe('sweepStuckTokens', function () {
    it('blocks payment-token sweep while PENDING polls exist', async function () {
      await poll.connect(regularSender).submitPoll('cid', ['a', 'b'], (await time.latest()) + DAY, CAT_DEFI, 10);
      await expect(poll.sweepStuckTokens(await usdc.getAddress(), 1_000_000n))
        .to.be.revertedWith('Active pending polls');
    });

    it('allows non-payment-token sweep regardless', async function () {
      const MockUSDC = await ethers.getContractFactory('MockUSDC');
      const other = await MockUSDC.deploy();
      await other.mint(await poll.getAddress(), 500n);
      await poll.sweepStuckTokens(await other.getAddress(), 500n);
      expect(await other.balanceOf(owner.address)).to.equal(500n);
    });
  });
});
