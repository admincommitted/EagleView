import { Button, DataTable, DateInput, Field, Input, Modal, NumberInput, SelectBox } from '@/components/ui';

const REIMPORT_TYPES = [{ value: 'Y', label: 'Y - Yes' }, { value: 'N', label: 'N - No' }];
const RSP_DUTY_FLAGS = [
  { value: 'Y', label: 'Y - Yes RSP applicable' },
  { value: 'S', label: 'S - Scheme (exempted)' },
  { value: 'N', label: 'N - Not applicable' },
  { value: 'Q', label: 'Q - Quantitative restriction' },
  { value: 'T', label: 'T - Temporary exemption' },
  { value: 'D', label: 'D - Deemed import' },
];
const NCD_FLAGS = [{ value: 'A', label: 'A - Advalorem' }, { value: 'S', label: 'S - Specific' }, { value: 'B', label: 'B - Both' }];

// Re-import = goods exported earlier and brought back: ICEGATE wants the export Shipping Bill details
// (reimportModel). Values saved under the older previous-BE keys are shown in the Shipping Bill boxes.
const REIMPORT_FIELDS = [
  { key: 'shippingBillNo', label: 'Shipping Bill No', legacyKey: 'prevBeNo' },
  { key: 'shippingBillDate', label: 'Shipping Bill Date', legacyKey: 'prevBeDate', kind: 'date' },
  { key: 'portOfExport', label: 'Port of Export', legacyKey: 'prevCustomHouseCode' },
  { key: 'invoiceNoSb', label: 'Invoice Sr No in SB' },
  { key: 'itemNoSb', label: 'Item Sr No in SB' },
  { key: 'notificationNo', label: 'Re-import Notification No' },
  { key: 'notificationSrNo', label: 'Notification Sr No' },
  { key: 'exportFreight', label: 'Export Freight', kind: 'number' },
  { key: 'exportInsurance', label: 'Export Insurance', kind: 'number' },
  { key: 'customsDuty', label: 'Drawback / Customs Duty availed', kind: 'number' },
  { key: 'exciseDuty', label: 'Excise Duty / IGST refund availed', kind: 'number' },
  { key: 'reasonForReimport', label: 'Reason for Re-import' },
];

const NCD_FIELDS = [
  { key: 'ncdNotificationNo', label: 'NCD Notification No' },
  { key: 'ncdSrNo', label: 'NCD Sr No' },
  { key: 'ncdRate', label: 'NCD Rate', kind: 'number' },
  { key: 'ncdFlag', label: 'NCD Flag', kind: 'select', options: NCD_FLAGS },
  { key: 'ncdAmount', label: 'NCD Amount', kind: 'number' },
  { key: 'ncdUnit', label: 'NCD Unit' },
];

const RSP_FIELDS = [
  { key: 'rspValue', label: 'RSP Value', kind: 'number' },
  { key: 'rspQty', label: 'Quantity at this RSP', kind: 'number' },
  { key: 'rspNotificationNo', label: 'RSP Notification No' },
  { key: 'rspSrNo', label: 'RSP Sr No' },
  { key: 'rspRate', label: 'RSP Rate', kind: 'number' },
  { key: 'rspAmount', label: 'RSP Amount', kind: 'number' },
];

function PopupField({ field, value, onChange, placeholder }) {
  const { kind, options } = field;
  let control;
  if (kind === 'date') control = <DateInput value={value} onValueChange={onChange} />;
  else if (kind === 'number') control = <NumberInput value={value} placeholder={placeholder} onValueChange={onChange} />;
  else if (kind === 'select') control = <SelectBox options={options} value={value} onValueChange={onChange} clearable clearLabel="Select..." className="tw:w-full" />;
  else control = <Input data-allow-text value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
  return <Field label={field.label} layout="col">{control}</Field>;
}

const rspColumns = ({ editRspRow, removeRspRow }) => [
  { key: 'rspValue', header: 'RSP', align: 'right' },
  { key: 'rspQty', header: 'Qty', align: 'right', cell: (row) => row.rspQty || 'all' },
  { key: 'rspNotificationNo', header: 'Notification' },
  { key: 'rspSrNo', header: 'Sr No' },
  { key: 'rspRate', header: 'Rate', align: 'right' },
  { key: 'rspAmount', header: 'Amount', align: 'right' },
  {
    key: 'actions', header: '', align: 'center', width: 60,
    cell: (row, index) => (
      <>
        <Button variant="link" size="sm" title="Edit" onClick={() => editRspRow(index)}>edit</Button>
        <Button variant="link" size="sm" title="Remove" className="tw:ml-2 tw:text-destructive" onClick={() => removeRspRow(index)}>x</Button>
      </>
    ),
  },
];

// Re-Import, RSP and NCD popups of the selected item
export default function SearchSection2({ ctx }) {
  const {
    saveReimportModal, saveRspModal, saveNcdModal, setShowNcdModal, setShowReimportModal, setShowRspModal, setTempNcdData, setTempReimportData, setTempRspData,
    showNcdModal, showReimportModal, showRspModal, tempNcdData, tempReimportData, tempRspData, addRspRow, editRspRow, removeRspRow, tempRspRows, rspEditIdx, selectedItem,
  } = ctx;
  const rspRows = tempRspRows || [];
  const editingRspRow = rspEditIdx !== null ? rspRows[rspEditIdx] : null;
  const rspRowKey = (row, index) => row.id || index;
  const reimportValue = ({ key, legacyKey }) => tempReimportData?.[key] ?? (legacyKey ? tempReimportData?.[legacyKey] : '') ?? '';

  return (
    <>
      <Modal open={showReimportModal} onClose={() => setShowReimportModal(false)} title="Re-Import Details" width={640} onOk={saveReimportModal} okLabel="Save" closeOnOutside={false}>
        <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          <PopupField field={{ label: 'Re-Import Type', kind: 'select', options: REIMPORT_TYPES }} value={tempReimportData?.type || ''} onChange={(value) => setTempReimportData({ ...tempReimportData, type: value })} />
          {REIMPORT_FIELDS.map((field) => (
            <PopupField key={field.key} field={field} value={reimportValue(field)} onChange={(value) => setTempReimportData({ ...tempReimportData, [field.key]: value })} />
          ))}
        </div>
      </Modal>

      <Modal
        open={showRspModal}
        onClose={() => setShowRspModal(false)}
        title="RSP Duty Details"
        description="One line per retail sale price (MRP slab) of this item"
        width={680}
        onOk={saveRspModal}
        okLabel="Save"
        closeOnOutside={false}
      >
        <div className="tw:flex tw:flex-col tw:gap-2.5">
          <PopupField field={{ label: 'RSP Duty Flag', kind: 'select', options: RSP_DUTY_FLAGS }} value={tempRspData?.rspDutyFlag || ''} onChange={(value) => setTempRspData({ ...tempRspData, rspDutyFlag: value })} />
          {RSP_FIELDS.map((field) => (
            <PopupField
              key={field.key}
              field={field}
              value={tempRspData?.[field.key] || ''}
              placeholder={field.key === 'rspQty' ? (selectedItem?.qty ? 'blank = all ' + selectedItem.qty : 'blank = whole item quantity') : undefined}
              onChange={(value) => setTempRspData({ ...tempRspData, [field.key]: value })}
            />
          ))}
          <div className="tw:flex tw:justify-end">
            <Button variant="default" onClick={addRspRow}>{rspEditIdx !== null ? 'Update line ' + (rspEditIdx + 1) : '+ Add line'}</Button>
          </div>
          <DataTable
            columns={rspColumns({ editRspRow, removeRspRow })}
            rows={rspRows}
            rowKey={rspRowKey}
            selectedKey={editingRspRow ? rspRowKey(editingRspRow, rspEditIdx) : undefined}
            emptyText='No RSP line yet - fill the boxes above and press "Add line"'
          />
        </div>
      </Modal>

      <Modal open={showNcdModal} onClose={() => setShowNcdModal(false)} title="NCD Custom Duty Details" width={400} onOk={saveNcdModal} okLabel="Save" closeOnOutside={false}>
        <div className="tw:flex tw:flex-col tw:gap-2.5">
          {NCD_FIELDS.map((field) => (
            <PopupField key={field.key} field={field} value={tempNcdData?.[field.key] || ''} onChange={(value) => setTempNcdData({ ...tempNcdData, [field.key]: value })} />
          ))}
        </div>
      </Modal>
    </>
  );
}
