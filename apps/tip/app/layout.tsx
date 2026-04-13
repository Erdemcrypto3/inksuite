import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
export const metadata: Metadata = {
  title: 'InkTip — On-chain Tips on Ink',
  description: 'Send ETH tips to any Ink wallet. Share your tip link. On-chain, transparent, no middleman.',
  openGraph: { title: 'InkTip — Send Tips on Ink', description: 'On-chain tipping on Ink chain.', url: 'https://tip.inksuite.xyz', siteName: 'Ink Suite', type: 'website' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={jakarta.variable}><body className="font-sans">{children}</body></html>);
}
