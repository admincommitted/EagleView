import { asList } from '../../../../utils/asList';
import { useExportContext } from '../../ExportContext';
import { useMasterList } from '../../useExportCalc';
import { r2, rosctlRowsOf, CAP_NEEDS_QTY } from './schemeUtils';
import { SchemeFootnote, SchemeGrid, SchemeSummary, SummaryNote } from './SchemeParts';

// Scheme > RoSCTL. Scheme 60 is "Drawback + RoSCTL": the items claim drawback (Scheme > Dbk) and the Rebate of State
// and Central Taxes and Levies. The schedule row is found by the item's drawback schedule number without its suffix
// (62030307B -> 62030307), else by RITC; the estimate is rate % x FOB (INR), limited to cap x qty. ICEGATE gets the
// reward flag and the RoSCTL declaration (statement RS001) of each item; the amount is worked out by Customs.
const NOT_FOUND_ROW = 'tw:bg-warning/10 tw:even:bg-warning/10';
const statementCodeOf = (statement) => String(statement.statementCode || statement.stmtCode || statement.code || '').toUpperCase();
const levyText = (rate, cap) => `${rate}%${cap ? ' / ' + cap : ''}`;

export default function RosctlTab() {
  const { items, dbkItems, exportData } = useExportContext();
  const master = useMasterList('/masters/rosctls');
  const rows = rosctlRowsOf(items, dbkItems, master);
  const total = rows.reduce((sum, row) => sum + (row.amt === null ? 0 : row.amt), 0);
  const pending = rows.filter((row) => row.amt === null).length;
  const loading = !master.length;
  const notInSchedule = loading ? 0 : rows.filter((row) => row.noRow).length;

  // RS001 (RoSCTL declaration) on the item or for the whole SB
  const statements = [
    ...asList(exportData && exportData._statements),
    ...(items || []).flatMap((item) => asList(item.swStatements).map((statement) => ({ ...statement, invoiceSerialNumber: item.invSr, itemSerialNumber: item.itemSr }))),
  ];
  const hasRs001 = (row) => statements.some((statement) => statementCodeOf(statement) === 'RS001'
    && (String(statement.itemSerialNumber || statement.itemSr || '0') === '0'
      || (String(statement.invoiceSerialNumber || statement.invSr || 1) === row.inv && String(statement.itemSerialNumber || statement.itemSr) === row.itm)));
  const withoutDeclaration = rows.filter((row) => !hasRs001(row)).length;

  const columns = [
    { key: 'inv', header: 'Inv', align: 'center', width: 'tw:w-[50px]', className: 'tw:font-semibold tw:text-success', cell: (row) => row.inv },
    { key: 'itm', header: 'Item', align: 'center', width: 'tw:w-[50px]', className: 'tw:font-semibold tw:text-head', cell: (row) => row.itm },
    { key: 'dbkNo', header: 'DBK No', width: 'tw:w-[100px]', cell: (row) => row.dbkNo || '-' },
    {
      key: 'slNo', header: 'RoSCTL Sl No', width: 'tw:w-[100px]',
      cell: (row) => row.slNo || (loading ? '...' : <span className="tw:text-warning">not found</span>),
    },
    {
      key: 'description', header: 'Description', className: 'tw:max-w-[260px] tw:overflow-hidden tw:text-ellipsis',
      cell: (row) => <span title={row.scheduleRow ? row.scheduleRow.description : ''}>{row.item.desc || row.item.description || '-'}</span>,
    },
    { key: 'qty', header: 'Qty', align: 'right', width: 'tw:w-[90px]', cell: (row) => `${row.qty || 0} ${row.unit}` },
    { key: 'fob', header: 'FOB ₹', align: 'right', width: 'tw:w-[110px]', cell: (row) => r2(row.fob) },
    { key: 'state', header: 'State % / cap', align: 'right', width: 'tw:w-[110px]', cell: (row) => (row.split ? levyText(row.split.stateRate, row.split.stateCap) : '-') },
    { key: 'central', header: 'Central % / cap', align: 'right', width: 'tw:w-[110px]', cell: (row) => (row.split ? levyText(row.split.centralRate, row.split.centralCap) : '-') },
    { key: 'rate', header: 'Rate %', align: 'right', width: 'tw:w-[70px]', cell: (row) => (row.scheduleRow ? row.rate : '-') },
    { key: 'cap', header: 'Cap ₹/unit', align: 'right', width: 'tw:w-[80px]', cell: (row) => (row.scheduleRow && row.cap ? row.cap : '-') },
    {
      key: 'amount', header: 'Est. RoSCTL ₹', align: 'right', width: 'tw:w-[110px]', className: 'tw:font-semibold',
      cell: (row) => (
        <span className={row.amt === null ? 'tw:text-warning' : 'tw:text-success'} title={row.amt === null ? CAP_NEEDS_QTY : ''}>
          {row.noRow ? '-' : (row.amt === null ? 'qty?' : r2(row.amt))}
        </span>
      ),
    },
  ];

  return (
    <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
      <SchemeSummary title="RoSCTL (scheme 60)">
        <span>Items: <b>{rows.length}</b></span>
        <span>Estimated RoSCTL ₹ <b className="tw:text-success">{r2(total)}</b></span>
        {loading && <SummaryNote tone="muted">Reading the RoSCTL schedule...</SummaryNote>}
        {notInSchedule > 0 && <SummaryNote tone="warn">{notInSchedule} item(s) not found in the RoSCTL schedule (check the DBK No / RITC)</SummaryNote>}
        {pending > 0 && <SummaryNote tone="warn" title={CAP_NEEDS_QTY}>{pending} item(s) not worked out - quantity needed (the cap is per unit)</SummaryNote>}
        {withoutDeclaration > 0 && (
          <SummaryNote tone="muted" title="The Shipping Bill gets RS001 for every scheme 60 reward item that has no declaration">
            {withoutDeclaration} item(s) without RS001 here - it is added to the Shipping Bill by itself
          </SummaryNote>
        )}
      </SchemeSummary>

      <SchemeGrid
        className="tw:min-w-[1000px]"
        columns={columns}
        rows={rows}
        rowKey={(row, index) => row.item.id ?? index}
        rowClassName={(row) => row.noRow && NOT_FOUND_ROW}
        emptyText="No item has scheme code 60 (Drawback + RoSCTL)."
        footer={[
          { value: 'Total', colSpan: 6, align: 'right' },
          { value: r2(rows.reduce((sum, row) => sum + row.fob, 0)), align: 'right' },
          { value: '', colSpan: 4 },
          { value: r2(total), align: 'right', className: 'tw:text-success' },
        ]}
      />

      <SchemeFootnote>
        Estimate = Rate % × FOB ₹, limited to Cap × Qty (RoSCTL schedule). ICEGATE gets the reward flag and statement RS001 of each item; the amount is worked out by Customs.
      </SchemeFootnote>
    </div>
  );
}
