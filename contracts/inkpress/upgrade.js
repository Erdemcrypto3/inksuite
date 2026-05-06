/**
 * InkPress UUPS Upgrade Script
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

  const InkPress = await ethers.getContractFactory('InkPress');

  console.log('\nImporting existing proxy into hardhat-upgrades manifest...');
  await upgrades.forceImport(PROXY_ADDRESS, InkPress, { kind: 'uups' });

  console.log('Validating storage layout compatibility...');
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, InkPress, {
    kind: 'uups',
    redeployImplementation: 'always',
    unsafeAllowRenames: true,
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
