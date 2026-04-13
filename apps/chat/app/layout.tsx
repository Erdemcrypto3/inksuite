import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
export const metadata: Metadata = {
  title: 'InkChat — On-chain Messaging on Ink',
  description: 'Send wallet-to-wallet messages on Ink chain. Every message is a transaction. Permanent, verifiable, on-chain.',
  openGraph: { title: 'InkChat — On-chain Messages', description: 'Wallet-to-wallet messaging on Ink.', url: 'https://chat.inksuite.xyz', siteName: 'Ink Suite', type: 'website' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={jakarta.variable}><body className="font-sans">{children}</body></html>);
}
