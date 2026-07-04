import { TASK_PRIORITY_LABELS, type TaskPriority } from '@cnsofts/shared';
import { Badge, type BadgeVariant } from '@/components/ui';

const PRIORITY_VARIANT: Record<TaskPriority, BadgeVariant> = {
  low: 'neutral',
  medium: 'info',
  high: 'danger',
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} size="sm">
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
