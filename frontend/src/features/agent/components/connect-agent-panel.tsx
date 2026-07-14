'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  apiPaths,
  API_TOKEN_SCOPE_LABELS,
  USER_ROLE_LABELS,
  type AgentActivity,
  type ApiTokenScope,
  type ApiTokenSummary,
  type AuthUser,
  type CreatedApiToken,
  type Project,
} from '@cnsofts/shared';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Icon,
  IconButton,
  Input,
  Menu,
  MultiSelect,
  Select,
  Spinner,
  Tabs,
  useConfirm,
  type IconName,
  type SelectOption,
} from '@/components/ui';
import { config } from '@/lib/config';
import { ApiRequestError } from '@/lib/api-client';
import { projectsApi } from '@/features/projects/projects.api';
import { useAgentTokens } from '../use-agent-tokens';
import { useAgentActivity } from '../use-agent-activity';
import { agentApi } from '../agent.api';
import {
  CONNECT_CLIENTS,
  EXAMPLE_PROMPTS,
  MCP_TOOL_GROUPS,
  REST_EXAMPLES,
  TROUBLESHOOTING,
  type ConnectClient,
} from '../agent.content';
import styles from './connect-agent-panel.module.css';

const EXPIRY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Never expires' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

const SCOPE_OPTIONS: SelectOption[] = (
  Object.entries(API_TOKEN_SCOPE_LABELS) as [ApiTokenScope, string][]
).map(([value, label]) => ({ value, label }));

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

/** Whole days until a token expires, or null if it never expires / is expired. */
function daysUntilExpiry(t: ApiTokenSummary): number | null {
  if (t.expiresAt == null) return null;
  const ms = new Date(t.expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function downloadFile(name: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Copy-to-clipboard control with a transient "Copied" state. */
function CopyButton({
  value,
  label,
  variant = 'outline',
}: {
  value: string;
  label: string;
  variant?: 'outline' | 'ghost';
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={variant}
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

/** Tabbed code snippets (MCP clients or REST languages), with copy + download.
 *  `download` shows the "grab the MCP server" step first (MCP clients only). */
function SnippetTabs({
  clients,
  token,
  download = false,
}: {
  clients: ConnectClient[];
  token: string;
  download?: boolean;
}) {
  const [sel, setSel] = useState(clients[0].value);
  // The API base the agent's device must reach — defaults to this app's API,
  // but on another machine you paste your tunnel/public URL here.
  const [apiBase, setApiBase] = useState(config.apiUrl);
  const active = clients.find((c) => c.value === sel) ?? clients[0];
  const snippet = active.build(apiBase, token);
  const downloadCmd = `curl -fsSL ${apiBase}${apiPaths.agent.mcpServer()} -o cnsofts-mcp.mjs`;
  return (
    <div className={styles.connect}>
      <Input
        label="API base URL (must be reachable from the agent's device)"
        value={apiBase}
        onChange={(e) => setApiBase(e.target.value)}
        placeholder="https://your-tunnel.devtunnels.ms"
      />
      {download && (
        <>
          <p className={styles.stepLabel}>
            1. Download the MCP server (one file, no npm needed)
          </p>
          <div className={styles.cmdRow}>
            <pre className={styles.cmd}>{downloadCmd}</pre>
            <div className={styles.cmdActions}>
              <CopyButton value={downloadCmd} label="Copy" />
            </div>
          </div>
          <p className={styles.stepLabel}>2. Register it with your client</p>
        </>
      )}
      <Tabs
        variant="pill"
        items={clients.map((c) => ({
          value: c.value,
          label: c.label,
          icon: c.icon,
        }))}
        value={sel}
        onValueChange={setSel}
      />
      <div className={styles.cmdRow}>
        <pre className={styles.cmd}>{snippet}</pre>
        <div className={styles.cmdActions}>
          <CopyButton value={snippet} label="Copy" />
          {active.filename && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon="attachment"
              onClick={() => downloadFile(active.filename as string, snippet)}
            >
              Download
            </Button>
          )}
        </div>
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

/** One token row: status, scope/usage meta, and a rename/rotate/revoke menu. */
function TokenRow({
  token,
  projectNames,
  onRename,
  onRotate,
  onRevoke,
}: {
  token: ApiTokenSummary;
  projectNames: (ids: string[]) => string;
  onRename: (id: string, name: string) => Promise<void>;
  onRotate: (token: ApiTokenSummary) => void;
  onRevoke: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(token.name);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'loading' | 'ok' | 'err'>(
    'idle',
  );
  const [testMsg, setTestMsg] = useState('');
  const expired = isExpired(token);

  async function test() {
    if (testState === 'loading') return;
    setTestState('loading');
    try {
      const result = await agentApi.verifyById(token.id);
      setTestMsg(result.reason);
      setTestState(result.valid ? 'ok' : 'err');
    } catch (err) {
      setTestMsg(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not test this token.',
      );
      setTestState('err');
    }
  }
  const daysLeft = daysUntilExpiry(token);
  const expiringSoon = daysLeft != null && daysLeft <= 14;

  async function save() {
    const next = draft.trim();
    if (!next || next === token.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(token.id, next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const scopeLabel = API_TOKEN_SCOPE_LABELS[token.scope];
  const projectScope =
    token.projectIds.length === 0
      ? 'All projects'
      : projectNames(token.projectIds);

  return (
    <li className={styles.tokenItem}>
      <span
        className={styles.statusDot}
        data-expired={expired || undefined}
        title={expired ? 'Expired' : 'Active'}
      />
      <div className={styles.tokenMain}>
        {editing ? (
          <div className={styles.renameRow}>
            <Input
              value={draft}
              autoFocus
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <span className={styles.tokenName}>
              {token.name}
              <span
                className={styles.scopeTag}
                data-ro={token.scope === 'read_only' || undefined}
              >
                {scopeLabel}
              </span>
              {token.canDelete && (
                <span className={styles.deleteTag}>Can delete</span>
              )}
              {expired && <span className={styles.expiredTag}>Expired</span>}
              {expiringSoon && (
                <span className={styles.expiringTag}>
                  Expires in {daysLeft}d
                </span>
              )}
            </span>
            <span className={styles.tokenMeta}>
              <span title={projectScope}>
                <Icon name="folder" size={13} /> {projectScope}
              </span>
              {' · '}
              {token.usageCount} call{token.usageCount === 1 ? '' : 's'}
              {' · '}
              <span title={fmt(token.lastUsedAt)}>
                used {relativeTime(token.lastUsedAt)}
              </span>
              {' · '}
              {token.expiresAt ? (
                <span title={fmt(token.expiresAt)}>
                  {expired ? 'expired' : `expires ${fmt(token.expiresAt)}`}
                </span>
              ) : (
                'no expiry'
              )}
            </span>
            {testState === 'ok' && (
              <span className={styles.verifyOk}>
                <Icon name="checkCircle" size={14} tone="success" /> {testMsg}
              </span>
            )}
            {testState === 'err' && (
              <span className={styles.verifyErr}>
                <Icon name="alertCircle" size={14} tone="danger" /> {testMsg}
              </span>
            )}
          </>
        )}
      </div>
      {!editing && (
        <Button
          variant="outline"
          size="sm"
          leftIcon="checkCircle"
          loading={testState === 'loading'}
          onClick={() => void test()}
        >
          Test
        </Button>
      )}
      {!editing && (
        <Menu
          align="end"
          portal
          trigger={
            <IconButton icon="moreVertical" label={`Manage ${token.name}`} variant="ghost" size="sm" />
          }
          items={[
            { label: 'Rename', icon: 'edit', onSelect: () => { setDraft(token.name); setEditing(true); } },
            { label: 'Rotate secret', icon: 'key', onSelect: () => onRotate(token) },
            { separator: true },
            { label: 'Revoke', icon: 'delete', danger: true, onSelect: () => onRevoke(token.id, token.name) },
          ]}
        />
      )}
    </li>
  );
}

/** Recent agent actions feed. */
function ActivityFeed({ reloadKey }: { reloadKey: number }) {
  const { activity, loading } = useAgentActivity(reloadKey);
  const iconFor = (a: AgentActivity): IconName =>
    a.kind === 'message' ? 'chat' : 'tasks';

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>
        <Icon name="clock" size={18} tone="brand" />
        Recent agent activity
      </h2>
      {loading ? (
        <div className={styles.loading}>
          <Spinner size={20} />
        </div>
      ) : activity.length === 0 ? (
        <p className={styles.empty}>
          Nothing yet. Actions your agents take — moving tasks, posting messages
          — will show up here.
        </p>
      ) : (
        <ul className={styles.activityList}>
          {activity.map((a) => (
            <li key={a.id} className={styles.activityItem}>
              <span className={styles.activityIcon}>
                <Icon name={iconFor(a)} size={16} tone="brand" />
              </span>
              <div className={styles.activityMain}>
                <p className={styles.activitySummary}>{a.summary}</p>
                <span className={styles.activityMeta}>
                  <strong>{a.agentName}</strong> · {a.context} · {a.projectName}{' '}
                  · {relativeTime(a.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** MCP tool catalog + example prompts. */
function ToolReference() {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>
        <Icon name="ai" size={18} tone="brand" />
        What your agent can do
      </h2>
      <div className={styles.toolGroups}>
        {MCP_TOOL_GROUPS.map((g) => (
          <div key={g.title} className={styles.toolGroup}>
            <div className={styles.toolGroupHead}>
              <Icon name={g.icon} size={15} tone="neutral" />
              <span className={styles.toolGroupTitle}>{g.title}</span>
              <span className={styles.toolGroupNote}>{g.note}</span>
            </div>
            <div className={styles.toolChips}>
              {g.tools.map((t) => (
                <code key={t} className={styles.toolChip}>
                  {t}
                </code>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className={styles.cmdLabel}>Try asking your agent:</p>
      <ul className={styles.promptList}>
        {EXAMPLE_PROMPTS.map((p) => (
          <li key={p} className={styles.promptItem}>
            <span className={styles.promptText}>{p}</span>
            <CopyButton value={p} label="Copy" variant="ghost" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ConnectAgentPanel() {
  const { tokens, loading, create, rename, rotate, revoke } = useAgentTokens();
  const confirm = useConfirm();

  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiTokenScope>('full');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [expiresIn, setExpiresIn] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  // The plaintext token is returned once, on creation/rotation — memory only.
  const [fresh, setFresh] = useState<CreatedApiToken | null>(null);

  useEffect(() => {
    let alive = true;
    projectsApi
      .list()
      .then((res) => {
        if (alive) setProjects(res);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const projectOptions: SelectOption[] = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects],
  );
  const projectNames = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p.name]));
    return (ids: string[]): string => {
      const names = ids.map((id) => byId.get(id) ?? 'Unknown');
      if (names.length <= 2) return names.join(', ');
      return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
    };
  }, [projects]);

  async function onCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await create({
        name: trimmed,
        scope,
        projectIds,
        canDelete: scope !== 'read_only' && canDelete,
        ...(expiresIn ? { expiresInDays: Number(expiresIn) } : {}),
      });
      setFresh(result);
      setRevealed(false);
      setName('');
      setScope('full');
      setProjectIds([]);
      setCanDelete(false);
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

  async function onRotate(token: ApiTokenSummary) {
    const ok = await confirm({
      title: 'Rotate token?',
      message: (
        <>
          Rotate <strong>{token.name}</strong>? Its current secret stops working
          immediately — you&apos;ll get a new one to copy into your MCP config
          (<code>agent-workspace/.mcp.json</code>), or the agent using it will
          stop.
        </>
      ),
      confirmLabel: 'Rotate',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await rotate(token.id);
    setFresh(result);
    setRevealed(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
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
              {revealed
                ? fresh.token
                : `${fresh.token.slice(0, 12)}${'•'.repeat(18)}${fresh.token.slice(-4)}`}
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
          <SnippetTabs clients={CONNECT_CLIENTS} token={fresh.token} download />
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
          <Field label="Access" className={styles.scopeField}>
            <Select
              value={scope}
              onChange={(e) => setScope(e.target.value as ApiTokenScope)}
              options={SCOPE_OPTIONS}
            />
          </Field>
          <Field
            label="Projects"
            className={styles.projectsField}
          >
            <MultiSelect
              options={projectOptions}
              values={projectIds}
              onValuesChange={setProjectIds}
              placeholder="All my projects"
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
            className={styles.generateBtn}
            leftIcon="add"
            onClick={() => void onCreate()}
            loading={creating}
            disabled={!name.trim()}
          >
            Generate token
          </Button>
        </div>
        <Checkbox
          checked={canDelete}
          disabled={scope === 'read_only'}
          onChange={(e) => setCanDelete(e.target.checked)}
          label="Allow deletes"
          description="Let this token permanently delete tasks and features. Off by default."
        />
        <p className={styles.formHint}>
          <Icon name="info" size={14} tone="neutral" />
          {scope === 'read_only'
            ? 'Read-only tokens can view boards and discussions but cannot make changes.'
            : 'Full-access tokens can create and update work.'}{' '}
          {projectIds.length === 0
            ? 'Scoped to every project you can access.'
            : `Limited to ${projectIds.length} project${projectIds.length === 1 ? '' : 's'}.`}
        </p>
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
            <span className={styles.count}>
              {tokens.filter((t) => !isExpired(t)).length} active
            </span>
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
            {tokens.map((t) => (
              <TokenRow
                key={t.id}
                token={t}
                projectNames={projectNames}
                onRename={rename}
                onRotate={onRotate}
                onRevoke={onRevoke}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Agent activity */}
      <ActivityFeed reloadKey={0} />

      {/* Tool reference + prompts */}
      <ToolReference />

      {/* Setup reference */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Icon name="terminal" size={18} tone="brand" />
          How to connect
        </h2>
        <ol className={styles.steps}>
          <li>Generate a token above and copy it.</li>
          <li>Pick your client below and run the snippet (the token is baked in).</li>
          <li>Restart your agent so it loads the new tools.</li>
        </ol>
        <SnippetTabs clients={CONNECT_CLIENTS} token="<YOUR_TOKEN>" download />
      </section>

      {/* Any language — raw REST */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Icon name="code" size={18} tone="brand" />
          Use it from any language
        </h2>
        <p className={styles.formHint}>
          <Icon name="info" size={14} tone="neutral" />
          No MCP or Node required — the token is a standard Bearer credential.
          Any language with an HTTP client (C#, Python, Go, JavaScript, …) can
          call the same REST API the agent uses.
        </p>
        <SnippetTabs clients={REST_EXAMPLES} token="<YOUR_TOKEN>" />
      </section>

      {/* Troubleshooting */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Icon name="help" size={18} tone="brand" />
          Troubleshooting
        </h2>
        <dl className={styles.faq}>
          {TROUBLESHOOTING.map((item) => (
            <div key={item.q} className={styles.faqItem}>
              <dt className={styles.faqQ}>{item.q}</dt>
              <dd className={styles.faqA}>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
