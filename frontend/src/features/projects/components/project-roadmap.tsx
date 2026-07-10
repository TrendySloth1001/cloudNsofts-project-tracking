'use client';

import { useState } from 'react';
import {
  MILESTONE_STATUS_LABELS,
  milestoneStatusSchema,
  type MessageAttachment,
  type Milestone,
  type MilestoneStatus,
  type Project,
} from '@cnsofts/shared';
import {
  Badge,
  Button,
  Card,
  Icon,
  type IconName,
  IconButton,
  Input,
  Markdown,
  Menu,
  useConfirm,
} from '@/components/ui';
import { cx } from '@/lib/cx';
import { projectStore } from '../projects.store';
import { formatDate, isOverdue } from '../task-utils';
import { MilestoneStatusBadge } from './milestone-status-badge';
import { MilestoneDialog } from './milestone-dialog';
import { ShareToChannelDialog } from './share-to-channel-dialog';
import styles from './project-roadmap.module.css';

export interface ProjectRoadmapProps {
  project: Project;
  /** Caller may add/edit/reorder checkpoints & set the deadline. */
  canEdit: boolean;
}

type NodeState = 'upcoming' | 'in_progress' | 'done' | 'overdue';

/** Visual state of a checkpoint's timeline node (overdue overrides the stage). */
function nodeState(m: Milestone): NodeState {
  if (m.status === 'done') return 'done';
  if (isOverdue(m.dueDate)) return 'overdue';
  return m.status;
}

/** Whole days from today to a date (negative = in the past). */
function daysUntil(iso: string): number {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return 0;
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Countdown pill copy + tone for the final deadline. */
function deadlineCountdown(
  dueDate: string,
  completed: boolean,
): { label: string; tone: 'success' | 'danger' | 'warning' | 'info' } {
  if (completed) return { label: 'Delivered', tone: 'success' };
  const days = daysUntil(dueDate);
  if (days < 0) {
    const n = -days;
    return { label: `Overdue by ${n} day${n === 1 ? '' : 's'}`, tone: 'danger' };
  }
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days <= 7)
    return { label: `${days} day${days === 1 ? '' : 's'} left`, tone: 'warning' };
  return { label: `${days} days left`, tone: 'info' };
}

const STATUS_ICON: Record<MilestoneStatus, IconName> = {
  upcoming: 'clock',
  in_progress: 'flag',
  done: 'checkCircle',
};

export function ProjectRoadmap({ project, canEdit }: ProjectRoadmapProps) {
  const confirm = useConfirm();
  const milestones = project.milestones;
  const [dialog, setDialog] = useState<{
    open: boolean;
    milestone: Milestone | null;
  }>({ open: false, milestone: null });
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const [share, setShare] = useState<{
    attachment: MessageAttachment;
    name: string;
  } | null>(null);

  const doneCount = milestones.filter((m) => m.status === 'done').length;
  const total = milestones.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const projectCompleted = project.status === 'completed';

  function openCreate() {
    setDialog({ open: true, milestone: null });
  }
  function openEdit(milestone: Milestone) {
    setDialog({ open: true, milestone });
  }

  async function remove(milestone: Milestone) {
    const ok = await confirm({
      title: 'Delete checkpoint?',
      message: (
        <>
          Delete <strong>“{milestone.title}”</strong>? This can’t be undone.
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await projectStore.removeMilestone(project.id, milestone.id);
  }

  function setStatus(milestone: Milestone, status: MilestoneStatus) {
    void projectStore.updateMilestone(project.id, milestone.id, { status });
  }

  function setDeadline(value: string) {
    void projectStore.updateProject(project.id, { dueDate: value || null });
  }

  // ---- Drag-to-reorder (native HTML5 DnD, matching the board). ----
  function handleRowDragOver(event: React.DragEvent, id: string) {
    if (!dragId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    setOver({ id, after });
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const draggedId = dragId;
    const target = over;
    setDragId(null);
    setOver(null);
    if (!draggedId || !target) return;
    const ids = milestones.map((m) => m.id).filter((id) => id !== draggedId);
    let idx = ids.indexOf(target.id);
    if (idx < 0) idx = ids.length;
    else if (target.after) idx += 1;
    ids.splice(idx, 0, draggedId);
    const current = milestones.map((m) => m.id);
    if (current.length === ids.length && current.every((id, i) => id === ids[i]))
      return;
    void projectStore.reorderMilestones(project.id, { orderedIds: ids });
  }

  return (
    <div className={styles.roadmap}>
      <aside className={styles.side}>
        <section className={styles.deadlineCard}>
        <div className={styles.deadlineMain}>
          <span className={styles.deadlineIcon}>
            <Icon name="flag" size={20} tone="brand" />
          </span>
          <div className={styles.deadlineText}>
            <p className={styles.deadlineLabel}>Final deadline</p>
            {canEdit ? (
              <Input
                type="date"
                inputSize="sm"
                containerClassName={styles.deadlineInput}
                value={project.dueDate ?? ''}
                onChange={(e) => setDeadline(e.target.value)}
              />
            ) : (
              <p className={styles.deadlineValue}>
                {project.dueDate ? formatDate(project.dueDate) : 'Not set'}
              </p>
            )}
          </div>
          {project.dueDate && (
            <span
              className={styles.countdown}
              data-tone={
                deadlineCountdown(project.dueDate, projectCompleted).tone
              }
            >
              {deadlineCountdown(project.dueDate, projectCompleted).label}
            </span>
          )}
        </div>

        <div className={styles.progress}>
          <div className={styles.progressHead}>
            <span>
              {doneCount} of {total} checkpoint{total === 1 ? '' : 's'} done
            </span>
            <span className={styles.progressPct}>{pct}%</span>
          </div>
          <div className={styles.progressTrack}>
            <span className={styles.progressBar} style={{ width: `${pct}%` }} />
          </div>
        </div>
        </section>
      </aside>

      <div className={styles.main}>
      <div className={styles.listHead}>
        <h2 className={styles.listTitle}>Checkpoints</h2>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            leftIcon="add"
            onClick={openCreate}
          >
            Add checkpoint
          </Button>
        )}
      </div>

      {total === 0 ? (
        <Card className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon name="flag" size={24} tone="brand" />
          </span>
          <p className={styles.emptyTitle}>No checkpoints yet</p>
          <p className={styles.emptyText}>
            Add checkpoints to map out delivery and keep the client in the loop.
          </p>
          {canEdit && (
            <Button leftIcon="add" onClick={openCreate}>
              Add checkpoint
            </Button>
          )}
        </Card>
      ) : (
        <ol className={styles.timeline} onDrop={canEdit ? handleDrop : undefined}>
          {milestones.map((m, i) => {
            const state = nodeState(m);
            const last = i === milestones.length - 1;
            const dropTop = over?.id === m.id && !over.after;
            const dropBottom = over?.id === m.id && over.after;
            return (
              <li
                key={m.id}
                className={cx(
                  styles.row,
                  dragId === m.id && styles.dragging,
                  dropTop && styles.dropBefore,
                  dropBottom && styles.dropAfter,
                )}
                draggable={canEdit}
                onDragStart={
                  canEdit
                    ? (e) => {
                        setDragId(m.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }
                    : undefined
                }
                onDragOver={
                  canEdit ? (e) => handleRowDragOver(e, m.id) : undefined
                }
                onDragEnd={
                  canEdit
                    ? () => {
                        setDragId(null);
                        setOver(null);
                      }
                    : undefined
                }
              >
                <div className={styles.rail}>
                  <span className={styles.node} data-state={state}>
                    {state === 'done' && (
                      <Icon name="check" size={13} color="var(--color-text-on-accent)" />
                    )}
                  </span>
                  {!last && <span className={styles.line} />}
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <div className={styles.headMain}>
                      <h3 className={styles.cardTitle}>{m.title}</h3>
                      <div className={styles.badges}>
                        <MilestoneStatusBadge status={m.status} />
                        {state === 'overdue' && (
                          <Badge variant="danger" size="sm" dot>
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className={styles.actions}>
                        <span className={styles.grip} aria-hidden>
                          <Icon name="gripVertical" size={16} tone="neutral" />
                        </span>
                        <Menu
                          align="end"
                          trigger={
                            <IconButton
                              icon="moreVertical"
                              label="Checkpoint actions"
                              variant="ghost"
                              size="sm"
                            />
                          }
                          items={[
                            {
                              label: 'Edit',
                              icon: 'edit',
                              onSelect: () => openEdit(m),
                            },
                            {
                              label: 'Share to discussion',
                              icon: 'share',
                              onSelect: () =>
                                setShare({
                                  attachment: { kind: 'milestone', id: m.id },
                                  name: m.title,
                                }),
                            },
                            ...milestoneStatusSchema.options
                              .filter((s) => s !== m.status)
                              .map((s) => ({
                                label: `Mark as ${MILESTONE_STATUS_LABELS[
                                  s
                                ].toLowerCase()}`,
                                icon: STATUS_ICON[s],
                                onSelect: () => setStatus(m, s),
                              })),
                            { separator: true },
                            {
                              label: 'Delete',
                              icon: 'delete',
                              danger: true,
                              onSelect: () => remove(m),
                            },
                          ]}
                        />
                      </div>
                    )}
                  </div>

                  <div className={styles.meta}>
                    <span
                      className={cx(
                        styles.metaItem,
                        state === 'overdue' && styles.metaOverdue,
                      )}
                    >
                      <Icon name="calendar" size={14} />
                      {m.dueDate ? formatDate(m.dueDate) : 'No date'}
                    </span>
                    {m.status === 'done' && m.completedAt && (
                      <span className={styles.metaItem}>
                        <Icon name="checkCircle" size={14} tone="success" />
                        Delivered {formatDate(m.completedAt)}
                      </span>
                    )}
                  </div>

                  {m.description && (
                    <Markdown className={styles.desc}>{m.description}</Markdown>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      </div>

      <MilestoneDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, milestone: null })}
        projectId={project.id}
        milestone={dialog.milestone}
      />

      <ShareToChannelDialog
        open={share !== null}
        onClose={() => setShare(null)}
        projectId={project.id}
        attachment={share?.attachment ?? null}
        itemName={share?.name ?? ''}
      />
    </div>
  );
}
