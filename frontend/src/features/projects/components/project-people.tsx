'use client';

import { useState } from 'react';
import {
  MEMBER_ROLE_LABELS,
  type ProjectClient,
  type ProjectMember,
} from '@cnsofts/shared';
import { Button, Divider, Icon, useConfirm } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { projectStore } from '../projects.store';
import { MemberDialog } from './member-dialog';
import { ClientDialog } from './client-dialog';
import styles from './project-people.module.css';

export interface ProjectPeopleProps {
  projectId: string;
  members: ProjectMember[];
  clients: ProjectClient[];
}

export function ProjectPeople({
  projectId,
  members,
  clients,
}: ProjectPeopleProps) {
  const [memberOpen, setMemberOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const confirm = useConfirm();

  async function removeMember(member: ProjectMember) {
    const ok = await confirm({
      title: 'Remove member?',
      message: (
        <>
          Remove <strong>{member.name}</strong> from the team?
        </>
      ),
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) void projectStore.removeMember(projectId, member.id);
  }
  async function removeClient(client: ProjectClient) {
    const ok = await confirm({
      title: 'Remove client?',
      message: (
        <>
          Remove <strong>{client.name}</strong>?
        </>
      ),
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) void projectStore.removeClient(projectId, client.id);
  }

  return (
    <section className={styles.people}>
      <div className={styles.group}>
        <div className={styles.groupHead}>
          <Icon name="user" size={16} tone="brand" />
          <span className={styles.groupTitle}>Team</span>
          <span className={styles.count}>{members.length}</span>
          <span className={styles.grow} />
          <Button
            variant="ghost"
            size="sm"
            leftIcon="add"
            onClick={() => setMemberOpen(true)}
          >
            Add member
          </Button>
        </div>
        <div className={styles.chips}>
          {members.length === 0 ? (
            <span className={styles.empty}>No team members yet.</span>
          ) : (
            members.map((member) => (
              <span key={member.id} className={styles.chip}>
                <UserAvatar name={member.name} seed={member.id} size={22} />
                <span className={styles.chipText}>
                  <span className={styles.chipName}>{member.name}</span>
                  <span className={styles.chipSub}>
                    {MEMBER_ROLE_LABELS[member.role]}
                  </span>
                </span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => void removeMember(member)}
                  aria-label={`Remove ${member.name}`}
                >
                  <Icon name="close" size={13} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <Divider orientation="vertical" className={styles.divider} />

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <Icon name="userCircle" size={16} tone="info" />
          <span className={styles.groupTitle}>Clients</span>
          <span className={styles.count}>{clients.length}</span>
          <span className={styles.grow} />
          <Button
            variant="ghost"
            size="sm"
            leftIcon="add"
            onClick={() => setClientOpen(true)}
          >
            Add client
          </Button>
        </div>
        <div className={styles.chips}>
          {clients.length === 0 ? (
            <span className={styles.empty}>No clients yet.</span>
          ) : (
            clients.map((client) => (
              <span key={client.id} className={styles.chip}>
                <span className={styles.clientBadge}>
                  {client.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <span className={styles.chipText}>
                  <span className={styles.chipName}>{client.name}</span>
                  <span className={styles.chipSub}>
                    {client.company || client.email}
                  </span>
                </span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => void removeClient(client)}
                  aria-label={`Remove ${client.name}`}
                >
                  <Icon name="close" size={13} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <MemberDialog
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        projectId={projectId}
      />
      <ClientDialog
        open={clientOpen}
        onClose={() => setClientOpen(false)}
        projectId={projectId}
      />
    </section>
  );
}
