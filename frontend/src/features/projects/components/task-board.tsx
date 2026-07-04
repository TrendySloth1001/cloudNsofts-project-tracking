'use client';

import { useState } from 'react';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type ProjectMember,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { projectStore } from '../projects.store';
import { groupByStatus } from '../task-utils';
import { TaskCard } from './task-card';
import styles from './tasks.module.css';

export interface TaskBoardProps {
  tasks: Task[];
  members: ProjectMember[];
  projectId: string;
  onAddTask: (status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
}

export function TaskBoard({
  tasks,
  members,
  projectId,
  onAddTask,
  onOpenTask,
}: TaskBoardProps) {
  const groups = groupByStatus(tasks);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  function handleDrop(event: React.DragEvent, status: TaskStatus) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) projectStore.updateTask(projectId, taskId, { status });
    setDragOver(null);
  }

  return (
    <div className={styles.board}>
      {TASK_STATUS_ORDER.map((status) => (
        <div
          key={status}
          className={cx(
            styles.column,
            dragOver === status && styles.columnDragOver,
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(status);
          }}
          onDragLeave={() =>
            setDragOver((current) => (current === status ? null : current))
          }
          onDrop={(e) => handleDrop(e, status)}
        >
          <div className={styles.columnHead}>
            <span className={styles.columnTitle}>
              {TASK_STATUS_LABELS[status]}
            </span>
            <span className={styles.columnCount}>{groups[status].length}</span>
          </div>
          <div className={styles.columnBody}>
            {groups[status].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                assignee={memberById.get(task.assigneeId ?? '')}
                onOpen={() => onOpenTask(task)}
              />
            ))}
            <button
              type="button"
              className={styles.addCard}
              onClick={() => onAddTask(status)}
            >
              <Icon name="add" size={15} />
              Add task
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
