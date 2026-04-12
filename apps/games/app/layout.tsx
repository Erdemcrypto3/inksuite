import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
