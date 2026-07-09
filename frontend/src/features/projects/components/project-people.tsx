'use client';

import { useEffect, useState } from 'react';
import {
  MEMBER_ROLE_LABELS,
  memberRoleSchema,
  type Invitation,
  type MemberRole,
  type ProjectClient,
  type ProjectMember,
} from '@cnsofts/shared';
import { Button, Divider, Icon, Menu, useConfirm } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { invitationsApi } from '@/features/invitations/invitations.api';
import { projectStore } from '../projects.store';
import { MemberDialog } from './member-dialog';
import { ClientDialog } from './client-dialog';
import { InviteDialog } from './invite-dialog';
import styles from './project-people.module.css';

export interface ProjectPeopleProps {
  projectId: string;
  members: ProjectMember[];
  clients: ProjectClient[];
  /** Admin-only: show add/remove controls. Members see the roster read-only. */
  canManage: boolean;
}

export function ProjectPeople({
  projectId,
  members,
  clients,
  canManage,
}: ProjectPeopleProps) {
  const [memberOpen, setMemberOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const confirm = useConfirm();

  // Load pending invitations for managers (viewers don't manage the roster).
  useEffect(() => {
    if (!canManage) return;
    let alive = true;
    invitationsApi
      .listForProject(projectId)
      .then(({ invitations }) => {
        if (alive) setInvites(invitations);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [canManage, projectId]);

  async function cancelInvite(invite: Invitation) {
    const ok = await confirm({
      title: 'Cancel invitation?',
      message: (
        <>
          Cancel the invite to <strong>{invite.email}</strong>?
        </>
      ),
      confirmLabel: 'Cancel invite',
      tone: 'danger',
    });
    if (!ok) return;
    await invitationsApi.cancel(projectId, invite.id);
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
  }

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
  async function changeRole(member: ProjectMember, role: MemberRole) {
    if (role === member.role) return;
    await projectStore.updateMemberRole(projectId, member.id, { role });
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
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon="add"
              onClick={() => setMemberOpen(true)}
            >
              Add member
            </Button>
          )}
        </div>
        <div className={styles.chips}>
          {members.length === 0 ? (
            <span className={styles.empty}>No team members yet.</span>
          ) : (
            members.map((member) => (
              <span key={member.id} className={styles.chip}>
                <UserAvatar name={member.name} seed={member.id} size={28} />
                <span className={styles.chipText}>
                  <span className={styles.chipName}>{member.name}</span>
                  {canManage ? (
                    <Menu
                      portal
                      align="start"
                      className={styles.roleMenu}
                      trigger={
                        <span
                          className={styles.roleBtn}
                          role="button"
                          tabIndex={0}
                          aria-label={`Change ${member.name}'s role`}
                        >
                          {MEMBER_ROLE_LABELS[member.role]}
                          <Icon name="chevronDown" size={12} />
                        </span>
                      }
                      items={memberRoleSchema.options.map((role) => ({
                        label: MEMBER_ROLE_LABELS[role],
                        selected: role === member.role,
                        onSelect: () => void changeRole(member, role),
                      }))}
                    />
                  ) : (
                    <span className={styles.chipSub}>
                      {MEMBER_ROLE_LABELS[member.role]}
                    </span>
                  )}
                </span>
                {canManage && (
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => void removeMember(member)}
                    aria-label={`Remove ${member.name}`}
                  >
                    <Icon name="close" size={13} />
                  </button>
                )}
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
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon="add"
              onClick={() => setClientOpen(true)}
            >
              Add client
            </Button>
          )}
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
                {canManage && (
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => void removeClient(client)}
                    aria-label={`Remove ${client.name}`}
                  >
                    <Icon name="close" size={13} />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
      </div>

      {canManage && (
        <>
          <Divider orientation="vertical" className={styles.divider} />

          <div className={styles.group}>
            <div className={styles.groupHead}>
              <Icon name="mail" size={16} tone="warning" />
              <span className={styles.groupTitle}>Invitations</span>
              <span className={styles.count}>{invites.length}</span>
              <span className={styles.grow} />
              <Button
                variant="ghost"
                size="sm"
                leftIcon="add"
                onClick={() => setInviteOpen(true)}
              >
                Invite
              </Button>
            </div>
            <div className={styles.chips}>
              {invites.length === 0 ? (
                <span className={styles.empty}>No pending invites.</span>
              ) : (
                invites.map((invite) => (
                  <span key={invite.id} className={styles.chip}>
                    <span className={styles.clientBadge}>@</span>
                    <span className={styles.chipText}>
                      <span className={styles.chipName}>{invite.email}</span>
                      <span className={styles.chipSub}>
                        {MEMBER_ROLE_LABELS[invite.role]} · pending
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => void cancelInvite(invite)}
                      aria-label={`Cancel invite to ${invite.email}`}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <MemberDialog
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        projectId={projectId}
      />
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        projectId={projectId}
        onInvited={(invite) =>
          setInvites((prev) => [
            invite,
            ...prev.filter((i) => i.id !== invite.id),
          ])
        }
      />
      <ClientDialog
        open={clientOpen}
        onClose={() => setClientOpen(false)}
        projectId={projectId}
      />
    </section>
  );
}
