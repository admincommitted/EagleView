import { AlertTriangle, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, DataTable, Field, Input, Section, SelectBox,
} from '@/components/ui';
import CustomAutocomplete from '@/components/CustomAutocomplete';
import FieldAutocomplete from '@/components/FieldAutocomplete';
import FWBTextArea from '@/components/FWBTextArea';
import { OCI_COUNTRY_CODES, OCI_CUSTOMS_IDS, OCI_INFO_IDENTIFIERS } from '../awbConstants';
import { LinkButton } from '../awbFormParts';

const MAX_SPH_CODES = 9;
const SSR_REQUIRED_FOR = ['PER', 'AVI', 'DGD', 'VAL'];

const SCI_OPTIONS = [
  { value: 'C', label: 'C - Community' },
  { value: 'F', label: 'F - Fiscal' },
  { value: 'T1', label: 'T1 - Non-Free' },
  { value: 'T2', label: 'T2 - Free Circ.' },
  { value: 'TD', label: 'TD - Transit' },
  { value: 'TF', label: 'TF - Int. Transit' },
  { value: 'X', label: 'X - Export' },
];

const SPH_WARNINGS = [
  { codes: ['PER'], text: 'PER: Ensure temperature requirements are mentioned in OSI.', tone: 'tw:bg-foreground' },
  { codes: ['AVI'], text: "AVI: Health Certificate & IATA Shipper's Cert are mandatory.", tone: 'tw:bg-warning' },
  { codes: ['DGD'], text: 'DGD: Ensure UN Number & Proper Shipping Name exactly match DGD.', tone: 'tw:bg-destructive' },
  { codes: ['FIL'], text: 'FIL: Attach "DO NOT X-RAY" physical labels on packages.', tone: 'tw:bg-primary' },
  { codes: ['CAO'], text: 'CAO: Ensure "CARGO AIRCRAFT ONLY" labels are attached to all packages.', tone: 'tw:bg-warning' },
  { codes: ['VAL'], text: 'VAL: High Value Cargo. Security escort may be required.', tone: 'tw:bg-head' },
  { codes: ['HUM'], text: 'HUM: Ensure death certificate & embalming cert are attached.', tone: 'tw:bg-muted-foreground' },
  { codes: ['AOG'], text: 'AOG: Urgent Aircraft Part. Expedite handling.', tone: 'tw:bg-success' },
  { codes: ['ELI', 'ELM'], text: 'ELI/ELM: Ensure Lithium Battery Mark is visible on all packages.', tone: 'tw:bg-warning' },
  { codes: ['COL', 'CRT', 'ACT'], text: 'COL/CRT/ACT: Temperature-controlled cargo. Verify limits.', tone: 'tw:bg-primary' },
];

const toOptions = (list) => list.map((item) => ({ value: item.val, label: item.label }));
const INFO_ID_OPTIONS = toOptions(OCI_INFO_IDENTIFIERS);
const CUSTOMS_ID_OPTIONS = toOptions(OCI_CUSTOMS_IDS);

function SphCodes({ ctx }) {
  const { masterSph, setSphCodes, sphCodes } = ctx;
  const usedCodes = sphCodes.filter(Boolean);
  const removeCode = (code) => {
    const codes = [...sphCodes];
    const index = codes.indexOf(code);
    if (index > -1) codes[index] = '';
    setSphCodes(codes);
  };
  const addCode = (option) => {
    if (!option?.title) return;
    const codes = [...sphCodes];
    const emptyIndex = codes.findIndex((code) => !code);
    if (emptyIndex > -1 && !codes.includes(option.title)) {
      codes[emptyIndex] = option.title;
      setSphCodes(codes);
    }
  };
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      {usedCodes.map((code, index) => (
        <Badge key={`${code}-${index}`} variant="info" className="tw:gap-1 tw:pr-0.5" title={masterSph.find((item) => item.code === code)?.description || ''}>
          {code}
          <Button variant="ghost" size="icon-sm" className="tw:size-4" aria-label={`Remove ${code}`} onClick={() => removeCode(code)}><X className="tw:size-3" /></Button>
        </Badge>
      ))}
      {usedCodes.length < MAX_SPH_CODES && (
        <div className="tw:w-[150px]">
          <FieldAutocomplete key={sphCodes.join(',')} listType="sph" placeholder="+ Add SPH Code" value="" onSelect={addCode} />
        </div>
      )}
    </div>
  );
}

function OciRows({ ctx }) {
  const { handleAutoFilleCSD, handleOciChange, handleSmartAutoFillOCI, ociRows, setOciRows } = ctx;
  const columns = [
    {
      key: 'countryCode', header: 'COUNTRY CODE', className: 'tw:w-[15%] tw:min-w-[90px]',
      cell: (row) => (
        <CustomAutocomplete value={row.countryCode || ''} staticData={OCI_COUNTRY_CODES} placeholder="SELECT"
          onChange={(event) => handleOciChange(row.id, 'countryCode', event.target.value)}
          onSelect={(option) => handleOciChange(row.id, 'countryCode', option.title)} />
      ),
    },
    {
      key: 'infoId', header: 'INFORMATION IDENTIFIER', className: 'tw:w-[20%] tw:min-w-[150px]',
      cell: (row) => <SelectBox options={INFO_ID_OPTIONS} value={row.infoId || ''} placeholder="SELECT" clearable clearLabel="SELECT" onValueChange={(value) => handleOciChange(row.id, 'infoId', value)} />,
    },
    {
      key: 'customsId', header: 'CUSTOMS INFORMATION IDENTIFIER', className: 'tw:w-[25%] tw:min-w-[180px]',
      cell: (row) => <SelectBox options={CUSTOMS_ID_OPTIONS} value={row.customsId || ''} placeholder="SELECT" clearable clearLabel="SELECT" onValueChange={(value) => handleOciChange(row.id, 'customsId', value)} />,
    },
    {
      key: 'suppInfo', header: 'SUPPLEMENTARY CUSTOMS INFORMATION', className: 'tw:min-w-[180px]',
      cell: (row) => (
        <Input autoComplete="off" maxLength={35} placeholder="Enter Tax ID, EORI, PAN, etc." value={row.suppInfo || ''}
          onChange={(event) => handleOciChange(row.id, 'suppInfo', event.target.value)} />
      ),
    },
    {
      key: 'remove', header: '', width: 36, align: 'center',
      cell: (_, index) => (
        <Button variant="destructive" size="icon-sm" aria-label="Remove row" onClick={() => setOciRows(ociRows.filter((__, rowIndex) => rowIndex !== index))}><X /></Button>
      ),
    },
  ];
  const actions = [
    { label: 'AUTO e-CSD', icon: Zap, onClick: handleAutoFilleCSD },
    { label: 'SMART AUTO-FILL', icon: Zap, onClick: handleSmartAutoFillOCI },
    { label: '+ ADD ROW', onClick: () => setOciRows([...ociRows, { id: Date.now(), countryCode: '', infoId: '', customsId: '', suppInfo: '' }]) },
    { label: 'CLEAR ALL', tone: 'danger', onClick: () => setOciRows([]) },
  ];

  return (
    <Accordion type="single" collapsible className="tw:rounded-sm tw:border tw:border-border tw:bg-page">
      <AccordionItem value="oci">
        <div className="tw:flex tw:flex-col tw:md:flex-row tw:md:items-center">
          <div className="tw:min-w-0 tw:flex-1">
            <AccordionTrigger className="tw:py-1.5 tw:text-[11px] tw:font-bold">
              <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:uppercase">
                OCI: Other customs, security and regulatory control information
                <Badge variant="warning">*(Optional)</Badge>
              </span>
            </AccordionTrigger>
          </div>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-3 tw:gap-y-1 tw:px-3 tw:pb-1.5 tw:md:pb-0">
            {actions.map(({ label, icon: Icon, tone, onClick }) => (
              <LinkButton key={label} tone={tone} className="tw:font-bold" onClick={onClick}>{Icon && <Icon />}{label}</LinkButton>
            ))}
          </div>
        </div>
        <AccordionContent className="tw:border-t tw:border-border tw:bg-background tw:p-2">
          <DataTable columns={columns} rows={ociRows} rowKey="id" emptyText="No OCI line" />
          <p className="tw:m-0 tw:mt-1 tw:text-right tw:text-[9px] tw:italic tw:text-muted-foreground">
            [ENTER INFORMATION IDENTIFYING A PARTY OR A LOCATION RELATED TO CUSTOMS, SECURITY AND REGULATORY CONTROL]
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/** SPH / SCI, SSR / OSI and the OCI lines (the "handling information" box of the AWB). */
export default function HandlingOciSection({ ctx }) {
  const { osiText, sci, setOsiText, setSci, setSsrText, sphCodes, ssrText } = ctx;
  const warnings = SPH_WARNINGS.filter((warning) => warning.codes.some((code) => sphCodes.includes(code)));

  return (
    <Section
      title="Handling Information"
      actions={<span className="tw:text-[10px] tw:font-bold tw:text-muted-foreground">**SPH, SSR, OCI AND OSI FIELDS ARE EQUIVALENT TO THE &quot;HANDLING INFORMATION BOX&quot;</span>}
      className="tw:px-2 tw:pt-1"
      bodyClassName="tw:gap-3 tw:py-2"
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <Field label="SPH: SPECIAL HANDLING CODE" layout="col">
          <SphCodes ctx={ctx} />
        </Field>
        <Field label="SCI" layout="col" labelClassName="tw:font-bold tw:text-warning">
          <SelectBox options={SCI_OPTIONS} value={sci ?? ''} placeholder="SELECT" clearable clearLabel="SELECT" onValueChange={setSci}
            className="tw:w-full tw:border-warning tw:font-bold tw:text-warning tw:md:w-[120px]" />
        </Field>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
        <Field label="SSR: Special Service Request" layout="col">
          <div className="tw:flex tw:w-full tw:flex-col tw:gap-1">
            <FWBTextArea value={ssrText} onChange={(event) => setSsrText(event.target.value)} maxLines={3} maxCharsPerLine={65}
              placeholder="EXAMPLES: DO NOT FEED..." required={sphCodes.some((code) => SSR_REQUIRED_FOR.includes(code))} className="tw:min-h-[60px] tw:resize-none" />
            {warnings.map((warning) => (
              <div key={warning.text} className={cn('tw:flex tw:items-center tw:gap-1.5 tw:rounded-sm tw:px-2.5 tw:py-1.5 tw:text-[11px] tw:font-bold tw:text-white', warning.tone)}>
                <AlertTriangle className="tw:size-3.5 tw:shrink-0" /> {warning.text}
              </div>
            ))}
          </div>
        </Field>
        <Field label="OSI: Other Service Information" layout="col">
          <FWBTextArea value={osiText} onChange={(event) => setOsiText(event.target.value)} maxLines={3} maxCharsPerLine={65}
            placeholder="EXAMPLES: SHIPPERS CERTIFICATION FOR LIVE ANIMALS ATTACHED..." className="tw:min-h-[60px] tw:resize-none" />
        </Field>
      </div>

      <OciRows ctx={ctx} />
    </Section>
  );
}
