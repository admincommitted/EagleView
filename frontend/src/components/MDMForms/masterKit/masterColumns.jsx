import { Badge, Button } from '@/components/ui';

export const isActiveRecord = (record) => record.isActive === true || record.isActive === 1;

// MasterPage rowClassName: a switched-off row is shown faded
export const dimRowWhenInactive = (record) => (isActiveRecord(record) ? '' : 'tw:opacity-55');

export const activeColumn = {
  key: 'isActive',
  header: 'Status',
  align: 'center',
  width: 90,
  cell: (record) => <Badge variant={isActiveRecord(record) ? 'success' : 'danger'}>{isActiveRecord(record) ? 'Active' : 'Inactive'}</Badge>,
};

// Edit, and Switch off / on when onSwitch is given
export const masterActionsColumn = ({ onEdit, onSwitch }) => ({
  key: 'actions',
  header: 'Action',
  align: 'right',
  width: 150,
  cell: (record) => (
    <span className="tw:inline-flex tw:gap-1">
      <Button variant="link" size="sm" onClick={(event) => { event.stopPropagation(); onEdit(record); }}>Edit</Button>
      {onSwitch && (
        <Button variant="link" size="sm" className={isActiveRecord(record) ? 'tw:text-warning' : 'tw:text-success'}
          onClick={(event) => { event.stopPropagation(); onSwitch(record); }}>
          {isActiveRecord(record) ? 'Switch off' : 'Switch on'}
        </Button>
      )}
    </span>
  ),
});
