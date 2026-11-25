import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox, Label, NumberInput, SelectBox } from '@/components/ui';
import { asList } from '../../../../utils/asList';
import { useExportContext } from '../../ExportContext';
import { useMasterList } from '../../useExportCalc';
import {
  num, r2, isRodtepItem, isRosctlItem, claimsRodtep, invOf, itemNoOf, itemFobInr, rodtepAmount, CAP_NEEDS_QTY, rodtepRowOf,
  rodtepRateOf, rodtepQtyOf, isAppendix4RE, RDT_QTY_NEEDED,
} from './schemeUtils';
import { SchemeFootnote, SchemeGrid, SchemeSummary, SummaryNote } from './SchemeParts';

// Scheme > RoDTEP: one row per item with RITC, FOB (INR), rate and cap from the RoDTEP master, the estimate and a
// Claim switch. ICEGATE takes the claim from the item's SW info row DTY / RDT (RODTEPY / RODTEPN) and the reward
// item flag, so the switch sets both on the item.
const CLAIM_OPTIONS = [{ value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }];
const capitals = (value) => String(value || '').toUpperCase();
const serialOf = (value, fallback) => String(parseInt(value, 10) || fallback);
const isSwRow = (row, type, qualifier) => capitals(row.swInfoField1 || row.type) === type && capitals(row.swInfoField2 || row.qual) === qualifier;
const claimCode = (claimed) => (claimed ? 'RODTEPY' : 'RODTEPN');
const rdtInfoRow = ({ code, msr, uqc }) => ({
  id: Date.now(), type: 'DTY', qual: 'RDT', code, msr, uqc,
  swInfoField1: 'DTY', swInfoField2: 'RDT', swInfoField3: code, swInfoField4: '', swInfoField5: msr, swInfoField6: uqc,
});

export default function RodtepTab() {
  const { items, setItems, exportData, setExportData } = useExportContext();
  const master = useMasterList('/masters/rodteps');
  const [showAll, setShowAll] = useState(false);
  const showAllId = useId();
  const jobInfoRows = asList(exportData && exportData._infoTypes);

  const rateOf = (item) => rodtepRateOf(rodtepRowOf(master, item), item);

  // the DTY / RDT (and CHR / SQC) measurement of an item, in the schedule unit: on the item's own SW info rows, or on
  // the rows kept with the job when the job was read from a file (those are what the Shipping Bill sends)
  const setRdtQty = (item, value) => {
    const rate = rateOf(item);
    const scheduleUnit = (rate && rate.uqc) || capitals(item.unit);
    const invoiceSr = serialOf(item.invSr || 1, 1), itemSr = serialOf(item.itemSr, 0);
    const isThisItem = (row) => serialOf(row.invoiceSerialNumber, 1) === invoiceSr && serialOf(row.itemSerialNumber, 0) === itemSr;
    const keptWithJob = !asList(item.swInfos).length && jobInfoRows.some(isThisItem);
    if (keptWithJob) {
      setExportData((previous) => ({
        ...previous,
        _infoTypes: asList(previous._infoTypes).map((row) => {
          if (!isThisItem(row)) return row;
          const kind = `${capitals(row.infoType)}/${capitals(row.infoQualifier)}`;
          return kind === 'DTY/RDT' || kind === 'CHR/SQC' ? { ...row, infoMeasure: value, infouqc: scheduleUnit } : row;
        }),
      }));
      return;
    }
    setItems((previous) => previous.map((other) => {
      if (other.id !== item.id) return other;
      const swInfos = [...asList(other.swInfos)];
      [['DTY', 'RDT'], ['CHR', 'SQC']].forEach(([type, qualifier]) => {
        const position = swInfos.findIndex((row) => isSwRow(row, type, qualifier));
        if (position >= 0) swInfos[position] = { ...swInfos[position], msr: value, uqc: scheduleUnit, swInfoField5: value, swInfoField6: scheduleUnit };
        else if (qualifier === 'RDT') swInfos.push(rdtInfoRow({ code: claimCode(claimsRodtep(other)), msr: value, uqc: scheduleUnit }));
      });
      return { ...other, swInfos };
    }));
  };

  const setClaim = (id, claimed) => setItems((previous) => previous.map((item) => {
    if (item.id !== id) return item;
    const code = claimCode(claimed);
    const swInfos = [...asList(item.swInfos)];
    const position = swInfos.findIndex((row) => isSwRow(row, 'DTY', 'RDT'));
    if (position >= 0) {
      swInfos[position] = { ...swInfos[position], code, swInfoField3: code };
    } else {
      // the measurement is in the RoDTEP schedule unit (11 NOS of 83071000 is claimed as 139.7 KGS)
      const rate = rateOf(item);
      const quantity = rodtepQtyOf(item, jobInfoRows, rate && rate.uqc);
      swInfos.push(rdtInfoRow({ code, msr: quantity.qty > 0 ? String(quantity.qty) : '', uqc: quantity.unit || item.unit || '' }));
    }
    const flag = claimed ? 'Y' : 'N';
    return { ...item, rodtep: flag, reward: flag, rewardItem: flag, swInfos };
  }));

  const allRows = (items || []).map((item, index) => ({ item, index }));
  const rows = (showAll ? allRows : allRows.filter(({ item }) => isRodtepItem(item))).map(({ item, index }) => {
    const rate = rateOf(item);
    const quantity = rodtepQtyOf(item, jobInfoRows, rate && rate.uqc);
    const amount = rate ? rodtepAmount({ fob: itemFobInr(item), qty: quantity.qty, rate: rate.rate, cap: rate.cap, rsPerUqc: rate.rsPerUqc }) : 0;
    return { item, index, rate, claimed: claimsRodtep(item), amount, quantity };
  });
  const claimedRows = rows.filter((row) => row.claimed);
  // amount is null when the cap is per unit and the quantity is not keyed yet - such a row is counted, not guessed
  const total = claimedRows.reduce((sum, row) => sum + (row.amount !== null ? row.amount : 0), 0);
  const pending = claimedRows.filter((row) => row.rate && row.amount === null).length;
  const noRate = claimedRows.filter((row) => !row.rate).length;
  const noQty = claimedRows.filter((row) => row.rate && row.quantity.from === 'NONE').length;
  const at4RE = rows.filter(({ item }) => isAppendix4RE(item)).length;

  const rateText = ({ rate }) => {
    if (!rate) return <span className="tw:text-warning" title="RITC not in the RoDTEP master">n/a</span>;
    if (rate.rsPerUqc && !rate.rate) return `Rs ${rate.rsPerUqc}/${rate.uqc}`;
    return <>{num(rate.rate)}{rate.appendix === '4RE' && <sup className="tw:text-muted-foreground"> 4RE</sup>}</>;
  };

  const rdtQtyCell = ({ item, rate, claimed, quantity }) => {
    const unitDiffers = rate && rate.uqc && rate.uqc !== capitals(item.unit);
    const qtyMissing = claimed && quantity.from === 'NONE';
    return (
      <div title={unitDiffers ? RDT_QTY_NEEDED : 'DTY / RDT measurement'} className={cn('tw:inline-flex tw:items-center tw:justify-end tw:gap-1', qtyMissing && 'tw:bg-warning/10')}>
        {unitDiffers || quantity.from === 'RDT' ? (
          <>
            <NumberInput
              align="right"
              className={cn('tw:w-[70px]', qtyMissing && 'tw:border-warning')}
              value={quantity.qty > 0 ? String(quantity.qty) : ''}
              placeholder={rate ? rate.uqc : ''}
              onValueChange={(text) => setRdtQty(item, text)}
            />
            <span className="tw:text-[11px]">{quantity.unit || (rate && rate.uqc) || ''}</span>
          </>
        ) : <span>{quantity.qty || 0} {quantity.unit}</span>}
      </div>
    );
  };

  const columns = [
    { key: 'inv', header: 'Inv', align: 'center', width: 'tw:w-[50px]', className: 'tw:font-semibold tw:text-success', cell: ({ item }) => invOf(item) },
    { key: 'item', header: 'Item', align: 'center', width: 'tw:w-[50px]', className: 'tw:font-semibold tw:text-head', cell: ({ item, index }) => itemNoOf(item, index) },
    { key: 'ritc', header: 'RITC', width: 'tw:w-[90px]', cell: ({ item }) => item.ritc || '-' },
    { key: 'description', header: 'Description', className: 'tw:max-w-[280px] tw:overflow-hidden tw:text-ellipsis', cell: ({ item }) => item.desc || item.description || '-' },
    { key: 'qty', header: 'Item Qty', align: 'right', width: 'tw:w-[90px]', cell: ({ item }) => `${item.qty || item.quantity || 0} ${item.unit || ''}` },
    { key: 'rdtQty', header: 'RoDTEP Qty', title: 'DTY / RDT measurement, in the unit of the RoDTEP schedule', align: 'right', width: 'tw:w-[120px]', cell: rdtQtyCell },
    { key: 'fob', header: 'FOB ₹', align: 'right', width: 'tw:w-[110px]', cell: ({ item }) => r2(itemFobInr(item)) },
    { key: 'rate', header: 'Rate %', align: 'right', width: 'tw:w-[70px]', cell: rateText },
    { key: 'cap', header: 'Cap ₹/unit', align: 'right', width: 'tw:w-[90px]', cell: ({ rate }) => (rate ? (num(rate.cap) || '-') : '-') },
    {
      key: 'amount', header: 'Est. RoDTEP ₹', align: 'right', width: 'tw:w-[110px]', className: 'tw:font-semibold',
      cell: ({ rate, claimed, amount }) => (
        <span className={amount === null ? 'tw:text-warning' : (claimed ? 'tw:text-success' : 'tw:text-muted-foreground')} title={amount === null ? CAP_NEEDS_QTY : ''}>
          {!rate ? '-' : (amount === null ? 'qty?' : r2(amount))}
        </span>
      ),
    },
    {
      key: 'claim', header: 'Claim', align: 'center', width: 'tw:w-[90px]',
      cell: ({ item, claimed }) => (isRosctlItem(item)
        ? <span className="tw:text-[11px] tw:text-muted-foreground" title="Scheme 60 item: claims RoSCTL (see Scheme > RoSCTL), not RoDTEP">RoSCTL</span>
        : <SelectBox options={CLAIM_OPTIONS} value={claimed ? 'Y' : 'N'} onValueChange={(value) => setClaim(item.id, value === 'Y')} className={claimed ? 'tw:border-success' : undefined} />),
    },
  ];

  return (
    <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
      <SchemeSummary
        title="RoDTEP"
        actions={(
          <div className="tw:flex tw:items-center tw:gap-1">
            <Checkbox id={showAllId} checked={showAll} onCheckedChange={(checked) => setShowAll(checked === true)} />
            <Label htmlFor={showAllId} className="tw:cursor-pointer">Show all items</Label>
          </div>
        )}
      >
        <span>Claimed: <b>{claimedRows.length}</b> of {rows.length}</span>
        <span>Estimated RoDTEP ₹ <b className="tw:text-success">{r2(total)}</b></span>
        {noRate > 0 && <SummaryNote tone="warn">{noRate} claimed item(s) have no rate in the RoDTEP master</SummaryNote>}
        {pending > 0 && <SummaryNote tone="warn" title={CAP_NEEDS_QTY}>{pending} claimed item(s) not worked out - quantity needed (the cap is per unit)</SummaryNote>}
        {noQty > 0 && <SummaryNote tone="warn" title={RDT_QTY_NEEDED}>{noQty} item(s): key the RoDTEP qty in the schedule unit</SummaryNote>}
        {at4RE > 0 && (
          <SummaryNote tone="muted" title="Exports under Advance Authorisation / EOU / SEZ (scheme 01-05, 16, 17, 34, 35, 39, 41, 44, 46, 63)">
            {at4RE} item(s) at Appendix 4RE rates
          </SummaryNote>
        )}
      </SchemeSummary>

      <SchemeGrid
        className="tw:min-w-[900px]"
        columns={columns}
        rows={rows}
        rowKey={(row, index) => row.item.id ?? index}
        rowClassName={(row) => !row.claimed && 'tw:text-muted-foreground'}
        emptyText='No RoDTEP item. Tick "Show all items" to claim for an item.'
      />

      <SchemeFootnote>
        Estimate = Rate % × FOB ₹, limited to Cap × RoDTEP Qty (Appendix 4R; 4RE for AA / EOU / SEZ exports). ICEGATE gets SW info DTY / RDT (RODTEPY / RODTEPN) and the reward flag of each item; the amount is worked out by customs.
      </SchemeFootnote>
    </div>
  );
}
