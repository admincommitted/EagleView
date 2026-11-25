import { DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { Box, LedgerPicker, PartyNote, inr } from '../../ui';
import { num } from '../amounts';
import { CURRENCIES, DIVISION_OPTIONS, PAY_BY } from '../voucherConfig';
import { BranchSelect } from './BranchSelect';
import { VoucherNoInput } from './VoucherNoInput';

const balanceText = (balance, withGroup) => (balance ? inr(balance.balance) + ' ' + balance.side + (withGroup && balance.groupName ? '  -  ' + balance.groupName : '') : '');

// the four boxes on top: voucher, cash / bank book, account, amount and cheque
export function CashHeaderBoxes({ form, editId }) {
  const { header, setHeaderField, entry, setEntryField, look, party, pay } = form;
  const inRupees = entry.currency === 'INR';
  return (
    <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] tw:gap-2.5">
      <Box>
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <Field label="Branch" required labelWidth="104px">
            <BranchSelect value={header.branchCode} onChange={setHeaderField('branchCode')} list={form.branches.list} required disabled={!!editId} />
          </Field>
          <Field label="Division" required labelWidth="104px">
            <SelectBox options={DIVISION_OPTIONS} value={form.division} onValueChange={setHeaderField('division')} placeholder="Select" required={!form.division} disabled={!!editId} />
          </Field>
          <Field label="Voucher No" required labelWidth="104px"><VoucherNoInput header={header} editId={editId} onChange={setHeaderField('voucherNumber')} /></Field>
          <Field label="Date" required labelWidth="104px"><DateInput value={header.date} onValueChange={setHeaderField('date')} /></Field>
          <Field label="Cost Center" labelWidth="104px">
            <SelectBox options={look.cc.map((centre) => ({ value: centre.id, label: centre.name }))} value={header.costCentreId} onValueChange={setHeaderField('costCentreId')} placeholder="Select" clearable clearLabel="Select" />
          </Field>
        </div>
      </Box>
      <Box>
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <Field label={'Cash/Bank Book (' + form.bankSide + '.)'} required labelWidth="128px">
            <LedgerPicker id="bank" list={look.banks.length ? look.banks : look.all} value={form.bank} onChange={form.setBank} placeholder="Cash / bank book" mandatory />
          </Field>
          <Field label="Current Balance" labelWidth="128px"><Input readOnly value={balanceText(form.bankBalance)} /></Field>
          <Field label="Reference No" labelWidth="128px"><Input data-allow-text value={header.refNo} onChange={(event) => setHeaderField('refNo')(event.target.value)} /></Field>
        </div>
      </Box>
      <Box>
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <Field label={'Account (' + (pay ? 'Dr' : 'Cr') + '.)'} required labelWidth="96px">
            <LedgerPicker id="acc" list={look.all} value={entry.ledgerId} onChange={form.pickParty} placeholder={pay ? 'Paid to' : 'Received from'} mandatory />
          </Field>
          <Field label="GSTIN" labelWidth="96px"><Input readOnly value={party?.gstin || ''} /></Field>
          <Field label="Balance" labelWidth="96px"><Input readOnly value={balanceText(party, true)} /></Field>
          <PartyNote b={party} />
          <Field label="Currency" labelWidth="96px">
            <div className="tw:grid tw:w-full tw:grid-cols-[1.2fr_1fr_1fr] tw:gap-1.5">
              <SelectBox options={CURRENCIES} value={entry.currency} onValueChange={setEntryField('currency')} />
              <NumberInput readOnly={inRupees} value={entry.roe} onValueChange={setEntryField('roe')} placeholder="Ex. rate" />
              <NumberInput readOnly={inRupees} value={entry.fcy} onValueChange={setEntryField('fcy')} placeholder="FC amt" />
            </div>
          </Field>
        </div>
      </Box>
      <Box>
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <Field label="Amount" required labelWidth="96px">
            <NumberInput align="right" className="tw:font-extrabold" required={!num(entry.amount)} value={entry.amount} onValueChange={setEntryField('amount')} placeholder="0.00" />
          </Field>
          <Field label="Payment By" labelWidth="96px"><SelectBox options={PAY_BY} value={header.payBy} onValueChange={setHeaderField('payBy')} /></Field>
          <Field label="CHQ/DD/UTR No" labelWidth="96px"><Input data-allow-text value={header.chqNo} onChange={(event) => setHeaderField('chqNo')(event.target.value)} /></Field>
          <Field label="CHQ/DD Date" labelWidth="96px"><DateInput value={header.chqDate} onValueChange={setHeaderField('chqDate')} /></Field>
        </div>
      </Box>
    </div>
  );
}
