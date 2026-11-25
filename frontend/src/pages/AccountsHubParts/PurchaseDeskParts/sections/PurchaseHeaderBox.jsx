import { DateInput, Field, Input, SelectBox } from '@/components/ui';
import { Box, LedgerPicker, PartyNote, inr } from '../../ui';
import { DIVISION_OPTIONS } from '../../VoucherDeskParts/voucherConfig';
import { CheckLabel } from '../../VoucherDeskParts/sections/CheckLabel';
import { VoucherNoInput } from '../../VoucherDeskParts/sections/VoucherNoInput';
import { SEZ_OPTIONS, SUPPLY_OPTIONS } from '../purchaseConfig';

const textInput = (value, onChange, extra) => <Input data-allow-text value={value} onChange={(event) => onChange(event.target.value)} {...extra} />;

// party, bill no and dates, place of supply, job, HBL / master no, SEZ
export function PurchaseHeaderBox({ form, editId }) {
  const { cfg, header, setHeaderField, creditNote, vendorBalance, look } = form;
  const jobRequired = cfg.needJob && !creditNote;
  const stateText = vendorBalance ? vendorBalance.state || (vendorBalance.gstin ? 'Code ' + vendorBalance.gstin.slice(0, 2) : '') : '';
  return (
    <Box>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] tw:items-end tw:gap-2.5">
        <Field label="Division" required layout="col">
          <SelectBox options={DIVISION_OPTIONS} value={form.division} onValueChange={setHeaderField('division')} placeholder="Select" required={!form.division} disabled={!!editId} />
        </Field>
        <Field label="Voucher No" required layout="col"><VoucherNoInput header={header} editId={editId} onChange={setHeaderField('voucherNumber')} /></Field>
        <Field label="Date" required layout="col"><DateInput value={header.date} onValueChange={setHeaderField('date')} /></Field>
        <Field label="Branch" layout="col">{textInput(header.branchCode, setHeaderField('branchCode'), { placeholder: 'This branch' })}</Field>
        <Field label="Select Party" required layout="col" className="tw:sm:col-span-2">
          <div className="tw:flex tw:w-full tw:min-w-0 tw:flex-col">
            <LedgerPicker id="vendor" list={look.creditors.length ? look.creditors : look.all} value={form.vendor} onChange={form.setVendor} autoFocus placeholder="Vendor (Sundry Creditors)" mandatory />
            <PartyNote b={vendorBalance} />
          </div>
        </Field>
        <Field label="Party GSTIN" layout="col"><Input readOnly value={vendorBalance?.gstin || ''} /></Field>
        <Field label="State" layout="col"><Input readOnly value={stateText} /></Field>
        <Field label={creditNote ? 'Credit Note No' : 'Invoice No'} required layout="col">
          {textInput(header.billNo, setHeaderField('billNo'), { required: !header.billNo, placeholder: creditNote ? 'Vendor credit note no' : 'Vendor bill no' })}
        </Field>
        <Field label={creditNote ? 'Credit Note Date' : 'Invoice Date'} required layout="col"><DateInput value={header.billDate} onValueChange={form.setBillDate} /></Field>
        {!creditNote && <Field label="Due Date" layout="col"><DateInput value={header.dueDate} onValueChange={setHeaderField('dueDate')} /></Field>}
        <Field label="Place Of Supply" layout="col">
          <SelectBox options={SUPPLY_OPTIONS} value={form.supply} onValueChange={setHeaderField('supply')} disabled={header.isSez} />
        </Field>
        <Field label="Docket / Job No" required={jobRequired} layout="col">
          {textInput(header.jobNo, setHeaderField('jobNo'), { required: jobRequired && !header.jobNo, placeholder: cfg.needJob ? 'Job of this bill' : 'Optional' })}
        </Field>
        <Field label="HBL / HAWB No" layout="col">{textInput(header.hblNo, setHeaderField('hblNo'))}</Field>
        <Field label="Master (MBL / MAWB) No" layout="col">{textInput(header.mblNo, setHeaderField('mblNo'))}</Field>
        <Field label="SEZ Supplier" layout="col">
          <div className="tw:flex tw:w-full tw:items-center tw:gap-1.5">
            <CheckLabel checked={header.isSez} onChange={(checked) => setHeaderField('isSez')(checked)} />
            <SelectBox options={SEZ_OPTIONS} value={header.sezType} onValueChange={setHeaderField('sezType')} disabled={!header.isSez} className="tw:flex-1" />
          </div>
        </Field>
        <Field label="Party Balance" layout="col"><Input readOnly value={vendorBalance ? inr(vendorBalance.balance) + ' ' + vendorBalance.side : ''} /></Field>
      </div>
    </Box>
  );
}
