import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import { resolveAssetUrl } from '@/lib/asset-url';
import { cx } from '@/lib/cx';
// Light (white-background) syntax colors for fenced code blocks (`.hljs` spans).
import 'highlight.js/styles/github.css';
import styles from './markdown.module.css';

export interface MarkdownProps {
  children: string;
  className?: string;
  /**
   * When provided, rendered images become clickable and call this with their
   * original (unresolved) src — e.g. to open a fullscreen lightbox. Omit to
   * render plain, non-interactive images.
   */
  onImageClick?: (src: string) => void;
}

/**
 * Render user/agent message text as GitHub-flavored Markdown (bold, italic,
 * strikethrough, lists, code, blockquotes, links, tables). Single newlines are
 * kept as line breaks (remark-breaks) and fenced code blocks are syntax-
 * highlighted (rehype-highlight). No raw HTML is allowed — react-markdown
 * ignores it by default — so message content can't inject markup. Links open
 * safely in a new tab. Styled via design tokens.
 */
export function Markdown({ children, className, onImageClick }: MarkdownProps) {
  return (
    <div className={cx(styles.markdown, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          // Uploaded images are stored as relative `/api/images/:id` paths so
          // the content stays portable; resolve them against the API host at
          // render time (external absolute URLs pass through untouched). When a
          // click handler is supplied, images open a fullscreen viewer.
          img: ({ node: _node, src, alt, ...props }) => {
            const clickable = onImageClick && typeof src === 'string';
            // eslint-disable-next-line @next/next/no-img-element
            return (
              <img
                {...props}
                src={resolveAssetUrl(typeof src === 'string' ? src : undefined)}
                alt={alt ?? ''}
                loading="lazy"
                className={clickable ? styles.clickable : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={
                  clickable ? () => onImageClick(src as string) : undefined
                }
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onImageClick(src as string);
                        }
                      }
                    : undefined
                }
              />
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
