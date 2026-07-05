'use client';

import { useState } from 'react';
import {
  USER_ROLE_LABELS,
  type AuthUser,
  type CreatedApiToken,
  type ApiTokenSummary,
} from '@cnsofts/shared';
import {
  Alert,
  Button,
  Field,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
  Tabs,
  useConfirm,
} from '@/components/ui';
import { config } from '@/lib/config';
import { ApiRequestError } from '@/lib/api-client';
import { useAgentTokens } from '../use-agent-tokens';
import { agentApi } from '../agent.api';
import styles from './connect-agent-panel.module.css';

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

const CONNECT_METHODS = [
  { value: 'cli', label: 'Claude Code', icon: 'terminal' as const },
  { value: 'json', label: 'MCP config', icon: 'code' as const },
  { value: 'env', label: 'Env vars', icon: 'key' as const },
];

const TOKEN_PLACEHOLDER = '<YOUR_TOKEN>';

/** Build the connect snippet for a given method + token. */
function snippetFor(method: string, token: string): string {
  const apiUrl = config.apiUrl;
  if (method === 'json') {
    return JSON.stringify(
      {
        mcpServers: {
          cnsofts: {
            command: 'npx',
            args: ['-y', '@cnsofts/mcp'],
            env: { CNSOFTS_API_URL: apiUrl, CNSOFTS_TOKEN: token },
          },
        },
      },
      null,
      2,
    );
  }
  if (method === 'env') {
    return `CNSOFTS_API_URL=${apiUrl}\nCNSOFTS_TOKEN=${token}`;
  }
  return [
    'claude mcp add cnsofts \\',
    `  -e CNSOFTS_API_URL=${apiUrl} \\`,
    `  -e CNSOFTS_TOKEN=${token} \\`,
    '  -- npx -y @cnsofts/mcp',
  ].join('\n');
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
function fmt(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : '—';
}

/** Compact relative time — "just now", "3h ago", "5d ago", else a date. */
function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return dateFmt.format(new Date(iso));
}

function isExpired(t: ApiTokenSummary): boolean {
  return t.expiresAt != null && new Date(t.expiresAt).getTime() < Date.now();
}

/** Days until expiry, flagged `soon` within a week. Null when no expiry/passed. */
function expiryInfo(iso: string | null): { text: string; soon: boolean } | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.ceil(diff / 86_400_000);
  return {
    text: days <= 1 ? 'Expires today' : `Expires in ${days}d`,
    soon: days <= 7,
  };
}

/** Copy-to-clipboard control with a transient "Copied" state. */
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

/** Tabbed connect snippets (CLI / MCP JSON / env) with per-snippet copy. */
function ConnectInstructions({ token }: { token: string }) {
  const [method, setMethod] = useState('cli');
  const snippet = snippetFor(method, token);
  return (
    <div className={styles.connect}>
      <Tabs
        variant="pill"
        items={CONNECT_METHODS}
        value={method}
        onValueChange={setMethod}
      />
      <div className={styles.cmdRow}>
        <pre className={styles.cmd}>{snippet}</pre>
        <CopyButton value={snippet} label="Copy" />
      </div>
    </div>
  );
}

/** Live token check — calls `/me` as the token and reports the principal. */
function VerifyButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');

  async function run() {
    setState('loading');
    try {
      const user: AuthUser = await agentApi.verify(token);
      setMsg(`Authenticated as ${user.name} · ${USER_ROLE_LABELS[user.role]}`);
      setState('ok');
    } catch (err) {
      setMsg(
        err instanceof ApiRequestError ? err.message : 'Verification failed.',
      );
      setState('err');
    }
  }

  return (
    <div className={styles.verify}>
      <Button
        variant="outline"
        size="sm"
        leftIcon="checkCircle"
        loading={state === 'loading'}
        onClick={() => void run()}
      >
        Test connection
      </Button>
      {state === 'ok' && (
        <span className={styles.verifyOk}>
          <Icon name="checkCircle" size={15} tone="success" /> {msg}
        </span>
      )}
      {state === 'err' && (
        <span className={styles.verifyErr}>
          <Icon name="alertCircle" size={15} tone="danger" /> {msg}
        </span>
      )}
    </div>
  );
}

export function ConnectAgentPanel() {
  const { tokens, loading, create, revoke } = useAgentTokens();
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  // The plaintext token is returned once, on creation — held in memory only.
  const [fresh, setFresh] = useState<CreatedApiToken | null>(null);

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
      setRevealed(false);
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

  const activeCount = tokens.filter((t) => !isExpired(t)).length;
  const maskedToken = fresh
    ? `${fresh.token.slice(0, 12)}${'•'.repeat(18)}${fresh.token.slice(-4)}`
    : '';

  return (
    <div className={styles.panel}>
      {/* Header */}
      <header className={styles.head}>
        <h1 className={styles.title}>
          <Icon name="plug" size={24} tone="brand" />
          Connect a coding agent
        </h1>
        <p className={styles.subtitle}>
          Generate a personal token so an AI coding agent (like Claude Code) can
          manage your boards and discussions on your behalf. The agent acts as
          you — it can only touch what you can, and it never deletes data.
        </p>
      </header>

      {/* Freshly-minted token — shown once. */}
      {fresh && (
        <Alert variant="success" title="Token created — copy it now">
          <p className={styles.freshNote}>
            This is the only time the full token is shown. Copy it now, test the
            connection, then paste it into your agent.
          </p>
          <div className={styles.tokenRow}>
            <code className={styles.tokenValue}>
              {revealed ? fresh.token : maskedToken}
            </code>
            <IconButton
              icon={revealed ? 'eyeOff' : 'eye'}
              label={revealed ? 'Hide token' : 'Reveal token'}
              variant="ghost"
              size="sm"
              onClick={() => setRevealed((v) => !v)}
            />
            <CopyButton value={fresh.token} label="Copy token" />
          </div>
          <VerifyButton token={fresh.token} />
          <p className={styles.cmdLabel}>Connect your agent:</p>
          <ConnectInstructions token={fresh.token} />
        </Alert>
      )}

      {/* Generate form */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Icon name="key" size={18} tone="brand" />
          Generate a token
        </h2>
        <div className={styles.form}>
          <Field label="Token name" className={styles.nameField}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. “Claude Code — laptop”"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onCreate();
              }}
            />
          </Field>
          <Field label="Expiry" className={styles.expiryField}>
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
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>
            <Icon name="shield" size={18} tone="brand" />
            Active tokens
          </h2>
          {!loading && tokens.length > 0 && (
            <span className={styles.count}>{activeCount} active</span>
          )}
        </div>
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
            {tokens.map((t) => {
              const expired = isExpired(t);
              const exp = expiryInfo(t.expiresAt);
              return (
                <li key={t.id} className={styles.tokenItem}>
                  <span
                    className={styles.statusDot}
                    data-expired={expired || undefined}
                    title={expired ? 'Expired' : 'Active'}
                  />
                  <div className={styles.tokenMain}>
                    <span className={styles.tokenName}>
                      {t.name}
                      {expired && (
                        <span className={styles.expiredTag}>Expired</span>
                      )}
                      {exp?.soon && (
                        <span className={styles.soonTag}>{exp.text}</span>
                      )}
                    </span>
                    <span className={styles.tokenMeta}>
                      <span title={fmt(t.createdAt)}>
                        Created {fmt(t.createdAt)}
                      </span>
                      {' · '}
                      <span title={t.lastUsedAt ? fmt(t.lastUsedAt) : 'never'}>
                        Last used {relativeTime(t.lastUsedAt)}
                      </span>
                      {' · '}
                      {t.expiresAt ? (
                        <span title={fmt(t.expiresAt)}>
                          {expired ? 'Expired' : (exp?.text ?? `Expires ${fmt(t.expiresAt)}`)}
                        </span>
                      ) : (
                        'No expiry'
                      )}
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
              );
            })}
          </ul>
        )}
      </section>

      {/* Setup reference */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Icon name="terminal" size={18} tone="brand" />
          How to connect
        </h2>
        <ol className={styles.steps}>
          <li>Generate a token above and copy it.</li>
          <li>
            Pick your setup below and run it, pasting the token in place of{' '}
            <code className={styles.inline}>{TOKEN_PLACEHOLDER}</code>.
          </li>
          <li>
            Your agent can now create features &amp; tasks, move and assign them,
            and post channel messages — as you.
          </li>
        </ol>
        <ConnectInstructions token={TOKEN_PLACEHOLDER} />
      </section>
    </div>
  );
}
