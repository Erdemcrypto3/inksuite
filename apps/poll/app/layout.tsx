import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
export const metadata: Metadata = {
  title: 'InkPoll — On-chain Polls on Ink',
  description: 'Create and vote on polls recorded on Ink chain. Every vote is a transaction. Transparent, verifiable, on-chain.',
  openGraph: { title: 'InkPoll — On-chain Polls', description: 'On-chain polling on Ink chain.', url: 'https://poll.inksuite.xyz', siteName: 'Ink Suite', type: 'website' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={jakarta.variable}><body className="font-sans">{children}</body></html>);
}
