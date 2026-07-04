'use client';

import { useEffect, useState } from 'react';
import {
  addMemberSchema,
  memberRoleSchema,
  MEMBER_ROLE_LABELS,
  type MemberRole,
} from '@cnsofts/shared';
import { Alert, Button, Input, Modal, Select } from '@/components/ui';
import { projectStore } from '../projects.store';
import styles from './people-dialog.module.css';

const ROLE_OPTIONS = memberRoleSchema.options.map((r) => ({
  value: r,
  label: MEMBER_ROLE_LABELS[r],
}));

export interface MemberDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function MemberDialog({ open, onClose, projectId }: MemberDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setRole('member');
    setError(null);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = addMemberSchema.safeParse({ name, email, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await projectStore.addMember(projectId, parsed.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add team member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="member-form" loading={submitting}>
            Add member
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={handleSubmit} className={styles.form}>
        {error && <Alert variant="danger">{error}</Alert>}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jordan Lee"
          required
          autoFocus
        />
        <div className={styles.row}>
          <Input
            label="Email"
            type="email"
            containerClassName={styles.grow}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jordan@company.com"
            required
          />
          <Select
            label="Role"
            containerClassName={styles.grow}
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            options={ROLE_OPTIONS}
          />
        </div>
      </form>
    </Modal>
  );
}
