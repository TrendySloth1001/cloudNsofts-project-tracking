import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

/**
 * Plus Jakarta Sans — a soft, geometric humanist sans. Loaded as a variable
 * font and exposed via the `--font-plus-jakarta` CSS variable (see tokens.css).
 */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  title: 'CloudNSofts',
  description: 'CloudNSofts workspace.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
