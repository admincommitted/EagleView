import { DateInput, Field, Input } from '@/components/ui';
import { useExportContext } from '../../ExportContext';

export default function MoowrTab() {
  const { exportData, setExportData } = useExportContext();
  const moowr = exportData.moowrDetails || {};

  const changeMoowr = (field, value) => {
    setExportData((previous) => ({ ...previous, moowrDetails: { ...(previous.moowrDetails || {}), [field]: value } }));
  };

  // the header keeps the ex-bond warehouse in code / warehousename (SB 2 tab: warehouseCode)
  const warehouse = [exportData.code || exportData.warehouseCode || '', exportData.warehousename || ''].filter(Boolean).join(' - ');

  return (
    <div className="tw:p-4">
      <h3 className="tw:mb-4 tw:border-b tw:border-border tw:pb-2 tw:text-sm tw:font-semibold tw:text-foreground">
        Manufacture and Other Operations in Warehouse (MOOWR)
      </h3>
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2 tw:xl:grid-cols-3">
        <Field layout="col" label="Warehouse Code (From Ex-Bond Header)">
          <Input
            readOnly
            className="tw:cursor-not-allowed tw:text-muted-foreground"
            value={warehouse}
            title="This value is picked from the Ex-Bond details in the Header tab."
            placeholder="Select the WareHouse Code in SB Header (Ex-Bond Job = Y)"
          />
        </Field>
        <Field layout="col" label="License No / Job Number">
          <Input data-allow-text="" value={moowr.licenseNo || ''} onChange={(event) => changeMoowr('licenseNo', event.target.value)} />
        </Field>
        <Field layout="col" label="Approval Date">
          <DateInput value={moowr.approvalDate || ''} onValueChange={(ymd) => changeMoowr('approvalDate', ymd)} />
        </Field>
      </div>
    </div>
  );
}
