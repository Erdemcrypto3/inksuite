'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { walletConfig } from './config';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const inkTheme = darkTheme({
  accentColor: '#7538F5',
  accentColorForeground: 'white',
  borderRadius: 'medium',
});

// Override specific colors for Ink branding
inkTheme.colors.modalBackground = '#1a1030';
inkTheme.colors.profileForeground = '#1a1030';

// One-time purge of stale WC v2 + wagmi localStorage keyed to the dead 2026-05-18 Reown projectId.
// Disconnect was failing because the session metadata pointed at a relay that no longer accepts the old ID.
const WC_PURGE_KEY = 'inksuite-wc-purge-2026-05-18';

export function InkWalletProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(WC_PURGE_KEY)) return;
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith('wc@2:') || k.startsWith('wagmi.') || k === 'WALLETCONNECT_DEEPLINK_CHOICE')
      .forEach((k) => window.localStorage.removeItem(k));
    window.localStorage.setItem(WC_PURGE_KEY, '1');
  }, []);

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
