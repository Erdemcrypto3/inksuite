/**
 * InkPoll V2 Deploy Script — reads compiled artifact (no hand-pasted bytecode).
 *
 * Usage (Windows, key sourced from Credential Manager via hardhat.config.js):
 *   cd contracts
 *   pnpm install
 *   pnpm compile
 *   pnpm deploy:testnet    # Ink Sepolia smoke
 *   pnpm deploy:mainnet    # Ink mainnet
 *
 * The signer is auto-pulled from WCM target `BasePress-DeployKey` by
 * hardhat.config.js:getDeployKey(). For CI or Unix, set DEPLOY_KEY env var.
 *
 * After successful deploy:
 *   1. Copy printed address → set NEXT_PUBLIC_INKPOLL_V2_ADDRESS on inksight
 *      Cloudflare Pages project (activates the approve UI)
 *   2. Verify on Blockscout: https://explorer.inkonchain.com/verify-smart-contract
 *   3. Call setTreasury(multisig) once Safe{Wallet} multisig is deployed (HIGH-07)
 */

const { ethers } = require('hardhat');

// Constructor parameters
const USDC_ADDRESS = '0x2D270e6886d130D724215A266106e6832161EAEd';
const TREASURY_ADDRESS = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('Deploying from:', deployer.address);
  console.log('Network:', network.name, `(chainId ${network.chainId})`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
  if (balance === 0n) {
    throw new Error('No ETH for gas');
  }

  console.log('\nPayment token (USDC):', USDC_ADDRESS);
  console.log('Treasury:              ', TREASURY_ADDRESS);
  console.log('\nDeploying InkPoll V2...');

  const InkPoll = await ethers.getContractFactory('inkpoll/InkPoll_V2.sol:InkPoll');
  const poll = await InkPoll.deploy(USDC_ADDRESS, TREASURY_ADDRESS);
  const tx = poll.deploymentTransaction();
  console.log('Tx hash:', tx?.hash);

  await poll.waitForDeployment();
  const address = await poll.getAddress();
  console.log('\nContract deployed at:', address);
  console.log('\nNext steps:');
  console.log('  1. Update INKPOLL_ADDRESS in apps/inksight/app/components/contract.ts');
  console.log('  2. Set NEXT_PUBLIC_INKPOLL_V2_ADDRESS =', address, 'in Cloudflare Pages env vars to activate approve UI');
  console.log('  3. Verify on Blockscout: https://explorer.inkonchain.com/address/' + address + '/contract-code-tab');
  console.log('  4. After Safe{Wallet} multisig deploy, call setTreasury(multisig)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
