import { Input, SelectBox, Textarea } from '@/components/ui';
import { Box, LedgerPicker } from '../../ui';
import { CheckField } from '../../GstInvoiceDeskParts/sections/formParts';
import { STATE_OPTIONS, balanceText, stateOfGstin } from '../mastersData';
import { FormField, GRID_2, GRID_4 } from './masterParts';

const TAXABILITY = ['Taxable', 'Exempt', 'Nil Rated', 'Non-GST'];
const DEDUCTEE_TYPES = ['Company', 'Individual / HUF', 'Firm / LLP', 'Others'];
const CREDIT_MODES = ['Credit', 'Advance', 'Cash', 'Against delivery'];
const PAIR = 'tw:grid tw:grid-cols-[1fr_64px] tw:gap-1.5';
const FLAGS_ROW = 'tw:flex tw:flex-wrap tw:gap-3.5 tw:sm:col-span-2';

// a 0 / 1 flag of the ledger as a tick box
export function FlagCheck({ account, flag, label, className }) {
  return <CheckField label={label} checked={!!Number(account.form[flag])} onCheckedChange={(on) => account.setFlagField(flag, on)} className={className} />;
}

function AccountDetails({ account }) {
  const { form, setField, groups, pathOf, group, isParty, isBank, info, selectedId } = account;
  const groupType = group ? group.nature + (isParty ? ' - party' : isBank ? ' - bank / cash' : '') : '';
  return (
    <Box title={selectedId ? 'Account details - ' + (info ? info.name : '') : 'New account'} className="tw:bg-card">
      <div className={GRID_4}>
        <FormField label="Account Name" required span={2}><Input data-allow-text required={!form.name} value={form.name} onChange={(event) => setField('name', event.target.value)} autoFocus={!selectedId} /></FormField>
        <FormField label="Under Group" required span={2}>
          <SelectBox value={form.groupId} onValueChange={(value) => setField('groupId', value)} options={groups.map((entry) => ({ value: entry.id, label: pathOf(entry) }))} placeholder="Select" required={!form.groupId} />
        </FormField>
        <FormField label="Account Type"><SelectBox value={form.accountType || 'Personal'} onValueChange={(value) => setField('accountType', value)} options={['Personal', 'Ledger']} /></FormField>
        <FormField label="Group Type"><Input readOnly value={groupType} /></FormField>
        <FormField label="Opening Balance">
          <div className={PAIR}>
            <Input className="tw:text-right" inputMode="decimal" value={form.openingBalance} onChange={(event) => setField('openingBalance', event.target.value)} placeholder="0.00" />
            <SelectBox value={form.balanceType} onValueChange={(value) => setField('balanceType', value)} options={['Dr', 'Cr']} />
          </div>
        </FormField>
        <FormField label="Current Balance"><Input readOnly className="tw:text-right tw:font-bold" value={info && selectedId ? balanceText(info.balance, info.side) : ''} /></FormField>
      </div>
    </Box>
  );
}

function GstTdsBox({ account }) {
  const { form, setField, setForm, setGstin, tdsSections, allLedgers } = account;
  const gstinHint = form.gstin ? stateOfGstin(form.gstin) : Number(form.isUnregistered) ? 'Un-registered party' : 'State and PAN fill in from it';
  const tdsOff = !Number(form.isTdsApplicable);
  return (
    <Box title="GST & TDS" className="tw:bg-card">
      <div className={GRID_2}>
        <FormField label="GSTIN" hint={gstinHint}>
          <Input data-allow-text value={form.gstin} onChange={(event) => setGstin(event.target.value)} maxLength={15} placeholder="07AAACC1234D1Z5" disabled={!!Number(form.isUnregistered)} />
        </FormField>
        <FormField label="PAN"><Input data-allow-text value={form.pan} onChange={(event) => setField('pan', event.target.value.toUpperCase())} maxLength={10} placeholder="AAACC1234D" /></FormField>
        <FormField label="Taxability"><SelectBox value={form.taxability} onValueChange={(value) => setField('taxability', value)} options={TAXABILITY} placeholder="Select" clearable clearLabel="Select" /></FormField>
        <FormField label="HSN / SAC and GST %">
          <div className={PAIR}>
            <Input value={form.hsnSac} onChange={(event) => setField('hsnSac', event.target.value)} placeholder="996531" />
            <Input className="tw:text-right" value={form.gstRate} onChange={(event) => setField('gstRate', event.target.value)} placeholder="%" />
          </div>
        </FormField>
        <div className={FLAGS_ROW}>
          <FlagCheck account={account} flag="isGstApplicable" label="GST applicable" />
          <FlagCheck account={account} flag="isUnregistered" label="Un-registered" />
          <FlagCheck account={account} flag="isComposite" label="Composite GST" />
        </div>
        <div className={FLAGS_ROW}>
          <FlagCheck account={account} flag="isTdsApplicable" label="Apply TDS" />
          <FlagCheck account={account} flag="isTdsExempt" label="Exempt TDS" />
          <FlagCheck account={account} flag="isTdsDeductible" label="Party deducts TDS from us" />
        </div>
        <FormField label="TDS Section">
          <SelectBox value={form.tdsNatureId} disabled={tdsOff || !!Number(form.isTdsExempt)} onValueChange={(value) => setField('tdsNatureId', value)} placeholder="Select" clearable clearLabel="Select"
            options={tdsSections.map((section) => ({ value: section.id, label: section.section + ' - ' + section.name + ' (' + Number(section.rate) + '%)' }))} />
        </FormField>
        <FormField label="Deductee Type">
          <SelectBox value={form.deducteeType} disabled={tdsOff} onValueChange={(value) => setField('deducteeType', value)} options={DEDUCTEE_TYPES} placeholder="Select" clearable clearLabel="Select" />
        </FormField>
        <FormField label="Party TDS A/c" span={2}>
          <LedgerPicker id="ptds" list={allLedgers} value={form.partyTdsLedgerId} onChange={(value) => setForm((old) => ({ ...old, partyTdsLedgerId: value }))} placeholder="TDS ledger used for this party" />
        </FormField>
      </div>
    </Box>
  );
}

function CreditBankBox({ account }) {
  const { form, setField, selectedId } = account;
  return (
    <Box title="Credit control & bank" className="tw:bg-card">
      <div className={GRID_2}>
        <FormField label="Credit Days" hint="Overdue after these days (30 when blank)"><Input className="tw:text-right" inputMode="numeric" value={form.creditDays} onChange={(event) => setField('creditDays', event.target.value)} /></FormField>
        <FormField label="Credit Limit"><Input className="tw:text-right" inputMode="decimal" value={form.creditLimit} onChange={(event) => setField('creditLimit', event.target.value)} /></FormField>
        <FormField label="Credit Mode"><SelectBox value={form.creditMode || 'Credit'} onValueChange={(value) => setField('creditMode', value)} options={CREDIT_MODES} /></FormField>
        <FormField label="Monthly Budget"><Input className="tw:text-right" inputMode="decimal" value={form.monthlyBudget} onChange={(event) => setField('monthlyBudget', event.target.value)} /></FormField>
        <div className={FLAGS_ROW}>
          <FlagCheck account={account} flag="maintainBillByBill" label="Keep bill-by-bill" />
          <FlagCheck account={account} flag="costCentresApplicable" label="Cost centres apply" />
        </div>
      </div>
      <div className="tw:mt-3 tw:mb-1.5 tw:text-[10px] tw:font-extrabold tw:text-muted-foreground tw:uppercase">Main bank account {selectedId ? '(more in Bank accounts)' : ''}</div>
      <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-3">
        <FormField label="Bank Name"><Input data-allow-text value={form.bankName} onChange={(event) => setField('bankName', event.target.value)} /></FormField>
        <FormField label="Account No"><Input value={form.bankAccount} onChange={(event) => setField('bankAccount', event.target.value)} /></FormField>
        <FormField label="IFSC"><Input data-allow-text value={form.bankIfsc} onChange={(event) => setField('bankIfsc', event.target.value.toUpperCase())} maxLength={11} /></FormField>
      </div>
    </Box>
  );
}

function AddressBox({ account }) {
  const { form, setField, selectedId } = account;
  return (
    <Box title={'Registered address & contact' + (selectedId ? ' (more in Addresses)' : '')} className="tw:bg-card">
      <div className={GRID_4}>
        <FormField label="Address" span={2}><Textarea rows={2} value={form.address} onChange={(event) => setField('address', event.target.value)} /></FormField>
        <FormField label="State"><SelectBox value={form.state} onValueChange={(value) => setField('state', value)} options={STATE_OPTIONS} placeholder="Select" clearable clearLabel="Select" /></FormField>
        <FormField label="PIN / Country">
          <div className="tw:grid tw:grid-cols-2 tw:gap-1.5">
            <Input value={form.pinCode} onChange={(event) => setField('pinCode', event.target.value)} maxLength={10} />
            <Input data-allow-text value={form.country} onChange={(event) => setField('country', event.target.value)} />
          </div>
        </FormField>
        <FormField label="Contact Person"><Input data-allow-text value={form.contactPerson} onChange={(event) => setField('contactPerson', event.target.value)} /></FormField>
        <FormField label="Phone"><Input value={form.phone} onChange={(event) => setField('phone', event.target.value)} /></FormField>
        <FormField label="Email" span={2}><Input data-allow-text value={form.email} onChange={(event) => setField('email', event.target.value)} /></FormField>
      </div>
    </Box>
  );
}

// the Account tab: details, GST & TDS, credit & bank, registered address
export default function LedgerAccountTab({ account }) {
  return (
    <>
      <AccountDetails account={account} />
      <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:lg:grid-cols-2">
        <GstTdsBox account={account} />
        <CreditBankBox account={account} />
      </div>
      <AddressBox account={account} />
    </>
  );
}
