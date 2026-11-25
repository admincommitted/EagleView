import { useState } from 'react';
import { Button } from '@/components/ui';
import { BOND_CODES, mergeCodes, filterCodes } from '../icegateCodes';
import { GridEntryModal } from './GridEntryModal';
import { editColumn, removeColumn } from './rowActionColumns';
import { LookupSearchModal } from './LookupSearchModal';

const CONTAINER_TYPES = [
  { value: 'GP', label: 'General Purpose (Dry)' },
  { value: 'HC', label: 'High Cube' },
  { value: 'RF', label: 'Reefer' },
  { value: 'RH', label: 'Reefer High Cube' },
  { value: 'OT', label: 'Open Top' },
  { value: 'FR', label: 'Flat Rack' },
  { value: 'TK', label: 'Tank' },
  { value: 'PL', label: 'Platform' },
  { value: 'VH', label: 'Ventilated' },
];

const CONTAINER_FIELD_ROWS = [
  [
    { name: 'srNo', label: 'Sr No', required: true, placeholder: 'Sr No', className: 'tw:md:w-24' },
    { name: 'igmNumber', label: 'IGM No', required: true, className: 'tw:md:w-36' },
    { name: 'igmDate', label: 'IGM Date', kind: 'date', className: 'tw:md:w-32' },
  ],
  [
    { name: 'contNo', label: 'Container No', required: true, className: 'tw:md:flex-[1.5]' },
    { name: 'sealNo', label: 'Seal No', required: true, className: 'tw:md:flex-[1.5]' },
    { name: 'lclFcl', label: 'LCL/FCL', kind: 'select', required: true, options: ['LCL', 'FCL'] },
    { name: 'contSize', label: 'Container Size', kind: 'select', options: [{ value: '20', label: '20 FT' }, { value: '40', label: '40 FT' }, { value: '45', label: '45 FT' }] },
    { name: 'contType', label: 'Container Type', kind: 'combo', upper: true, placeholder: 'GP / HC / RF ...', options: CONTAINER_TYPES },
    { name: 'truckNo', label: 'Truck No' },
  ],
];

const CONTAINER_COLUMNS = [
  { key: 'srNo', header: 'Sr No' },
  { key: 'igmNumber', header: 'Igm No', cell: (container) => container.igmNumber || container.igmNo },
  { key: 'igmDate', header: 'Igm Date' },
  { key: 'contNo', header: 'Cont No', className: 'tw:font-bold' },
  { key: 'sealNo', header: 'Seal No' },
  { key: 'lclFcl', header: 'LCL/FCL' },
  { key: 'contSize', header: 'Cont. Size' },
  { key: 'contType', header: 'Cont. Type' },
];

const BOND_COLUMNS = [
  { key: 'bondNo', header: 'BOND NO' },
  { key: 'bondAmt', header: 'BOND AMT' },
  { key: 'bondCode', header: 'BOND CD' },
  { key: 'bondPort', header: 'BOND PORT' },
];

const PORT_SEARCH_MIN_LETTERS = 2;

function matchingPorts(ports, query) {
  if (query.length < PORT_SEARCH_MIN_LETTERS) return [];
  const portCodeOf = (port) => String(port.portCode || '').toLowerCase();
  return ports
    .filter((port) => portCodeOf(port).includes(query) || String(port.portName || '').toLowerCase().includes(query))
    .sort((a, b) => portCodeOf(b).startsWith(query) - portCodeOf(a).startsWith(query))
    .slice(0, 50)
    .map((port) => ({ code: port.portCode, name: port.portName }));
}

function ContainerModal({ ctx }) {
  const { isContainerModalOpen, setIsContainerModalOpen, containerForm, handleContainerChange, addContainer, jobData, removeContainer } = ctx;
  const close = () => setIsContainerModalOpen(false);
  return (
    <GridEntryModal
      open={isContainerModalOpen} title="Container Details" width={900} onClose={close}
      footer={<Button variant="success" onClick={close}>OK</Button>}
      fieldRows={CONTAINER_FIELD_ROWS} values={containerForm}
      onFieldChange={(name, value) => handleContainerChange({ target: { name, value } })}
      onAdd={addContainer}
      columns={[removeColumn((_, container) => removeContainer(container.id)), ...CONTAINER_COLUMNS]}
      rows={jobData.containers || []} rowKey={(container, index) => container.id || index}
      emptyText="No containers added" gridClassName="tw:min-h-[150px] tw:max-h-[300px]"
    />
  );
}

function BondModal({ ctx, onSearchCode, onSearchPort }) {
  const { isBondModalOpen, setIsBondModalOpen, jobData, handleChange, handleBondAdd, handleBondEdit, handleBondRemove, bondRows, bondEditIdx, ports = [] } = ctx;
  const fieldRows = [[
    { name: 'autoField_24', label: 'Bond No', required: true },
    { name: 'autoField_25', label: 'Bond Amount', kind: 'number' },
    { name: 'autoField_26', label: 'Bond Code', required: true, onSearch: onSearchCode },
    {
      name: 'autoField_27', label: 'Bond Port', kind: 'combo', required: true, className: 'tw:md:flex-[1.2]', onSearch: onSearchPort,
      options: ports, getOptionValue: (port) => port.portCode, getOptionLabel: (port) => port.portName,
    },
  ]];
  const close = () => setIsBondModalOpen(false);
  return (
    <GridEntryModal
      open={isBondModalOpen} title="Bond Details" width={800} onClose={close}
      fieldRows={fieldRows} values={jobData}
      onFieldChange={(name, value) => handleChange({ target: { name, value } })}
      addLabel={bondEditIdx !== null ? 'Update' : 'Add'} onAdd={handleBondAdd}
      columns={[editColumn(handleBondEdit), removeColumn(handleBondRemove), ...BOND_COLUMNS]}
      rows={bondRows} selectedKey={bondEditIdx}
      emptyText="No bonds added. Fill the fields and click Add."
    />
  );
}

export default function ContainerDetailsSection({ ctx }) {
  const { bondMaster = [], ports = [], setJobData, isBondCodeSearchOpen, isBondPortSearchOpen, setIsBondCodeSearchOpen, setIsBondPortSearchOpen } = ctx;
  const [searchText, setSearchText] = useState('');
  const query = searchText.trim().toLowerCase();
  const searchRows = isBondCodeSearchOpen ? filterCodes(mergeCodes(bondMaster, BOND_CODES), query) : matchingPorts(ports, query);

  const openSearch = (setSearchOpen) => () => { setSearchText(''); setSearchOpen(true); };
  const closeSearch = () => { setIsBondCodeSearchOpen(false); setIsBondPortSearchOpen(false); };
  const pickSearchRow = (row) => {
    setJobData((previous) => ({ ...previous, [isBondCodeSearchOpen ? 'autoField_26' : 'autoField_27']: row.code }));
    closeSearch();
  };
  const portHintNeeded = !isBondCodeSearchOpen && query.length < PORT_SEARCH_MIN_LETTERS;

  return (
    <>
      <ContainerModal ctx={ctx} />
      <BondModal ctx={ctx} onSearchCode={openSearch(setIsBondCodeSearchOpen)} onSearchPort={openSearch(setIsBondPortSearchOpen)} />
      <LookupSearchModal
        open={isBondCodeSearchOpen || isBondPortSearchOpen} onClose={closeSearch}
        filter={searchText} onFilterChange={setSearchText}
        codeHeader={isBondCodeSearchOpen ? 'CODE' : 'PORT_CD'} nameHeader={isBondCodeSearchOpen ? 'DESCRIPTION' : 'PORT_NM'}
        rows={searchRows} onPick={pickSearchRow}
        emptyText={portHintNeeded ? 'Type at least 2 letters of the port code or name' : 'Nothing found'}
      />
    </>
  );
}
