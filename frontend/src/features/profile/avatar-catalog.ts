/**
 * Bundled Open Peeps avatar illustrations (DiceBear, CC0 — no attribution
 * required). Assets live in public/avatars/peep_01.png … peep_25.png.
 *
 * Single source of truth for selectable avatars.
 */
export const AVATAR_COUNT = 25;

/** All selectable avatar ids, in display order. */
export const avatarCatalog: string[] = Array.from(
  { length: AVATAR_COUNT },
  (_, i) => `peep_${String(i + 1).padStart(2, '0')}`,
);

/** Public path for an avatar id. */
export function avatarAsset(id: string): string {
  return `/avatars/${id}.png`;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Stable "random" default for a user with no chosen avatar — derived from the
 * user id so every profile gets a consistent illustration without a DB write.
 */
export function defaultAvatarFor(seed: string): string {
  return avatarCatalog[hashSeed(seed) % avatarCatalog.length];
}

/** Whether [id] is a known bundled avatar. */
export function isKnownAvatar(id: string | null | undefined): id is string {
  return id != null && avatarCatalog.includes(id);
}
