// Air cargo (consol) manifest of a MAWB: the saved MAWB and its live HAWBs (GET /awb/manifest/:mawb). It can be printed,
// saved as PDF / Word or taken to Excel. Only "Remarks" and "Prepared by" are typed here (kept with the AWB by PersistedDoc).
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/lib/download';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { freightApi } from '../freightApi';
import { DocCtx, SheetBody, SheetCell, SheetFooter, SheetHead, SheetHeader, SheetRow, SheetTable } from './docKit';
import { dmy, failText, joinFilled } from './docFormat';
import { escapeHtml, printSheet, saveSheetPdf, saveSheetWord, sheetClone } from './docPrint';

const kg = (value) => (Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CELL = 'tw:px-[6px] tw:py-[5px] tw:text-[10.5px]';
const NUMBER_CELL = cn(CELL, 'tw:text-right tw:whitespace-nowrap');
const HOUSE_COLUMNS = [
  { header: 'S.No', className: 'tw:w-[3%]' },
  { header: 'HAWB No.', className: 'tw:w-[9%]' },
  { header: 'Org / Dest', className: 'tw:w-[6%]' },
  { header: 'Shipper', className: 'tw:w-[21%]' },
  { header: 'Consignee', className: 'tw:w-[21%]' },
  { header: 'Pcs', className: 'tw:w-[5%] tw:text-right' },
  { header: 'Gross wt (kg)', className: 'tw:w-[8%] tw:text-right' },
  { header: 'Chg. wt (kg)', className: 'tw:w-[8%] tw:text-right' },
  { header: 'Nature of goods', className: 'tw:w-[15%]' },
  { header: 'PP/CC', className: 'tw:w-[4%]' },
];
const MISMATCH = 'tw:text-[#b91c1c]';

function PartyBlock({ title, party }) {
  return (
    <div className="tw:min-h-[64px] tw:border tw:border-solid tw:border-black tw:px-[8px] tw:py-[6px]">
      <div className="tw:mb-[3px] tw:text-[9.5px] tw:font-bold tw:text-[#334155]">{title}</div>
      <div className="tw:text-[11px] tw:font-bold">{party?.name}</div>
      {party?.address && <div className="tw:text-[10px]">{party.address}</div>}
      {party?.place && <div className="tw:text-[10px]">{party.place}</div>}
      {party?.phone && <div className="tw:text-[10px]">Ph: {party.phone}</div>}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <SheetRow>
      <SheetCell className="tw:border-0 tw:py-[2px] tw:pr-[6px] tw:pl-0 tw:text-[10.5px] tw:whitespace-nowrap tw:text-[#334155]">{label}</SheetCell>
      <SheetCell className="tw:border-0 tw:px-0 tw:py-[2px] tw:text-[11px] tw:font-bold">{value || '-'}</SheetCell>
    </SheetRow>
  );
}

function HouseCell({ party }) {
  return <><b>{party.name}</b>{party.address && <div>{party.address}</div>}{party.place && <div>{party.place}</div>}</>;
}

// a typed box is written into the printed / exported copy as plain text
function manifestField(field) {
  const text = document.createElement('div');
  text.innerHTML = escapeHtml(field.value).replace(/\n/g, '<br/>') || '&nbsp;';
  text.style.cssText = 'font-size:10.5px;min-height:14px;';
  return text;
}

function manifestCsv({ master, houses, totals, mawbNo }) {
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const address = (party) => joinFilled([party.address, party.place], ', ');
  const lines = [
    ['MAWB', mawbNo, 'Date', dmy(master.date), 'Airline', master.airline, 'Flight', (master.flights || []).map((flight) => `${flight.flight} ${dmy(flight.date)}`).join(' / '), 'From', master.origin, 'To', master.destination],
    [],
    ['S.No', 'HAWB No', 'Origin', 'Destination', 'Shipper', 'Shipper address', 'Consignee', 'Consignee address', 'Pieces', 'Gross wt (kg)', 'Chargeable wt (kg)', 'Volume (CBM)', 'Nature of goods', 'PP/CC'],
    ...houses.map((house, index) => [index + 1, house.hawb, house.origin, house.destination, house.shipper.name, address(house.shipper), house.consignee.name, address(house.consignee),
      house.pieces, house.gross, house.chargeable, house.volume || '', house.goods, house.chargeCode]),
    ['', 'Total', '', '', '', '', '', '', totals.pieces, totals.gross, totals.chargeable, totals.volume || '', `${totals.houses} house(s)`, ''],
    ...(master.mawb ? [['', 'MAWB', '', '', '', '', '', '', master.pieces, master.gross, master.chargeable, '', '', '']] : []),
  ];
  return 'ï»¿' + lines.map((line) => line.map(quote).join(',')).join('\r\n');
}

const CargoManifestModal = ({ isOpen, onClose, awbNumber }) => {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(null);
  const persisted = useContext(DocCtx);
  const restored = useRef(false);

  useEffect(() => { if (!isOpen) restored.current = false; }, [isOpen]);
  // remarks / prepared by typed before come back once the sheet is drawn
  useEffect(() => {
    if (!isOpen || loading || !manifest || restored.current || !sheet) return;
    restored.current = true;
    if (persisted?.restore) setTimeout(() => persisted.restore(sheet), 0);
  }, [isOpen, loading, manifest, sheet, persisted]);

  const load = useCallback(async () => {
    if (!awbNumber) return;
    setLoading(true);
    setError('');
    try {
      setManifest(await freightApi.awbManifest(awbNumber));
    } catch (loadError) {
      setManifest(null);
      setError(failText(loadError, 'Could not read the manifest'));
    } finally {
      setLoading(false);
    }
  }, [awbNumber]);
  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const master = manifest?.master || {};
  const houses = manifest?.houses || [];
  const totals = manifest?.totals || {};
  const company = manifest?.company || {};
  const mawbNo = master.mawb || awbNumber || '';
  const fileName = `Manifest_${String(mawbNo).replace(/[^0-9A-Za-z-]/g, '')}`;
  const canExport = Boolean(manifest) && houses.length > 0;
  const exportCopy = () => sheetClone(sheet, { width: 1040, padding: '10px 12px', renderField: manifestField });

  const print = () => printSheet(exportCopy(), { title: fileName, landscape: true, css: 'table{page-break-inside:auto} tr{page-break-inside:avoid}' });
  const savePdf = () => saveSheetPdf(exportCopy(), { fileName, landscape: true, windowWidth: 1150, avoid: 'tr' });
  const saveWord = () => saveSheetWord(exportCopy(), { fileName, title: 'Cargo Manifest', landscape: true, margin: '0.4in' });
  const saveExcel = () => downloadBlob(new Blob([manifestCsv({ master, houses, totals, mawbNo })], { type: 'text/csv;charset=utf-8' }), `${fileName}.csv`);

  const statusText = loading ? 'Reading the MAWB and its houses...' : manifest ? `${totals.houses} house(s), ${totals.pieces} pcs, ${kg(totals.gross)} kg` : error;
  const statusClass = loading ? 'tw:text-muted-foreground' : canExport ? 'tw:text-success' : 'tw:text-warning';
  const flights = (master.flights || []).map((flight) => `${flight.flight}  ${dmy(flight.date)}`).join('   Â·   ');
  const emptyText = error || `No live HAWB is linked to ${mawbNo}. Link the houses on the MAWB (View / Link HAWBs) or on each HAWB.`;

  const footer = (
    <>
      <Button variant="secondary" title="Read again" onClick={load}><RefreshCw /> Refresh</Button>
      <Button variant="default" disabled={!canExport} onClick={print}><Printer /> Print</Button>
      <Button variant="destructive" disabled={!canExport} onClick={savePdf}><Download /> PDF</Button>
      <Button disabled={!canExport} onClick={saveWord}><FileText /> Word</Button>
      <Button variant="success" disabled={!canExport} onClick={saveExcel}><FileSpreadsheet /> Excel</Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title={`Cargo manifest - MAWB ${mawbNo}`} width={1240} closeOnOutside={false}
      description={<span className={cn('tw:text-[11px] tw:font-bold', statusClass)}>{statusText}</span>}
      className="tw:h-[94vh]" bodyClassName="tw:items-center-safe tw:overflow-auto tw:bg-[#e2e8f0] tw:p-[14px]" footer={footer}>
      {manifest?.warnings?.length > 0 && (
        <div className="tw:self-stretch tw:rounded-md tw:bg-[#fef3c7] tw:px-3 tw:py-2 tw:text-entry tw:text-[#92400e]">
          {manifest.warnings.map((warning) => <div key={warning}>{warning}</div>)}
        </div>
      )}
      <div ref={setSheet} data-doc-root={persisted ? persisted.docType : ''}
        className="tw:box-border tw:w-[1100px] tw:shrink-0 tw:bg-white tw:px-[20px] tw:py-[18px] tw:[font-family:Arial,sans-serif] tw:text-black tw:normal-case">
        <div className="tw:mb-[8px] tw:border-0 tw:border-b-2 tw:border-solid tw:border-black tw:pb-[6px] tw:text-center">
          <div className="tw:text-[19px] tw:font-bold tw:tracking-[0.5px]">{company.name || ' '}</div>
          {company.address && <div className="tw:text-[10.5px]">{company.address}</div>}
          <div className="tw:text-[10px]">{joinFilled([company.gstin && `GSTIN ${company.gstin}`, company.iata && `IATA ${company.iata}`, company.phone && `Ph ${company.phone}`, company.email], '   |   ')}</div>
          <div className="tw:mt-[6px] tw:text-[14px] tw:font-bold">AIR CARGO MANIFEST (CONSOLIDATION)</div>
        </div>

        <div className="tw:mb-[10px] tw:grid tw:grid-cols-[1fr_1fr_1.1fr] tw:gap-[8px]">
          <PartyBlock title="Shipper (MAWB)" party={master.shipper} />
          <PartyBlock title="Consignee (MAWB) / destination agent" party={master.consignee} />
          <div className="tw:border tw:border-solid tw:border-black tw:px-[8px] tw:py-[6px]">
            <SheetTable>
              <SheetBody>
                <InfoRow label="MAWB No." value={mawbNo} />
                <InfoRow label="MAWB date" value={dmy(master.date)} />
                <InfoRow label="Airline" value={master.airline ? `${master.airline}${master.airlineCode ? ' (' + master.airlineCode + ')' : ''}` : ''} />
                <InfoRow label="Flight / date" value={flights} />
                <InfoRow label="From / to" value={master.origin || master.destination ? `${master.origin || '-'}  to  ${master.destination || '-'}` : ''} />
                {(master.routing || []).length > 1 && <InfoRow label="Routing" value={master.routing.join('  >  ')} />}
              </SheetBody>
            </SheetTable>
          </div>
        </div>

        <SheetTable>
          <SheetHeader>
            <SheetRow>{HOUSE_COLUMNS.map((column) => <SheetHead key={column.header} className={cn(CELL, 'tw:text-[10px]', column.className)}>{column.header}</SheetHead>)}</SheetRow>
          </SheetHeader>
          <SheetBody>
            {loading && <SheetRow><SheetCell colSpan={10} className={cn(CELL, 'tw:p-[20px] tw:text-center tw:text-[#64748b]')}>Reading the houses...</SheetCell></SheetRow>}
            {!loading && houses.length === 0 && <SheetRow><SheetCell colSpan={10} className={cn(CELL, 'tw:p-[20px] tw:text-center tw:text-[#64748b]')}>{emptyText}</SheetCell></SheetRow>}
            {!loading && houses.map((house, index) => (
              <SheetRow key={house.id}>
                <SheetCell className={cn(CELL, 'tw:text-center')}>{index + 1}</SheetCell>
                <SheetCell className={cn(CELL, 'tw:font-bold')}>{house.hawb}</SheetCell>
                <SheetCell className={cn(CELL, 'tw:text-center')}>{house.origin}<br />{house.destination}</SheetCell>
                <SheetCell className={CELL}><HouseCell party={house.shipper} /></SheetCell>
                <SheetCell className={CELL}><HouseCell party={house.consignee} /></SheetCell>
                <SheetCell className={NUMBER_CELL}>{house.pieces}</SheetCell>
                <SheetCell className={NUMBER_CELL}>{kg(house.gross)}</SheetCell>
                <SheetCell className={NUMBER_CELL}>{kg(house.chargeable)}</SheetCell>
                <SheetCell className={cn(CELL, 'tw:whitespace-pre-line')}>{house.goods}</SheetCell>
                <SheetCell className={cn(CELL, 'tw:text-center')}>{house.chargeCode}</SheetCell>
              </SheetRow>
            ))}
          </SheetBody>
          {houses.length > 0 && (
            <SheetFooter>
              <SheetRow className="tw:font-bold">
                <SheetCell colSpan={5} className={cn(CELL, 'tw:text-right tw:font-bold')}>Total of {totals.houses} house(s)</SheetCell>
                <SheetCell className={cn(NUMBER_CELL, 'tw:font-bold')}>{totals.pieces}</SheetCell>
                <SheetCell className={cn(NUMBER_CELL, 'tw:font-bold')}>{kg(totals.gross)}</SheetCell>
                <SheetCell className={cn(NUMBER_CELL, 'tw:font-bold')}>{kg(totals.chargeable)}</SheetCell>
                <SheetCell colSpan={2} className={CELL}>{totals.volume ? `Volume ${totals.volume} CBM` : ''}</SheetCell>
              </SheetRow>
              {master.mawb && (
                <SheetRow>
                  <SheetCell colSpan={5} className={cn(CELL, 'tw:text-right')}>As per MAWB {master.mawb}</SheetCell>
                  <SheetCell className={cn(NUMBER_CELL, master.pieces !== totals.pieces && MISMATCH)}>{master.pieces}</SheetCell>
                  <SheetCell className={cn(NUMBER_CELL, Math.abs((master.gross || 0) - (totals.gross || 0)) > 0.5 && MISMATCH)}>{kg(master.gross)}</SheetCell>
                  <SheetCell className={NUMBER_CELL}>{master.chargeable ? kg(master.chargeable) : ''}</SheetCell>
                  <SheetCell colSpan={2} className={CELL}>{master.goods ? String(master.goods).split('\n')[0] : ''}</SheetCell>
                </SheetRow>
              )}
            </SheetFooter>
          )}
        </SheetTable>

        <div className="tw:mt-[12px] tw:grid tw:grid-cols-[1.6fr_1fr] tw:gap-[12px] tw:text-[10.5px]">
          <div>
            <div className="tw:mb-[3px] tw:font-bold">Remarks</div>
            <Textarea data-k="remarks" rows={3} placeholder="Optional"
              className="tw:min-h-0 tw:rounded-none tw:border-[#cbd5e1] tw:bg-white tw:p-[4px] tw:[font-family:Arial,sans-serif] tw:text-[10.5px] tw:text-black" />
          </div>
          <div className="tw:text-right">
            <div>For {company.name || ''}</div>
            <div className="tw:h-[34px]" />
            <div className="tw:inline-block tw:min-w-[220px] tw:border-0 tw:border-t tw:border-solid tw:border-black tw:pt-[3px]">Authorised signatory</div>
            <div className="tw:mt-[6px] tw:flex tw:items-center tw:justify-end tw:gap-[6px]">
              <span>Prepared by</span>
              <Input data-k="preparedBy" defaultValue={manifest?.preparedBy || ''} key={manifest?.preparedBy || 'p'}
                className="tw:h-auto tw:w-[140px] tw:rounded-none tw:border-[#cbd5e1] tw:bg-white tw:px-[4px] tw:py-[2px] tw:text-[10.5px] tw:text-black" />
              <span>on {dmy(new Date().toISOString().slice(0, 10))}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CargoManifestModal;
