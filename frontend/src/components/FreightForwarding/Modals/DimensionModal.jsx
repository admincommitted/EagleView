// Dimension window: opens with the AWB's dimensions and uses the ratio of the screen (IATA 1:6 = 6000 cm3 per kg).
// The volumetric weight is worked out by weightCalc.js, the same as the rate lines.
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, DataTable, Field, Input, Modal, SelectBox } from '@/components/ui';
import { volWtFromDims, cbmFromDims, divisorOf, chargeableOf } from '../awb/weightCalc';
import { FormError, GRID_BOX } from './_ModalFrame';

const toNumber = (value) => { const number = parseFloat(value); return isNaN(number) ? 0 : number; };
const toRow = (dimension, index) => ({
  id: dimension.id || `${Date.now()}-${index}`,
  length: toNumber(dimension.length ?? dimension.len), width: toNumber(dimension.width ?? dimension.wid), height: toNumber(dimension.height ?? dimension.ht),
  pkgs: parseInt(dimension.pkgs ?? dimension.pcs ?? dimension.pieces ?? dimension.noOfUnits, 10) || 1,
  unit: /^IN/i.test(String(dimension.unit || dimension.cmIn || '')) ? 'INCH' : 'CMT',
});
const EMPTY_ENTRY = { length: '', width: '', height: '', pkgs: '' };
const SIZE_FIELDS = [{ key: 'length', label: 'Length', min: '0' }, { key: 'width', label: 'Width', min: '0' }, { key: 'height', label: 'Height', min: '0' }, { key: 'pkgs', label: 'Pieces', min: '1' }];
const UNITS = ['CMT', 'INCH'];

const DimensionModal = ({ isOpen, onClose, onSave, initialDims, densityGroup }) => {
  const [dims, setDims] = useState([]);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [unit, setUnit] = useState('CMT');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setDims((Array.isArray(initialDims) ? initialDims : []).map(toRow).filter((row) => row.length && row.width && row.height));
    setEntry(EMPTY_ENTRY);
    setError('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;
  const divisor = divisorOf(densityGroup);
  const rowVolumetricWeight = (row) => volWtFromDims([row], densityGroup);

  const handleAdd = () => {
    const length = toNumber(entry.length), width = toNumber(entry.width), height = toNumber(entry.height), pkgs = parseInt(entry.pkgs, 10);
    if (!(length > 0 && width > 0 && height > 0 && pkgs > 0)) { setError('Enter length, width, height and pieces (all more than 0)'); return; }
    setError('');
    setDims([...dims, { id: Date.now(), length, width, height, pkgs, unit }]);
    setEntry(EMPTY_ENTRY);
  };
  const totalVolWt = +volWtFromDims(dims, densityGroup).toFixed(2);
  const apply = () => { onSave?.(dims, totalVolWt); onClose(); };
  const addOnEnter = (event) => { if (event.key === 'Enter') { event.preventDefault(); handleAdd(); } };

  const columns = [
    { key: 'length', header: 'Length' }, { key: 'width', header: 'Width' }, { key: 'height', header: 'Height' },
    { key: 'pkgs', header: 'Pieces' }, { key: 'unit', header: 'Unit' },
    { key: 'cbm', header: 'CBM', cell: (row) => cbmFromDims([row]).toFixed(3) },
    { key: 'volWt', header: 'Vol Wt (kg)', className: 'tw:font-bold tw:text-success', cell: (row) => rowVolumetricWeight(row).toFixed(2) },
    {
      key: 'remove', header: '', width: '30px', align: 'center',
      cell: (row) => <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove" aria-label="Remove" onClick={() => setDims(dims.filter((item) => item.id !== row.id))}><X /></Button>,
    },
  ];

  const footer = (
    <>
      <Button onClick={onClose}>CANCEL</Button>
      <Button variant="success" onClick={apply}>APPLY - UPDATE VOL &amp; CHARGEABLE WT</Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title="Dimensions" width={640} closeOnOutside={false} footer={footer}>
      <div className="tw:rounded-sm tw:border tw:border-border tw:bg-page tw:px-2 tw:py-1 tw:text-[11px] tw:font-bold tw:text-head tw:normal-case">
        Volumetric weight = L x W x H x pieces / {divisor} (cm, ratio {densityGroup && /^1:/.test(densityGroup) ? densityGroup : '1:6'}); inches are converted to cm. Chargeable weight is rounded up to the next 0.5 kg.
      </div>
      <div className="tw:grid tw:grid-cols-2 tw:items-end tw:gap-2 tw:sm:grid-cols-[repeat(5,1fr)_auto]">
        {SIZE_FIELDS.map((field) => (
          <Field key={field.key} label={field.label} layout="col">
            <Input type="number" min={field.min} value={entry[field.key]} onKeyDown={addOnEnter}
              onChange={(event) => setEntry((current) => ({ ...current, [field.key]: event.target.value }))} />
          </Field>
        ))}
        <Field label="Unit" layout="col">
          <SelectBox className="tw:w-full" value={unit} onValueChange={setUnit} options={UNITS} />
        </Field>
        <Button variant="default" onClick={handleAdd}><Plus /> Add</Button>
      </div>
      <FormError>{error}</FormError>
      <DataTable columns={columns} rows={dims} emptyText="No dimension line yet" containerClassName={GRID_BOX} />
      <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-4 tw:rounded-sm tw:border tw:border-border tw:bg-background tw:p-2 tw:text-entry">
        <div>Pieces: <strong>{dims.reduce((sum, row) => sum + row.pkgs, 0)}</strong></div>
        <div>Volume: <strong>{cbmFromDims(dims).toFixed(3)} CBM</strong></div>
        <div className="tw:text-success">Volumetric Wt: <strong>{totalVolWt.toFixed(2)} kg</strong></div>
        <div>Chargeable if gross is lower: <strong>{chargeableOf(0, totalVolWt).toFixed(2)} kg</strong></div>
      </div>
    </Modal>
  );
};

export default DimensionModal;
