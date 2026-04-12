import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

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
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
