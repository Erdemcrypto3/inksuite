import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
export const metadata: Metadata = {
  title: 'InkSight — Community Insight Platform on Ink',
  description: 'Projects pay to ask. You earn points for answering. The community insight layer for Ink L2.',
  openGraph: { title: 'InkSight — Community Insight Platform', description: 'Earn points for sharing your opinion on Ink L2.', url: 'https://inksight.inksuite.xyz', siteName: 'Ink Suite', type: 'website' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={jakarta.variable}><body className="font-sans">{children}</body></html>);
}
