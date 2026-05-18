'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { walletConfig } from './config';

import '@rainbow-me/rainbowkit/styles.css';

// P012-PI-0035: one-shot purge of stale WC v2 + wagmi localStorage keyed to the
// dead 2026-05-18 Reown projectId. Runs at module-load (before WagmiProvider
// mounts) so wagmi's reconnect read sees clean storage on first visit, not just
// on reload. Gated by inksuite-wc-purge-2026-05-18 so it runs once per user.
if (typeof window !== 'undefined') {
  const PURGE_KEY = 'inksuite-wc-purge-2026-05-18';
  if (!window.localStorage.getItem(PURGE_KEY)) {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith('wc@2:') || k.startsWith('wagmi.') || k === 'WALLETCONNECT_DEEPLINK_CHOICE')
      .forEach((k) => window.localStorage.removeItem(k));
    window.localStorage.setItem(PURGE_KEY, '1');
  }
}

const queryClient = new QueryClient();

const inkTheme = darkTheme({
  accentColor: '#7538F5',
  accentColorForeground: 'white',
  borderRadius: 'medium',
});

// Override specific colors for Ink branding
inkTheme.colors.modalBackground = '#1a1030';
inkTheme.colors.profileForeground = '#1a1030';

export function InkWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={walletConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={inkTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
