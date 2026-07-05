'use client';

import { useState } from 'react';
import type { CreatedApiToken } from '@cnsofts/shared';
import {
  Alert,
  Button,
  Field,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
  useConfirm,
} from '@/components/ui';
import { config } from '@/lib/config';
import { ApiRequestError } from '@/lib/api-client';
import { useAgentTokens } from '../use-agent-tokens';
import styles from './connect-agent-panel.module.css';

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
function fmt(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : '—';
}

/** Small copy-to-clipboard control with a transient "Copied" state. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      leftIcon={copied ? 'check' : 'copy'}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function ConnectAgentPanel() {
  const { tokens, loading, create, revoke } = useAgentTokens();
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The plaintext token is returned once, on creation — held in memory only.
  const [fresh, setFresh] = useState<CreatedApiToken | null>(null);

  const connectCommand = (token: string): string =>
    [
      'claude mcp add cnsofts \\',
      `  -e CNSOFTS_API_URL=${config.apiUrl} \\`,
      `  -e CNSOFTS_TOKEN=${token} \\`,
      '  -- npx -y @cnsofts/mcp',
    ].join('\n');

  async function onCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await create({
        name: trimmed,
        ...(expiresIn ? { expiresInDays: Number(expiresIn) } : {}),
      });
      setFresh(result);
      setName('');
      setExpiresIn('');
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not create the token. Please try again.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(id: string, tokenName: string) {
    const ok = await confirm({
      title: 'Revoke token?',
      message: (
        <>
          Revoke <strong>{tokenName}</strong>? Any agent using it will lose
          access immediately.
        </>
      ),
      confirmLabel: 'Revoke',
      tone: 'danger',
    });
    if (!ok) return;
    await revoke(id);
    if (fresh?.apiToken.id === id) setFresh(null);
  }

  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <span className={styles.headIcon}>
          <Icon name="ai" size={26} tone="brand" />
        </span>
        <div>
          <h1 className={styles.title}>Connect a coding agent</h1>
          <p className={styles.subtitle}>
            Generate a personal token so an AI coding agent (like Claude Code)
            can manage your boards and discussions on your behalf. The agent
            acts as you — it can only touch what you can.
          </p>
        </div>
      </header>

      {/* Freshly-minted token — shown once. */}
      {fresh && (
        <Alert variant="success" title="Token created — copy it now">
          <p className={styles.freshNote}>
            This is the only time the full token is shown. Store it somewhere
            safe or paste it straight into your agent.
          </p>
          <div className={styles.tokenRow}>
            <code className={styles.tokenValue}>{fresh.token}</code>
            <CopyButton value={fresh.token} label="Copy token" />
          </div>
          <p className={styles.cmdLabel}>Or run this to connect Claude Code:</p>
          <div className={styles.cmdRow}>
            <pre className={styles.cmd}>{connectCommand(fresh.token)}</pre>
            <CopyButton value={connectCommand(fresh.token)} label="Copy command" />
          </div>
        </Alert>
      )}

      {/* Create form */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Generate a token</h2>
        <div className={styles.form}>
          <Field label="Token name" hint="e.g. “Claude Code — laptop”">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My coding agent"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onCreate();
              }}
            />
          </Field>
          <Field label="Expiry">
            <Select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              options={EXPIRY_OPTIONS}
            />
          </Field>
          <Button
            leftIcon="add"
            onClick={() => void onCreate()}
            loading={creating}
            disabled={!name.trim()}
          >
            Generate token
          </Button>
        </div>
        {error && (
          <Alert variant="danger" className={styles.formError}>
            {error}
          </Alert>
        )}
      </section>

      {/* Existing tokens */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Active tokens</h2>
        {loading ? (
          <div className={styles.loading}>
            <Spinner size={20} />
          </div>
        ) : tokens.length === 0 ? (
          <p className={styles.empty}>
            No tokens yet. Generate one above to connect an agent.
          </p>
        ) : (
          <ul className={styles.tokenList}>
            {tokens.map((t) => (
              <li key={t.id} className={styles.tokenItem}>
                <span className={styles.tokenIcon}>
                  <Icon name="link" size={16} tone="brand" />
                </span>
                <div className={styles.tokenMain}>
                  <span className={styles.tokenName}>{t.name}</span>
                  <span className={styles.tokenMeta}>
                    Created {fmt(t.createdAt)} · Last used{' '}
                    {t.lastUsedAt ? fmt(t.lastUsedAt) : 'never'} ·{' '}
                    {t.expiresAt ? `Expires ${fmt(t.expiresAt)}` : 'No expiry'}
                  </span>
                </div>
                <IconButton
                  icon="delete"
                  label={`Revoke ${t.name}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => void onRevoke(t.id, t.name)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Setup reference */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>How to connect</h2>
        <ol className={styles.steps}>
          <li>Generate a token above and copy it.</li>
          <li>
            In your terminal, run the connect command (or add the snippet to
            your MCP config), pasting the token in place of{' '}
            <code className={styles.inline}>&lt;YOUR_TOKEN&gt;</code>.
          </li>
          <li>
            Your agent can now create features & tasks, move and assign them,
            and post channel messages — as you.
          </li>
        </ol>
        <pre className={styles.cmd}>{connectCommand('<YOUR_TOKEN>')}</pre>
      </section>
    </div>
  );
}
