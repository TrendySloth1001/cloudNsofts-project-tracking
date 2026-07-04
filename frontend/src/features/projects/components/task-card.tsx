import type { ProjectMember, Task } from '@cnsofts/shared';
import { Icon } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { cx } from '@/lib/cx';
import { formatDate, isOverdue } from '../task-utils';
import { TaskPriorityBadge } from './task-priority-badge';
import styles from './tasks.module.css';

export interface TaskCardProps {
  task: Task;
  assignee?: ProjectMember;
  onOpen: () => void;
}

export function TaskCard({ task, assignee, onOpen }: TaskCardProps) {
  const overdue = task.status !== 'done' && isOverdue(task.dueDate);
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.card}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <span className={styles.cardTitle}>{task.title}</span>

      <div className={styles.cardMeta}>
        <TaskPriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cx(styles.due, overdue && styles.overdue)}>
            <Icon
              name="calendar"
              size={13}
              tone={overdue ? undefined : 'warning'}
            />
            {formatDate(task.dueDate)}
          </span>
        )}
        <span className={styles.spacer} />
        {assignee && (
          <UserAvatar name={assignee.name} seed={assignee.id} size={22} />
        )}
      </div>
    </div>
  );
}
