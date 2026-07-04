/**
 * Client-side persistence for the chosen avatar, keyed by user id. SSR-safe.
 *
 * NOTE: this is a stop-gap until the backend stores the avatar on the user
 * record. When that exists, read/write it through the API instead.
 */
const key = (userId: string) => `cnsofts.avatar.${userId}`;

export const profileStorage = {
  getAvatar(userId: string): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key(userId));
  },
  setAvatar(userId: string, avatarId: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key(userId), avatarId);
  },
};
