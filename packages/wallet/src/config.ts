import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { ink } from '@inksuite/chain';

export const walletConfig = getDefaultConfig({
  appName: 'Ink Suite',
  projectId: '0', // WalletConnect projectId — works without one for injected wallets
  chains: [ink],
  ssr: false,
});
