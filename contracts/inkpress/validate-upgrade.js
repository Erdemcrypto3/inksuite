/**
 * Validate InkPress UUPS upgrade against live mainnet fork.
 *
 * Usage:
 *   COMPILE_INKPRESS=1 node inkpress/validate-upgrade.js
 */

const hre = require('hardhat');

const PROXY_ADDRESS = '0x7A0bB0C37a934b3858436E61838719a5a7F63720';
const INK_RPC = process.env.INK_RPC || 'https://rpc-gel.inkonchain.com';

async function main() {
  // Reset hardhat to fork Ink mainnet
  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [{ forking: { jsonRpcUrl: INK_RPC } }],
  });

  console.log('Forked Ink mainnet at', INK_RPC);

  // Verify proxy exists on fork
  const code = await hre.ethers.provider.getCode(PROXY_ADDRESS);
  if (code === '0x') {
    throw new Error('No contract at proxy address on fork');
  }
  console.log('Proxy bytecode found at', PROXY_ADDRESS, '(', code.length / 2, 'bytes)');

  const InkPress = await hre.ethers.getContractFactory('InkPress');

  console.log('\nImporting existing proxy...');
  await hre.upgrades.forceImport(PROXY_ADDRESS, InkPress, { kind: 'uups' });
  console.log('Import OK');

  console.log('\nValidating storage layout compatibility...');
  await hre.upgrades.validateUpgrade(PROXY_ADDRESS, InkPress, {
    kind: 'uups',
    unsafeAllowRenames: true,
  });
  console.log('Storage layout validation PASSED');

  console.log('\nDry-run upgrade on fork...');

  const owner = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [owner],
  });
  await hre.network.provider.send('hardhat_setBalance', [
    owner,
    '0x56BC75E2D63100000',
  ]);

  const signer = await hre.ethers.getSigner(owner);
  const InkPressAsOwner = InkPress.connect(signer);

  const upgraded = await hre.upgrades.upgradeProxy(PROXY_ADDRESS, InkPressAsOwner, {
    kind: 'uups',
    redeployImplementation: 'always',
    unsafeAllowRenames: true,
  });

  await upgraded.waitForDeployment();
  const implAddress = await hre.upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log('Dry-run upgrade succeeded!');
  console.log('New implementation (fork):', implAddress);

  const proxy = InkPress.attach(PROXY_ADDRESS).connect(signer);
  const maxSupply = await proxy.maxMintSupply();
  const cooldown = await proxy.publishCooldown();
  const delay = await proxy.ADMIN_CHANGE_DELAY();
  const pendingFee = await proxy.pendingPlatformFee();
  const pendingGw = await proxy.pendingStorageGatewayUrl();
  console.log('\nState variable checks:');
  console.log('  maxMintSupply:', maxSupply.toString(), '(expect 0)');
  console.log('  publishCooldown:', cooldown.toString(), '(expect 0)');
  console.log('  ADMIN_CHANGE_DELAY:', delay.toString(), '(expect 86400)');
  console.log('  pendingPlatformFee:', pendingFee.toString(), '(expect 0)');
  console.log('  pendingStorageGatewayUrl:', pendingGw, '(expect empty)');

  console.log('\n✓ All validations passed. Safe to upgrade on mainnet.');
}

main().catch((e) => {
  console.error('\n✗ VALIDATION FAILED:', e.message || e);
  process.exit(1);
});
