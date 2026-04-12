import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'Ink Game Hub — Classic games on Ink Suite',
  description: 'Play Hangman, Minesweeper, Snake, Tetris and more. Track your high scores. Part of Ink Suite.',
  openGraph: {
    title: 'Ink Game Hub',
    description: 'Classic browser games on Ink Suite.',
    url: 'https://games.inksuite.xyz',
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
