import type { ReactNode } from 'react';
import styles from './legal-doc.module.css';

export interface LegalDocProps {
  title: string;
  /** Human-readable effective/last-updated date. */
  updated: string;
  /** One-line summary shown under the title. */
  intro: string;
  children: ReactNode;
}

/** Presentational wrapper for a legal document: title, effective date, a plain-
 *  language disclaimer, and the prose body (styled via the module). */
export function LegalDoc({ title, updated, intro, children }: LegalDocProps) {
  return (
    <article className={styles.doc}>
      <header className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.updated}>Last updated: {updated}</p>
        <p className={styles.intro}>{intro}</p>
      </header>
      <div className={styles.body}>{children}</div>
    </article>
  );
}

/** A titled section within a legal document. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{heading}</h2>
      {children}
    </section>
  );
}
