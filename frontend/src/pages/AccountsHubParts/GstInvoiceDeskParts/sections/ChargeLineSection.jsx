import { Plus, X } from 'lucide-react';
import { Button, DateInput, Input, SelectBox } from '@/components/ui';
import { Box, inr } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { ALL_DOCKETS } from '../hooks/useChargeLine';
import { GRID_12, GridField, ReadOnlyBox, RemoteCombo } from './formParts';

function ChargeOption({ charge }) {
  return (
    <div className="tw:normal-case">
      <b>{charge.name}</b>{' '}
      <span className="tw:text-[10px] tw:text-muted-foreground">{charge.sac ? 'SAC ' + charge.sac : ''}{charge.gstRate != null ? ' - GST ' + charge.gstRate + '%' : ''}{charge.master ? '' : ' - from charge list'}</span>
    </div>
  );
}

function DocketOfLine({ desk }) {
  const { head, kindId, chargeLine } = desk;
  const { line, setLineField, editIndex } = chargeLine;
  if (kindId === 'reimbursable' || kindId === 'can') {
    return (
      <>
        <GridField label="Receipt No"><Input data-allow-text value={line.receiptNo} onChange={(event) => setLineField('receiptNo', event.target.value)} placeholder="RECEIPT NO" /></GridField>
        <GridField label="Receipt Date"><DateInput value={line.receiptDate} onValueChange={(value) => setLineField('receiptDate', value)} /></GridField>
      </>
    );
  }
  if (head.bulk) {
    const options = [...(editIndex < 0 ? [{ value: ALL_DOCKETS, label: 'All ' + head.dockets.length + ' dockets (one line each)' }] : []), ...head.dockets];
    return (
      <GridField label="Docket (line)" required span={2}>
        <SelectBox value={line.jobNo} onValueChange={(value) => setLineField('jobNo', value)} options={options} placeholder="Select" clearable clearLabel="Select" required={!line.jobNo} />
      </GridField>
    );
  }
  return (
    <GridField label="Docket (line)" span={2}>
      <Input data-allow-text value={line.jobNo || head.jobNo} onChange={(event) => setLineField('jobNo', event.target.value.toUpperCase())} />
    </GridField>
  );
}

// the charge being typed: two rows over the 12 column grid
export default function ChargeLineSection({ desk }) {
  const { kind, meta, calc, lineCalc, isVoid, chargeLine } = desk;
  const { line, setLineField, editIndex, addLine } = chargeLine;
  const addOnEnter = (event) => event.key === 'Enter' && addLine();
  const currencies = meta ? meta.currencies.filter((currency) => currency.code !== 'INR').map((currency) => currency.code) : [];
  const gstSplit = lineCalc ? `${lineCalc.igstPct} / ${lineCalc.cgstPct} / ${lineCalc.sgstPct}` : calc.gstOn ? (calc.intra ? 'C + S' : 'IGST') : 'No GST';

  return (
    <Box pad={8} title={editIndex >= 0 ? 'Charge (editing line ' + (editIndex + 1) + ')' : 'Charge'}>
      <div className={GRID_12}>
        <GridField label="Charge" required span={3}>
          <RemoteCombo value={line.charge} required minChars={1} placeholder="CHARGE" onText={(text) => setLineField('charge', text)} onPick={chargeLine.pickCharge}
            search={accountsApi.gstInvoiceCharges} getValue={(charge) => charge.name} renderOption={(charge) => <ChargeOption charge={charge} />} />
        </GridField>
        <GridField label="SAC"><Input data-allow-text value={line.sac} onChange={(event) => setLineField('sac', event.target.value)} placeholder="SAC" /></GridField>
        <GridField label="Currency"><SelectBox value={line.currency} onValueChange={chargeLine.setLineCurrency} options={['INR', ...currencies]} /></GridField>
        <GridField label="Ex.Rate"><Input readOnly={line.currency === 'INR'} value={line.exRate} onChange={(event) => setLineField('exRate', event.target.value)} /></GridField>
        <GridField label="Rate" required><Input required={!line.rate} value={line.rate} onChange={(event) => setLineField('rate', event.target.value)} placeholder="RATE" onKeyDown={addOnEnter} /></GridField>
        <GridField label="Unit"><Input data-allow-text value={line.unit} onChange={(event) => setLineField('unit', event.target.value.toUpperCase())} placeholder="UNIT" /></GridField>
        <GridField label="Qty"><Input value={line.qty} onChange={(event) => setLineField('qty', event.target.value)} onKeyDown={addOnEnter} /></GridField>
        <GridField label="Discount"><Input value={line.discount} onChange={(event) => setLineField('discount', event.target.value)} /></GridField>
        <GridField label="GST %"><Input readOnly={!kind.gst} value={kind.gst ? line.gstRate : 0} onChange={(event) => setLineField('gstRate', event.target.value)} /></GridField>
        <GridField label="INR Amount"><ReadOnlyBox value={lineCalc ? inr(lineCalc.inrAmount) : ''} placeholder="INR" className="tw:font-bold" /></GridField>

        <GridField label="Container No"><Input data-allow-text value={line.containerNo} onChange={(event) => setLineField('containerNo', event.target.value.toUpperCase())} placeholder="CONTAINER" /></GridField>
        <DocketOfLine desk={desk} />
        <GridField label="Narration" span={6}><Input data-allow-text value={line.narration} onChange={(event) => setLineField('narration', event.target.value)} placeholder="Narration" onKeyDown={addOnEnter} /></GridField>
        <GridField label="IGST / CGST / SGST %"><ReadOnlyBox value={gstSplit} /></GridField>
        <div className="tw:flex tw:gap-1">
          <Button variant="default" size="lg" onClick={addLine} disabled={isVoid}><Plus /> {editIndex >= 0 ? 'Update' : 'Add'}</Button>
          {editIndex >= 0 && <Button size="lg" aria-label="Stop editing" onClick={chargeLine.resetLine}><X /></Button>}
        </div>
      </div>
    </Box>
  );
}
