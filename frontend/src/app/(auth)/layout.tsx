import styles from './auth-layout.module.css';

/** Simple centered layout for authentication screens. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={styles.wrap}>{children}</div>;
}
