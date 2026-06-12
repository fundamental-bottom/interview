import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Funda Transcripts',
  description: 'Meeting transcript platform take-home',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="site-title">
            Funda Transcripts
          </Link>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
