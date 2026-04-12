'use client';

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
