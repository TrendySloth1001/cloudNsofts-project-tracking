import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import { cx } from '@/lib/cx';
// Light (white-background) syntax colors for fenced code blocks (`.hljs` spans).
import 'highlight.js/styles/github.css';
import styles from './markdown.module.css';

export interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Render user/agent message text as GitHub-flavored Markdown (bold, italic,
 * strikethrough, lists, code, blockquotes, links, tables). Single newlines are
 * kept as line breaks (remark-breaks) and fenced code blocks are syntax-
 * highlighted (rehype-highlight). No raw HTML is allowed — react-markdown
 * ignores it by default — so message content can't inject markup. Links open
 * safely in a new tab. Styled via design tokens.
 */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cx(styles.markdown, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
