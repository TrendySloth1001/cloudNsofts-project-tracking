'use client';

import { useState } from 'react';
import {
  INVITATION_ROLE_LABELS,
  type InvitationRole,
  type Invitation,
} from '@cnsofts/shared';
import { Badge, Button, Icon, type BadgeVariant, type IconName } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { projectStore } from '@/features/projects/projects.store';
import { invitationsApi } from '../invitations.api';
import styles from './invitation-card.module.css';

export interface InvitationCardProps {
  invitation: Invitation;
  /** Called after the invite is accepted (true) or declined (false). */
  onResolved: (id: string, accepted: boolean) => void;
}

/** Per-role visual treatment for the role badge — icon + badge color so each
 *  access level reads at a glance and matches the app's accent palette. */
const ROLE_META: Record<InvitationRole, { icon: IconName; variant: BadgeVariant }> = {
  admin: { icon: 'shield', variant: 'primary' },
  manager: { icon: 'userCircle', variant: 'info' },
  member: { icon: 'user', variant: 'teal' },
  viewer: { icon: 'eye', variant: 'neutral' },
  client: { icon: 'star', variant: 'warning' },
};

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

  const role = ROLE_META[invitation.role];
  const initial = invitation.projectName.trim()[0]?.toUpperCase() ?? '#';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.cover} aria-hidden="true">
          {initial}
        </span>
        <div className={styles.headText}>
          <span className={styles.project} title={invitation.projectName}>
            {invitation.projectName}
          </span>
          <Badge variant={role.variant} size="sm">
            <Icon name={role.icon} size={12} />
            {INVITATION_ROLE_LABELS[invitation.role]}
          </Badge>
        </div>
      </div>

      <div className={styles.inviter}>
        <UserAvatar name={invitation.invitedBy} seed={invitation.invitedBy} size={26} />
        <span className={styles.inviterText}>
          Invited by <strong>{invitation.invitedBy}</strong>
        </span>
      </div>

      {error && (
        <p className={styles.error}>
          <Icon name="alertCircle" size={14} />
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button
          className={styles.action}
          variant="outline"
          size="sm"
          onClick={() => void respond(false)}
          loading={busy === 'decline'}
          disabled={busy !== null}
        >
          Decline
        </Button>
        <Button
          className={styles.action}
          size="sm"
          leftIcon="check"
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
