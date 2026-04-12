import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'Ink Fantasy Premier League — Build your dream squad',
  description: 'Pick your 15-player Premier League squad with a £100M budget. Track points, manage transfers. Part of Ink Suite.',
  openGraph: {
    title: 'Ink Fantasy PL',
    description: 'Fantasy Premier League on Ink Suite.',
    url: 'https://fantasy.inksuite.xyz',
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
