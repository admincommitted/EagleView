import { DateInput, Field, Input, Modal } from '@/components/ui';

const OTHER_DETAILS = [
  { label: 'Exporter Contract No', key: 'contractNo' }, { label: 'Contract Date', key: 'contractDate', date: true },
  { label: 'L/C No', key: 'lcNo' }, { label: 'L/C Date', key: 'lcDate', date: true },
  { label: "Buyer's Order No", key: 'poNo' }, { label: 'Order Date', key: 'poDate', date: true },
  { label: 'Proforma Invoice No', key: 'proformaNo' }, { label: 'Proforma Date', key: 'proformaDate', date: true },
];

export default function OtherDetailsModal({ ctx }) {
  const { showOtherDetailsModal, closeOtherDetails, formData, setField, selectedId } = ctx;
  return (
    <Modal
      open={showOtherDetailsModal}
      title={`Other Invoice Details${formData.no ? ` - ${formData.no}` : ''}`}
      description={`Shown on the checklist; the charges are on the main screen. Click ${selectedId ? 'Modify' : 'Save'} after OK to keep them on the invoice.`}
      width={600}
      closeOnOutside={false}
      onOk={() => closeOtherDetails(true)}
      onClose={() => closeOtherDetails(false)}
    >
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2">
        {OTHER_DETAILS.map(({ label, key, date }) => (
          <Field key={key} label={label} labelWidth="140px">
            {date
              ? <DateInput value={formData[key] || ''} onValueChange={(value) => setField(key, value)} />
              : <Input data-allow-text="" maxLength={30} value={formData[key] || ''} onChange={(event) => setField(key, event.target.value.toUpperCase())} />}
          </Field>
        ))}
      </div>
    </Modal>
  );
}
