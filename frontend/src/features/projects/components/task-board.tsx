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
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { projectStore } from '../projects.store';
import { groupByStatus, resolveMembers } from '../task-utils';
import { TaskCard } from './task-card';
import { QuickAddCard } from './quick-add-card';
import styles from './tasks.module.css';

interface DropTarget {
  status: TaskStatus;
  /** Insert the dragged card before this task id; `null` means append. */
  beforeId: string | null;
}

export interface TaskBoardProps {
  tasks: Task[];
  members: ProjectMember[];
  features: Feature[];
  projectId: string;
  onOpenTask: (task: Task) => void;
  /** When false (e.g. a client), the board is view-only. */
  canEdit: boolean;
}

export function TaskBoard({
  tasks,
  members,
  features,
  projectId,
  onOpenTask,
  canEdit,
}: TaskBoardProps) {
  const groups = groupByStatus(tasks);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const featureById = new Map(features.map((f) => [f.id, f]));
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  // Which columns are collapsed to a rail — view-only state (desktop).
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set());

  function toggleCollapsed(status: TaskStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function handleDrop(event: React.DragEvent, status: TaskStatus) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain');
    const target: DropTarget = dropTarget ?? { status, beforeId: null };
    setDropTarget(null);
    if (!taskId || target.beforeId === taskId) return;

    const columnIds = groups[target.status]
      .map((t) => t.id)
      .filter((id) => id !== taskId);
    const insertAt = target.beforeId
      ? columnIds.indexOf(target.beforeId)
      : columnIds.length;
    columnIds.splice(insertAt < 0 ? columnIds.length : insertAt, 0, taskId);

    // Skip the round-trip if nothing actually moved.
    const currentIds = groups[target.status].map((t) => t.id);
    const unchanged =
      currentIds.length === columnIds.length &&
      currentIds.every((id, i) => id === columnIds[i]);
    if (unchanged) return;

    void projectStore.reorderTasks(projectId, {
      status: target.status,
      orderedIds: columnIds,
    });
  }

  return (
    <div className={styles.board}>
      {TASK_STATUS_ORDER.map((status) => {
        const columnTasks = groups[status];
        const isDropCol = dropTarget?.status === status;
        const isCollapsed = collapsed.has(status);
        return (
          <div
            key={status}
            data-status={status}
            className={cx(
              styles.column,
              isDropCol && styles.columnDragOver,
              isCollapsed && styles.columnCollapsed,
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget({ status, beforeId: null });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setDropTarget((cur) => (cur?.status === status ? null : cur));
              }
            }}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div
              className={styles.columnHead}
              onClick={isCollapsed ? () => toggleCollapsed(status) : undefined}
            >
              <span className={styles.columnDot} />
              <span className={styles.columnTitle}>
                {TASK_STATUS_LABELS[status]}
              </span>
              <span className={styles.columnCount}>{columnTasks.length}</span>
              <button
                type="button"
                className={styles.collapseBtn}
                aria-label={isCollapsed ? 'Expand column' : 'Collapse column'}
                aria-expanded={!isCollapsed}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapsed(status);
                }}
              >
                <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={16} />
              </button>
            </div>
            <div className={styles.columnBody}>
              {columnTasks.length === 0 && (
                <p className={styles.columnEmpty}>No tasks</p>
              )}
              {columnTasks.map((task, index) => (
                <div
                  key={task.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    setDropTarget({
                      status,
                      beforeId: after
                        ? (columnTasks[index + 1]?.id ?? null)
                        : task.id,
                    });
                  }}
                >
                  {isDropCol && dropTarget?.beforeId === task.id && (
                    <div className={styles.dropLine} />
                  )}
                  <TaskCard
                    task={task}
                    assignees={resolveMembers(task.assigneeIds, memberById)}
                    members={members}
                    onAssigneesChange={(assigneeIds) =>
                      void projectStore.updateTask(projectId, task.id, {
                        assigneeIds,
                      })
                    }
                    featureName={
                      task.featureId
                        ? featureById.get(task.featureId)?.name
                        : undefined
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
                </div>
              ))}
              {isDropCol && dropTarget?.beforeId === null && (
                <div className={styles.dropLine} />
              )}
              {canEdit && <QuickAddCard projectId={projectId} status={status} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
