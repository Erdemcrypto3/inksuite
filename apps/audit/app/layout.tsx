import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
export const metadata: Metadata = {
  title: 'InkAudit — Web Security Scanner',
  description: 'Scan any website for security headers, HTTPS, and best practices. Get a security grade instantly.',
  openGraph: { title: 'InkAudit — Security Scanner', description: 'Web security audit tool.', url: 'https://audit.inksuite.xyz', siteName: 'Ink Suite', type: 'website' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={jakarta.variable}><body className="font-sans">{children}</body></html>);
}
