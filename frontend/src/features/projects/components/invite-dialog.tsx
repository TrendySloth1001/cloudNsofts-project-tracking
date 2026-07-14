'use client';

import { useEffect, useState } from 'react';
import {
  createInvitationSchema,
  invitationRoleSchema,
  INVITATION_ROLE_LABELS,
  type Invitation,
  type InvitationRole,
} from '@cnsofts/shared';
import { Alert, Button, Input, Modal, Select } from '@/components/ui';
import { invitationsApi } from '@/features/invitations/invitations.api';
import styles from './people-dialog.module.css';

const ROLE_OPTIONS = invitationRoleSchema.options.map((r) => ({
  value: r,
  label: INVITATION_ROLE_LABELS[r],
}));

export interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onInvited: (invitation: Invitation) => void;
}

/** Invite someone to the project by email. Works whether or not they already
 *  have an account — the invite waits and pops up when they next sign in. */
export function InviteDialog({
  open,
  onClose,
  projectId,
  onInvited,
}: InviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole('member');
    setError(null);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createInvitationSchema.safeParse({ email, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const invitation = await invitationsApi.create(projectId, parsed.data);
      onInvited(invitation);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite to project"
      description="They'll see it when they next sign in — or right after they sign up."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={submitting}>
            Send invite
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={handleSubmit} className={styles.form}>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className={styles.row}>
          <Input
            label="Email"
            type="email"
            containerClassName={styles.grow}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            required
            autoFocus
          />
          <Select
            label="Role"
            containerClassName={styles.grow}
            value={role}
            onChange={(e) => setRole(e.target.value as InvitationRole)}
            options={ROLE_OPTIONS}
          />
        </div>
        <p className={styles.hint}>
          {role === 'client'
            ? 'Clients get read-only access to the board and can join client channels.'
            : 'Team members can view and work on the board per their role.'}
        </p>
      </form>
    </Modal>
  );
}
