import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ink Gas Tracker — Live gas prices on Ink L2',
  description: 'Real-time gas price, base fee, and recent history for Ink, Kraken\'s Ethereum Layer 2.',
  openGraph: {
    title: 'Ink Gas Tracker',
    description: 'Real-time gas price monitor for Ink L2.',
    url: 'https://gas.inksuite.xyz',
    siteName: 'Ink Suite',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
