import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ink Wallet Dashboard — Activity summary for any address',
  description:
    'Enter any Ink wallet to see total transactions, gas spent, unique contracts interacted with, and active period.',
  openGraph: {
    title: 'Ink Wallet Dashboard',
    description: 'Wallet activity summary for Ink L2.',
    url: 'https://wallet.inksuite.xyz',
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
