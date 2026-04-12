import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'InkPress — Decentralized Blog on Ink',
  description: 'Publish articles as NFTs on Ink chain. Content stored on Walrus (decentralized storage). Fully on-chain blog platform.',
  openGraph: {
    title: 'InkPress — Decentralized Blog on Ink',
    description: 'On-chain blog platform: publish, read, and collect articles as NFTs.',
    url: 'https://inkpress.inksuite.xyz',
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
