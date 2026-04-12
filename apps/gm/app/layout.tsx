import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'GM Widget — Say gm on Ink',
  description: 'Send a daily on-chain gm transaction on Ink. Track your streak and climb the calendar. Part of Ink Suite.',
  openGraph: {
    title: 'GM Widget — Ink Suite',
    description: 'Daily on-chain gm with streak tracking on Ink.',
    url: 'https://gm.inksuite.xyz',
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
