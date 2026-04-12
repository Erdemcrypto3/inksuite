import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'InkMint — AI NFT Generator on Ink',
  description: 'Generate AI art from a text prompt and mint it as an NFT on Ink chain. 0.000777 ETH per mint.',
  openGraph: {
    title: 'InkMint — AI NFT Generator',
    description: 'AI-powered NFT minting on Ink chain.',
    url: 'https://mint.inksuite.xyz',
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
