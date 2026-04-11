import { createPublicClient, defineChain, http } from 'viem';

export const ink = defineChain({
  id: 57073,
  name: 'Ink',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc-gel.inkonchain.com', 'https://rpc-qnd.inkonchain.com'],
      webSocket: ['wss://rpc-gel.inkonchain.com', 'wss://rpc-qnd.inkonchain.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://explorer.inkonchain.com',
      apiUrl: 'https://explorer.inkonchain.com/api',
    },
  },
  testnet: false,
});

export const inkPublicClient = createPublicClient({
  chain: ink,
  transport: http(),
});

export const CHAIN_ID = ink.id;
export const EXPLORER_URL = ink.blockExplorers.default.url;
export const BLOCKSCOUT_API_URL = ink.blockExplorers.default.apiUrl;

export type { PublicClient } from 'viem';
