import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
export const metadata: Metadata = {
  title: 'Test Yourself — Science & Math Quiz on Ink Suite',
  description: 'Geometry, Math, Physics, Biology, Chemistry — 5 questions per round, earn points, unlock achievements.',
  openGraph: { title: 'Test Yourself', description: 'Science & Math Quiz on Ink Suite.', url: 'https://quiz.inksuite.xyz', siteName: 'Ink Suite', type: 'website' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={jakarta.variable}><body className="font-sans">{children}</body></html>);
}
