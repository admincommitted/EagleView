import { useEffect, useId, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { Button, Checkbox, ComboInput, DataTable, Field, Input, Label, Modal, SelectBox } from '@/components/ui';
import { jobEntryApi } from '../../../jobEntryApi';
import EsanchitDocsPanel from '../../../EsanchitDocsPanel';

const ANTIDUMPING_TYPES = ['Based On Landed Cost', 'Based On Assessable', 'Based On CIF Value', 'Based On Quantity'];

const ADD_FIELDS = [
  { name: 'notnNo', label: 'Notification No' },
  { name: 'cth', label: 'CTH Serial No' },
  { name: 'srNo', label: 'Serial No' },
  { name: 'supSlNo', label: 'Supplier Sl No', required: true },
  { name: 'rate', label: 'Advalorem Rate' },
  { name: 'flag', label: 'Flag', withDifference: true },
  { name: 'qty', label: 'Quantity' },
  { name: 'uqc', label: 'UQC', kind: 'uqc' },
  { name: 'amount', label: 'Spec. Amt' },
  { name: 'currency', label: 'Currency', kind: 'currency', required: true },
];

const EXPIRED_TITLE = 'More than 5 years old - check that it is still in force';
const isSpecific = (row) => String(row.flag || '').toUpperCase() === 'S';

const masterColumns = (onUse) => [
  { key: 'notifNo', header: 'Notn', cell: (row) => <span title={row.maybeExpired ? EXPIRED_TITLE : undefined}>{row.notifNo}</span> },
  { key: 'notifDate', header: 'Date', cell: (row) => row.notifDate || '' },
  { key: 'serialNo', header: 'Sl' },
  { key: 'cthSlNo', header: 'CTH Sl' },
  { key: 'cth', header: 'CTH' },
  { key: 'originCountry', header: 'Origin', cell: (row) => row.originCountry || 'ANY' },
  { key: 'exportCountry', header: 'Export', cell: (row) => row.exportCountry || 'ANY' },
  { key: 'flag', header: 'Flag' },
  { key: 'rateOrAmount', header: 'Rate / Amt', cell: (row) => (isSpecific(row) ? `${row.amount} ${row.currency || ''}/${row.uqc || ''}` : `${row.rate}%`) },
  { key: 'use', header: '', cell: (row) => <Button variant="warning" size="sm" onClick={() => onUse(row)}>Use</Button> },
];

/**
 * "From ADD master": the anti-dumping rows (iCAFFE Antidumping Master) that cover the item's CTH, the country of origin
 * first. "Use" fills notification, serial, CTH serial, flag, rate / specific amount, UQC and currency.
 */
function AntiDumpingMasterLookup({ ritc, origin, onUse }) {
  const [rows, setRows] = useState(null);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const allCountriesId = useId();
  const cth = String(ritc || '').replace(/\D/g, '');
  const hasCth = cth.length >= 4;

  useEffect(() => {
    if (!hasCth) {
      setRows([]);
      return undefined;
    }
    let current = true;
    const loadRows = async () => {
      try {
        const response = await jobEntryApi.antiDumpingForCth(cth, origin || '');
        if (current) setRows(Array.isArray(response?.data) ? response.data : []);
      } catch {
        if (current) setRows([]);
      }
    };
    loadRows();
    return () => { current = false; };
  }, [cth, origin, hasCth]);

  if (!hasCth) return <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">Item has no CTH - enter the RITC to look up anti-dumping duty.</p>;
  if (rows === null) return <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">Looking up anti-dumping duty for {cth}...</p>;
  if (!rows.length) return <p className="tw:m-0 tw:text-entry tw:text-success">No anti-dumping notification in the master for CTH {cth}.</p>;

  const sorted = [...rows].sort((first, second) => (second.matchOrigin - first.matchOrigin) || (first.maybeExpired - second.maybeExpired));
  const shown = showAllCountries ? sorted : sorted.filter((row) => row.matchOrigin || !origin).slice(0, 50);
  const forThisCountry = rows.filter((row) => row.matchOrigin).length;

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5 tw:rounded-sm tw:border tw:border-warning/40 tw:bg-warning/10 tw:p-2">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:text-entry">
        <b className="tw:text-warning">
          From ADD master - CTH {cth}{origin ? `, origin ${origin}` : ''}: {forThisCountry} for this country / {rows.length} in all
        </b>
        {origin && (
          <div className="tw:flex tw:items-center tw:gap-1">
            <Checkbox id={allCountriesId} checked={showAllCountries} onCheckedChange={(checked) => setShowAllCountries(checked === true)} />
            <Label htmlFor={allCountriesId}>all countries</Label>
          </div>
        )}
      </div>
      {shown.length
        ? <DataTable columns={masterColumns(onUse)} rows={shown} rowKey={(_, index) => index} className="tw:whitespace-nowrap"
            rowClassName={(row) => row.maybeExpired && 'tw:text-muted-foreground'} containerClassName="tw:max-h-[170px] tw:bg-background" />
        : <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">None for {origin}. Tick "all countries" to see the other rows.</p>}
      <p className="tw:m-0 tw:text-[10px] tw:text-warning">
        The duty usually depends on the producer / exporter too - check the supplier serial in the notification before filing. Grey rows are more than 5 years old.
      </p>
    </div>
  );
}

function AntiDumpingModal({ ctx }) {
  const { saveAntiDumpingModal, setShowAntiDumpingModal, showAntiDumpingModal, tempAddData, setTempAddData, selectedItem, jobData, masters } = ctx;
  const origin = String(jobData?.countryOfOrigin || jobData?.autoField_20 || '').toUpperCase();
  const setField = (name) => (value) => setTempAddData({ ...tempAddData, [name]: value });

  const useMasterRow = (row) => {
    const specific = isSpecific(row);
    setTempAddData({
      ...tempAddData,
      notnNo: row.notifNo, srNo: row.serialNo, cth: row.cthSlNo, flag: String(row.flag || '').toUpperCase(),
      rate: specific ? '' : (row.rate ?? ''), amount: specific ? (row.amount ?? '') : '',
      uqc: row.uqc || tempAddData.uqc || '', currency: row.currency || tempAddData.currency || '',
      ...(specific ? { type: 'Based On Quantity' } : {}),
    });
  };

  const control = (field) => {
    const value = tempAddData[field.name] || '';
    if (field.kind === 'uqc') {
      return (
        <ComboInput name="uqc" options={masters?.uqcs || []} getValue={(uqc) => uqc.uqcCode} getLabel={(uqc) => uqc.description}
          value={value} onValueChange={setField('uqc')} />
      );
    }
    if (field.kind === 'currency') {
      return (
        <>
          <ComboInput name="currency" required className="tw:w-[70px] tw:flex-none" options={masters?.currencies || []}
            getValue={(currency) => currency.currencyCode} getLabel={(currency) => currency.currencyName} value={value} onValueChange={setField('currency')} />
          <Input name="currencyRate" required className="tw:w-[70px]" value={tempAddData.currencyRate || ''} onChange={(event) => setField('currencyRate')(event.target.value)} />
        </>
      );
    }
    return <Input name={field.name} required={field.required} value={value} onChange={(event) => setField(field.name)(event.target.value)} />;
  };

  return (
    <Modal open={showAntiDumpingModal} title="Antidumping Custom Duty" width={820} closeOnOutside={false}
      onClose={() => setShowAntiDumpingModal(false)} onOk={saveAntiDumpingModal}>
      <AntiDumpingMasterLookup ritc={selectedItem?.ritc} origin={origin} onUse={useMasterRow} />
      <div className="tw:grid tw:grid-cols-1 tw:gap-x-6 tw:gap-y-3 tw:md:grid-cols-2 tw:rounded-sm tw:border tw:border-border tw:p-3">
        <Field label="Antidumping Type" labelWidth="130px" className="tw:md:col-span-2 tw:md:w-1/2">
          <SelectBox name="type" placeholder="Select" options={ANTIDUMPING_TYPES} value={tempAddData.type || ''} onValueChange={setField('type')} />
        </Field>
        {ADD_FIELDS.map((field, index) => (
          <Field key={field.name} label={field.label} required={field.required} labelWidth={index % 2 === 0 ? '130px' : '120px'}>
            {control(field)}
            {field.withDifference && (
              <div className="tw:flex tw:items-center tw:gap-1">
                <Checkbox id="add-difference" checked={tempAddData.difference !== false}
                  onCheckedChange={(checked) => setTempAddData({ ...tempAddData, difference: checked === true })} />
                <Label htmlFor="add-difference">Difference</Label>
              </div>
            )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}

function SupportingDocsModal({ ctx }) {
  const { saveSupportingDocsModal, setShowSupportingDocsModal, showSupportingDocsModal, tempDocsData, setTempDocsData, docsOtherIrns, selectedItem, jobData } = ctx;
  const close = () => setShowSupportingDocsModal(false);
  const footer = (
    <>
      <Button onClick={close}>Cancel</Button>
      <Button variant="success" onClick={saveSupportingDocsModal}><CheckSquare /> OK - keep {tempDocsData.length} document(s)</Button>
    </>
  );

  // the same panel as tab 5 "Supporting Docs", in item mode; invoice / BE rows are kept once on the job
  return (
    <Modal open={showSupportingDocsModal} width={1180} onClose={close} footer={footer} closeOnOutside={false}
      title={`eSanchit documents - item ${selectedItem.invSrNo || '?'}/${selectedItem.itemSrNo || '?'}`}
      description="Doc. for = this item, its invoice or the BE - invoice / BE rows are kept once on the job (shared by all its items)">
      <EsanchitDocsPanel compact rows={tempDocsData} setRows={setTempDocsData} jobData={jobData}
        itemCtx={{ invSr: selectedItem.invSrNo, itemSr: selectedItem.itemSrNo }} otherIrns={docsOtherIrns} title="Documents of this item / its invoice / the BE" />
    </Modal>
  );
}

export default function AntidumpingCustomDutySection({ ctx }) {
  return (
    <>
      <AntiDumpingModal ctx={ctx} />
      <SupportingDocsModal ctx={ctx} />
    </>
  );
}
