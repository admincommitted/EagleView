import { DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { Box } from '../../ui';
import { CURRENCIES, DIVISION_OPTIONS } from '../voucherConfig';
import { BranchSelect } from './BranchSelect';
import { Notice } from './Notice';
import { VoucherNoInput } from './VoucherNoInput';

export function LinesHeaderBox({ form, cfg, initial, editId }) {
  const { header, setHeaderField, branches, own } = form;
  return (
    <>
      {initial && (
        <Notice tone={editId ? 'warn' : 'info'}>
          {editId
            ? `Modifying ${initial.typeName} ${initial.voucherNumber}. The lines are shown as Dr / Cr entries; after saving the voucher goes back for approval.`
            : `Copy of ${initial.typeName} ${initial.voucherNumber} - change what you need and Save as a new voucher.`}
        </Notice>
      )}
      <Box>
        <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] tw:items-end tw:gap-2.5">
          <Field label="Branch" required layout="col"><BranchSelect value={own} onChange={form.setOwn} list={branches.list} required disabled={!!editId} /></Field>
          {cfg.branch && (
            <Field label="To Branch" required layout="col"><BranchSelect value={header.branchCode} onChange={setHeaderField('branchCode')} list={branches.list} required exclude={own} /></Field>
          )}
          <Field label="Division" required layout="col">
            <SelectBox options={DIVISION_OPTIONS} value={form.division} onValueChange={setHeaderField('division')} placeholder="Select" required={!form.division} disabled={!!editId} />
          </Field>
          <Field label="Voucher No." required layout="col"><VoucherNoInput header={header} editId={editId} onChange={setHeaderField('voucherNumber')} /></Field>
          <Field label="Date" required layout="col"><DateInput value={header.date} onValueChange={setHeaderField('date')} /></Field>
          <Field label="Curr" layout="col"><SelectBox options={CURRENCIES} value={header.currency} onValueChange={form.setCurrency} /></Field>
          <Field label="Ex. Rate" layout="col"><NumberInput readOnly={!form.foreign} value={header.roe} onValueChange={setHeaderField('roe')} /></Field>
          <Field label="Ref No" layout="col"><Input data-allow-text value={header.refNo} onChange={(event) => setHeaderField('refNo')(event.target.value)} /></Field>
        </div>
      </Box>
    </>
  );
}
