import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button, DataTable, Field, Input, Section } from '@/components/ui';
import ModalFrame, { FormError, GRID_BOX } from './_ModalFrame';

/** HS / harmonised code picker: onSelect(code) gets the code chosen for the selected rate line. */
const HSCodeModal = ({ isOpen, onClose, onSelect }) => {
  const [inputCode, setInputCode] = useState('');
  const [codeList, setCodeList] = useState([]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    const code = inputCode.trim().replace(/\s+/g, '');
    if (!code) { setError('Please enter an HS Code.'); return; }
    if (!/^\d{6,10}$/.test(code)) { setError('HS Code must be 6-10 digits.'); return; }
    if (codeList.includes(code)) { setError('This HS Code is already added.'); return; }
    setCodeList((current) => [...current, code]);
    setInputCode('');
    setError('');
  };
  const handleSelect = (code) => {
    onSelect?.(code);
    onClose();
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); handleAdd(); }
  };

  const columns = [
    {
      key: 'select', header: 'Select', width: '60px', align: 'center',
      cell: (code) => <Button variant="success" size="icon-sm" title="Use this HS Code" aria-label="Use this HS Code" onClick={() => handleSelect(code)}><Check /></Button>,
    },
    {
      key: 'delete', header: 'Delete', width: '60px', align: 'center',
      cell: (code) => <Button variant="destructive" size="icon-sm" title="Remove" aria-label="Remove" onClick={() => setCodeList((current) => current.filter((item) => item !== code))}><X /></Button>,
    },
    { key: 'code', header: 'HS Code', className: 'tw:font-semibold tw:tracking-[1px]', cell: (code) => code },
  ];

  return (
    <ModalFrame title="HS / Harmonised Code" width={450} onClose={onClose}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center">
        <Field label="Enter HS Code" className="tw:flex-1">
          <Input autoFocus maxLength={10} placeholder="e.g. 84713000" value={inputCode} onKeyDown={handleKeyDown}
            onChange={(event) => { setInputCode(event.target.value.replace(/\D/g, '')); setError(''); }} />
        </Field>
        <Button variant="default" onClick={handleAdd}><Plus /> Add</Button>
      </div>
      <FormError>{error}</FormError>
      <Section title="HS Codes Added">
        <DataTable columns={columns} rows={codeList} rowKey={(code) => code} emptyText="No codes added yet. Enter a code above and click + Add." containerClassName={GRID_BOX} />
      </Section>
      <div className="tw:text-[10px] tw:text-muted-foreground">Click ✓ to use a code in the selected rate line. HS codes are 6–10 digits (e.g. 84713000).</div>
    </ModalFrame>
  );
};

export default HSCodeModal;
