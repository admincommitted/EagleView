import { Input, NumberInput } from '@/components/ui';
import { CheckField, FormGrid, GridField, Panel } from './layout';
import { MasterLookup } from './MasterLookup';
import { textProps, valueProps } from './formBindings';

export default function OtherDetailsPanel({ form }) {
  const { shipment, setValue } = form;
  const lookupProps = (path, pickedValue) => ({
    value: form.getValue(path),
    onText: (text) => setValue(path, text),
    onPick: (record) => setValue(path, pickedValue(record)),
  });

  return (
    <Panel title="Other Details">
      <FormGrid columns={4}>
        <GridField label="Docket Owner"><MasterLookup what="user" {...lookupProps('docketOwner', (user) => user.name)} /></GridField>
        <GridField label="Reference No/PO"><Input {...textProps(form, 'referenceNo')} /></GridField>
        <GridField label="Marketing Person"><MasterLookup what="salesperson" {...lookupProps('marketingPerson', (user) => user.name)} /></GridField>
        <GridField label="Quotation / Contract">
          <MasterLookup what="quotation" noAdd placeholder="blank = customer's contract" {...lookupProps('quotationNo', (quotation) => quotation.code)} />
        </GridField>
        <GridField label="Ass. Value"><NumberInput {...valueProps(form, 'data.assValue')} /></GridField>
        <GridField label="Total Duty"><NumberInput {...valueProps(form, 'data.totalDuty')} /></GridField>
        <GridField label="Place of Supply">
          <MasterLookup what="state" upper noAdd placeholder="state (GST)" {...lookupProps('placeOfSupply', (state) => state.name)} />
        </GridField>
        <div className="tw:flex tw:gap-3">
          <CheckField label="BRO" checked={shipment.data.bro} onCheckedChange={(checked) => setValue('data.bro', checked)} />
          <CheckField label="Approval Verified" checked={shipment.data.approvalVerified} onCheckedChange={(checked) => setValue('data.approvalVerified', checked)} />
        </div>
        <GridField label="Remarks" span={4}><Input {...textProps(form, 'remarks')} /></GridField>
      </FormGrid>
    </Panel>
  );
}
