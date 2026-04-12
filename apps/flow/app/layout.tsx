import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
export const metadata: Metadata = {
  title: 'InkFlow — Bridge & DEX Analytics on Ink',
  description: 'Track bridge inflows/outflows and DEX trading activity on Ink chain. Unique wallets, volume, top tokens.',
  openGraph: { title: 'InkFlow — Ink Analytics', description: 'Bridge and DEX analytics for Ink chain.', url: 'https://flow.inksuite.xyz', siteName: 'Ink Suite', type: 'website' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={jakarta.variable}><body className="font-sans">{children}</body></html>);
}
