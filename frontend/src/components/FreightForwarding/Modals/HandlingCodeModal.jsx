// Handling (SPH) codes of the AWB, picked from the SPH master. An AWB has at most 9 SPH codes.
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, DataTable, SelectBox } from '@/components/ui';
import ModalFrame, { FormError, GRID_BOX } from './_ModalFrame';

const MAX_CODES = 9;

const HandlingCodeModal = ({ isOpen, onClose, codes = [], setCodes, masterSph = [] }) => {
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  if (!isOpen) return null;

  const list = (codes || []).filter(Boolean);
  const descriptionOf = (code) => masterSph.find((sph) => sph.code === code)?.description || '';
  const write = (next) => setCodes?.(Array.from({ length: MAX_CODES }, (_, index) => next[index] || ''));
  const add = () => {
    setError('');
    if (!pick) return setError('Choose a handling code');
    if (list.includes(pick)) return setError(`${pick} is already added`);
    if (list.length >= MAX_CODES) return setError('An AWB can have at most 9 SPH codes');
    write([...list, pick]);
    setPick('');
  };
  const columns = [
    { key: 'code', header: 'Code', width: '60px', className: 'tw:font-bold', cell: (code) => code },
    { key: 'description', header: 'Description', cell: (code) => descriptionOf(code) },
    {
      key: 'delete', header: 'Delete', width: '50px', align: 'center',
      cell: (code) => <Button variant="ghost" size="icon-sm" className="tw:text-destructive" aria-label="Delete" onClick={() => write(list.filter((item) => item !== code))}><X /></Button>,
    },
  ];

  return (
    <ModalFrame title="Add Handling Code" width={520} onClose={onClose} footer={`${list.length} of 9 codes - saved with the AWB`}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center">
        <SelectBox className="tw:flex-1" placeholder="Select" value={pick} onValueChange={setPick}
          options={masterSph.map((sph) => ({ value: sph.code, label: `${sph.code} - ${sph.description}` }))} />
        <Button variant="default" onClick={add}><Plus /> Add</Button>
      </div>
      <FormError>{error}</FormError>
      <DataTable columns={columns} rows={list} rowKey={(code) => code} emptyText="No handling codes" containerClassName={GRID_BOX} />
    </ModalFrame>
  );
};

export default HandlingCodeModal;
