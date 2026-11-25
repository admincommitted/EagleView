import { Fragment } from 'react';
import { CheckSquare, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import { Button, DataTable, Field, FlagInput, Input, Modal, Section, SelectBox } from '@/components/ui';
import { igstBaseFromForm } from '../helpers';
import { editColumn, removeColumn } from '../../JobHeaderTabParts/sections/rowActionColumns';

const IGST_HEADINGS = ['NOTN', 'SLNO', 'RATE %', 'FLAG', 'AMOUNT', 'UQC'];
const IGST_BOXES = [
  { name: 'notnNo', placeholder: '009/2025' },
  { name: 'srNo', placeholder: 'II506' },
  { name: 'rate' },
  { name: 'flag' },
  { name: 'amount' },
  { name: 'uqc' },
];

// the duty notification rows go in the BE JSON as sbedutyModel
const DUTY_ROW_SELECTS = [
  { key: 'dutyType', label: 'Duty Type', options: [{ value: 'C', label: 'C | Custom' }, { value: 'G', label: 'G | GST' }, { value: 'E', label: 'E | Excise' }] },
  { key: 'addlDutyFlag', label: 'Add Duty Type', options: [{ value: 'A', label: 'A | AIDC' }, { value: 'I', label: 'I | IGST' }, { value: 'P', label: 'P | Compensation Cess' }, { value: 'X', label: 'X | Excise' }, { value: '+', label: '+ | Plus' }] },
  { key: 'igstFlag', label: 'IGST Flag', blankLabel: 'Select', options: [{ value: 'G', label: 'G | GST' }, { value: 'C', label: 'C | Custom' }] },
];
const DUTY_ROW_TEXTS = [
  { key: 'notificationNo', label: 'Notn No', placeholder: '011/2021' },
  { key: 'notificationSrNo', label: 'Notn Sl No', placeholder: '17' },
  { key: 'exmpNotificationNo', label: 'Exem Notn No' },
  { key: 'exmpNotificationSrNo', label: 'Exem Sl No' },
];
const DUTY_ROW_COLUMNS = [
  { key: 'dutyType', header: 'Duty Type' },
  { key: 'addlDutyFlag', header: 'Duty Flg' },
  { key: 'igstFlag', header: 'IGST Flg' },
  { key: 'notificationNo', header: 'Notn' },
  { key: 'notificationSrNo', header: 'Notn Slno' },
  { key: 'exmpNotificationNo', header: 'Exem Notn no' },
  { key: 'exmpNotificationSrNo', header: 'Exem Notn Slno' },
];

const SVB_LOADS = [
  { label: 'Ass. Value(%)', percent: 'loadValue', status: 'valueStatus' },
  { label: 'Duty(%)', percent: 'loadDuty', status: 'dutyStatus' },
];

const percentOf = (base, rateText) => (((parseFloat(rateText) || 0) / 100) * base).toFixed(2);

function IgstModal({ ctx }) {
  const { saveIgstModal, setShowIgstModal, showIgstModal, tempIgstData, setTempIgstData, selectedItem, invoices, jobData,
    addDutyRow, editDutyRow, removeDutyRow, clearDutyForm, tempDutyRows, dutyForm, setDutyForm, dutyEditIdx } = ctx;
  // IGST = rate x (AV + BCD + SWS + health cess + CVD + ADD + AIDC / other duties) - the way ICES adds it up
  const igstDuty = () => igstBaseFromForm(document.getElementById('item-form'), selectedItem, invoices, jobData);

  const changeIgstBox = (name, text) => {
    if (name !== 'rate') return setTempIgstData({ ...tempIgstData, [name]: text });
    const duty = igstDuty();
    return setTempIgstData({
      ...tempIgstData,
      rate: text,
      amount: duty.rateFound ? percentOf(duty.igstBase, text) : tempIgstData.amount,
      cessAmount: duty.rateFound && parseFloat(tempIgstData.cessRate) ? percentOf(duty.igstBase, tempIgstData.cessRate) : tempIgstData.cessAmount,
    });
  };
  const changeCessRate = (text) => {
    const duty = igstDuty();
    setTempIgstData({ ...tempIgstData, cessRate: text, cessAmount: duty.rateFound && text !== '' ? percentOf(duty.igstBase, text) : '' });
  };
  const setDutyField = (key) => (value) => setDutyForm({ ...dutyForm, [key]: value });
  const addOnEnter = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addDutyRow(); }
  };
  const dutyRowColumns = [
    { ...editColumn((index) => editDutyRow(index)), align: 'center' },
    { ...removeColumn((index) => removeDutyRow(index)), align: 'center' },
    ...DUTY_ROW_COLUMNS,
  ];

  return (
    <Modal open={showIgstModal} title="IGST Duty / Duty Notifications" width={880} closeOnOutside={false}
      onClose={() => setShowIgstModal(false)} onOk={saveIgstModal} okLabel="Ok">
      <div className="tw:overflow-x-auto tw:rounded-sm tw:border tw:border-border tw:p-2.5">
        <div className="tw:grid tw:min-w-[560px] tw:grid-cols-[70px_repeat(6,minmax(0,1fr))] tw:items-center tw:gap-x-1 tw:gap-y-1.5">
          <span />
          {IGST_HEADINGS.map((heading) => <span key={heading} className="tw:text-[11px] tw:font-bold">{heading}</span>)}

          <span>IGST</span>
          {IGST_BOXES.map((box) => (
            <Input key={box.name} name={box.name} placeholder={box.placeholder} value={tempIgstData[box.name] || ''}
              onChange={(event) => changeIgstBox(box.name, event.target.value)} />
          ))}

          <span title="GST compensation cess (sin / auto goods etc.) - on the same base as IGST; the notification goes in the duty rows below as G / P">Comp. Cess</span>
          <span className="tw:col-span-2 tw:text-[10px] tw:text-muted-foreground">rate % on AV + customs duties (notification: duty row G / P below)</span>
          <Input name="cessRate" value={tempIgstData.cessRate || ''} onChange={(event) => changeCessRate(event.target.value)} />
          <span />
          <Input name="cessAmount" value={tempIgstData.cessAmount || ''} onChange={(event) => setTempIgstData({ ...tempIgstData, cessAmount: event.target.value })} />
          <span />
        </div>
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-2.5 tw:rounded-sm tw:border tw:border-border tw:p-2.5">
        {DUTY_ROW_SELECTS.map((select) => (
          <Field key={select.key} label={select.label} layout="col">
            <SelectBox className="tw:min-w-[120px]" options={select.options} value={dutyForm[select.key] || ''} onValueChange={setDutyField(select.key)}
              clearable={Boolean(select.blankLabel)} clearLabel={select.blankLabel} placeholder={select.blankLabel} />
          </Field>
        ))}
        {DUTY_ROW_TEXTS.map((text) => (
          <Field key={text.key} label={text.label} layout="col">
            <Input placeholder={text.placeholder} value={dutyForm[text.key] || ''} className="tw:w-[100px]"
              onChange={(event) => setDutyField(text.key)(event.target.value)} onKeyDown={addOnEnter} />
          </Field>
        ))}
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button variant="default" onClick={addDutyRow}>{dutyEditIdx !== null ? <><Pencil /> Update</> : <><Plus /> Add</>}</Button>
          <Button variant="secondary" onClick={clearDutyForm}><RefreshCw /> Clear</Button>
        </div>
      </div>

      <DataTable columns={dutyRowColumns} rows={tempDutyRows} rowKey={(_, index) => index} selectedKey={dutyEditIdx}
        emptyText="No duty notification rows. Add AIDC / IGST / Compensation cess rows above." containerClassName="tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

function SvbModal({ ctx }) {
  const { saveSvbModal, setShowSvbModal, showSvbModal, tempSvbData, setTempSvbData } = ctx;
  const setSvbField = (name) => (value) => setTempSvbData({ ...tempSvbData, [name]: value });
  const textChange = (name) => (event) => setSvbField(name)(event.target.value);
  const footer = (
    <>
      <Button variant="success" onClick={saveSvbModal}><CheckSquare /> Ok</Button>
      <Button onClick={() => setShowSvbModal(false)}><X /> Cancel</Button>
    </>
  );

  // the window's X keeps what was typed (it saves), Cancel drops it
  return (
    <Modal open={showSvbModal} title="SVB Loading Item Wise" width={600} closeOnOutside={false} onClose={saveSvbModal} footer={footer}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-2.5 tw:md:grid-cols-2">
        <Field label="Ref No." required labelWidth="110px">
          <Input name="refNo" required className="tw:w-[150px]" value={tempSvbData.refNo || ''} onChange={textChange('refNo')} />
        </Field>
        {/* the BE carries one customHouseCodeWhichHasImposedLoad */}
        <Field label="Custom House" required labelWidth="100px">
          <Input name="customHouse1" required className="tw:w-[120px]" value={tempSvbData.customHouse1 || ''} onChange={textChange('customHouse1')} />
        </Field>
        <Field label="Date" required labelWidth="110px" className="tw:md:col-span-2">
          <Input name="date" required className="tw:w-[150px]" value={tempSvbData.date || ''} onChange={textChange('date')} />
        </Field>
        <Field label="SVB load on ass. value/duty/both[A/D/B]" required className="tw:md:col-span-2">
          <FlagInput name="loadType" allowed="ADB" required value={tempSvbData.loadType || ''} onValueChange={setSvbField('loadType')} />
        </Field>
      </div>

      <Section title="SVB load On" bodyClassName="tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-2 tw:md:grid-cols-2">
        {SVB_LOADS.map((load) => (
          <Fragment key={load.percent}>
            <Field label={load.label} labelWidth="110px">
              <Input name={load.percent} className="tw:w-[100px]" value={tempSvbData[load.percent] || ''} onChange={textChange(load.percent)} />
            </Field>
            <Field label="SVB Load Status" labelWidth="100px">
              <FlagInput name={load.status} allowed="FP" value={tempSvbData[load.status] || ''} onValueChange={setSvbField(load.status)} />
            </Field>
          </Fragment>
        ))}
      </Section>
    </Modal>
  );
}

export default function IgstDutySection({ ctx }) {
  return (
    <>
      <IgstModal ctx={ctx} />
      <SvbModal ctx={ctx} />
    </>
  );
}
