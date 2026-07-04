const SIZE = 36;

/**
 * Curated palette for generated avatars. This is avatar *data* (the illustration
 * needs concrete colors baked into the SVG), not app styling — app styling still
 * comes from tokens.
 */
const AVATAR_COLORS = [
  '#6c5ce7',
  '#15b79e',
  '#f79009',
  '#2e90fa',
  '#12b76a',
  '#f26a1b',
  '#ee5fa7',
  '#7a5af8',
];

function hashCode(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDigit(n: number, nth: number): number {
  return Math.floor((n / Math.pow(10, nth)) % 10);
}
function getBoolean(n: number, nth: number): boolean {
  return getDigit(n, nth) % 2 === 0;
}
function getUnit(n: number, range: number, index?: number): number {
  const value = n % range;
  if (index !== undefined && getDigit(n, index) % 2 === 0) return -value;
  return value;
}
function pickColor(n: number): string {
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}
function faceColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#1d2939' : '#ffffff';
}

export interface IllustratedAvatarProps {
  /** Stable seed (e.g. the user id) — same seed always yields the same avatar. */
  seed: string;
  /** Rendered diameter in px. */
  size?: number;
  /** Accessible label (e.g. the user's name). */
  title?: string;
  className?: string;
}

/**
 * Deterministic, generative illustrated avatar. Assign a stable seed (the user's
 * id) at creation and every profile gets its own unique illustrated face — no
 * assets, no network.
 */
export function IllustratedAvatar({
  seed,
  size = 36,
  title,
  className,
}: IllustratedAvatarProps) {
  const n = hashCode(seed);

  const wrapperColor = pickColor(n);
  const backgroundColor = pickColor(n + 13);
  const faceColor = faceColorFor(wrapperColor);

  const preTX = getUnit(n, 10, 1);
  const wrapperTX = preTX < 5 ? preTX + SIZE / 9 : preTX;
  const preTY = getUnit(n, 10, 2);
  const wrapperTY = preTY < 5 ? preTY + SIZE / 9 : preTY;
  const wrapperRotate = getUnit(n, 360);
  const wrapperScale = 1 + getUnit(n, Math.floor(SIZE / 12)) / 10;
  const isMouthOpen = getBoolean(n, 2);
  const isCircle = getBoolean(n, 1);
  const eyeSpread = getUnit(n, 5);
  const mouthSpread = getUnit(n, 3);
  const faceRotate = getUnit(n, 10, 3);
  const faceTX = wrapperTX > SIZE / 6 ? wrapperTX / 2 : getUnit(n, 8, 1);
  const faceTY = wrapperTY > SIZE / 6 ? wrapperTY / 2 : getUnit(n, 7, 2);

  const maskId = `illus-avatar-${n}`;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width={SIZE}
        height={SIZE}
      >
        <rect width={SIZE} height={SIZE} rx={SIZE * 2} fill="#fff" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <rect width={SIZE} height={SIZE} fill={backgroundColor} />
        <rect
          x="0"
          y="0"
          width={SIZE}
          height={SIZE}
          fill={wrapperColor}
          rx={isCircle ? SIZE : SIZE / 6}
          transform={`translate(${wrapperTX} ${wrapperTY}) rotate(${wrapperRotate} ${SIZE / 2} ${SIZE / 2}) scale(${wrapperScale})`}
        />
        <g
          transform={`translate(${faceTX} ${faceTY}) rotate(${faceRotate} ${SIZE / 2} ${SIZE / 2})`}
        >
          {isMouthOpen ? (
            <path
              d={`M15 ${19 + mouthSpread}c2 1 4 1 6 0`}
              stroke={faceColor}
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <path
              d={`M13,${19 + mouthSpread} a1,0.75 0 0,0 10,0`}
              fill={faceColor}
            />
          )}
          <rect
            x={14 - eyeSpread}
            y={14}
            width="1.5"
            height="2"
            rx="1"
            fill={faceColor}
          />
          <rect
            x={20 + eyeSpread}
            y={14}
            width="1.5"
            height="2"
            rx="1"
            fill={faceColor}
          />
        </g>
      </g>
    </svg>
  );
}
