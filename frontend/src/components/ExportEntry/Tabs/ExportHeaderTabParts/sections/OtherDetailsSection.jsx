import { Fragment } from 'react';
import { Field, Input, Section, SelectBox } from '@/components/ui';
import { TextField } from '../helpers';
import { FIVE_COLUMNS } from '../headerLists';

const LABEL_WIDTH = '100px';
const SHIPMENT_TYPES = [
  { value: 'FCL', label: 'FCL - Full Container Load' },
  { value: 'LCL', label: 'LCL - Less than Container Load' },
  { value: 'BULK', label: 'Bulk' },
];

// in screen order, five to a row; `special` boxes are drawn by OtherDetailsSection itself
const OTHER_FIELDS = [
  { name: 'autoField_11', label: 'EPZ/ICD' },
  { name: 'drawbackAcNo', special: 'drawback' },
  { name: 'forexCode', label: 'Fr Bank', placeholder: 'FOREX CODE' },
  { name: 'autoField_12', special: 'pan' },
  { name: 'autoField_13', label: 'User Job No' },
  { name: 'exciseRs', label: 'Excise Rs', placeholder: 'EXCISE RS' },
  { name: 'customRs', label: 'Custom Rs.', placeholder: 'CUSTOM RS' },
  { name: 'cessAmt', label: 'Cess Amount', placeholder: 'CESS AMT' },
  { name: 'shipmentType', special: 'shipmentType' },
  { name: 'docketOwner', label: 'Docket Owner', placeholder: 'DOCKET OWNER' },
  { name: 'dbkRs', label: 'DBK Rs.', placeholder: 'DBK RS', fromItems: 'the drawback rows' },
  { name: 'fobRs', label: 'FOB Rs.', placeholder: 'FOB RS', fromItems: 'the item FOB values' },
  { name: 'ifscCd', label: 'IFSC Code', placeholder: 'IFSC CD' },
];

export default function OtherDetailsSection({ ctx }) {
  const { exportData, setExportData, setField, handleChange, hasDrawback, totalsFromItems } = ctx;
  // once the job has items these totals are worked out from them, so a typed amount would only be replaced
  const totalProps = (fromItems) => (fromItems && totalsFromItems ? { readOnly: true, title: `Total of ${fromItems} (Items tab)` } : {});
  const changePan = (event) => {
    const pan = event.target.value.toUpperCase();
    setExportData((prev) => ({ ...prev, autoField_12: pan, panNo: pan }));
  };

  const specialFields = {
    drawback: (
      <TextField label="Drawback A/C No" name="drawbackAcNo" placeholder="DRAWBACK A/C NO" required={hasDrawback} labelWidth={LABEL_WIDTH}
        title={hasDrawback ? 'Needed: the job has drawback items' : 'Needed only when an item claims drawback'} exportData={exportData} onChange={handleChange} />
    ),
    pan: (
      <Field label="PAN No" labelWidth={LABEL_WIDTH}>
        <Input name="autoField_12" maxLength={10} value={exportData.autoField_12 || exportData.panNo || ''} onChange={changePan} />
      </Field>
    ),
    shipmentType: (
      <Field label="Shipment Type" labelWidth={LABEL_WIDTH}>
        <SelectBox clearable clearLabel="Select" placeholder="Select" className="tw:w-full" options={SHIPMENT_TYPES} value={exportData.shipmentType || ''} onValueChange={setField('shipmentType')} />
      </Field>
    ),
  };

  return (
    <Section title="Other Details" bodyClassName={FIVE_COLUMNS}>
      {OTHER_FIELDS.map(({ special, fromItems, ...field }) => (
        <Fragment key={field.name}>
          {special ? specialFields[special] : <TextField {...field} {...totalProps(fromItems)} labelWidth={LABEL_WIDTH} exportData={exportData} onChange={handleChange} />}
        </Fragment>
      ))}
    </Section>
  );
}
