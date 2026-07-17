'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { DeviceLookupResponse, UserProfile } from '@cnsofts/shared';
import { Button, Icon, Spinner, type IconName } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { authApi } from '@/features/auth/auth.api';
import { deviceApi } from '@/features/auth/device.api';
import styles from './connect.module.css';

type Phase =
  | { kind: 'loading' }
  | { kind: 'no-code' }
  | { kind: 'need-login' }
  | { kind: 'confirm'; info: DeviceLookupResponse; user: UserProfile }
  | { kind: 'approving'; info: DeviceLookupResponse; user: UserProfile }
  | { kind: 'approved' }
  | { kind: 'error'; message: string };

function ConnectInner() {
  const code = useSearchParams().get('code');
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

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
        const info = await deviceApi.lookup(code);
        if (!cancelled) setPhase({ kind: 'confirm', info, user });
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

  async function approve() {
    if (phase.kind !== 'confirm' || !code) return;
    setPhase({ kind: 'approving', info: phase.info, user: phase.user });
    try {
      await deviceApi.approve({ userCode: code });
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
          <>
            <h1 className={styles.title}>Connect a coding agent</h1>
            <p className={styles.lead}>
              Grant <strong>{phase.info.tokenName}</strong> full access to act as{' '}
              <strong>{phase.user.name || phase.user.email}</strong> — it can read
              and change any project you can.
            </p>
            <div className={styles.codeRow}>
              <span className={styles.codeLabel}>Code</span>
              <code className={styles.code}>{code}</code>
            </div>
            <div className={styles.actions}>
              <Button
                onClick={approve}
                disabled={phase.kind === 'approving'}
                leftIcon="check"
              >
                {phase.kind === 'approving' ? 'Approving…' : 'Approve'}
              </Button>
            </div>
            <p className={styles.hint}>
              Only approve a code you started yourself. You can revoke access any
              time under Settings → Connect coding agent.
            </p>
          </>
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
