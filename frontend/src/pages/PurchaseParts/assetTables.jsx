import { FileText, History, Image as ImageIcon, Plus, Trash2, UserPlus } from 'lucide-react';
import { Button, DataTable } from '@/components/ui';
import StatusBadge from './StatusBadge';
import { rupees, vendorName } from './purchaseFormat';

const LINK = 'tw:font-bold tw:text-primary tw:underline';
const PO_MARK = 'PO:';

const ASSET_STATUS_TONES = {
  IN_STOCK: { variant: 'info', label: 'IN STOCK' },
  ASSIGNED: { variant: 'success', label: 'ASSIGNED' },
};
const statusFallback = (status) => ({ variant: 'danger', label: String(status).replace('_', ' ') });

export function AssetInwardTable({ rows, onReceive }) {
  const columns = [
    { key: 'srNo', header: 'Sr. No.', width: 60, cell: (row, index) => index + 1 },
    { key: 'poNumber', header: 'PO Number', cell: ({ po }) => <a href={`/po-view/${po.id}`} target="_blank" rel="noreferrer" className={LINK}>{po.poNumber}</a> },
    {
      key: 'vendor', header: 'Vendor',
      cell: ({ po }) => <>{vendorName(po)}<div className="tw:text-[11px] tw:text-muted-foreground">{po.branch}</div></>,
    },
    { key: 'itemName', header: 'Item Name', cell: ({ item }) => <b>{item.itemName}</b> },
    { key: 'quantity', header: 'Qty', cell: ({ item }) => item.quantity },
    { key: 'unitPrice', header: 'Unit Price', cell: ({ item }) => rupees(item.unitPrice) },
    { key: 'action', header: 'Action', cell: ({ item, po }) => <Button variant="success" size="sm" onClick={() => onReceive(item, po)}><Plus /> Receive</Button> },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(row) => row.item.id} emptyText="No approved POs pending inward." className="tw:text-entry" />;
}

function AssetDescription({ asset }) {
  const fromPo = asset.description && asset.description.includes('Received via PO:') && asset.sourcePurchaseId;
  if (!fromPo) return asset.description || 'No description';
  const [before, poNumber] = asset.description.split(PO_MARK);
  return (
    <span>
      {before} {PO_MARK}
      <a href={`/po-view/${asset.sourcePurchaseId}`} target="_blank" rel="noreferrer" className={`tw:ml-1 ${LINK}`}>{poNumber}</a>
    </span>
  );
}

function AssetStatus({ asset }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-1">
      <StatusBadge status={asset.status} tones={ASSET_STATUS_TONES} fallback={statusFallback(asset.status)} className="tw:rounded-sm" />
      {asset.status === 'ASSIGNED' && (
        <div className="tw:text-[11px] tw:text-success"><b>Assigned To:</b><br />{asset.assignedTo}<br />({asset.assignedDepartment})</div>
      )}
      {asset.status === 'DISCARDED' && (
        <div className="tw:text-[11px] tw:text-destructive">
          <b>Reason:</b><br />{asset.discardReason}
          {asset.discardPhotoUrl && <div className="tw:mt-1"><a href={asset.discardPhotoUrl} target="_blank" rel="noreferrer" className="tw:text-primary">View Discard Record</a></div>}
        </div>
      )}
    </div>
  );
}

function AssetPhoto({ asset }) {
  if (asset.photoUrl) return <img src={asset.photoUrl} alt={asset.assetName} className="tw:size-[50px] tw:rounded-sm tw:border tw:border-border tw:object-cover" />;
  return (
    <div className="tw:flex tw:size-[50px] tw:flex-col tw:items-center tw:justify-center tw:rounded-sm tw:bg-muted tw:text-muted-foreground">
      <ImageIcon className="tw:size-4" />
      <span className="tw:mt-0.5 tw:text-[8px]">N/A</span>
    </div>
  );
}

const assetActions = (asset) => [
  { dialog: 'photo', label: 'Add Photo', icon: ImageIcon, variant: 'default' },
  { dialog: 'bill', label: 'Upload Bill', icon: FileText, variant: 'secondary' },
  asset.status !== 'DISCARDED' && { dialog: 'assign', label: 'Edit/Assign', icon: UserPlus, variant: 'success' },
  asset.status !== 'DISCARDED' && { dialog: 'discard', label: 'Discard', icon: Trash2, variant: 'destructive' },
  { dialog: 'history', label: 'History', icon: History, variant: 'warning' },
].filter(Boolean);

export function AssetDirectoryTable({ assets, onOpenDialog }) {
  const columns = [
    { key: 'srNo', header: 'Sr. No.', width: 60, cell: (asset, index) => index + 1 },
    {
      key: 'asset', header: 'Asset Details',
      cell: (asset) => (
        <>
          <div className="tw:text-[11px] tw:font-bold tw:text-primary">{asset.assetTag || 'NO TAG'}</div>
          <b className="tw:text-sm">{asset.assetName}</b>
        </>
      ),
    },
    {
      key: 'description', header: 'Description & Value', className: 'tw:whitespace-normal',
      cell: (asset) => (
        <>
          <div className="tw:text-muted-foreground"><AssetDescription asset={asset} /></div>
          <div className="tw:mt-1"><b>Value:</b> ₹{asset.purchaseValue || '0'}</div>
          {asset.billUrl && <div className="tw:mt-1"><a href={asset.billUrl} target="_blank" rel="noreferrer" className="tw:text-[11px] tw:text-primary">View Bill/Warranty</a></div>}
        </>
      ),
    },
    { key: 'status', header: 'Status / Assignment', cell: (asset) => <AssetStatus asset={asset} /> },
    { key: 'photo', header: 'Photo', cell: (asset) => <AssetPhoto asset={asset} /> },
    {
      key: 'action', header: 'Action',
      cell: (asset) => (
        <div className="tw:flex tw:flex-nowrap tw:gap-1.5">
          {assetActions(asset).map(({ dialog, label, icon: Icon, variant }) => (
            <Button key={dialog} size="sm" variant={variant} onClick={() => onOpenDialog(dialog, asset)}><Icon /> {label}</Button>
          ))}
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} rows={assets} emptyText="No assets found matching the search criteria." className="tw:text-entry" />;
}
