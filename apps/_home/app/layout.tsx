import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'Ink Suite — Utilities for Kraken\'s Ink L2',
  description:
    'A portfolio of mini utilities for users and developers building on Ink, Kraken\'s Ethereum Layer 2.',
  openGraph: {
    title: 'Ink Suite',
    description: 'Mini utilities for Kraken\'s Ink L2.',
    url: 'https://inksuite.xyz',
    siteName: 'Ink Suite',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ink Suite',
    description: 'Mini utilities for Kraken\'s Ink L2.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
