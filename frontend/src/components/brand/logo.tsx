import { cx } from '@/lib/cx';
import styles from './logo.module.css';

/** Pixel-cloud mark (CloudNSofts concept #2). Dark cells inherit `currentColor`;
 *  accent cells use the brand orange token. */
const DARK_CELLS: ReadonlyArray<readonly [number, number]> = [
  [64, 34], [78, 34], [92, 34],
  [50, 48], [64, 48], [92, 48], [106, 48],
  [36, 62], [50, 62], [78, 62], [92, 62],
  [50, 76], [78, 76], [92, 76], [106, 76],
];
const BRAND_CELLS: ReadonlyArray<readonly [number, number]> = [
  [78, 48], [120, 62], [106, 62], [64, 76],
];

const RATIO = 114 / 66; // viewBox aspect

export interface LogoMarkProps {
  /** Rendered height in px. Width follows the mark's aspect ratio. */
  size?: number;
  className?: string;
  title?: string;
}

export function LogoMark({
  size = 24,
  className,
  title = 'CloudNSofts',
}: LogoMarkProps) {
  return (
    <svg
      width={Math.round(size * RATIO)}
      height={size}
      viewBox="28 28 114 66"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="currentColor">
        {DARK_CELLS.map(([x, y]) => (
          <rect key={`d${x}-${y}`} x={x} y={y} width="12" height="12" rx="2" />
        ))}
      </g>
      <g fill="var(--brand)">
        {BRAND_CELLS.map(([x, y]) => (
          <rect key={`b${x}-${y}`} x={x} y={y} width="12" height="12" rx="2" />
        ))}
      </g>
    </svg>
  );
}

export type LogoSize = 'sm' | 'md' | 'lg';

export interface LogoProps {
  size?: LogoSize;
  /** Hide the "cloudnsofts" wordmark and show just the mark. */
  markOnly?: boolean;
  className?: string;
}

const MARK_HEIGHT: Record<LogoSize, number> = { sm: 18, md: 24, lg: 32 };

/** Full brand lockup: pixel-cloud mark + "cloudnsofts" wordmark. */
export function Logo({ size = 'md', markOnly = false, className }: LogoProps) {
  return (
    <span className={cx(styles.logo, styles[size], className)}>
      <LogoMark size={MARK_HEIGHT[size]} className={styles.mark} />
      {!markOnly && (
        <span className={styles.wordmark}>
          cloud<span className={styles.accent}>n</span>softs
        </span>
      )}
    </span>
  );
}
