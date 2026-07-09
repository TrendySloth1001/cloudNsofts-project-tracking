'use client';

import type { DocSummary } from '@cnsofts/shared';
import { Icon, IconButton, Spinner } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './project-docs.module.css';

export interface DocsSidebarProps {
  docs: DocSummary[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  /** Editors only: show the "new page" control. */
  canCreate: boolean;
  creating: boolean;
}

export function DocsSidebar({
  docs,
  activeId,
  loading,
  onSelect,
  onCreate,
  canCreate,
  creating,
}: DocsSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHead}>
        <span className={styles.sidebarTitle}>Docs</span>
        {canCreate && (
          <IconButton
            icon="add"
            label="New page"
            variant="ghost"
            size="sm"
            onClick={onCreate}
            disabled={creating}
          />
        )}
      </div>

      <div className={styles.docList}>
        {loading && docs.length === 0 && (
          <div className={styles.sidebarState}>
            <Spinner size={18} />
          </div>
        )}
        {!loading && docs.length === 0 && (
          <span className={styles.sidebarEmpty}>No pages yet</span>
        )}

        {docs.map((d) => (
          <button
            key={d.id}
            type="button"
            className={cx(
              styles.docItem,
              d.id === activeId && styles.docItemActive,
            )}
            onClick={() => onSelect(d.id)}
          >
            <Icon name="doc" size={15} className={styles.docItemIcon} />
            <span className={styles.docName}>{d.title}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
