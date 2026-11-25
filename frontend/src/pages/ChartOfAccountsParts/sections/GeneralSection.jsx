// Ledger form: General, Mailing & Contact, Tax & Compliance, Bank & Credit
import { FileText, IndianRupee, Landmark, ShieldCheck, User } from 'lucide-react';
import { Separator, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { groupOptions } from '../chartTabs';
import { CheckField, FieldRow, NumberField, OptionPanel, SelectField, TextField } from '../formFields';

const LEDGER_TABS = [
  { id: 'general', label: 'General', icon: FileText },
  { id: 'mailing', label: 'Mailing & Contact', icon: User },
  { id: 'tax', label: 'Tax & Compliance', icon: ShieldCheck },
  { id: 'bank', label: 'Bank & Credit', icon: Landmark },
];
const BALANCE_TYPES = ['Dr', 'Cr'];
const TAXABILITY = ['Taxable', 'Nil Rated', 'Exempt'];
const DEDUCTEE_TYPES = ['Company', 'Individual/HUF', 'Partnership Firm'];
const TAB_BODY = 'tw:flex tw:flex-col tw:gap-4 tw:pt-2';

function SubHeading({ children }) {
  return <h5 className="tw:m-0 tw:mb-3 tw:text-sm tw:font-semibold tw:text-foreground">{children}</h5>;
}

export default function GeneralSection({ chart }) {
  const { activeTab, flatGroups, ledgerForm, ledgerFormTab, masterData, setLedgerForm, setLedgerFormTab } = chart;
  if (activeTab !== 'ledgers') return null;
  const set = (key) => (value) => setLedgerForm((form) => ({ ...form, [key]: value }));
  const tdsNatureOptions = masterData.tdsNatures.map((nature) => ({ value: String(nature.id), label: `${nature.name} (${nature.section})` }));

  return (
    <Tabs value={ledgerFormTab} onValueChange={setLedgerFormTab}>
      <TabsList variant="line" className="tw:mb-2 tw:h-auto tw:w-full tw:flex-wrap tw:justify-start tw:border-b tw:border-border">
        {LEDGER_TABS.map((tab) => <TabsTrigger key={tab.id} value={tab.id} className="tw:font-semibold"><tab.icon className="tw:size-4" /> {tab.label}</TabsTrigger>)}
      </TabsList>

      <TabsContent value="general" className={TAB_BODY}>
        <TextField label="Ledger Name" required value={ledgerForm.name} onChange={set('name')} placeholder="e.g. Reliance Industries" />
        <SelectField label="Under (Group)" required value={ledgerForm.groupId} onChange={set('groupId')} options={groupOptions(flatGroups)} emptyLabel="-- Select Parent Group --" />
        <FieldRow>
          <NumberField label="Opening Balance" value={ledgerForm.openingBalance} onChange={set('openingBalance')} leftIcon={IndianRupee} />
          <SelectField label="Type" value={ledgerForm.balanceType} onChange={set('balanceType')} options={BALANCE_TYPES} className="tw:md:max-w-[100px]" />
        </FieldRow>
        <OptionPanel className="tw:mt-2">
          <CheckField label="Maintain balances bill-by-bill" checked={ledgerForm.maintainBillByBill} onChange={set('maintainBillByBill')} />
          <CheckField label="Cost Centres are applicable" checked={ledgerForm.costCentresApplicable} onChange={set('costCentresApplicable')} />
        </OptionPanel>
      </TabsContent>

      <TabsContent value="mailing" className={TAB_BODY}>
        <TextField label="Address" multiline value={ledgerForm.address} onChange={set('address')} placeholder="Full address..." />
        <FieldRow>
          <TextField label="State" value={ledgerForm.state} onChange={set('state')} />
          <TextField label="PIN Code" value={ledgerForm.pinCode} onChange={set('pinCode')} />
          <TextField label="Country" value={ledgerForm.country} onChange={set('country')} />
        </FieldRow>
        <FieldRow className="tw:mt-4">
          <TextField label="Contact Person" value={ledgerForm.contactPerson} onChange={set('contactPerson')} />
          <TextField label="Email" type="email" value={ledgerForm.email} onChange={set('email')} />
          <TextField label="Phone" value={ledgerForm.phone} onChange={set('phone')} />
        </FieldRow>
      </TabsContent>

      <TabsContent value="tax" className="tw:flex tw:flex-col tw:gap-5 tw:pt-2">
        <div>
          <SubHeading>Core Tax Details</SubHeading>
          <FieldRow>
            <TextField label="GSTIN Number" upper value={ledgerForm.gstin} onChange={set('gstin')} />
            <TextField label="PAN Number" upper value={ledgerForm.pan} onChange={set('pan')} />
          </FieldRow>
        </div>
        <Separator />
        <div>
          <SubHeading>GST Setup (For Goods/Services)</SubHeading>
          <div className="tw:mb-3"><CheckField label="Is GST Applicable?" checked={ledgerForm.isGstApplicable} onChange={set('isGstApplicable')} /></div>
          {ledgerForm.isGstApplicable && (
            <OptionPanel>
              <FieldRow className="tw:w-full">
                <TextField label="HSN/SAC" value={ledgerForm.hsnSac} onChange={set('hsnSac')} />
                <SelectField label="Taxability" value={ledgerForm.taxability} onChange={set('taxability')} options={TAXABILITY} />
                <NumberField label="GST Rate (%)" value={ledgerForm.gstRate} onChange={set('gstRate')} />
              </FieldRow>
            </OptionPanel>
          )}
        </div>
        <Separator />
        <div>
          <SubHeading>TDS Compliance</SubHeading>
          <FieldRow className="tw:md:gap-6">
            <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-1">
              <CheckField label="Is TDS Applicable? (For Expenses)" checked={ledgerForm.isTdsApplicable} onChange={set('isTdsApplicable')} />
              {ledgerForm.isTdsApplicable && <SelectField value={ledgerForm.tdsNatureId} onChange={set('tdsNatureId')} options={tdsNatureOptions} emptyLabel="-- Select TDS Nature --" />}
            </div>
            <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-1">
              <CheckField label="Is TDS Deductible? (For Parties)" checked={ledgerForm.isTdsDeductible} onChange={set('isTdsDeductible')} />
              {ledgerForm.isTdsDeductible && <SelectField value={ledgerForm.deducteeType} onChange={set('deducteeType')} options={DEDUCTEE_TYPES} />}
            </div>
          </FieldRow>
        </div>
      </TabsContent>

      <TabsContent value="bank" className={TAB_BODY}>
        <FieldRow>
          <TextField label="Bank Name" value={ledgerForm.bankName} onChange={set('bankName')} />
          <TextField label="Account Number" value={ledgerForm.bankAccount} onChange={set('bankAccount')} />
          <TextField label="IFSC Code" upper value={ledgerForm.bankIfsc} onChange={set('bankIfsc')} />
        </FieldRow>
        <Separator className="tw:my-2" />
        <FieldRow>
          <NumberField label="Credit Limit (₹)" value={ledgerForm.creditLimit} onChange={set('creditLimit')} />
          <NumberField label="Credit Days" decimals={0} value={ledgerForm.creditDays} onChange={set('creditDays')} />
        </FieldRow>
      </TabsContent>
    </Tabs>
  );
}
