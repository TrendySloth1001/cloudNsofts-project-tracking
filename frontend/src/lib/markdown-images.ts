/** An image embedded in a markdown body: its (unresolved) src + optional alt. */
export interface MarkdownImage {
  src: string;
  alt?: string;
}

// Matches `![alt](url)` and `![alt](url "title")`, capturing alt and url.
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

/**
 * Pull embedded images (in document order) out of a markdown body. Shared by
 * the doc reader and the discussion view so their image lightboxes agree on
 * what an image list is.
 */
export function extractMarkdownImages(markdown: string): MarkdownImage[] {
  const out: MarkdownImage[] = [];
  for (const m of markdown.matchAll(IMAGE_RE)) {
    out.push({ src: m[2], alt: m[1] || undefined });
  }
  return out;
}
