import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { ink } from '@inksuite/chain';

// [HIGH-05] WalletConnect v2 projectId. Required for mobile wallet connections.
// Set NEXT_PUBLIC_WC_PROJECT_ID in each Cloudflare Pages project env vars.
// Fallback '0' preserves injected-wallet flows (MetaMask etc.) when unset.
export const walletConfig = getDefaultConfig({
  appName: 'Ink Suite',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '0',
  chains: [ink],
  ssr: false,
});
