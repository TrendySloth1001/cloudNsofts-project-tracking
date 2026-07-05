import { FEATURE_STATUS_LABELS, type FeatureStatus } from '@cnsofts/shared';
import { Badge, type BadgeVariant } from '@/components/ui';

/** Feature lifecycle status → badge color. */
const FEATURE_STATUS_VARIANT: Record<FeatureStatus, BadgeVariant> = {
  planned: 'neutral',
  active: 'info',
  shipped: 'success',
};

export function FeatureStatusBadge({
  status,
  size = 'sm',
  className,
}: {
  status: FeatureStatus;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <Badge
      variant={FEATURE_STATUS_VARIANT[status]}
      size={size}
      dot
      className={className}
    >
      {FEATURE_STATUS_LABELS[status]}
    </Badge>
  );
}
