'use client';

import { useEffect, useState } from 'react';
import type { ChannelMember } from '@cnsofts/shared';
import { Button, IconButton, Modal, Spinner } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { discussionsApi } from '../discussions.api';
import styles from './channel-members-dialog.module.css';

/** Sentinel `busy` value while the bulk add-all is running. */
const ADD_ALL = '__all__';

/** A candidate to add to a channel (a project member or client). */
export interface ChannelCandidate {
  email: string;
  name: string;
}

export interface ChannelMembersDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  channelId: string;
  channelName: string;
  /** Project members + clients that can be added to the channel. */
  candidates: ChannelCandidate[];
  /** Called after the roster changes (e.g. to refresh member counts). */
  onChanged?: () => void;
}

export function ChannelMembersDialog({
  open,
  onClose,
  projectId,
  channelId,
  channelName,
  candidates,
  onChanged,
}: ChannelMembersDialogProps) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    discussionsApi
      .listMembers(projectId, channelId)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, projectId, channelId]);

  const memberEmails = new Set(members.map((m) => m.email.toLowerCase()));
  const addable = candidates.filter(
    (c) => !memberEmails.has(c.email.toLowerCase()),
  );

  async function add(candidate: ChannelCandidate) {
    setBusy(candidate.email);
    try {
      const member = await discussionsApi.addMember(projectId, channelId, {
        email: candidate.email,
        name: candidate.name,
      });
      setMembers((prev) =>
        prev.some((m) => m.id === member.id) ? prev : [...prev, member],
      );
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  // Bulk-add every remaining project person — the one-click way to grant the
  // whole team access to a channel.
  async function addAll() {
    setBusy(ADD_ALL);
    try {
      for (const candidate of addable) {
        const member = await discussionsApi.addMember(projectId, channelId, {
          email: candidate.email,
          name: candidate.name,
        });
        setMembers((prev) =>
          prev.some((m) => m.id === member.id) ? prev : [...prev, member],
        );
      }
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  async function remove(member: ChannelMember) {
    setBusy(member.email);
    try {
      await discussionsApi.removeMember(projectId, channelId, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Members · #${channelName}`}
      size="md"
    >
      {loading ? (
        <div className={styles.loading}>
          <Spinner size={22} />
        </div>
      ) : (
        <div className={styles.sections}>
          <div className={styles.section}>
            <span className={styles.label}>
              In this channel ({members.length})
            </span>
            <ul className={styles.list}>
              {members.map((member) => (
                <li key={member.id} className={styles.row}>
                  <UserAvatar name={member.name} seed={member.email} size={28} />
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{member.name}</span>
                    <span className={styles.rowSub}>{member.email}</span>
                  </span>
                  <IconButton
                    icon="close"
                    label={`Remove ${member.name}`}
                    variant="ghost"
                    size="sm"
                    disabled={busy === member.email}
                    onClick={() => void remove(member)}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.label}>Add from this project</span>
              {addable.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon="add"
                  loading={busy === ADD_ALL}
                  onClick={() => void addAll()}
                >
                  Add whole team
                </Button>
              )}
            </div>
            {addable.length === 0 ? (
              <span className={styles.empty}>Everyone here is already in.</span>
            ) : (
              <ul className={styles.list}>
                {addable.map((candidate) => (
                  <li key={candidate.email} className={styles.row}>
                    <UserAvatar
                      name={candidate.name}
                      seed={candidate.email}
                      size={28}
                    />
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{candidate.name}</span>
                      <span className={styles.rowSub}>{candidate.email}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon="add"
                      loading={busy === candidate.email}
                      onClick={() => void add(candidate)}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
