import { Input, SelectBox } from '@/components/ui';
import { Box } from '../../ui';
import { BUSINESS_TYPES } from '../mastersData';
import { FlagCheck } from './LedgerAccountTab';
import { FormField, GRID_4 } from './masterParts';

const MSME_TYPES = ['Micro', 'Small', 'Medium'];
const MSME_ACTIVITIES = ['Manufacturing', 'Services', 'Trading'];

// the Other details & MSME tab
export default function LedgerOtherTab({ account }) {
  const { form, setField } = account;
  const blacklisted = !!Number(form.isBlacklisted);
  return (
    <>
      <Box title="Other details" className="tw:bg-card">
        <div className={GRID_4}>
          <FormField label="A/c Code"><Input data-allow-text value={form.accountCode} onChange={(event) => setField('accountCode', event.target.value.toUpperCase())} placeholder="Short code" /></FormField>
          <FormField label="Dealing Branch"><Input data-allow-text value={form.dealingBranch} onChange={(event) => setField('dealingBranch', event.target.value)} placeholder="DEL" /></FormField>
          <FormField label="Business Type"><SelectBox value={form.businessType} onValueChange={(value) => setField('businessType', value)} options={BUSINESS_TYPES} placeholder="Select" clearable clearLabel="Select" /></FormField>
          <div className="tw:flex tw:items-end"><FlagCheck account={account} flag="isActive" label="Active (untick to stop using this account)" /></div>
          <div className="tw:flex tw:flex-wrap tw:gap-4.5 tw:sm:col-span-2 tw:lg:col-span-4">
            <FlagCheck account={account} flag="isFixedDeposit" label="Fixed deposit account" />
            <FlagCheck account={account} flag="isBlacklisted" label="Blacklist party" className={blacklisted ? 'tw:text-destructive' : ''} />
          </div>
          {blacklisted && (
            <FormField label="Why blacklisted" required span={4}>
              <Input data-allow-text required={!form.blacklistReason} value={form.blacklistReason} onChange={(event) => setField('blacklistReason', event.target.value)} placeholder="Cheque bounced, dispute, legal ..." />
            </FormField>
          )}
        </div>
      </Box>
      <Box title="MSME (Udyam)" right={<span className="tw:text-[10.5px] tw:font-semibold tw:text-muted-foreground">Dues to an MSME supplier must be paid within 45 days</span>} className="tw:bg-card">
        <div className={GRID_4}>
          <FormField label="Udyam Registration No" span={2}><Input data-allow-text value={form.msmeNo} onChange={(event) => setField('msmeNo', event.target.value.toUpperCase())} placeholder="UDYAM-DL-07-0012345" /></FormField>
          <FormField label="Enterprise"><SelectBox value={form.msmeType} onValueChange={(value) => setField('msmeType', value)} options={MSME_TYPES} placeholder="Select" clearable clearLabel="Select" /></FormField>
          <FormField label="Activity"><SelectBox value={form.msmeActivity} onValueChange={(value) => setField('msmeActivity', value)} options={MSME_ACTIVITIES} placeholder="Select" clearable clearLabel="Select" /></FormField>
          <FormField label="Agreed Payment Days" hint="Up to 45"><Input className="tw:text-right" inputMode="numeric" value={form.msmeAgreementDays} onChange={(event) => setField('msmeAgreementDays', event.target.value)} /></FormField>
        </div>
      </Box>
    </>
  );
}
