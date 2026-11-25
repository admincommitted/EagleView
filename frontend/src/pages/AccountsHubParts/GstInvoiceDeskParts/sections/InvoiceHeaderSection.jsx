import { Badge, Button, DateInput, Input, SelectBox } from '@/components/ui';
import { Box } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { DIVISIONS, FOREIGN_POS, PARTY_TYPES, isForeignCurrency, partyTypeOptions } from '../gstMath';
import { ChoiceButtons, GRID_8, GridField, ReadOnlyBox, RemoteCombo, RoundOffSelect } from './formParts';
import InvoiceOptionsStrip from './InvoiceOptionsStrip';

const DOCKET_BY = { overseas: [['hawb', 'H/AWB'], ['master', 'Master']], other: [['docket', 'Docket'], ['hawb', 'H/AWB']] };
const DOCKET_FIELD = { hawb: 'hawbNo', master: 'mawbNo', docket: 'jobNo' };
const DOCKET_PLACEHOLDER = { hawb: 'H/AWB NO', master: 'MASTER NO', docket: 'DOCKET NO.' };
const SEZ_OPTIONS = [{ value: 'SEZ SUPPLIES WITH PAYMENT', label: 'SEZ with payment' }, { value: 'SEZ SUPPLIES WITHOUT PAYMENT', label: 'SEZ without payment' }];
const DIVISION_OPTIONS = DIVISIONS.map(([code, label]) => ({ value: code, label: code + ' - ' + label }));

function supplyLabel(desk) {
  const { head, kind, calc } = desk;
  if (!kind.gst) return ' - no GST';
  if (!head.pos) return ' - choose Place of Supply';
  if (calc.zero) return ' - zero rated, no GST';
  if (head.gstExempt) return ' - GST exempted';
  if (head.rcm) return ' - reverse charge';
  return calc.intra ? ' - CGST + SGST' : ' - IGST';
}

function PartyOption({ party }) {
  const branch = party.branches[0];
  const account = party.source === 'ledger' ? 'ledger in accounts' : (party.partyType || '') + (party.hasAccount ? ' - account ✓' : ' - no account');
  return (
    <div className="tw:normal-case">
      <b>{party.name}</b>{' '}
      <span className="tw:text-[10px] tw:text-muted-foreground">{account}{branch && branch.gstin ? ' - ' + branch.gstin : ''}{party.branches.length > 1 ? ' - ' + party.branches.length + ' branches' : ''}</span>
    </div>
  );
}

export default function InvoiceHeaderSection({ desk }) {
  const { head, setField, kindId, kind, meta, our, loaded, isVoid, editId, job, branches, nextNo, noNote, myBranch, division } = desk;
  const docketField = DOCKET_FIELD[head.docketBy];
  const overseas = kindId === 'overseas';
  const states = meta ? meta.states : [];
  const currencies = meta ? meta.currencies.filter((currency) => currency.code !== 'INR') : [];
  const branchOptions = meta && meta.branches.length ? meta.branches.map((branch) => ({ value: branch.code, label: branch.code + ' - ' + branch.name })) : [];
  const paymentOptions = [{ value: 'SUPPLIES WITH PAYMENT', label: 'With payment' }, { value: 'SUPPLIES WITHOUT PAYMENT', label: 'Without payment (LUT)' }, ...(overseas ? [{ value: 'REIMBURSABLE', label: 'Reimbursable' }] : [])];
  const invoiceNoText = editId ? (loaded && loaded.invoiceNo) || '' : nextNo ? nextNo + '  (on Save)' : noNote || 'on Save';

  const title = (
    <span className="tw:inline-flex tw:items-center tw:gap-1.5">
      Invoice {loaded && <Badge variant={isVoid ? 'danger' : 'success'}>{isVoid ? 'VOID' : loaded.invoiceNo}</Badge>}
    </span>
  );
  const right = (
    <span className="tw:text-[10.5px] tw:font-semibold tw:text-muted-foreground">
      {our ? 'Our GSTIN ' + (our.gstin || '-') + ' (' + our.name + ')' : ''}{supplyLabel(desk)}
    </span>
  );
  const docketLabel = <ChoiceButtons options={DOCKET_BY[overseas ? 'overseas' : 'other']} value={head.docketBy} onChange={(value) => setField('docketBy', value)} />;
  const partyLabel = (
    <span>Party{job && job.party && !head.partyName ? <> - <Button variant="link" size="sm" className="tw:h-auto" onClick={() => setField('partyName', job.party)}>{job.party}</Button></> : null}</span>
  );

  return (
    <Box pad={8} title={title} right={right}>
      <div className={GRID_8}>
        <GridField label="Party Type" required>
          <SelectBox options={partyTypeOptions(PARTY_TYPES[overseas ? 'overseas' : 'other'])} value={head.partyType} onValueChange={(value) => setField('partyType', value)}
            placeholder="Select Party" clearable clearLabel="Select Party" required={!head.partyType} />
        </GridField>
        <GridField label={docketLabel}>
          <Input data-allow-text value={head[docketField]} placeholder={head.bulk ? 'ADD DOCKET' : DOCKET_PLACEHOLDER[head.docketBy]}
            onChange={(event) => setField(docketField, event.target.value.toUpperCase())}
            onBlur={() => head.docketBy !== 'master' && desk.findJob()} onKeyDown={(event) => event.key === 'Enter' && desk.findJob()} />
        </GridField>
        <GridField label={partyLabel} required span={3}>
          <RemoteCombo value={head.partyName} required placeholder="PARTY NAME - type 2 letters" onText={desk.typeParty} onPick={desk.pickParty}
            search={(text) => accountsApi.gstInvoiceParties(head.partyType, text)} getValue={(party) => party.name} renderOption={(party) => <PartyOption party={party} />} />
        </GridField>
        <GridField label="Invoice No" span={2}><ReadOnlyBox title={noNote} value={invoiceNoText} /></GridField>
        <GridField label="Date" required><DateInput value={head.date} onValueChange={(value) => setField('date', value)} /></GridField>

        <GridField label="GST No"><Input data-allow-text value={head.gstin} maxLength={15} onChange={(event) => desk.changeGstin(event.target.value)} placeholder="GST NO" /></GridField>
        <GridField label="State / Code"><ReadOnlyBox value={head.stateName ? head.stateName + (head.stateCode ? ' (' + head.stateCode + ')' : '') : ''} placeholder="STATE" /></GridField>
        <GridField label="Party Address" span={3}>
          {branches.length > 1
            ? <SelectBox value={head.partyBranchId || ''} onValueChange={desk.pickBranch}
                options={branches.map((branch) => ({ value: branch.id, label: branch.label + ' - ' + branch.address + ' ' + (branch.gstin ? '(' + branch.gstin + ')' : '') }))} />
            : <Input data-allow-text value={head.address} onChange={(event) => setField('address', event.target.value)} placeholder="PARTY ADDRESS" />}
        </GridField>
        <GridField label="Currency">
          <SelectBox value={head.currency} onValueChange={desk.changeCurrency}
            options={[{ value: 'INR', label: 'INR' }, ...currencies.map((currency) => ({ value: currency.code, label: currency.code + ' - ' + currency.name }))]} />
        </GridField>
        <GridField label="Ex. Rate"><Input readOnly={!isForeignCurrency(head.currency)} value={head.exRate} onChange={(event) => setField('exRate', event.target.value)} /></GridField>
        <GridField label="Branch">
          <SelectBox value={head.branchCode || myBranch} onValueChange={(value) => setField('branchCode', value)} disabled={!!editId} options={branchOptions} placeholder="-" />
        </GridField>
        <GridField label="Division" required>
          <div className="tw:min-w-0 tw:flex-1" title="The invoice no comes from this division's series (iCAFFE)">
            <SelectBox value={division} onValueChange={(value) => setField('division', value)} disabled={!!editId} options={DIVISION_OPTIONS}
              placeholder="Select" clearable clearLabel="Select" required={!division} />
          </div>
        </GridField>

        <GridField label="Place Of Supply" required={kind.gst}>
          <SelectBox value={head.pos} onValueChange={desk.changePlaceOfSupply} placeholder="Select" clearable clearLabel="Select" required={kind.gst && !head.pos}
            options={[...states.map((state) => ({ value: state.code, label: state.name + ' (' + state.code + ')' })), { value: FOREIGN_POS, label: 'Foreign Country' }]} />
        </GridField>
        <GridField label="SEZ"><SelectBox value={head.sez} onValueChange={(value) => setField('sez', value)} options={SEZ_OPTIONS} placeholder="No SEZ" clearable clearLabel="No SEZ" /></GridField>
        <GridField label="Payment Option"><SelectBox value={head.paymentOption} onValueChange={(value) => setField('paymentOption', value)} options={paymentOptions} placeholder="Select" clearable clearLabel="Select" /></GridField>
        {overseas || head.pos === FOREIGN_POS
          ? <GridField label="Country Code"><Input data-allow-text value={head.countryCode} maxLength={3} onChange={(event) => setField('countryCode', event.target.value.toUpperCase())} placeholder="GB, US" /></GridField>
          : <GridField label="Round Off"><RoundOffSelect head={head} setField={setField} /></GridField>}
        <GridField label="Email"><Input data-allow-text value={head.email} onChange={(event) => setField('email', event.target.value)} placeholder="Email" /></GridField>
        <GridField label="Cost Center"><Input data-allow-text value={head.costCentre} onChange={(event) => setField('costCentre', event.target.value)} placeholder="Cost Center" /></GridField>
        <GridField label="Quotation No." span={2}><Input data-allow-text value={head.quotationNo} onChange={(event) => setField('quotationNo', event.target.value)} placeholder="QUOTATION NO." /></GridField>
      </div>
      <InvoiceOptionsStrip desk={desk} />
    </Box>
  );
}
