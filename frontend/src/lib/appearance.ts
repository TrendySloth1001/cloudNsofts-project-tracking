import type { AppDensity, AppTheme } from '@cnsofts/shared';

/**
 * Reflect the user's appearance preferences onto the document root as data
 * attributes. `styles/tokens.css` remaps its semantic tokens under
 * `:root[data-theme='dark']` / `:root[data-density='compact']`, so setting
 * these flips the whole UI without any per-component logic.
 *
 * The source of truth for these values is the DB (UserProfile); this only
 * mirrors them to the DOM. No-op on the server (no `document`).
 */
export function applyAppearance(theme: AppTheme, density: AppDensity): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.density = density;
}
