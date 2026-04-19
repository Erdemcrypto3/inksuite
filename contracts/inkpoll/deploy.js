/**
 * InkPoll Deploy Script
 *
 * Usage:
 *   1. Set WCM env variable with your private key
 *   2. Run: node deploy.js
 *
 * Prerequisites:
 *   npm install viem
 */

const { createWalletClient, createPublicClient, http, defineChain } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

// Ink L2 chain definition
const ink = defineChain({
  id: 57073,
  name: 'Ink',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-gel.inkonchain.com'] },
  },
});

// Constructor parameters
const USDC_ADDRESS = '0x2D270e6886d130D724215A266106e6832161EAEd';
const TREASURY_ADDRESS = '0x9e84d77264d94c646df91a70dbae99c20330ead0';

// Contract bytecode — paste from Remix/Foundry compilation
const BYTECODE = 'PASTE_COMPILED_BYTECODE_HERE';

async function deploy() {
  // Get private key from environment
  const privateKey = process.env.DEPLOY_KEY;
  if (!privateKey) {
    console.error('Set DEPLOY_KEY environment variable');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  console.log('Deploying from:', account.address);

  const walletClient = createWalletClient({
    account,
    chain: ink,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: ink,
    transport: http(),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', Number(balance) / 1e18, 'ETH');

  if (balance === 0n) {
    console.error('No ETH for gas!');
    process.exit(1);
  }

  // Encode constructor args: (address _paymentToken, address _treasury)
  // ABI-encoded: two address params, each padded to 32 bytes
  const encodedArgs =
    USDC_ADDRESS.slice(2).padStart(64, '0') +
    TREASURY_ADDRESS.slice(2).padStart(64, '0');

  const deployData = `0x${BYTECODE}${encodedArgs}`;

  console.log('Deploying InkPoll...');
  console.log('  Payment token (USDC):', USDC_ADDRESS);
  console.log('  Treasury:', TREASURY_ADDRESS);

  const hash = await walletClient.sendTransaction({
    data: deployData,
  });

  console.log('Tx hash:', hash);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Contract deployed at:', receipt.contractAddress);
  console.log('Gas used:', receipt.gasUsed.toString());
  console.log('\nDone! Update INKPOLL_ADDRESS in contract.ts with:', receipt.contractAddress);
}

deploy().catch(console.error);
