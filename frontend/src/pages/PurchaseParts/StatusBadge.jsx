import { Badge } from '@/components/ui';

/**
 * tones: { [status]: { variant, label, icon } } - a status that is not listed uses `fallback`.
 */
export default function StatusBadge({ status, tones, fallback = { variant: 'warning' }, className }) {
  const { variant, label, icon: Icon } = tones[status] || fallback;
  return (
    <Badge variant={variant} className={className}>
      {Icon && <Icon />}
      {label || status}
    </Badge>
  );
}
