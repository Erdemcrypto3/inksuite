export { walletConfig } from './config';
export { InkWalletProvider } from './provider';

// Re-export commonly used wagmi hooks so apps don't need to import wagmi directly
export {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWriteContract,
  useReadContract,
  useSwitchChain,
  useChainId,
} from 'wagmi';

// Re-export RainbowKit connect button
export { ConnectButton } from '@rainbow-me/rainbowkit';
