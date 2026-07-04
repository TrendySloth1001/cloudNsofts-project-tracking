'use client';

import { useEffect, useState } from 'react';
import { addClientSchema } from '@cnsofts/shared';
import { Alert, Button, Input, Modal } from '@/components/ui';
import { projectStore } from '../projects.store';
import styles from './people-dialog.module.css';

export interface ClientDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function ClientDialog({ open, onClose, projectId }: ClientDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setCompany('');
    setError(null);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = addClientSchema.safeParse({
      name,
      email,
      company: company.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await projectStore.addClient(projectId, parsed.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add client');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add client"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" loading={submitting}>
            Add client
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} className={styles.form}>
        {error && <Alert variant="danger">{error}</Alert>}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Priya Sharma"
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
            placeholder="priya@client.com"
            required
          />
          <Input
            label="Company"
            containerClassName={styles.grow}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </form>
    </Modal>
  );
}
