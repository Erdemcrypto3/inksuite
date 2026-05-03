/**
 * InkPress / BaseBlog UUPS Upgrade Script
 *
 * Upgrades the existing proxy to the new implementation with:
 *   - PAI-0056: maxMintSupply + publishCooldown
 *   - PAI-0058: announceMintPrice / applyMintPrice (24h timelock)
 *
 * Usage:
 *   COMPILE_INKPRESS=1 npx hardhat run inkpress/upgrade.js --network ink
 */

const { ethers, upgrades } = require('hardhat');

const PROXY_ADDRESS = '0x7A0bB0C37a934b3858436E61838719a5a7F63720';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('Upgrading from:', deployer.address);
  console.log('Network:', network.name, `(chainId ${network.chainId})`);
  console.log('Proxy:', PROXY_ADDRESS);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
  if (balance === 0n) {
    throw new Error('No ETH for gas');
  }

  const BaseBlog = await ethers.getContractFactory('BaseBlog');

  // Force-import the existing proxy so hardhat-upgrades can manage it.
  // This is needed because the proxy was originally deployed outside of
  // the hardhat-upgrades plugin.
  console.log('\nImporting existing proxy into hardhat-upgrades manifest...');
  await upgrades.forceImport(PROXY_ADDRESS, BaseBlog, { kind: 'uups' });

  console.log('Validating storage layout compatibility...');
  // upgradeProxy validates layout, deploys new impl, calls upgradeTo
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, BaseBlog, {
    kind: 'uups',
    redeployImplementation: 'always',
  });

  const tx = upgraded.deploymentTransaction();
  console.log('Upgrade tx hash:', tx?.hash);

  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log('\nUpgrade complete!');
  console.log('Proxy (unchanged):', PROXY_ADDRESS);
  console.log('New implementation:', implAddress);
  console.log('\nVerify new impl on Blockscout:');
  console.log('  https://explorer.inkonchain.com/address/' + implAddress + '/contract-code-tab');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
