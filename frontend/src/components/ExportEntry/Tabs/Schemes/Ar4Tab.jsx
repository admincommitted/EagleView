import { cn } from '@/lib/utils';
import { DateInput, Input } from '@/components/ui';
import { useExportContext } from '../../ExportContext';
import { invOf, itemNoOf, ar4Missing } from './schemeUtils';
import { SchemeGrid, StatusText } from './SchemeParts';

// Scheme > AR4 (ICEGATE SB "AR4" table), filled on the items that have AR4 = Y.
const WARN_ROW = 'tw:bg-warning/10 tw:even:bg-warning/10';

const TEXT_COLUMNS = [
  { field: 'ar4No', header: 'AR4 No *', placeholder: 'AR4 No', maxLength: 17, width: 'tw:w-[150px]', required: true },
  { field: 'commissionerate', header: 'Commissionerate *', placeholder: 'Commissionerate', maxLength: 20, required: true },
  { field: 'division', header: 'Division *', placeholder: 'Division', maxLength: 20, required: true },
  { field: 'ar4Range', header: 'Range *', placeholder: 'Range', maxLength: 20, required: true },
  { field: 'ar4Remarks', header: 'Remarks', placeholder: 'Remarks', maxLength: 250 },
];

export default function Ar4Tab() {
  const { items, setItems } = useExportContext();
  const updateItem = (id, field, value) => setItems((previous) => previous.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  const rows = (items || []).map((item, index) => ({ item, index })).filter(({ item }) => String(item.ar4 || '').toUpperCase() === 'Y');
  const incomplete = rows.filter(({ item }) => ar4Missing(item).length).length;

  const textColumn = ({ field, header, placeholder, maxLength, width, required }) => ({
    key: field, header, width,
    cell: ({ item }) => (
      <Input
        data-allow-text=""
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={required && !String(item[field] || '').trim()}
        value={item[field] || ''}
        onChange={(event) => updateItem(item.id, field, event.target.value)}
      />
    ),
  });
  const [ar4NoColumn, ...otherTextColumns] = TEXT_COLUMNS.map(textColumn);

  const columns = [
    { key: 'inv', header: 'Inv', align: 'center', width: 'tw:w-[50px]', className: 'tw:font-semibold tw:text-success', cell: ({ item }) => invOf(item) },
    { key: 'item', header: 'Item', align: 'center', width: 'tw:w-[50px]', className: 'tw:font-semibold tw:text-head', cell: ({ item, index }) => itemNoOf(item, index) },
    ar4NoColumn,
    {
      key: 'ar4Date', header: 'AR4 Date *', width: 'tw:w-[120px]',
      cell: ({ item }) => (
        <DateInput value={item.ar4Date || ''} onValueChange={(ymd) => updateItem(item.id, 'ar4Date', ymd)} wrapperClassName={cn(!item.ar4Date && 'tw:[&_input]:border-destructive')} />
      ),
    },
    ...otherTextColumns,
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:px-4 tw:py-3">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:text-entry">
        <strong className="tw:text-[13px] tw:text-head">AR4 Details (Central Excise)</strong>
        <StatusText tone={incomplete ? 'warn' : 'good'}>
          {incomplete ? `${incomplete} item(s) incomplete` : `${rows.length} item(s) complete`}
        </StatusText>
      </div>
      <div className="tw:flex tw:flex-col tw:border tw:border-border tw:bg-background">
        <SchemeGrid
          className="tw:min-w-[1000px]"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.item.id ?? row.index}
          rowClassName={(row) => ar4Missing(row.item).length > 0 && WARN_ROW}
          emptyText="No item has AR4 = Y."
        />
      </div>
    </div>
  );
}
