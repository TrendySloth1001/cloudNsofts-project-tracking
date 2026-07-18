'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type {
  ApiTokenScope,
  DeviceLookupResponse,
  GrantableProject,
  UserProfile,
} from '@cnsofts/shared';
import { Button, Icon, Spinner, type IconName } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { authApi } from '@/features/auth/auth.api';
import { deviceApi } from '@/features/auth/device.api';
import styles from './connect.module.css';

interface Grant {
  info: DeviceLookupResponse;
  user: UserProfile;
  projects: GrantableProject[];
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'no-code' }
  | { kind: 'need-login' }
  | { kind: 'confirm'; grant: Grant }
  | { kind: 'approving'; grant: Grant }
  | { kind: 'approved' }
  | { kind: 'error'; message: string };

function ConnectInner() {
  const code = useSearchParams().get('code');
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  // The approver's choices — which projects the agent may touch, and whether it
  // can write. Kept out of the phase so toggling doesn't rebuild it.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<ApiTokenScope>('full');

  useEffect(() => {
    if (!code) {
      setPhase({ kind: 'no-code' });
      return;
    }
    let cancelled = false;
    (async () => {
      let user: UserProfile;
      try {
        user = (await authApi.me()).user;
      } catch {
        if (!cancelled) setPhase({ kind: 'need-login' });
        return;
      }
      try {
        const [info, projects] = await Promise.all([
          deviceApi.lookup(code),
          deviceApi.grantableProjects(),
        ]);
        if (!cancelled)
          setPhase({ kind: 'confirm', grant: { info, user, projects } });
      } catch (err) {
        if (!cancelled)
          setPhase({
            kind: 'error',
            message:
              err instanceof Error
                ? err.message
                : 'That code is invalid or has expired.',
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  function toggleProject(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approve() {
    if (phase.kind !== 'confirm' || !code || selected.size === 0) return;
    const grant = phase.grant;
    setPhase({ kind: 'approving', grant });
    try {
      await deviceApi.approve({
        userCode: code,
        scope,
        projectIds: [...selected],
      });
      setPhase({ kind: 'approved' });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not approve.',
      });
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <Logo size="md" />

        {phase.kind === 'loading' && (
          <div className={styles.state}>
            <Spinner size={24} />
          </div>
        )}

        {phase.kind === 'no-code' && (
          <Message
            icon="alertCircle"
            title="No code provided"
            text="Open the link your coding agent printed, or start `login` again from your terminal."
          />
        )}

        {phase.kind === 'need-login' && (
          <>
            <Message
              icon="key"
              title="Sign in to connect"
              text="Sign in, then reopen the link from your terminal to approve the connection."
            />
            <Link href="/login" className={styles.actionLink}>
              <Button>Sign in</Button>
            </Link>
          </>
        )}

        {(phase.kind === 'confirm' || phase.kind === 'approving') && (
          <ApproveForm
            grant={phase.grant}
            code={code ?? ''}
            scope={scope}
            onScope={setScope}
            selected={selected}
            onToggle={toggleProject}
            busy={phase.kind === 'approving'}
            onApprove={approve}
          />
        )}

        {phase.kind === 'approved' && (
          <Message
            icon="checkCircle"
            tone="success"
            title="Connected"
            text="Return to your terminal — your agent is authenticating now. You can close this tab."
          />
        )}

        {phase.kind === 'error' && (
          <Message icon="alertCircle" title="Something went wrong" text={phase.message} />
        )}
      </div>
    </div>
  );
}

function ApproveForm({
  grant,
  code,
  scope,
  onScope,
  selected,
  onToggle,
  busy,
  onApprove,
}: {
  grant: Grant;
  code: string;
  scope: ApiTokenScope;
  onScope: (s: ApiTokenScope) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  busy: boolean;
  onApprove: () => void;
}) {
  const { info, user, projects } = grant;

  // A user with no projects has nothing to grant — the agent would be useless.
  if (projects.length === 0) {
    return (
      <Message
        icon="folder"
        title="No projects to grant"
        text="You're not a member of any project yet, so there's nothing to connect an agent to. Ask a project admin to add you, then start `login` again."
      />
    );
  }

  return (
    <>
      <h1 className={styles.title}>Connect a coding agent</h1>
      <p className={styles.lead}>
        Grant <strong>{info.tokenName}</strong> access to act as{' '}
        <strong>{user.name || user.email}</strong>. Choose what it can reach.
      </p>

      <div className={styles.codeRow}>
        <span className={styles.codeLabel}>Code</span>
        <code className={styles.code}>{code}</code>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Access level</span>
        <div className={styles.scopeRow}>
          <label className={styles.scopeOption} data-on={scope === 'full'}>
            <input
              type="radio"
              name="scope"
              checked={scope === 'full'}
              onChange={() => onScope('full')}
              disabled={busy}
            />
            <span className={styles.scopeText}>
              <strong>Full</strong>
              <small>Read &amp; write</small>
            </span>
          </label>
          <label className={styles.scopeOption} data-on={scope === 'read_only'}>
            <input
              type="radio"
              name="scope"
              checked={scope === 'read_only'}
              onChange={() => onScope('read_only')}
              disabled={busy}
            />
            <span className={styles.scopeText}>
              <strong>Read-only</strong>
              <small>Cannot change anything</small>
            </span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>
          Projects
          <button
            type="button"
            className={styles.selectAll}
            disabled={busy}
            onClick={() => {
              const all = selected.size === projects.length;
              projects.forEach((p) => {
                if (all === selected.has(p.id)) onToggle(p.id);
              });
            }}
          >
            {selected.size === projects.length ? 'Clear all' : 'Select all'}
          </button>
        </span>
        <ul className={styles.projectList}>
          {projects.map((p) => (
            <li key={p.id}>
              <label className={styles.projectItem} data-on={selected.has(p.id)}>
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => onToggle(p.id)}
                  disabled={busy}
                />
                <span className={styles.projectName}>{p.name}</span>
                {selected.has(p.id) && (
                  <Icon name="check" size={16} tone="brand" />
                )}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.actions}>
        <Button
          onClick={onApprove}
          disabled={busy || selected.size === 0}
          leftIcon="check"
        >
          {busy
            ? 'Approving…'
            : selected.size === 0
              ? 'Pick a project to approve'
              : `Approve for ${selected.size} project${selected.size === 1 ? '' : 's'}`}
        </Button>
      </div>
      <p className={styles.hint}>
        Only approve a code you started yourself. You can revoke access any time
        under Settings → Connect coding agent.
      </p>
    </>
  );
}

function Message({
  icon,
  title,
  text,
  tone,
}: {
  icon: IconName;
  title: string;
  text: string;
  tone?: 'success';
}) {
  return (
    <div className={styles.message}>
      <span className={tone === 'success' ? styles.iconOk : styles.icon}>
        <Icon name={icon} size={26} />
      </span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{text}</p>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.wrap}>
          <Spinner size={24} />
        </div>
      }
    >
      <ConnectInner />
    </Suspense>
  );
}
