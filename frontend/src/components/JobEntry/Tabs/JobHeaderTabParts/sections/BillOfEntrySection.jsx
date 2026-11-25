import { useEffect, useState } from 'react';
import { ComboInput, Field, FlagInput, Input, Section, SelectBox } from '@/components/ui';
import { jobEntryApi } from '../../../jobEntryApi';

// importer type is saved as the ICEGATE code (G|U|P|O|J|R|D|E|H|I); names saved by older jobs are mapped back
const IMP_TYPE = { G: 'Government', U: 'Undertaking (PSU)', P: 'Private', O: 'Others', J: 'Jobbing', R: 'Repairing', D: 'Destruction', E: 'Exhibition', H: 'Hand Carry Jeweller', I: 'Unclaimed Cargo' };
const IMP_NAME_TO_CODE = { GOVERNMENT: 'G', UNDERTAKING: 'U', 'UNDERTAKING (PSU)': 'U', PRIVATE: 'P', OTHERS: 'O', JOBBING: 'J', REPAIRING: 'R', DESTRUCTION: 'D', EXHIBITION: 'E', 'HAND CARRY JEWELLER': 'H', 'HAND CARRY': 'H', 'UNCLAIMED CARGO': 'I', 'UNCLIAMED CARGO': 'I' };
const impCode = (value) => {
  const text = String(value || '').trim().toUpperCase();
  if (!text || text === 'SELECT') return '';
  if (/^[GUOPERJDTSVAHIMBF]$/.test(text)) return text;
  return IMP_NAME_TO_CODE[text] || '';
};
const IMPORTER_TYPE_OPTIONS = Object.entries(IMP_TYPE).map(([code, name]) => ({ value: code, label: `${code} - ${name}` }));

const paymentCode = (value) => { const text = String(value || '').trim().toUpperCase(); return text.startsWith('D') ? 'D' : text.startsWith('T') ? 'T' : ''; };
const PAYMENT_OPTIONS = [{ value: 'T', label: 'Transaction' }, { value: 'D', label: 'Deferred' }];
const UCR_TYPES = [{ value: 'AWB', label: 'Air waybill' }, { value: 'BL', label: 'Bill of lading' }, { value: 'IGM', label: 'IGM' }];
const MOVEMENT_REMARKS = ['BILLING PURPOSE', 'EX-BOND', 'PARTY MOVEMENT', 'DPD', 'ICD OTHER', 'IN PROCESS', 'YES', 'LATE DOCUMENT'];
const DELIVERY_MODES = ['DESTUFF', 'LOADED'];
const PANEL_ROW = 'tw:flex tw:flex-col tw:gap-2 tw:rounded-sm tw:p-1 tw:lg:flex-row tw:lg:items-center tw:lg:gap-4';

let shippingLinesCache = null;
const requestShippingLines = async () => {
  try {
    const lines = await jobEntryApi.shippingLines();
    return Array.isArray(lines) ? lines : [];
  } catch {
    shippingLinesCache = null;
    return [];
  }
};
const loadShippingLines = () => {
  shippingLinesCache ??= requestShippingLines();
  return shippingLinesCache;
};

function FlagField({ label, labelWidth = '130px', required, ...flag }) {
  return (
    <Field label={label} labelWidth={labelWidth} required={required}>
      <FlagInput placeholder="N" required={required} {...flag} />
    </Field>
  );
}

function TextField({ label, labelWidth, className, ...input }) {
  return (
    <Field label={label} labelWidth={labelWidth} className={className}>
      <Input {...input} />
    </Field>
  );
}

export default function BillOfEntrySection({ ctx }) {
  const { addtlDetails, firstCheck, handleChange, highSeaSale, jobData, priorBE, provAssess, section48, setIsFirstCheckModalOpen, setIsHighSeaSaleModalOpen, setIsProvAssessModalOpen, setIsSection48ModalOpen, setJobData, transportMode } = ctx;
  const setField = (name) => (value) => handleChange({ target: { name, value } });
  const isSea = transportMode === 'S';
  const isAir = transportMode === 'A';

  const [shippingLines, setShippingLines] = useState([]);
  useEffect(() => {
    let current = true;
    const loadLines = async () => {
      const lines = await loadShippingLines();
      if (current) setShippingLines(lines);
    };
    loadLines();
    return () => { current = false; };
  }, []);

  const jobFlag = (key, openModal) => (value) => {
    setJobData((prev) => ({ ...prev, [key]: value }));
    if (openModal && value === 'Y') openModal(true);
  };

  const greenChannel = jobData.greenChannel || jobData.greenChannelRequested || (/^[YN]$/.test(String(jobData.autoField_55 || '')) ? jobData.autoField_55 : '') || '';
  const movementRemarks = jobData.movementRemarks ?? (/^select$/i.test(String(jobData.autoField_54 || '')) ? '' : (jobData.autoField_54 || ''));
  const deliveryMode = jobData.deliveryMode ?? (DELIVERY_MODES.includes(String(jobData.autoField_55 || '')) ? jobData.autoField_55 : '');

  return (
    <Section title="Bill Of Entry Specification">
      <div className="tw:grid tw:grid-cols-1 tw:items-center tw:gap-x-4 tw:gap-y-2 tw:sm:grid-cols-2 tw:lg:grid-cols-5">
        <FlagField label="Kacha BE [Y/N]" required name="kachchaBE" value={jobData.kachchaBE || jobData.kachaBe || ''}
          onValueChange={(value) => setJobData((prev) => ({ ...prev, kachchaBE: value }))} />

        <Field label="Importer Type" required labelWidth="130px" hint="Mandatory on every BE (ICEGATE importer type)">
          <SelectBox name="importerType" required clearable clearLabel="Select" placeholder="Select" className="tw:w-full tw:md:w-[120px]" options={IMPORTER_TYPE_OPTIONS}
            value={impCode(jobData.importerType) || (String(jobData.autoField_53 || '').length === 1 ? impCode(jobData.autoField_53) : '')}
            onValueChange={setField('importerType')} />
        </Field>

        <FlagField label="Green Channel" labelWidth="200px" required name="greenChannel" value={greenChannel}
          onValueChange={(value) => setJobData((prev) => ({ ...prev, greenChannel: value, greenChannelRequested: value }))} />

        <FlagField label="High Sea Sale" required value={highSeaSale} onValueChange={jobFlag('highSeaSaleFlag', setIsHighSeaSaleModalOpen)} />
        <FlagField label="Section[48] [Y/N]" required value={section48} onValueChange={jobFlag('section48Requested', setIsSection48ModalOpen)} />
        <FlagField label="Prior BE [Y/N]" required value={priorBE} onValueChange={jobFlag('whetherPriorBE')} />

        <Field label="Payment Method" required labelWidth="130px">
          <SelectBox name="paymentMethodCode" required className="tw:w-full tw:md:w-[120px]" options={PAYMENT_OPTIONS}
            value={paymentCode(jobData.paymentMethodCode || jobData.paymentMethod) || 'T'}
            onValueChange={(value) => setJobData((prev) => ({ ...prev, paymentMethodCode: value, paymentMethod: value }))} />
        </Field>

        <FlagField label="Provisional Assessment [Y/N]" labelWidth="200px" required value={provAssess}
          onValueChange={jobFlag('provAssess', setIsProvAssessModalOpen)} />
        <FlagField label="First Check [Y/N]" required value={firstCheck} onValueChange={jobFlag('firstCheckRequested', setIsFirstCheckModalOpen)} />

        <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center">
          <TextField label="UCR No" labelWidth="130px" className="tw:flex-1" name="ucr" maxLength={35} placeholder="unique consignment reference"
            title="Unique Consignment Reference quoted on the BE (optional)" value={jobData.ucr || ''} onChange={handleChange} />
          <Field label="UCR Type">
            <ComboInput name="ucrType" upper maxLength={6} placeholder="AWB" title="What the reference is (AWB, BL, ...)" className="tw:w-[90px] tw:flex-none"
              options={UCR_TYPES} value={jobData.ucrType || ''} onValueChange={setField('ucrType')} />
          </Field>
        </div>

        <FlagField label="Additional Details" value={addtlDetails} onValueChange={jobFlag('addtlDetails')} />

        {addtlDetails.toUpperCase() === 'Y' && (
          <div className="tw:col-span-full tw:flex tw:flex-col tw:gap-1 tw:border-t tw:border-border tw:pt-2">
            <div className={`${PANEL_ROW} tw:bg-success/10`}>
              <TextField label="Delivery Date" labelWidth="120px" name="deliveryDate" placeholder="DATE" className="tw:w-full tw:lg:w-[250px]"
                value={(jobData.deliveryDate ?? jobData.date) || ''} onChange={handleChange} />
              <TextField label="GRN No." name="grnNo" placeholder="NO" className="tw:w-full tw:lg:w-[180px]" value={(jobData.grnNo ?? jobData.no) || ''} onChange={handleChange} />
              <TextField label="PO No." name="poNo" placeholder="PO NO." className="tw:w-full tw:lg:w-[180px]" value={jobData.poNo || ''} onChange={handleChange} />
              <TextField label="Head Desc." name="headDesc" placeholder="HEAD DESC." className="tw:flex-1" value={jobData.headDesc || ''} onChange={handleChange} />
            </div>

            <div className={`${PANEL_ROW} tw:bg-warning/10`}>
              <Field label={isAir ? 'Air Line' : 'Shipping Line'} labelWidth="120px" className="tw:w-full tw:lg:w-[310px]">
                <ComboInput name="lineName" placeholder="LINE NAME" options={isSea ? shippingLines : []} getValue={(line) => line.name}
                  value={jobData.lineName || ''} onValueChange={setField('lineName')} />
              </Field>
              {isSea
                ? <TextField label="Vessel" name="vessel" placeholder="VESSEL" className="tw:flex-1" value={jobData.vessel || ''} onChange={handleChange} />
                : <div className="tw:hidden tw:lg:block tw:lg:flex-1" />}
              <TextField label={isAir ? 'Flight No' : 'Voyage No'} name="flightVoyage" placeholder="FLIGHT & VOYAGE" className="tw:w-full tw:lg:w-[200px]"
                value={jobData.flightVoyage || ''} onChange={handleChange} />
              <TextField label="ETA" name="eta" placeholder="ETA" className="tw:w-full tw:lg:w-[160px]" value={jobData.eta || ''} onChange={handleChange} />
            </div>

            <div className={`${PANEL_ROW} tw:bg-warning/10`}>
              <TextField label="Chargable Weight" labelWidth="120px" name="chargableWeight" placeholder="CHARGABLE WEIGHT" className="tw:w-full tw:lg:w-[280px]"
                value={jobData.chargableWeight || ''} onChange={handleChange} />
              <TextField label="CFS Name" name="cfsName" placeholder="CFS / shed" className="tw:flex-1" value={jobData.cfsName || ''} onChange={handleChange} />
              <Field label="Movement Remarks">
                <SelectBox name="movementRemarks" clearable clearLabel="Select" placeholder="Select" className="tw:w-full tw:lg:w-[140px]"
                  options={MOVEMENT_REMARKS} value={movementRemarks} onValueChange={setField('movementRemarks')} />
              </Field>
              <Field label="Delivery Mode">
                <SelectBox name="deliveryMode" clearable clearLabel="Select" placeholder="Select" className="tw:w-full tw:lg:w-[120px]"
                  options={DELIVERY_MODES} value={deliveryMode} onValueChange={setField('deliveryMode')} />
              </Field>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
