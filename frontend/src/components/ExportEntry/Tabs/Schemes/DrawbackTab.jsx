import { cn } from '@/lib/utils';
import { Button, ComboInput, Input, NumberInput, SelectBox } from '@/components/ui';
import { useExportContext } from '../../ExportContext';
import { useMasterList } from '../../useExportCalc';
import { num, r2, invOf, itemNoOf, itemFobInr, findDbk, dbkAmount, claimText, claimWhy } from './schemeUtils';
import { SchemeFootnote, SchemeGrid, SchemeSummary, SummaryChip } from './SchemeParts';

// Scheme > Dbk: one row per drawback item (scheme 19 / 60). The rows and their rates / amounts are kept up to date by
// useExportCalc for the whole export screen; here the operator keys the DBK No, qty, rates and availability.
const ERROR_ROW = 'tw:bg-destructive/5 tw:even:bg-destructive/5';
const YES_NO = ['Y', 'N'];

const dbkNoOf = (scheduleRow) => scheduleRow.schemeCode || scheduleRow.tariffItem;
const matchesDbk = (scheduleRow, query) => {
  const text = String(query || '').toLowerCase();
  return String(dbkNoOf(scheduleRow) || '').toLowerCase().includes(text) || String(scheduleRow.description || '').toLowerCase().includes(text);
};

function DbkOption({ scheduleRow }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col">
      <div className="tw:text-[11px] tw:font-bold tw:text-head">
        {dbkNoOf(scheduleRow)} <span className="tw:text-[10px] tw:font-normal tw:text-muted-foreground">{scheduleRow.description}</span>
      </div>
      <div className="tw:text-[10px] tw:text-muted-foreground">
        Rate {num(scheduleRow.drawbackRate)}% · Spe ₹{num(scheduleRow.drawbackRateSpec)} · Cap ₹{num(scheduleRow.drawbackCap)}{scheduleRow.uqc ? ' / ' + scheduleRow.uqc : ''}
      </div>
    </div>
  );
}

function rowChecks(row, item, master) {
  const checks = [];
  const itemQty = item ? num(item.qty || item.quantity) : 0;
  if (!String(row.dbkNo || '').trim()) checks.push({ text: 'DBK No missing', isError: true });
  else if (master.length && !findDbk(master, row.dbkNo)) checks.push({ text: 'DBK No not in the drawback schedule master', isError: false });
  if (num(row.dbkQty) <= 0) checks.push({ text: row.dbkWhy || 'DBK Qty must be more than 0', isError: true });
  else if (itemQty > 0 && num(row.dbkQty) > itemQty) checks.push({ text: 'DBK Qty is more than the item quantity', isError: false });
  return checks;
}

export default function DrawbackTab() {
  const { items, dbkItems, setDbkItems } = useExportContext();
  const master = useMasterList('/masters/drawbacks');

  const itemOf = (row) => (items || []).find((item, index) => (row.itemId != null && item.id === row.itemId)
    || (invOf(item) === String(row.invNo) && itemNoOf(item, index) === String(row.itemNo))) || null;

  // one state update per change, so a rate typed in the row cannot race with another update
  const patchRow = (id, patch, { manualValue = false, recalc = true } = {}) => {
    setDbkItems((previous) => previous.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, ...patch };
      // a DBK qty typed here stays; untouched, it follows the item qty (useExportCalc)
      if ('dbkQty' in patch) {
        const item = itemOf(next);
        next.dbkQtyAuto = !!item && num(next.dbkQty) === num(item.qty || item.quantity);
      }
      if (manualValue) return { ...next, valManual: true };
      if (recalc) {
        const claim = { fob: itemFobInr(itemOf(next)), qty: next.dbkQty, rateAdv: next.dbkRtAdv, rateSpe: next.dbkRtSpe, cap: next.dbkCap };
        const haveRate = num(next.dbkRtAdv) > 0 || num(next.dbkRtSpe) > 0;
        next.valManual = false;
        next.dbkVal = haveRate ? claimText(dbkAmount(claim)) : '';
        next.dbkWhy = haveRate ? claimWhy(claim) : '';
      }
      return next;
    }));
  };

  const applySchedule = (id, scheduleRow) => patchRow(id, {
    dbkNo: String(scheduleRow.schemeCode || scheduleRow.tariffItem || ''),
    dbkRtAdv: String(num(scheduleRow.drawbackRate)),
    dbkRtSpe: String(num(scheduleRow.drawbackRateSpec)),
    dbkCap: String(num(scheduleRow.drawbackCap)),
    ...(scheduleRow.uqc ? { accUnit: scheduleRow.uqc } : {}),
  });

  // a typed schedule number brings its rates; any other text clears the old rates
  const typeDbkNo = (id, text) => {
    const scheduleRow = findDbk(master, text);
    if (scheduleRow) applySchedule(id, scheduleRow);
    else patchRow(id, { dbkNo: text, dbkRtAdv: '', dbkRtSpe: '', dbkCap: '' });
  };

  const rows = dbkItems || [];
  const firstWithDbkNo = rows.find((row) => row.dbkNo);
  const copyFirstToBlank = () => {
    if (!firstWithDbkNo) return;
    const scheduleRow = findDbk(master, firstWithDbkNo.dbkNo);
    rows.filter((row) => !row.dbkNo).forEach((row) => {
      if (scheduleRow) applySchedule(row.id, scheduleRow);
      else patchRow(row.id, { dbkNo: firstWithDbkNo.dbkNo, dbkRtAdv: firstWithDbkNo.dbkRtAdv, dbkRtSpe: firstWithDbkNo.dbkRtSpe, dbkCap: firstWithDbkNo.dbkCap });
    });
  };

  const lines = rows.map((row) => {
    const item = itemOf(row);
    const checks = rowChecks(row, item, master);
    return { row, item, checks, hasError: checks.some((check) => check.isError) };
  });
  const errorRows = lines.filter((line) => line.hasError).length;
  const totalFob = rows.reduce((sum, row) => sum + itemFobInr(itemOf(row)), 0);
  const totalDbk = rows.reduce((sum, row) => sum + num(row.dbkVal), 0);
  // rows whose amount could not be worked out are counted, so the total is never read as the whole claim
  const pendingDbk = rows.filter((row) => String(row.dbkWhy || '').trim()).length;
  const hasSuffixAC = rows.some((row) => /[AC]$/i.test(String(row.dbkNo || '').trim()));

  const numberCell = (field) => ({ row }) => (
    <NumberInput align="right" value={row[field] ?? ''} onValueChange={(text) => patchRow(row.id, { [field]: text })} />
  );

  const columns = [
    { key: 'srNo', header: 'Sr', align: 'center', width: 'tw:w-[44px]', cell: ({ row }) => row.srNo },
    { key: 'invNo', header: 'Inv', align: 'center', width: 'tw:w-[50px]', className: 'tw:font-semibold tw:text-success', cell: ({ row }) => row.invNo },
    { key: 'itemNo', header: 'Item', align: 'center', width: 'tw:w-[50px]', className: 'tw:font-semibold tw:text-head', cell: ({ row }) => row.itemNo },
    {
      key: 'description', header: 'Description', className: 'tw:max-w-[260px] tw:overflow-hidden tw:text-ellipsis',
      cell: ({ item, checks, hasError }) => (
        <>
          {item ? (item.desc || item.description || item.itemDesc || '-') : '-'}
          {checks.length > 0 && (
            <div className={cn('tw:text-[10px] tw:whitespace-normal', hasError ? 'tw:text-destructive' : 'tw:text-warning')}>
              {checks.map((check) => check.text).join(' · ')}
            </div>
          )}
        </>
      ),
    },
    { key: 'fob', header: 'FOB ₹', align: 'right', width: 'tw:w-[100px]', cell: ({ item }) => r2(itemFobInr(item)) },
    {
      key: 'dbkNo', header: 'DBK No *', width: 'tw:w-[140px]',
      cell: ({ row }) => (
        <ComboInput
          options={master}
          value={row.dbkNo || ''}
          onValueChange={(text) => typeDbkNo(row.id, text)}
          onSelect={(scheduleRow) => applySchedule(row.id, scheduleRow)}
          getValue={dbkNoOf}
          filter={matchesDbk}
          renderOption={(scheduleRow) => <DbkOption scheduleRow={scheduleRow} />}
          placeholder="DBK No"
          aria-invalid={!row.dbkNo}
          className="tw:[&_input]:bg-warning/5 tw:[&_input]:font-semibold"
          listClassName="tw:min-w-80"
        />
      ),
    },
    { key: 'dbkQty', header: 'DBK Qty *', width: 'tw:w-[90px]', cell: ({ row }) => <NumberInput align="right" aria-invalid={!(num(row.dbkQty) > 0)} value={row.dbkQty ?? ''} onValueChange={(text) => patchRow(row.id, { dbkQty: text })} /> },
    {
      key: 'accUnit', header: 'Unit', width: 'tw:w-[64px]',
      cell: ({ row }) => <Input data-allow-text="" maxLength={3} className="tw:bg-success/5" value={row.accUnit || ''} onChange={(event) => patchRow(row.id, { accUnit: event.target.value.toUpperCase() }, { recalc: false })} />,
    },
    { key: 'dbkRtAdv', header: 'Rate %', width: 'tw:w-[74px]', cell: numberCell('dbkRtAdv') },
    { key: 'dbkRtSpe', header: 'Rate ₹/unit', width: 'tw:w-[80px]', cell: numberCell('dbkRtSpe') },
    { key: 'dbkCap', header: 'Cap ₹/unit', width: 'tw:w-[80px]', cell: numberCell('dbkCap') },
    {
      key: 'dbkVal', header: 'DBK Value ₹', width: 'tw:w-[104px]',
      cell: ({ row }) => (
        <NumberInput
          align="right"
          value={row.dbkVal ?? ''}
          onValueChange={(text) => patchRow(row.id, { dbkVal: text }, { manualValue: true })}
          title={row.dbkWhy || (row.valManual ? 'Typed by hand (changes to qty / rates will work it out again)' : 'Worked out from the rates')}
          placeholder={row.dbkWhy ? 'qty?' : ''}
          className={cn('tw:font-semibold', row.dbkWhy ? 'tw:bg-warning/10 tw:text-warning' : 'tw:text-success', row.valManual && 'tw:italic')}
        />
      ),
    },
    {
      key: 'available', header: 'Avail.', width: 'tw:w-[64px]',
      cell: ({ row }) => <SelectBox options={YES_NO} value={row.drawbackAvailable || 'Y'} onValueChange={(value) => patchRow(row.id, { drawbackAvailable: value }, { recalc: false })} />,
    },
  ];

  return (
    <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
      <SchemeSummary
        title="Drawback (scheme 19 / 60)"
        actions={(
          <Button size="sm" disabled={!firstWithDbkNo || !rows.some((row) => !row.dbkNo)} onClick={copyFirstToBlank} title="Put the first DBK No in every row that has none">
            Copy DBK No to blank rows
          </Button>
        )}
      >
        <SummaryChip label="Items" value={rows.length} />
        <SummaryChip label="FOB ₹" value={r2(totalFob)} />
        <SummaryChip label="Total DBK ₹" value={r2(totalDbk)} tone="good" />
        {pendingDbk > 0 && <SummaryChip label="Not worked out" value={pendingDbk + ' row(s)'} tone="warn" />}
        <SummaryChip label="To fix" value={errorRows} tone={errorRows ? 'bad' : 'good'} />
      </SchemeSummary>

      <SchemeGrid
        className="tw:min-w-[1100px]"
        columns={columns}
        rows={lines}
        rowKey={(line, index) => line.row.id ?? index}
        rowClassName={(line) => line.hasError && ERROR_ROW}
        rowTitle={(line) => line.checks.map((check) => check.text).join('\n')}
        emptyText="No item has scheme code 19 (Drawback) or 60 (Drawback + RoSCTL)."
        footer={[
          { value: 'Total', colSpan: 4, align: 'right' },
          { value: r2(totalFob), align: 'right' },
          { value: '', colSpan: 6 },
          { value: r2(totalDbk), align: 'right', className: 'tw:text-success' },
          { value: '' },
        ]}
      />

      <SchemeFootnote>
        DBK value = Rate % × FOB ₹, limited to Cap × Qty (or Rate ₹/unit × Qty). Only DBK No, Qty and Avail. go to ICEGATE; customs works out the amount.
        {hasSuffixAC && <span className="tw:ml-2 tw:text-warning">DBK No with suffix A / C: add the drawback declaration (DB001 / DB002 / DB003) under Items &gt; SW Statement.</span>}
      </SchemeFootnote>
    </div>
  );
}
