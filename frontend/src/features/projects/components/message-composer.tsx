'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import { Button, IconButton, Input, type IconName } from '@/components/ui';
import styles from './message-composer.module.css';

// tiptap-markdown adds a `markdown` bucket to the editor storage but ships no
// module augmentation for it, so declare it here to keep `getMarkdown()` typed.
declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

/** Imperative surface the parent uses to clear/focus the editor after send. */
export interface MessageComposerHandle {
  clear: () => void;
  focus: () => void;
}

export interface MessageComposerProps {
  placeholder: string;
  disabled?: boolean;
  /** Fired on every edit with the current value serialized to markdown. */
  onChange: (markdown: string) => void;
  /** Fired on Enter (without Shift) — the parent decides whether to send. */
  onSubmit: () => void;
  /** Rendered inside the input box, before the editor (e.g. attach button). */
  leftSlot?: ReactNode;
  /** Rendered inside the input box, after the editor (e.g. schedule/send). */
  rightSlot?: ReactNode;
}

interface FormatButton {
  icon: IconName;
  label: string;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
}

// Every command maps to a mark/node that the markdown serializer round-trips,
// so what the toolbar toggles is exactly what gets stored as markdown.
const FORMAT_BUTTONS: FormatButton[] = [
  {
    icon: 'bold',
    label: 'Bold',
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    icon: 'italic',
    label: 'Italic',
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    icon: 'strikethrough',
    label: 'Strikethrough',
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    icon: 'code',
    label: 'Inline code',
    isActive: (e) => e.isActive('code'),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    icon: 'codeBlock',
    label: 'Code block',
    isActive: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    icon: 'listBullet',
    label: 'Bulleted list',
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    icon: 'quote',
    label: 'Quote',
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
];

export const MessageComposer = forwardRef<
  MessageComposerHandle,
  MessageComposerProps
>(function MessageComposer(
  { placeholder, disabled, onChange, onSubmit, leftSlot, rightSlot },
  ref,
) {
  // Refs keep the editor's stable callbacks pointing at the latest props
  // without recreating the editor on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: false,
        transformPastedText: true,
      }),
    ],
    editorProps: {
      attributes: { class: styles.prose },
      handleKeyDown: (view, event) => {
        // Enter sends; Shift+Enter inserts a line break. Inside a code block,
        // Enter must add a newline instead — let TipTap handle it.
        if (event.key === 'Enter' && !event.shiftKey) {
          const inCodeBlock =
            view.state.selection.$head.parent.type.name === 'codeBlock';
          if (!inCodeBlock) {
            event.preventDefault();
            onSubmitRef.current();
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current(ed.storage.markdown.getMarkdown());
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      clear: () => editor?.commands.clearContent(),
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  function applyLink() {
    const url = linkUrl.trim();
    setLinkOpen(false);
    setLinkUrl('');
    if (!editor) return;
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const chain = editor.chain().focus().extendMarkRange('link');
    if (editor.state.selection.empty) {
      // No selection: insert the URL as its own linked text.
      chain
        .insertContent(url)
        .setTextSelection({
          from: editor.state.selection.from,
          to: editor.state.selection.from + url.length,
        })
        .setLink({ href: url })
        .run();
    } else {
      chain.setLink({ href: url }).run();
    }
  }

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    setLinkUrl('');
    setLinkOpen((o) => !o);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {editor &&
          FORMAT_BUTTONS.map((b) => (
            <IconButton
              key={b.label}
              icon={b.icon}
              label={b.label}
              variant={b.isActive(editor) ? 'subtle' : 'ghost'}
              size="sm"
              disabled={disabled}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => b.run(editor)}
            />
          ))}
        <div className={styles.linkGroup}>
          <IconButton
            icon="link"
            label="Link"
            variant={editor?.isActive('link') ? 'subtle' : 'ghost'}
            size="sm"
            disabled={disabled}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleLink}
          />
          {linkOpen && (
            <div className={styles.linkPop}>
              <Input
                autoFocus
                inputSize="sm"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === 'Escape') {
                    setLinkOpen(false);
                  }
                }}
              />
              <Button size="sm" onClick={applyLink}>
                Add
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className={styles.box}>
        {leftSlot}
        <EditorContent editor={editor} className={styles.host} />
        {rightSlot}
      </div>
    </div>
  );
});
