import { Input } from '@/components/ui';
import { Box, inr } from '../../ui';
import { isForeignCurrency, num, round2 } from '../gstMath';
import { GRID_12, GridField, ReadOnlyBox } from './formParts';

export default function InvoiceTotalsSection({ desk }) {
  const { head, setField, calc } = desk;
  const foreignTotal = isForeignCurrency(head.currency) && num(head.exRate) ? ' (' + head.currency + ' ' + inr(calc.total / num(head.exRate)) + ')' : '';
  const figures = [['Gross (INR)', calc.gross], ['IGST', calc.igst], ['CGST', calc.cgst], ['SGST', calc.sgst], ['Round Off', calc.roundOff]];
  return (
    <Box pad={8}>
      <div className={GRID_12}>
        {figures.map(([label, value]) => <GridField key={label} label={label}><ReadOnlyBox value={inr(value)} /></GridField>)}
        <GridField label={'Invoice Total' + foreignTotal} span={2}><ReadOnlyBox value={inr(calc.total)} className="tw:font-extrabold tw:text-head" /></GridField>
        <GridField label="Advance"><Input value={head.advance} onChange={(event) => setField('advance', event.target.value)} placeholder="0.00" /></GridField>
        <GridField label="Payable"><ReadOnlyBox value={inr(round2(calc.total - num(head.advance)))} className="tw:font-extrabold" /></GridField>
        <GridField label="Remarks (printed)" span={3}><Input data-allow-text value={head.remarks} onChange={(event) => setField('remarks', event.target.value)} placeholder="Remarks" /></GridField>
      </div>
    </Box>
  );
}
