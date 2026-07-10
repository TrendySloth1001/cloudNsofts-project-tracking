import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { LEGAL } from '@/features/legal/legal.config';
import styles from './legal-layout.module.css';

/** Public, unauthenticated layout for the legal pages (Terms, Privacy). */
export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label={LEGAL.productName}>
          <Logo size="sm" />
        </Link>
        <nav className={styles.nav}>
          <Link href="/terms" className={styles.navLink}>
            Terms
          </Link>
          <Link href="/privacy" className={styles.navLink}>
            Privacy
          </Link>
          <Link href="/login" className={styles.navLink}>
            Sign in
          </Link>
        </nav>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()} {LEGAL.legalEntity}. All rights reserved.
        </span>
        <span className={styles.footerLinks}>
          <Link href="/terms" className={styles.navLink}>
            Terms
          </Link>
          <Link href="/privacy" className={styles.navLink}>
            Privacy
          </Link>
        </span>
      </footer>
    </div>
  );
}
