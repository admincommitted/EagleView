import { ComboInput, Field, FlagInput, Input, SelectBox } from '@/components/ui';
import { includesText } from '../headerLists';

const SHIPMENT_MODES = [{ value: 'AIR', label: '✈ AIR' }, { value: 'SEA', label: '⚓ SEA' }, { value: 'LAND', label: '🚚 LAND' }];
const YES_NO = ['N', 'Y'];

const matchWarehouse = (warehouse, query) => includesText(warehouse.warehouseName, query) || includesText(warehouse.warehouseCode, query);

const HAND_CARRY_FIELDS = [
  { name: 'pnr', label: 'PNR', placeholder: 'PNR' },
  { name: 'eTicket', label: 'ETICKET', placeholder: 'ETICKET', alias: 'eticket' },
  { name: 'passportNo', label: 'PASSPORT NO', placeholder: 'PASSPORTNO', alias: 'passportno' },
];

function WarehouseFields({ warehouses, exportData, setExportData }) {
  const pickWarehouse = (warehouse) => setExportData((prev) => ({ ...prev, warehousename: warehouse.warehouseName, code: warehouse.warehouseCode }));
  const setText = (key) => (text) => setExportData((prev) => ({ ...prev, [key]: text }));
  return (
    <Field label={<>WareHouse Code <span className="tw:text-[10px] tw:font-normal tw:text-muted-foreground">(Total: {warehouses.length})</span></>}>
      <ComboInput placeholder="WAREHOUSE_NAME" className="tw:w-full tw:md:w-[200px] tw:md:flex-none" listClassName="tw:min-w-64"
        options={warehouses} filter={matchWarehouse} getValue={(warehouse) => warehouse.warehouseName} getLabel={(warehouse) => `Code: ${warehouse.warehouseCode}`}
        value={exportData.warehousename || ''} onValueChange={setText('warehousename')} onSelect={pickWarehouse} />
      <ComboInput placeholder="CODE" className="tw:w-[80px] tw:flex-none" listClassName="tw:min-w-64"
        options={warehouses} filter={matchWarehouse} getValue={(warehouse) => warehouse.warehouseCode} getLabel={(warehouse) => warehouse.warehouseName}
        value={exportData.code || ''} onValueChange={setText('code')} onSelect={pickWarehouse} />
    </Field>
  );
}

export default function ShipmentModeSection({ ctx }) {
  const { exportData, setExportData, setField, handleChange, warehouses } = ctx;
  const exBondJob = /^Y/i.test(String(exportData.exBondJob || '')) || exportData.exBondJob === true ? 'Y' : 'N';
  const handCarry = exportData.handCarry || 'N';

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-page tw:px-2 tw:py-1.5 tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:gap-x-8">
      <Field label="Shipment Mode">
        <SelectBox className="tw:w-full tw:font-semibold tw:md:w-[110px]" options={SHIPMENT_MODES} value={exportData.shipmentMode || 'AIR'} onValueChange={setField('shipmentMode')} />
      </Field>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center">
        <Field label="Ex-Bond Job">
          <SelectBox className="tw:w-full tw:md:w-[56px]" options={YES_NO} value={exBondJob} onValueChange={setField('exBondJob')} />
        </Field>
        {exportData.exBondJob === 'Y' && <WarehouseFields warehouses={warehouses} exportData={exportData} setExportData={setExportData} />}
      </div>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:flex-wrap tw:md:items-center">
        <Field label="Hand Carry">
          <FlagInput value={handCarry} onValueChange={setField('handCarry')} />
        </Field>
        {exportData.handCarry === 'Y' && HAND_CARRY_FIELDS.map(({ name, label, placeholder, alias }) => (
          <Field key={name} label={label}>
            <Input name={name} placeholder={placeholder} className="tw:w-full tw:md:w-[120px]" value={exportData[name] || (alias && exportData[alias]) || ''} onChange={handleChange} />
          </Field>
        ))}
      </div>
    </div>
  );
}
