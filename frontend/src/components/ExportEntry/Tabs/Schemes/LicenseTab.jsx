import { useEffect, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, DateInput, Input, NumberInput, SelectBox } from '@/components/ui';
import { useExportContext } from '../../ExportContext';
import { num, isLicenceItem, invOf, itemNoOf, licenceRowErrors } from './schemeUtils';
import { SchemeGrid, StatusText } from './SchemeParts';

// Scheme > License (ICEGATE SB "LICENCE" table: registration no / date, item Sr in Part E and Part C, quantity,
// export quantity, indigenous / imported). An item can have more than one licence row.
const IND_IMP_OPTIONS = [{ value: 'M', label: 'M - Imp' }, { value: 'I', label: 'I - Ind' }];
const LICENCE_TYPES = ['DEEC', 'EPCG', 'DFIA'];
const WARN_ROW = 'tw:bg-warning/10 tw:even:bg-warning/10';
const MISSING_DATE = 'tw:[&_input]:border-destructive';

const indImpOf = (value) => {
  const text = String(value || '').toUpperCase();
  return text === 'I' || text.startsWith('IND') ? 'I' : 'M';
};

let sequence = 0;
const newRowId = (itemId) => `L${itemId}-${Date.now().toString(36)}${(sequence++).toString(36)}`;
const blankRow = (item, index) => ({
  id: newRowId(item.id), itemId: item.id, srNo: 1, invNo: invOf(item), itemNo: itemNoOf(item, index),
  regNo: '', regDate: '', snE: '', snC: '', qty: '', expQty: String(item.qty || item.quantity || ''), uqc: item.unit || item.uqc || 'NOS',
  expDesc: String(item.desc || item.description || '').slice(0, 60), impDesc: '', indImp: 'M', licNo: '', licDt: '', licType: 'DEEC', eoQty: '', eoVal: '',
});

const isBlank = (value) => !String(value || '').trim();

// The licence rows of the items now on screen: an item's rows are found by its id first (an item / invoice deleted
// must not move its rows to the next item), then by invoice + item no for rows saved with the job, never taking
// rows of another item on the screen; an item without rows gets one empty row.
function syncedRows(previousRows, items, licenceItems) {
  const rest = [...(previousRows || [])];
  const takeRows = (belongs) => {
    const taken = [];
    for (let position = rest.length - 1; position >= 0; position--) {
      if (belongs(rest[position])) taken.unshift(rest.splice(position, 1)[0]);
    }
    return taken;
  };
  const liveIds = new Set((items || []).map((item) => item.id).filter((id) => id != null));
  const next = [];
  licenceItems.forEach(({ item, index }) => {
    const inv = invOf(item), itm = itemNoOf(item, index);
    let own = item.id != null ? takeRows((row) => row.itemId != null && row.itemId === item.id) : [];
    if (!own.length) own = takeRows((row) => !(row.itemId != null && liveIds.has(row.itemId)) && String(row.invNo || 1) === inv && String(row.itemNo) === itm);
    if (!own.length) own = [blankRow(item, index)];
    own.forEach((row, position) => {
      const synced = { ...row, itemId: item.id, invNo: inv, itemNo: itm, srNo: position + 1, indImp: indImpOf(row.indImp) };
      if (typeof synced.id !== 'string' || !synced.id.startsWith('L')) synced.id = newRowId(item.id);
      if (synced.expQty === undefined || synced.expQty === '') synced.expQty = String(item.qty || item.quantity || row.qty || '');
      next.push(synced);
    });
  });
  const withoutId = (row) => JSON.stringify({ ...row, id: 0 });
  const unchanged = next.length === (previousRows || []).length
    && next.every((row, position) => previousRows[position] && previousRows[position].id === row.id && withoutId(row) === withoutId(previousRows[position]));
  return unchanged ? previousRows : next;
}

export default function LicenseTab() {
  const { items, licenseItems, setLicenseItems } = useExportContext();
  const licenceItems = useMemo(() => (items || []).map((item, index) => ({ item, index })).filter(({ item }) => isLicenceItem(item)), [items]);

  useEffect(() => {
    setLicenseItems((previous) => syncedRows(previous, items, licenceItems));
  }, [licenceItems, setLicenseItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id, field, value) => setLicenseItems((previous) => previous.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  const itemKey = (row) => row.invNo + '/' + row.itemNo;
  const addRow = (row) => setLicenseItems((previous) => {
    const sameItem = previous.filter((other) => itemKey(other) === itemKey(row));
    const added = { ...row, id: newRowId(row.itemId), srNo: sameItem.length + 1, regNo: '', regDate: '', snE: '', snC: '', qty: '', licNo: '', licDt: '', impDesc: '', eoQty: '', eoVal: '' };
    const lastOfItem = previous.map(itemKey).lastIndexOf(itemKey(row));
    const insertAt = (lastOfItem >= 0 ? lastOfItem : previous.findIndex((other) => other.id === row.id)) + 1;
    return [...previous.slice(0, insertAt), added, ...previous.slice(insertAt)];
  });
  const removeRow = (row) => setLicenseItems((previous) => {
    let srNo = 0;
    return previous
      .filter((other) => other.id !== row.id)
      .map((other) => (other.invNo === row.invNo && other.itemNo === row.itemNo ? { ...other, srNo: ++srNo } : other));
  });

  const rows = licenseItems || [];
  const incompleteRows = rows.filter((row) => licenceRowErrors(row).length).length;

  const textCell = (field, { required = false, className } = {}) => (row) => (
    <Input data-allow-text="" aria-invalid={required && isBlank(row[field])} className={className} value={row[field] ?? ''} onChange={(event) => update(row.id, field, event.target.value)} />
  );
  const numberCell = (field, { required = false } = {}) => (row) => (
    <NumberInput align="right" aria-invalid={required && !(num(row[field]) > 0)} value={row[field] ?? ''} onValueChange={(text) => update(row.id, field, text)} />
  );
  const dateCell = (field, { required = false } = {}) => (row) => (
    <DateInput value={row[field] || ''} onValueChange={(ymd) => update(row.id, field, ymd)} wrapperClassName={cn('tw:min-w-[104px]', required && !row[field] && MISSING_DATE)} />
  );

  const columns = [
    { key: 'invNo', header: 'Inv', align: 'center', width: 'tw:w-[40px]', className: 'tw:font-semibold tw:text-success', cell: (row) => row.invNo },
    { key: 'itemNo', header: 'Itm', align: 'center', width: 'tw:w-[40px]', className: 'tw:font-semibold tw:text-head', cell: (row) => row.itemNo },
    { key: 'srNo', header: 'Sr', align: 'center', width: 'tw:w-[34px]', cell: (row) => row.srNo },
    { key: 'regNo', header: 'Reg No *', width: 'tw:w-[120px]', cell: textCell('regNo', { required: true }) },
    { key: 'regDate', header: 'Reg Dt *', width: 'tw:w-[112px]', cell: dateCell('regDate', { required: true }) },
    { key: 'snE', header: 'Sn E *', width: 'tw:w-[56px]', cell: textCell('snE', { required: true }) },
    { key: 'snC', header: 'Sn C *', width: 'tw:w-[56px]', cell: textCell('snC', { required: true }) },
    { key: 'qty', header: 'Qty *', width: 'tw:w-[74px]', cell: numberCell('qty', { required: true }) },
    { key: 'expQty', header: 'Exp Qty *', width: 'tw:w-[74px]', cell: numberCell('expQty', { required: true }) },
    { key: 'uqc', header: 'UQC', width: 'tw:w-[50px]', cell: textCell('uqc', { className: 'tw:bg-success/5' }) },
    { key: 'expDesc', header: 'Exp Item Desc', cell: textCell('expDesc', { className: 'tw:min-w-[140px]' }) },
    { key: 'impDesc', header: 'Imp Item Desc', cell: textCell('impDesc', { className: 'tw:min-w-[140px]' }) },
    { key: 'indImp', header: 'Ind / Imp', width: 'tw:w-[84px]', cell: (row) => <SelectBox options={IND_IMP_OPTIONS} value={indImpOf(row.indImp)} onValueChange={(value) => update(row.id, 'indImp', value)} /> },
    { key: 'licNo', header: 'Lic No', width: 'tw:w-[100px]', cell: textCell('licNo') },
    { key: 'licDt', header: 'Lic Dt', width: 'tw:w-[112px]', cell: dateCell('licDt') },
    { key: 'licType', header: 'Lic Type', width: 'tw:w-[70px]', cell: (row) => <SelectBox options={LICENCE_TYPES} value={row.licType || 'DEEC'} onValueChange={(value) => update(row.id, 'licType', value)} /> },
    { key: 'eoQty', header: 'EO Qty', width: 'tw:w-[64px]', cell: numberCell('eoQty') },
    { key: 'eoVal', header: 'EO Val', width: 'tw:w-[74px]', cell: numberCell('eoVal') },
    {
      key: 'actions', header: '', width: 'tw:w-[64px]', className: 'tw:whitespace-nowrap',
      cell: (row) => (
        <div className="tw:flex tw:gap-1">
          <Button size="icon-sm" title="Another licence row for this item" onClick={() => addRow(row)}><Plus /></Button>
          {row.srNo > 1 && <Button size="icon-sm" variant="destructive" title="Remove this licence row" onClick={() => removeRow(row)}><X /></Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:p-2">
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:border tw:border-border tw:bg-background">
        <SchemeGrid
          className="tw:min-w-[1500px] tw:text-[11px]"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowClassName={(row) => licenceRowErrors(row).length > 0 && WARN_ROW}
          rowTitle={(row) => {
            const missing = licenceRowErrors(row);
            return missing.length ? 'Missing: ' + missing.join(', ') : '';
          }}
          emptyText="No item has a licence scheme code."
        />
      </div>
      <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-1 tw:rounded tw:border tw:border-border tw:bg-page tw:px-4 tw:py-1.5 tw:text-[11px] tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <StatusText tone={incompleteRows ? 'warn' : 'good'}>
          {incompleteRows ? `${incompleteRows} row(s) incomplete` : `${rows.length} row(s) complete`}
        </StatusText>
        <span className="tw:text-muted-foreground">* Sent to ICEGATE: Reg No, Reg Dt, Sn E / Sn C (item Sr in Part E / C), Qty, Exp Qty, Ind/Imp. Lic No, type and EO are for your records.</span>
      </div>
    </div>
  );
}
