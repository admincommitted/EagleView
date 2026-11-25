import { Search } from 'lucide-react';
import { Button, DataTable, Input, Modal } from '@/components/ui';

const FIELD_LABELS = { ritc: 'RITC / HS code', cth: 'CTH (customs tariff heading)', ceth: 'CETH (central excise tariff heading)' };

const TARIFF_COLUMNS = [
  { key: 'hsnCode', header: 'HS code', width: 110, className: 'tw:font-bold tw:text-primary' },
  { key: 'description', header: 'Description', className: 'tw:min-w-[220px] tw:whitespace-normal' },
  { key: 'uqc', header: 'UQC', width: 60 },
  { key: 'bcd', header: 'BCD %', width: 70, cell: (row) => (row.bcd != null ? row.bcd : '') },
];

// RITC / CTH / CETH lookup on the Tariff master (the (i) buttons next to those boxes on the Item's Details row)
export default function SearchSection({ ctx }) {
  const { tariffSearch, setTariffSearch, runTariffSearch, pickTariff } = ctx;
  if (!tariffSearch) return null;
  const label = FIELD_LABELS[tariffSearch.field] || 'Tariff';
  const close = () => setTariffSearch({ ...tariffSearch, open: false });
  const emptyText = tariffSearch.loading
    ? 'Searching the Tariff master…'
    : tariffSearch.searched ? 'Nothing found - try fewer digits or another word' : 'Type a code or a description and press Enter';

  return (
    <Modal
      open={tariffSearch.open}
      onClose={close}
      title={`Search ${label}`}
      width={760}
      footer={(
        <div className="tw:flex tw:w-full tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
          <span className="tw:text-[11px] tw:font-normal tw:text-muted-foreground">
            Click a line to put its code in the {label.split(' ')[0]} box{tariffSearch.field === 'ritc' ? ' (CTH / CETH too when empty; description when the auto switch is on or the box is empty)' : ''}.
          </span>
          <Button onClick={close}>Close</Button>
        </div>
      )}
    >
      <div className="tw:flex tw:flex-col tw:gap-2">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Input
            autoFocus
            data-allow-text
            leftIcon={Search}
            placeholder="HS code (digits) or words of the description - Enter to search"
            value={tariffSearch.q}
            onChange={(event) => setTariffSearch({ ...tariffSearch, q: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Enter') runTariffSearch(); }}
          />
          <Button variant="default" onClick={() => runTariffSearch()}>{tariffSearch.loading ? 'Searching…' : 'Search'}</Button>
        </div>
        <DataTable
          columns={TARIFF_COLUMNS}
          rows={tariffSearch.rows}
          rowKey={(row, index) => row.id || index}
          onRowClick={pickTariff}
          emptyText={emptyText}
          containerClassName="tw:min-h-[200px] tw:max-h-[55vh]"
        />
      </div>
    </Modal>
  );
}
