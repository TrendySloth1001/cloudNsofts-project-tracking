'use client';

import { useState } from 'react';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type Feature,
  type ProjectMember,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';
import { Icon, IconButton, Menu, useConfirm } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { cx } from '@/lib/cx';
import { projectStore } from '../projects.store';
import {
  featureProgress,
  formatDate,
  groupByFeature,
  resolveMembers,
} from '../task-utils';
import { projectTint } from '../project-visuals';
import { TaskCard } from './task-card';
import { QuickAddCard } from './quick-add-card';
import { FeatureStatusBadge } from './feature-status-badge';
import { AssigneePicker } from './assignee-picker';
import styles from './tasks.module.css';

const NO_FEATURE = '__none__';
/** Custom drag payload key for swimlane reordering — distinct from the
 *  `text/plain` used by card drags so the two never collide. */
const LANE_MIME = 'application/x-feature';
const MAX_LANE_AVATARS = 4;

export interface TaskBoardSwimlanesProps {
  tasks: Task[];
  features: Feature[];
  members: ProjectMember[];
  projectId: string;
  onOpenTask: (task: Task) => void;
  onEditFeature: (feature: Feature) => void;
  /** Share the feature into a discussion channel. */
  onShareFeature: (feature: Feature) => void;
  /** When false (viewer/client): read-only — no drag, quick-add, or feature edit. */
  canEdit: boolean;
}

interface DropCell {
  laneKey: string;
  status: TaskStatus;
}

/**
 * The board grouped into feature **swimlanes**: one collapsible row per feature
 * (plus a "No feature" row for ungrouped tasks), each showing the four status
 * columns for that feature's tasks. Dragging a card to a cell reassigns its
 * status and/or feature in one move.
 */
export function TaskBoardSwimlanes({
  tasks,
  features,
  members,
  projectId,
  onOpenTask,
  onEditFeature,
  onShareFeature,
  canEdit,
}: TaskBoardSwimlanesProps) {
  const lanes = groupByFeature(tasks, features);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dropCell, setDropCell] = useState<DropCell | null>(null);
  // Swimlane reordering: the dragged feature id + where it would land
  // (insert before this feature id; null = after the last feature).
  const [laneDrag, setLaneDrag] = useState<string | null>(null);
  const [laneDropBefore, setLaneDropBefore] = useState<string | null>(null);
  const [laneDropEnd, setLaneDropEnd] = useState(false);
  const confirm = useConfirm();

  const isLaneDrag = (event: React.DragEvent) =>
    event.dataTransfer.types.includes(LANE_MIME);

  function clearLaneDrag() {
    setLaneDrag(null);
    setLaneDropBefore(null);
    setLaneDropEnd(false);
  }

  function handleLaneDrop(event: React.DragEvent) {
    if (!isLaneDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const draggedId = event.dataTransfer.getData(LANE_MIME);
    const beforeId = laneDropEnd ? null : laneDropBefore;
    const hadTarget = laneDropEnd || laneDropBefore !== null;
    clearLaneDrag();
    if (!draggedId || !hadTarget) return;
    const ids = features.map((f) => f.id).filter((id) => id !== draggedId);
    const insertAt = beforeId ? ids.indexOf(beforeId) : ids.length;
    ids.splice(insertAt < 0 ? ids.length : insertAt, 0, draggedId);
    const current = features.map((f) => f.id);
    if (current.every((id, i) => id === ids[i])) return;
    void projectStore.reorderFeatures(projectId, { orderedIds: ids });
  }

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleDrop(
    featureId: string | null,
    status: TaskStatus,
    event: React.DragEvent,
  ) {
    event.preventDefault();
    setDropCell(null);
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    // No-op if the card is already in this exact cell.
    if (task.status === status && (task.featureId ?? null) === featureId) return;
    void projectStore.updateTask(projectId, taskId, { status, featureId });
  }

  async function deleteFeature(feature: Feature) {
    const ok = await confirm({
      title: 'Delete feature?',
      message: (
        <>
          Delete <strong>“{feature.name}”</strong>? Its tasks stay on the board
          but become ungrouped.
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) void projectStore.removeFeature(projectId, feature.id);
  }

  if (lanes.length === 0) {
    return (
      <p className={styles.swimlanesEmpty}>
        No features yet — create one to organize the board by feature.
      </p>
    );
  }

  return (
    <div className={styles.swimlanes}>
      {lanes.map((lane) => {
        const key = lane.feature?.id ?? NO_FEATURE;
        const featureId = lane.feature?.id ?? null;
        const isCollapsed = collapsed.has(key);
        const { done, total } = featureProgress(lane.tasks);
        const pct = total ? Math.round((done / total) * 100) : 0;
        const owners = lane.feature
          ? resolveMembers(lane.feature.ownerIds, memberById)
          : [];
        const accent = lane.feature ? projectTint(lane.feature.id).fg : undefined;
        // Members actively working in this feature = unique task assignees.
        const activeMembers = lane.tasks.reduce<typeof members>((acc, t) => {
          for (const memberId of t.assigneeIds) {
            if (acc.some((m) => m.id === memberId)) continue;
            const member = memberById.get(memberId);
            if (member) acc.push(member);
          }
          return acc;
        }, []);
        const visibleMembers = activeMembers.slice(0, MAX_LANE_AVATARS);
        const extraMembers = activeMembers.length - visibleMembers.length;
        const featureIndex = lane.feature
          ? features.findIndex((f) => f.id === lane.feature?.id)
          : -1;
        const isLastFeature =
          featureIndex >= 0 && featureIndex === features.length - 1;

        return (
          <section
            key={key}
            className={cx(
              styles.swimlane,
              laneDrag === lane.feature?.id && styles.swimlaneDragging,
            )}
            onDragOver={
              lane.feature
                ? (e) => {
                    if (!isLaneDrag(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    if (after && isLastFeature) {
                      setLaneDropEnd(true);
                      setLaneDropBefore(null);
                    } else {
                      setLaneDropEnd(false);
                      setLaneDropBefore(
                        after
                          ? (features[featureIndex + 1]?.id ?? null)
                          : (lane.feature?.id ?? null),
                      );
                    }
                  }
                : undefined
            }
            onDrop={lane.feature ? handleLaneDrop : undefined}
          >
            {lane.feature && (
              <div
                className={styles.laneTopBar}
                title={`${done}/${total} done`}
                aria-hidden="true"
              >
                <span
                  className={styles.laneTopFill}
                  style={{
                    width: `${pct}%`,
                    ...(accent ? { background: accent } : {}),
                  }}
                />
              </div>
            )}
            {laneDrag && laneDropBefore === lane.feature?.id && (
              <div className={styles.laneDropLine} />
            )}
            <header className={styles.swimlaneHead}>
              {canEdit && lane.feature && (
                <span
                  className={styles.laneGrip}
                  title="Drag to reorder"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(LANE_MIME, lane.feature?.id ?? '');
                    e.dataTransfer.effectAllowed = 'move';
                    setLaneDrag(lane.feature?.id ?? null);
                  }}
                  onDragEnd={clearLaneDrag}
                >
                  <Icon name="gripVertical" size={14} />
                </span>
              )}
              <button
                type="button"
                className={styles.laneCollapse}
                onClick={() => toggle(key)}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? 'Expand feature' : 'Collapse feature'}
              >
                <Icon
                  name={isCollapsed ? 'chevronRight' : 'chevronDown'}
                  size={16}
                />
              </button>
              {lane.feature?.pinned && (
                <span className={styles.lanePinned} title="Pinned to top">
                  <Icon name="pin" size={13} />
                </span>
              )}
              <span className={styles.laneName}>
                {lane.feature?.name ?? 'No feature'}
              </span>
              {lane.feature && <FeatureStatusBadge status={lane.feature.status} />}
              {total > 0 && (
                <span className={styles.laneProgressText}>
                  {done}/{total}
                </span>
              )}
              {activeMembers.length > 0 && (
                <span
                  className={styles.laneAvatars}
                  title={activeMembers.map((m) => m.name).join(', ')}
                >
                  {visibleMembers.map((m) => (
                    <span key={m.id} className={styles.laneAvatar}>
                      <UserAvatar name={m.name} seed={m.id} size={22} />
                    </span>
                  ))}
                  {extraMembers > 0 && (
                    <span className={styles.laneAvatarMore}>
                      +{extraMembers}
                    </span>
                  )}
                </span>
              )}
              <span className={styles.laneSpacer} />
              {lane.feature?.targetDate && (
                <span className={styles.laneDate}>
                  <Icon name="calendar" size={13} tone="warning" />
                  {formatDate(lane.feature.targetDate)}
                </span>
              )}
              {owners.length > 0 && (
                <span
                  className={styles.laneAvatars}
                  title={`Owners: ${owners.map((m) => m.name).join(', ')}`}
                >
                  {owners.slice(0, MAX_LANE_AVATARS).map((m) => (
                    <span key={m.id} className={styles.laneAvatar}>
                      <UserAvatar name={m.name} seed={m.id} size={22} />
                    </span>
                  ))}
                  {owners.length > MAX_LANE_AVATARS && (
                    <span className={styles.laneAvatarMore}>
                      +{owners.length - MAX_LANE_AVATARS}
                    </span>
                  )}
                </span>
              )}
              {canEdit && lane.feature && (
                <AssigneePicker
                  members={members}
                  values={lane.feature.ownerIds}
                  onChange={(ownerIds) => {
                    const featureId = lane.feature?.id;
                    if (featureId) {
                      void projectStore.updateFeature(projectId, featureId, {
                        ownerIds,
                      });
                    }
                  }}
                  label="Assign owners"
                />
              )}
              {canEdit && lane.feature && (
                <Menu
                  portal
                  align="end"
                  trigger={
                    <IconButton
                      icon="moreVertical"
                      label="Feature actions"
                      variant="ghost"
                      size="sm"
                    />
                  }
                  items={[
                    {
                      label: lane.feature.pinned ? 'Unpin' : 'Pin to top',
                      icon: lane.feature.pinned ? 'pinOff' : 'pin',
                      onSelect: () => {
                        const f = lane.feature as Feature;
                        void projectStore.updateFeature(projectId, f.id, {
                          pinned: !f.pinned,
                        });
                      },
                    },
                    {
                      label: 'Edit feature',
                      icon: 'edit',
                      onSelect: () => onEditFeature(lane.feature as Feature),
                    },
                    {
                      label: 'Share to discussion',
                      icon: 'share',
                      onSelect: () => onShareFeature(lane.feature as Feature),
                    },
                    { separator: true },
                    {
                      label: 'Delete feature',
                      icon: 'delete',
                      danger: true,
                      onSelect: () => void deleteFeature(lane.feature as Feature),
                    },
                  ]}
                />
              )}
            </header>

            {!isCollapsed && (
              <div className={styles.laneBoard}>
                {TASK_STATUS_ORDER.map((status) => {
                  const cellTasks = lane.tasks.filter((t) => t.status === status);
                  const isDrop =
                    dropCell?.laneKey === key && dropCell.status === status;
                  return (
                    <div
                      key={status}
                      data-status={status}
                      className={cx(
                        styles.laneCol,
                        isDrop && styles.laneColDragOver,
                      )}
                      onDragOver={(e) => {
                        if (isLaneDrag(e)) return; // lane drags land on the section
                        e.preventDefault();
                        setDropCell({ laneKey: key, status });
                      }}
                      onDragLeave={(e) => {
                        if (
                          !e.currentTarget.contains(
                            e.relatedTarget as Node | null,
                          )
                        ) {
                          setDropCell((c) =>
                            c?.laneKey === key && c.status === status ? null : c,
                          );
                        }
                      }}
                      onDrop={(e) => handleDrop(featureId, status, e)}
                    >
                      <div className={styles.laneColHead}>
                        <span className={styles.laneColDot} />
                        <span className={styles.laneColTitle}>
                          {TASK_STATUS_LABELS[status]}
                        </span>
                        <span className={styles.laneColCount}>
                          {cellTasks.length}
                        </span>
                      </div>
                      <div className={styles.laneColBody}>
                        {cellTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            assignees={resolveMembers(
                              task.assigneeIds,
                              memberById,
                            )}
                            members={members}
                            onAssigneesChange={(assigneeIds) =>
                              void projectStore.updateTask(projectId, task.id, {
                                assigneeIds,
                              })
                            }
                            onOpen={() => onOpenTask(task)}
                            canEdit={canEdit}
                            onMove={(next) => {
                              if (next !== task.status) {
                                void projectStore.updateTask(projectId, task.id, {
                                  status: next,
                                });
                              }
                            }}
                          />
                        ))}
                        {canEdit && (
                          <QuickAddCard
                            projectId={projectId}
                            status={status}
                            featureId={featureId}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {laneDrag && laneDropEnd && isLastFeature && (
              <div className={styles.laneDropLine} />
            )}
          </section>
        );
      })}
    </div>
  );
}
