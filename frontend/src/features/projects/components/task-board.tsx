'use client';

import { useState } from 'react';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type ProjectMember,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';
import { cx } from '@/lib/cx';
import { projectStore } from '../projects.store';
import { groupByStatus } from '../task-utils';
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
  projectId: string;
  onOpenTask: (task: Task) => void;
}

export function TaskBoard({
  tasks,
  members,
  projectId,
  onOpenTask,
}: TaskBoardProps) {
  const groups = groupByStatus(tasks);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

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
        return (
          <div
            key={status}
            className={cx(styles.column, isDropCol && styles.columnDragOver)}
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
            <div className={styles.columnHead}>
              <span className={styles.columnTitle}>
                {TASK_STATUS_LABELS[status]}
              </span>
              <span className={styles.columnCount}>{columnTasks.length}</span>
            </div>
            <div className={styles.columnBody}>
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
                    assignee={memberById.get(task.assigneeId ?? '')}
                    onOpen={() => onOpenTask(task)}
                  />
                </div>
              ))}
              {isDropCol && dropTarget?.beforeId === null && (
                <div className={styles.dropLine} />
              )}
              <QuickAddCard projectId={projectId} status={status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
