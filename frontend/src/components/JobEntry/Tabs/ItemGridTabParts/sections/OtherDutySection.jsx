import { DataTable, Input, Modal, NumberInput } from '@/components/ui';
import { EntryFields } from './ItemPopupFields';
import { uqcCombo } from './itemPopupConfig';

const OTHER_DUTIES = ['Add1(SIA)', 'Add2(S2)', 'Other(TTA)', 'Cess', 'Health', 'Aggregate', 'Safe Guard', 'Infra Cess'];

const OTHER_DUTY_BOXES = [
  { part: 'notnNo', header: 'Notn No', className: 'tw:w-[80px]' },
  { part: 'srNo', header: 'Serial No', className: 'tw:w-[80px]' },
  { part: 'flag', header: 'Flag', className: 'tw:w-[60px]' },
  { part: 'rate', header: 'Adv.Rate', numeric: true, className: 'tw:w-[60px]' },
  { part: 'amount', header: 'Spec.Amt', numeric: true, className: 'tw:w-[70px]' },
  { part: 'uqc', header: 'UQC', className: 'tw:w-[60px]' },
  { part: 'dutyAmount', header: 'Duty Amount', numeric: true, className: 'tw:w-[80px]' },
];

const CVD_TYPES = ['Based On Assessable', 'Based On Landed Cost', 'Based On CIF Value', 'Based On Quantity'];

function OtherDutyModal({ ctx }) {
  const { showOtherDutyModal, setShowOtherDutyModal, tempOtherDutyData, setTempOtherDutyData, saveOtherDutyModal } = ctx;
  const columns = [
    { key: 'duty', header: 'Duty', cell: (dutyName) => dutyName },
    ...OTHER_DUTY_BOXES.map(({ part, header, numeric, className }) => ({
      key: part,
      header,
      cell: (dutyName) => {
        const key = `${dutyName}_${part}`;
        const change = (value) => setTempOtherDutyData({ ...tempOtherDutyData, [key]: value });
        return numeric
          ? <NumberInput value={tempOtherDutyData[key] || ''} className={className} onValueChange={change} />
          : <Input value={tempOtherDutyData[key] || ''} className={className} onChange={(event) => change(event.target.value)} />;
      },
    })),
  ];
  return (
    <Modal open={showOtherDutyModal} title="Other Duty" width={850} onClose={() => setShowOtherDutyModal(false)}
      onOk={saveOtherDutyModal} closeOnOutside={false}>
      <DataTable columns={columns} rows={OTHER_DUTIES} rowKey={(dutyName) => dutyName} containerClassName="tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

function CustomsCvdModal({ ctx }) {
  const { showCustomsCvdModal, setShowCustomsCvdModal, tempCvdData, setTempCvdData, saveCustomsCvdModal, masters } = ctx;
  const boxes = [
    { key: 'type', label: 'CVD Levy Type', kind: 'select', options: CVD_TYPES, fieldClassName: 'tw:md:col-span-2 tw:md:w-[calc(50%-0.5rem)]' },
    { key: 'notnNo', label: 'Notification No' },
    { key: 'cth', label: 'CTH Serial No' },
    { key: 'srNo', label: 'Serial No' },
    { key: 'supSlNo', label: 'Supplier Sl No', required: true },
    { key: 'rate', label: 'Advalorem Rate', kind: 'number' },
    { key: 'flag', label: 'Flag' },
    { key: 'qty', label: 'Quantity', kind: 'number' },
    { key: 'uqc', label: 'UQC', ...uqcCombo(masters) },
    { key: 'amount', label: 'Specific Amt', kind: 'number' },
  ];
  return (
    <Modal open={showCustomsCvdModal} title="Customs CVD Levy" width={650} onClose={() => setShowCustomsCvdModal(false)}
      onOk={saveCustomsCvdModal} closeOnOutside={false}>
      <EntryFields boxes={boxes} values={tempCvdData} layout="row" labelWidth="120px" className="tw:gap-x-4 tw:md:grid-cols-2"
        onChange={(key, value) => setTempCvdData({ ...tempCvdData, [key]: value })} />
    </Modal>
  );
}

function PolicyParaModal({ ctx }) {
  const { showPolicyParaModal, setShowPolicyParaModal, tempPolicyParaData, setTempPolicyParaData, savePolicyParaModal } = ctx;
  const boxes = [
    { key: 'paraNo', label: 'Policy Para No', required: true, className: 'tw:md:w-[150px]' },
    { key: 'year', label: 'Policy Year', required: true, className: 'tw:md:w-[150px]' },
  ];
  return (
    <Modal open={showPolicyParaModal} title="Policy Para Details" width={500} onClose={() => setShowPolicyParaModal(false)}
      onOk={savePolicyParaModal} closeOnOutside={false}>
      <EntryFields boxes={boxes} values={tempPolicyParaData} layout="row" labelWidth="120px"
        onChange={(key, value) => setTempPolicyParaData({ ...tempPolicyParaData, [key]: value })} />
    </Modal>
  );
}

function PreviousBeModal({ ctx }) {
  const { showPreviousBeModal, setShowPreviousBeModal, tempPrevBeData, setTempPrevBeData, savePreviousBeModal, masters } = ctx;
  const boxes = [
    { key: 'beNo', label: 'Previous BE No', required: true },
    { key: 'beDate', label: 'Previous BE Date', required: true },
    { key: 'unitPrice', label: 'Previous Unit Price', kind: 'number' },
    {
      key: 'currency', label: 'Previous Currency Code', kind: 'combo', options: masters.currencies || [],
      getOptionValue: (currency) => currency.currencyCode, getOptionLabel: (currency) => currency.currencyName,
    },
    { key: 'customHouse', label: 'Previous Custom House', required: true },
  ];
  const quantityBoxes = [
    { key: 'qty', label: 'Quantity', kind: 'number' },
    { key: 'uqc', label: 'UQC', ...uqcCombo(masters) },
  ];
  const change = (key, value) => setTempPrevBeData({ ...tempPrevBeData, [key]: value });
  return (
    <Modal open={showPreviousBeModal} title="Previous Import Details" width={800} onClose={() => setShowPreviousBeModal(false)}
      onOk={savePreviousBeModal} closeOnOutside={false}>
      <EntryFields boxes={boxes} values={tempPrevBeData} layout="row" labelWidth="150px" className="tw:gap-x-4 tw:md:grid-cols-2" onChange={change} />
      <EntryFields boxes={quantityBoxes} values={tempPrevBeData} className="tw:grid-cols-2 tw:gap-x-4" onChange={change} />
    </Modal>
  );
}

export default function OtherDutySection({ ctx }) {
  return (
    <>
      <OtherDutyModal ctx={ctx} />
      <CustomsCvdModal ctx={ctx} />
      <PolicyParaModal ctx={ctx} />
      <PreviousBeModal ctx={ctx} />
    </>
  );
}
