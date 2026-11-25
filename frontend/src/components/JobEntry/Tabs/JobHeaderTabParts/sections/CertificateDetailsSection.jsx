import { useState } from 'react';
import { ComboInput, Field, Modal } from '@/components/ui';
import { CERT_TYPES, filterCodes } from '../icegateCodes';
import { GridEntryModal, SearchButton } from './GridEntryModal';
import { editColumn, removeColumn } from './rowActionColumns';
import { LookupSearchModal } from './LookupSearchModal';

const CERT_COLUMNS = [
  { key: 'certNo', header: 'CERT NO' },
  { key: 'certDate', header: 'CERT DT' },
  { key: 'certType', header: 'CERT TYPE' },
  { key: 'commissionerate', header: 'COMISSIONERATE' },
  { key: 'division', header: 'DIVISION' },
  { key: 'range', header: 'RANGE' },
];

const WAREHOUSE_MIN_LETTERS = 2;
const WAREHOUSE_TYPE_AHEAD_ROWS = 15;

const lower = (value) => String(value || '').toLowerCase();

// Warehouses whose code starts with the text come first, then those of this job's port; max 50.
function matchingWarehouses(warehouses, query, jobPort) {
  if (query.length < WAREHOUSE_MIN_LETTERS) return [];
  const codeStarts = (warehouse) => lower(warehouse.warehouseCode).startsWith(query) || lower(warehouse.warehouseCode).replace(/^wh_/, '').startsWith(query);
  const atJobPort = (warehouse) => String(warehouse.linkedPortCode || '').toUpperCase() === jobPort;
  return warehouses
    .filter((warehouse) => [warehouse.warehouseCode, warehouse.warehouseName, warehouse.linkedPortCode, warehouse.city].some((part) => lower(part).includes(query)))
    .sort((a, b) => (codeStarts(b) - codeStarts(a)) || (atJobPort(b) - atJobPort(a)))
    .slice(0, 50);
}

function warehouseSearchHint(warehouses, query) {
  if (!warehouses.length) return 'No warehouses in Masters > Warehouse - add them there, or type the code';
  if (query.length < WAREHOUSE_MIN_LETTERS) return `Type at least ${WAREHOUSE_MIN_LETTERS} letters of the warehouse code, name or port (e.g. INDEL4)`;
  return 'No match';
}

function CertificateModal({ ctx, onSearchCertType }) {
  const { isCertModalOpen, setIsCertModalOpen, jobData, handleChange, certRows = [], certEditIdx = null, handleCertAdd, handleCertEdit, handleCertRemove } = ctx;
  const fieldRows = [[
    { name: 'autoField_30', label: 'Cert. No', required: true },
    { name: 'autoField_31', label: 'Cert. Date', required: true, placeholder: 'DD/MM/YYYY' },
    { name: 'autoField_32', label: 'Cert. Type', required: true, onSearch: onSearchCertType },
    { name: 'autoField_33', label: 'Comissionerate' },
    { name: 'autoField_34', label: 'Division' },
    { name: 'autoField_35', label: 'Range' },
  ]];
  const close = () => setIsCertModalOpen(false);
  return (
    <GridEntryModal
      open={isCertModalOpen} title="Certificate Details" width={900} onClose={close}
      fieldRows={fieldRows} values={jobData}
      onFieldChange={(name, value) => handleChange({ target: { name, value } })}
      addLabel={certEditIdx !== null ? 'Update' : 'Add'} onAdd={handleCertAdd}
      columns={[editColumn(handleCertEdit), removeColumn(handleCertRemove), ...CERT_COLUMNS]}
      rows={certRows} selectedKey={certEditIdx}
      emptyText="No certificates added. Fill the fields and click Add."
    />
  );
}

function WarehouseModal({ ctx, typeAheadRows, onTypeWarehouse, onPickWarehouse, onSearchWarehouse }) {
  const { isWarehouseModalOpen, setIsWarehouseModalOpen, jobData } = ctx;
  const close = () => setIsWarehouseModalOpen(false);
  return (
    <Modal open={isWarehouseModalOpen} title="Update Warehouse Code" width={600} onClose={close} onOk={close} closeOnOutside={false}>
      <Field label="Warehouse Code" required labelWidth="120px">
        <ComboInput name="warehouseCode" required upper placeholder="TYPE WAREHOUSE CODE / NAME" className="tw:min-w-0 tw:flex-1 tw:md:w-[250px] tw:md:flex-none"
          options={typeAheadRows} filter={() => true} limit={WAREHOUSE_TYPE_AHEAD_ROWS}
          getValue={(warehouse) => warehouse.warehouseCode} getLabel={(warehouse) => warehouse.warehouseName}
          value={jobData.warehouseCode || ''} onValueChange={onTypeWarehouse} onSelect={onPickWarehouse} />
        <SearchButton onClick={onSearchWarehouse} />
      </Field>
    </Modal>
  );
}

export default function CertificateDetailsSection({ ctx }) {
  const { warehouseList = [], setJobData, jobData, isCertTypeSearchOpen, setIsCertTypeSearchOpen, isWarehouseSearchOpen, setIsWarehouseSearchOpen } = ctx;
  const [certTypeFilter, setCertTypeFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const certTypeRows = filterCodes(CERT_TYPES, certTypeFilter);
  const warehouseQuery = warehouseFilter.trim().toLowerCase();
  const warehouseRows = matchingWarehouses(warehouseList, warehouseQuery, String(jobData.portCode || jobData.autoField_2 || '').toUpperCase());
  const warehouseSearchRows = warehouseRows.map((warehouse) => ({
    code: warehouse.warehouseCode,
    name: `${warehouse.warehouseName || ''}${warehouse.linkedPortCode ? ` (${warehouse.linkedPortCode})` : ''}`,
    warehouse,
  }));

  const pickCertType = (row) => {
    setJobData((previous) => ({ ...previous, autoField_32: row.code }));
    setIsCertTypeSearchOpen(false);
  };
  const pickWarehouse = (warehouse) => {
    setJobData((previous) => ({ ...previous, warehouseCode: String(warehouse.warehouseCode || '').toUpperCase(), warehouseName: warehouse.warehouseName || '' }));
    setIsWarehouseSearchOpen(false);
  };
  const typeWarehouse = (code) => {
    setJobData((previous) => ({ ...previous, warehouseCode: code }));
    setWarehouseFilter(code);
  };

  return (
    <>
      <CertificateModal ctx={ctx} onSearchCertType={() => { setCertTypeFilter(''); setIsCertTypeSearchOpen(true); }} />
      <LookupSearchModal
        open={isCertTypeSearchOpen} onClose={() => setIsCertTypeSearchOpen(false)}
        filter={certTypeFilter} onFilterChange={setCertTypeFilter}
        rows={certTypeRows} onPick={pickCertType}
        emptyText="No match - type the code in the Cert. Type box"
      />
      <WarehouseModal ctx={ctx} typeAheadRows={warehouseRows} onTypeWarehouse={typeWarehouse} onPickWarehouse={pickWarehouse}
        onSearchWarehouse={() => { setWarehouseFilter(String(jobData.warehouseCode || '')); setIsWarehouseSearchOpen(true); }} />
      <LookupSearchModal
        open={isWarehouseSearchOpen} onClose={() => setIsWarehouseSearchOpen(false)}
        filter={warehouseFilter} onFilterChange={setWarehouseFilter} placeholder="TYPE WAREHOUSE CODE / NAME / PORT"
        codeHeader="WH_CODE" nameHeader="WH_NAME"
        rows={warehouseSearchRows} onPick={(row) => pickWarehouse(row.warehouse)} onFilterEnter={(row) => pickWarehouse(row.warehouse)}
        emptyText={warehouseSearchHint(warehouseList, warehouseQuery)}
      />
    </>
  );
}
