/** Visual identity helpers for a project (monogram + tint), derived from the
 *  project so each one is recognizable at a glance. Tints mirror token values. */
export interface Tint {
  bg: string;
  fg: string;
}

const TINTS: Tint[] = [
  { bg: '#f2f0fe', fg: '#4a3cb0' }, // violet
  { bg: '#d3f4ee', fg: '#107569' }, // teal
  { bg: '#fef0c7', fg: '#b54708' }, // amber
  { bg: '#d1e9ff', fg: '#175cd3' }, // blue
  { bg: '#d1fadf', fg: '#027a48' }, // green
  { bg: '#fee4e2', fg: '#b42318' }, // red
  { bg: '#fce7f6', fg: '#c11574' }, // pink
];

export function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function projectTint(seed: string): Tint {
  return TINTS[hash(seed) % TINTS.length];
}
