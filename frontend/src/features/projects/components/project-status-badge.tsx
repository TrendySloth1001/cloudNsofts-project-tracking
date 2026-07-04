import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@cnsofts/shared';
import { Badge, type BadgeVariant } from '@/components/ui';

const STATUS_VARIANT: Record<ProjectStatus, BadgeVariant> = {
  planning: 'info',
  active: 'teal',
  on_hold: 'warning',
  completed: 'primary',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} dot>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}
