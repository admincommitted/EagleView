import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, DataTable, DateInput, Field, Input, Label, SelectBox, Textarea } from '@/components/ui';
import { ChoiceGroup } from '../AirExportParts/widgets';
import { awbNumberOf } from './useEcsd';

const AWB_TYPES = ['AIR WAYBILL', 'HOUSE WAYBILL', 'MASTER AIR WAYBILL'];
const SECURITY_STATUSES = ['SELECT', 'SPX', 'SCO', 'SHR', 'NSC'];
const SECURITY_METHODS = [
  { value: 'SCREENING', label: 'Screening Method' },
  { value: 'EXEMPTION', label: 'Grounds for exemptions' },
  { value: 'RECEIVED', label: 'Received From' },
];
const SCREENING_METHODS = ['PHS', 'VCK', 'XRY', 'EDS', 'AOM', 'EDD', 'ETD', 'CMD'];
const ISSUING_PARTY_FIELDS = [
  { label: 'Country Code', className: 'tw:md:flex-1' },
  { label: 'Regulated Identifier Type', className: 'tw:md:flex-[1.5]' },
  { label: 'Identifier Code', className: 'tw:md:flex-[1.5]' },
  { label: 'Expiry Date', className: 'tw:md:flex-1' },
];

export function EcsdPanel({ title, aside, className, children }) {
  return (
    <div className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5 tw:overflow-hidden tw:rounded tw:border tw:border-muted-foreground tw:bg-card', className)}>
      {title && (
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-l-[6px] tw:border-b-muted-foreground tw:border-l-primary tw:bg-primary/10 tw:px-3 tw:py-1.5 tw:text-[13px] tw:font-extrabold tw:text-head tw:uppercase">
          <span>{title}</span>
          {aside}
        </div>
      )}
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5 tw:px-1.5 tw:pb-1.5">{children}</div>
    </div>
  );
}

export function AwbPicker({ ecsd }) {
  const { declaration, setField, awbs, loadAwbs, pickedAwb, setPickedAwb, addAwb } = ecsd;
  const firstAwbByNumber = new Map();
  awbs.forEach((awb) => {
    const number = awbNumberOf(awb);
    if (number && !firstAwbByNumber.has(number)) firstAwbByNumber.set(number, awb);
  });
  const awbOptions = [...firstAwbByNumber].map(([number, awb]) => ({ value: number, label: `${number}${awb.destination ? ` - ${awb.destination}` : ''}` }));

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end">
      <Field label="From Date" layout="col" className="tw:md:w-[120px]"><DateInput value={declaration.fromDate} onValueChange={setField('fromDate')} /></Field>
      <Field label="To Date" layout="col" className="tw:md:w-[120px]"><DateInput value={declaration.toDate} onValueChange={setField('toDate')} /></Field>
      <Field label="Air Waybill Type" layout="col" className="tw:md:w-[200px]">
        <SelectBox className="tw:flex-1" value={declaration.docType} onValueChange={setField('docType')} options={AWB_TYPES} />
        <Button variant="default" size="icon" title="Reload the AWB list" onClick={loadAwbs}><Search /></Button>
      </Field>
      <Field label="Air Waybill Number" layout="col" className="tw:md:w-[250px]">
        <SelectBox className="tw:flex-1" value={pickedAwb} onValueChange={setPickedAwb} placeholder={awbs.length ? 'SELECT' : 'No AWB found'} options={awbOptions} />
        <Button variant="default" onClick={addAwb}>Add</Button>
      </Field>
    </div>
  );
}

export function ConsignmentPanels({ ecsd }) {
  const { consignment, setNature, declaration, setField } = ecsd;
  return (
    <>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:lg:flex-row">
        <EcsdPanel title="Regulated Entity Category and Identifier - Security Status Issuing Party" className="tw:lg:flex-[2]">
          <div className="tw:flex tw:flex-col tw:gap-1.5 tw:md:flex-row">
            {ISSUING_PARTY_FIELDS.map((field) => (
              <Field key={field.label} label={field.label} layout="col" className={field.className}><Input disabled /></Field>
            ))}
          </div>
        </EcsdPanel>
        <EcsdPanel title="Unique Consignment Identifier - Air waybill Number" className="tw:lg:flex-1">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Input disabled className="tw:w-10" value={consignment.awbPrefix || ''} />
            <span>-</span>
            <Input disabled className="tw:flex-1" value={consignment.awbSuffix || ''} />
          </div>
        </EcsdPanel>
      </div>

      <EcsdPanel title="Contents of the consignment">
        <Textarea data-allow-text className="tw:h-10 tw:resize-none" value={consignment.nature || ''} onChange={(event) => setNature(event.target.value)} />
        <Label className="tw:flex tw:items-center tw:gap-1.5 tw:font-normal">
          <Checkbox checked={declaration.consolidation} onCheckedChange={(checked) => setField('consolidation')(checked === true)} /> Consolidation
        </Label>
      </EcsdPanel>
    </>
  );
}

const HAWB_COLUMNS = [
  { key: 'awbNumber', header: 'HAWB No.', className: 'tw:font-bold tw:text-head' },
  { key: 'shipperName', header: 'Shipper' },
  { key: 'consigneeName', header: 'Consignee' },
  { key: 'origin', header: 'Origin', align: 'center' },
  { key: 'destination', header: 'Dest', align: 'center' },
  { key: 'totalPieces', header: 'Pkgs', align: 'center' },
  { key: 'grossWeight', header: 'Gross Wt.', align: 'center', cell: (hawb) => (hawb.grossWeight ? Number(hawb.grossWeight).toFixed(2) : '') },
  {
    key: 'goods',
    header: 'Goods Desc',
    className: 'tw:max-w-[180px] tw:truncate',
    cell: (hawb) => {
      const goods = hawb.formData?.natureOfGoods || hawb.handlingInformation;
      return <span title={goods || ''}>{goods || '—'}</span>;
    },
  },
];

export function LinkedHawbsPanel({ linkedHawbs, loading }) {
  const status = (
    <span className={cn('tw:text-[11px] tw:font-normal tw:normal-case', loading ? 'tw:text-muted-foreground' : 'tw:text-success')}>
      {loading ? 'Loading...' : `${linkedHawbs.length} HAWB(s) linked`}
    </span>
  );
  return (
    <EcsdPanel title="Linked House AWBs" aside={status}>
      {linkedHawbs.length === 0 && !loading
        ? <div className="tw:p-3 tw:text-center tw:text-[11px] tw:text-muted-foreground">No linked House AWBs found for this MAWB</div>
        : <DataTable columns={HAWB_COLUMNS} rows={linkedHawbs} rowKey={(hawb, index) => index} />}
    </EcsdPanel>
  );
}

export function RoutePanel({ consignment }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded tw:border tw:border-border tw:p-1.5 tw:md:flex-row">
      <Field label="Origin" layout="col" className="tw:md:flex-1"><Input disabled value={consignment.dep || ''} /></Field>
      <Field label="Destination" layout="col" className="tw:md:flex-1"><Input disabled value={consignment.dest || ''} /></Field>
      <Field label="Transfer/Transit points" layout="col" className="tw:md:flex-[2]"><Input disabled /></Field>
    </div>
  );
}

export function SecurityPanels({ declaration, setField }) {
  const toggleMethod = (method) => setField('screeningMethods')(
    declaration.screeningMethods.includes(method)
      ? declaration.screeningMethods.filter((picked) => picked !== method)
      : [...declaration.screeningMethods, method],
  );

  return (
    <>
      <EcsdPanel>
        <div className="tw:flex tw:flex-col tw:gap-3 tw:pt-1.5 tw:md:flex-row">
          <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-2">
            <Field label="Security Status" required layout="col">
              <SelectBox className="tw:w-full tw:md:w-[150px]" value={declaration.securityStatus} onValueChange={setField('securityStatus')} options={SECURITY_STATUSES} />
            </Field>
            <ChoiceGroup value={declaration.securityMethod} onValueChange={setField('securityMethod')} options={SECURITY_METHODS} />
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:md:pl-5">
              {SCREENING_METHODS.map((method) => (
                <Label key={method} className="tw:flex tw:items-center tw:gap-1 tw:font-normal">
                  <Checkbox checked={declaration.screeningMethods.includes(method)} onCheckedChange={() => toggleMethod(method)} /> {method}
                </Label>
              ))}
            </div>
          </div>
          <Field label="Other Screening Method(s)" layout="col" className="tw:flex-1">
            <Textarea data-allow-text className="tw:h-10 tw:resize-none tw:bg-secondary" value={declaration.otherScreeningMethods} onChange={(event) => setField('otherScreeningMethods')(event.target.value)} />
          </Field>
        </div>
      </EcsdPanel>

      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row">
        <EcsdPanel title="Security Status Issued By" className="tw:flex-1">
          <Field label="Issuer name or Employee ID" required layout="col">
            <Input data-allow-text value={declaration.issuerName} onChange={(event) => setField('issuerName')(event.target.value)} />
          </Field>
        </EcsdPanel>
        <EcsdPanel title="Security Status Issued On" className="tw:flex-1">
          <Field label="Issued Date & Time" required layout="col">
            <Input data-allow-text value={declaration.issuedOn} onChange={(event) => setField('issuedOn')(event.target.value)} />
          </Field>
        </EcsdPanel>
      </div>

      <EcsdPanel title="Additional Security Information">
        <Textarea data-allow-text className="tw:h-10 tw:resize-none" value={declaration.additionalInfo} onChange={(event) => setField('additionalInfo')(event.target.value)} />
      </EcsdPanel>
    </>
  );
}
