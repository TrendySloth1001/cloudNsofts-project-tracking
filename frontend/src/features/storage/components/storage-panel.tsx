'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StorageAuditReport } from '@cnsofts/shared';
import {
  Button,
  Icon,
  Spinner,
  useConfirm,
} from '@/components/ui';
import { ApiRequestError } from '@/lib/api-client';
import { resolveAssetUrl } from '@/lib/asset-url';
import { storageApi } from '../storage.api';
import styles from './storage-panel.module.css';

/** Human-readable byte size (KB/MB), matching the app's compact number style. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Platform-admin storage reconciliation: lists images no content references
 * anymore (plus any dangling blobs) and reclaims them in one click. This is the
 * safe way to clear failed/abandoned uploads — deletion is scoped to objects
 * with no owner, computed server-side.
 */
export function StoragePanel() {
  const confirm = useConfirm();
  const [report, setReport] = useState<StorageAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reclaimed, setReclaimed] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await storageApi.audit());
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not load the storage report.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function purge() {
    if (!report || report.orphanCount === 0 || purging) return;
    const ok = await confirm({
      title: 'Reclaim orphaned images?',
      message: (
        <>
          Permanently delete <strong>{report.orphanCount}</strong> orphaned
          item{report.orphanCount === 1 ? '' : 's'} (
          {formatBytes(report.orphanBytes)})? Only images that no page, message
          or comment references are removed. This can’t be undone.
        </>
      ),
      confirmLabel: 'Reclaim',
      tone: 'danger',
    });
    if (!ok) return;
    setPurging(true);
    setError(null);
    try {
      const result = await storageApi.purge();
      setReclaimed(result.purged);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not reclaim.',
      );
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          <Icon name="image" size={22} tone="brand" /> Storage
        </h1>
        <p className={styles.subtitle}>
          Reclaim images that no page, message or comment references anymore —
          for example failed or abandoned uploads. Platform admins only.
        </p>
      </header>

      {loading ? (
        <div className={styles.state}>
          <Spinner size={26} />
        </div>
      ) : error && !report ? (
        <div className={styles.state}>
          <p className={styles.errorText}>{error}</p>
          <Button variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : report ? (
        <>
          <div className={styles.stats}>
            <Stat label="Images stored" value={report.scanned.images} />
            <Stat label="Objects in bucket" value={report.scanned.objects} />
            <Stat
              label="Orphaned"
              value={report.orphanCount}
              tone={report.orphanCount > 0 ? 'warning' : 'ok'}
            />
            <Stat label="Reclaimable" value={formatBytes(report.orphanBytes)} />
          </div>

          {reclaimed !== null && (
            <div className={styles.success}>
              <Icon name="checkCircle" size={16} tone="success" />
              Reclaimed {reclaimed} item{reclaimed === 1 ? '' : 's'}.
            </div>
          )}
          {error && <p className={styles.errorText}>{error}</p>}

          {report.orphanCount === 0 ? (
            <div className={styles.empty}>
              <Icon name="checkCircle" size={28} tone="success" />
              <p className={styles.emptyTitle}>Nothing to reclaim</p>
              <p className={styles.emptyDesc}>
                Every stored image is referenced by live content.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.actions}>
                <Button
                  variant="danger"
                  leftIcon="delete"
                  loading={purging}
                  onClick={purge}
                >
                  Reclaim {report.orphanCount} item
                  {report.orphanCount === 1 ? '' : 's'} (
                  {formatBytes(report.orphanBytes)})
                </Button>
              </div>

              {report.orphanImages.length > 0 && (
                <div className={styles.grid}>
                  {report.orphanImages.map((img) => (
                    <figure key={img.id} className={styles.card}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.thumb}
                        src={resolveAssetUrl(img.url)}
                        alt=""
                        loading="lazy"
                      />
                      <figcaption className={styles.meta}>
                        <span className={styles.project}>
                          {img.projectName}
                        </span>
                        <span className={styles.sub}>
                          {formatBytes(img.size)}
                          {img.agentName ? (
                            <>
                              {' · '}
                              <Icon name="ai" size={11} /> {img.agentName}
                            </>
                          ) : (
                            ` · ${img.uploadedBy}`
                          )}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}

              {report.danglingObjects.length > 0 && (
                <div className={styles.dangling}>
                  <p className={styles.danglingTitle}>
                    Dangling objects (no database record)
                  </p>
                  {report.danglingObjects.map((obj) => (
                    <div key={obj.key} className={styles.danglingRow}>
                      <Icon name="warning" size={14} tone="warning" />
                      <span className={styles.danglingKey}>{obj.key}</span>
                      <span className={styles.danglingSize}>
                        {formatBytes(obj.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'ok' | 'warning';
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue} data-tone={tone}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
