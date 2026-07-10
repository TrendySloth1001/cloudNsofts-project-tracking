'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { resolveAssetUrl } from '@/lib/asset-url';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icon';
import styles from './image-lightbox.module.css';

export interface LightboxImage {
  src: string;
  alt?: string;
}

export interface ImageLightboxProps {
  images: LightboxImage[];
  /** Index of the open image; `null` closes the lightbox. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.5;

/**
 * Fullscreen, zoomable/pannable image viewer. Opens over a dark scrim; supports
 * wheel + button zoom, drag-to-pan when zoomed, double-click to toggle zoom,
 * prev/next across a set, download, and keyboard control (Esc, ←/→, +/−, 0).
 * Controlled: the caller owns `index` (null = closed).
 */
export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const open = index !== null;
  const count = images.length;
  const current = open ? images[index] : undefined;

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Reset zoom/pan whenever the shown image changes.
  useEffect(() => {
    resetView();
  }, [index, resetView]);

  const go = useCallback(
    (delta: number) => {
      if (count < 2 || index === null) return;
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta));
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Keyboard + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP);
      else if (e.key === '-') zoomBy(-ZOOM_STEP);
      else if (e.key === '0') resetView();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, go, zoomBy, resetView]);

  // Wheel-to-zoom. React registers onWheel passively, so preventDefault() would
  // be rejected (and spam the console); attach a non-passive native listener.
  useEffect(() => {
    const el = stageRef.current;
    if (!open || !el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, zoomBy]);

  if (!mounted || !open || !current) return null;

  function onPointerDown(e: ReactPointerEvent<HTMLImageElement>) {
    if (zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLImageElement>) {
    if (!drag.current) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    });
  }

  function endDrag(e: ReactPointerEvent<HTMLImageElement>) {
    if (drag.current) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  function toggleZoom() {
    if (zoom > 1) resetView();
    else setZoom(2.5);
  }

  const resolved = resolveAssetUrl(current.src);

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt || 'Image viewer'}
      onMouseDown={onClose}
    >
      <div className={styles.toolbar} onMouseDown={(e) => e.stopPropagation()}>
        {count > 1 && (
          <span className={styles.counter}>
            {index + 1} / {count}
          </span>
        )}
        <div className={styles.toolbarActions}>
          <ToolBtn
            icon="zoomOut"
            label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => zoomBy(-ZOOM_STEP)}
          />
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <ToolBtn
            icon="zoomIn"
            label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => zoomBy(ZOOM_STEP)}
          />
          <a
            className={styles.toolBtn}
            href={resolved}
            target="_blank"
            rel="noopener noreferrer"
            download
            aria-label="Open image in a new tab"
            title="Open in a new tab"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Icon name="download" size={18} />
          </a>
          <ToolBtn icon="close" label="Close" onClick={onClose} />
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className={cx(styles.nav, styles.navPrev)}
            aria-label="Previous image"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => go(-1)}
          >
            <Icon name="chevronLeft" size={26} />
          </button>
          <button
            type="button"
            className={cx(styles.nav, styles.navNext)}
            aria-label="Next image"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => go(1)}
          >
            <Icon name="chevronRight" size={26} />
          </button>
        </>
      )}

      <div className={styles.stage} ref={stageRef}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.image}
          src={resolved}
          alt={current.alt || ''}
          draggable={false}
          data-zoomed={zoom > 1 ? '' : undefined}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? 'grab' : 'zoom-in',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={toggleZoom}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>

      {current.alt && (
        <div
          className={styles.caption}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {current.alt}
        </div>
      )}
    </div>,
    document.body,
  );
}

/** A light-on-dark toolbar button for the lightbox chrome. */
function ToolBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.toolBtn}
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
