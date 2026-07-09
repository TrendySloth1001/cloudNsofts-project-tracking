'use client';

import { useState } from 'react';
import { MEMBER_ROLE_LABELS, type Invitation } from '@cnsofts/shared';
import { Button, Icon } from '@/components/ui';
import { projectStore } from '@/features/projects/projects.store';
import { invitationsApi } from '../invitations.api';
import styles from './invitation-card.module.css';

export interface InvitationCardProps {
  invitation: Invitation;
  /** Called after the invite is accepted (true) or declined (false). */
  onResolved: (id: string, accepted: boolean) => void;
}

export function InvitationCard({ invitation, onResolved }: InvitationCardProps) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(accepted: boolean) {
    setBusy(accepted ? 'accept' : 'decline');
    setError(null);
    try {
      if (accepted) {
        await invitationsApi.accept(invitation.id);
        // The user just joined a project — refresh the sidebar/project list.
        void projectStore.reload();
      } else {
        await invitationsApi.decline(invitation.id);
      }
      onResolved(invitation.id, accepted);
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className={styles.card}>
      <span className={styles.icon}>
        <Icon name="folder" size={20} tone="brand" />
      </span>
      <div className={styles.body}>
        <span className={styles.project}>{invitation.projectName}</span>
        <span className={styles.meta}>
          {invitation.invitedBy} invited you as{' '}
          <strong>{MEMBER_ROLE_LABELS[invitation.role]}</strong>
        </span>
        {error && <span className={styles.error}>{error}</span>}
      </div>
      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void respond(false)}
          loading={busy === 'decline'}
          disabled={busy !== null}
        >
          Decline
        </Button>
        <Button
          size="sm"
          onClick={() => void respond(true)}
          loading={busy === 'accept'}
          disabled={busy !== null}
        >
          Accept
        </Button>
      </div>
    </div>
  );
}
