import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.text}>This page doesn’t exist or may have moved.</p>
      <Link href="/" className={styles.link}>
        Back to workspace
      </Link>
    </div>
  );
}
