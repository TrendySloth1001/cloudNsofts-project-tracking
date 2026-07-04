'use client';

import { useState } from 'react';
import {
  createProjectSchema,
  projectStatusSchema,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from '@cnsofts/shared';
import { Alert, Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { projectStore } from '../projects.store';

const STATUS_OPTIONS = projectStatusSchema.options.map((s) => ({
  value: s,
  label: PROJECT_STATUS_LABELS[s],
}));

export interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export function CreateProjectDialog({
  open,
  onClose,
  onCreated,
}: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName('');
    setDescription('');
    setStatus('planning');
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createProjectSchema.safeParse({ name, description, status });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const project = await projectStore.create(parsed.data);
      reset();
      onCreated(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      description="Name your project — you can add clients and team next."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-project-form" loading={submitting}>
            Create project
          </Button>
        </>
      }
    >
      <form
        id="create-project-form"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        {error && <Alert variant="danger">{error}</Alert>}
        <Input
          label="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Website Revamp"
          required
          autoFocus
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this project about?"
          rows={3}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          options={STATUS_OPTIONS}
        />
      </form>
    </Modal>
  );
}
