import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

const DAY_MS = 1000 * 60 * 60 * 24;

function WarrantyRow({ asset }) {
  const days = Math.ceil((new Date(asset.warrantyExpiryDate) - new Date()) / DAY_MS);
  const isExpired = days < 0;
  return (
    <div className={cn('tw:flex tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:border-l-4 tw:bg-card tw:px-4 tw:py-3', isExpired ? 'tw:border-l-destructive' : 'tw:border-l-warning')}>
      <div className="tw:min-w-0">
        <strong className="tw:mb-1 tw:block tw:text-[13px] tw:text-foreground">{asset.assetName}</strong>
        <span className="tw:text-entry tw:text-muted-foreground">Assigned: {asset.assignedTo || 'Unassigned'}</span>
      </div>
      <span className={cn('tw:shrink-0 tw:text-[13px] tw:font-bold', isExpired ? 'tw:text-destructive' : 'tw:text-warning')}>
        {isExpired ? 'Expired' : `${days} Days Left`}
      </span>
    </div>
  );
}

/** Without emptyText the block is left out when nothing is expiring. */
export function ExpiringWarranties({ assets, emptyText }) {
  if (!assets.length && !emptyText) return null;
  return (
    <Card className="tw:border-warning/40 tw:bg-warning/5">
      <CardHeader className="tw:justify-start tw:border-b tw:border-warning/30 tw:pb-2.5">
        <CardTitle icon={<AlertTriangle />} className="tw:text-sm tw:text-warning">Expiring Asset Warranties</CardTitle>
      </CardHeader>
      <CardContent className="tw:pt-3">
        {assets.length === 0 ? (
          <p className="tw:m-0 tw:text-[13px] tw:font-medium tw:text-warning">{emptyText}</p>
        ) : (
          <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] tw:gap-4">
            {assets.map((asset) => <WarrantyRow key={asset.id} asset={asset} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
