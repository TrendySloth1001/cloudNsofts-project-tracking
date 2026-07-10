import {
  MILESTONE_STATUS_LABELS,
  type MilestoneStatus,
} from '@cnsofts/shared';
import { Badge, type BadgeVariant } from '@/components/ui';

/** Checkpoint stage → badge color. */
const MILESTONE_STATUS_VARIANT: Record<MilestoneStatus, BadgeVariant> = {
  upcoming: 'neutral',
  in_progress: 'info',
  done: 'success',
};

export function MilestoneStatusBadge({
  status,
  size = 'sm',
  className,
}: {
  status: MilestoneStatus;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <Badge
      variant={MILESTONE_STATUS_VARIANT[status]}
      size={size}
      dot
      className={className}
    >
      {MILESTONE_STATUS_LABELS[status]}
    </Badge>
  );
}
