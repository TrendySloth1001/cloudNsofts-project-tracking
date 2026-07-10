import { config } from './config';

/**
 * Resolve an asset src for rendering. Uploaded images are stored as relative
 * `/api/...` paths so the content stays portable across hosts; resolve those
 * against the API host at render time. Absolute (http/https) or data URLs pass
 * through untouched. Single source of truth for both the Markdown renderer and
 * the image lightbox so they always agree on the final URL.
 */
export function resolveAssetUrl(src: string | undefined): string | undefined {
  if (typeof src !== 'string') return src;
  return src.startsWith('/api/') ? `${config.apiUrl}${src}` : src;
}
