import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
export const metadata: Metadata = {
  title: 'Wallet Health — Check Approvals on Ink',
  description: 'Review token approvals granted by any Ink wallet. Spot risky contracts and revoke them via Revoke.cash.',
  openGraph: { title: 'Wallet Health — Ink Suite', description: 'Check wallet approvals on Ink chain.', url: 'https://health.inksuite.xyz', siteName: 'Ink Suite', type: 'website' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
