import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'OrderFlow | Limit Order Book & Microstructure Simulator',
  description:
    'Simulate a live limit order book with price-time priority matching and real-time microstructure analytics (Spread, Microprice, OBI, OFI).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-[#080c14] text-slate-100 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
