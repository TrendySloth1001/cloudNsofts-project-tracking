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

/**
 * Set the initial theme from the OS appearance before first paint, so pre-auth
 * pages (login/signup/legal) render dark on a dark system with no flash. Reads
 * only the `prefers-color-scheme` media query — nothing is stored client-side.
 * Once signed in, the app layout overrides this with the user's saved (DB)
 * preference; `styles/tokens.css` keys its dark palette off `data-theme`.
 */
const THEME_INIT = `(function(){try{var d=document.documentElement;if(!d.dataset.theme){d.dataset.theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
    </html>
  );
}
