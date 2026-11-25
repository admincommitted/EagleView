// Due Agent / Due Carrier charges: the AWB's Other Charges with entitlement agent / carrier (saved with the AWB),
// charge list from the Airway Bill Charges master.
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, DataTable, Field, Input, SelectBox } from '@/components/ui';
import ModalFrame, { ENTRY_ROW, FormError, GRID_BOX } from './_ModalFrame';

const EMPTY_CHARGE = { code: '', rate: '', amount: '', ppcc: 'PP' };
const PREPAID_COLLECT = [{ value: 'PP', label: 'P' }, { value: 'CC', label: 'C' }];
const decimalText = (text) => text.replace(/[^\d.]/g, '');

export default function ChargesWindow({ isOpen, onClose, title, entitlement, charges = [], setCharges, masterCharges = [], currency }) {
  const [charge, setCharge] = useState(EMPTY_CHARGE);
  const [error, setError] = useState('');
  if (!isOpen) return null;

  const rows = (charges || []).map((row, position) => ({ ...row, position }))
    .filter((row) => row.code && String(row.entitlement || '').toLowerCase() === entitlement);
  const nameOf = (code) => {
    const master = masterCharges.find((item) => String(item.awbChargeCode || '').toUpperCase() === String(code).toUpperCase());
    return master ? (master.awbChargeName || master.chargeName || '') : '';
  };
  const activeCharges = masterCharges.filter((item) => item.isActive !== false && item.awbChargeCode);
  const setField = (field, value) => setCharge((current) => ({ ...current, [field]: value }));

  const add = () => {
    setError('');
    const code = String(charge.code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}[AC]?$/.test(code)) return setError('Choose a charge (IATA code of 2 letters)');
    const amount = parseFloat(charge.amount);
    if (!(amount > 0)) return setError('Enter the amount');
    const row = { id: Date.now(), code, entitlement, ppcc: charge.ppcc === 'CC' ? 'CC' : 'PP', amount: amount.toFixed(2), rate: charge.rate, description: nameOf(code) };
    const list = [...(charges || [])];
    const blank = list.findIndex((item) => !item.code);
    if (blank >= 0) list[blank] = { ...list[blank], ...row, id: list[blank].id };
    else list.push(row);
    setCharges?.(list);
    setCharge(EMPTY_CHARGE);
  };
  const remove = (position) => setCharges?.(charges.filter((_, index) => index !== position));
  const total = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);

  const columns = [
    { key: 'code', header: 'Code', className: 'tw:font-bold' },
    { key: 'name', header: 'Charge Name', cell: (row) => row.description || nameOf(row.code) },
    { key: 'rate', header: 'Rate', cell: (row) => row.rate || '' },
    { key: 'amount', header: 'Amount', align: 'right' },
    { key: 'ppcc', header: 'P/C', cell: (row) => (row.ppcc === 'CC' ? 'C' : 'P') },
    {
      key: 'delete', header: 'Delete', align: 'center',
      cell: (row) => <Button variant="ghost" size="icon-sm" className="tw:text-destructive" aria-label="Delete" onClick={() => remove(row.position)}><X /></Button>,
    },
  ];

  return (
    <ModalFrame title={title} width={640} onClose={onClose} footer={`${rows.length} charge(s), total ${total.toFixed(2)} ${currency || ''} - saved with the AWB (Other Charges)`}>
      <div className={ENTRY_ROW}>
        <Field label="Charge Name" layout="col" className="tw:md:flex-[2]"
          note={activeCharges.length === 0 ? <span className="tw:text-warning">No charges in Master &gt; Airway Bill Charges Master</span> : undefined}>
          <SelectBox className="tw:w-full" placeholder="Select" value={charge.code} onValueChange={(code) => setField('code', code)}
            options={activeCharges.map((item) => ({ value: item.awbChargeCode, label: `${item.awbChargeCode} - ${item.awbChargeName}` }))} />
        </Field>
        <Field label="Rate" layout="col" className="tw:md:flex-1">
          <Input value={charge.rate} onChange={(event) => setField('rate', decimalText(event.target.value))} />
        </Field>
        <Field label="Amount" layout="col" className="tw:md:flex-1">
          <Input value={charge.amount} onChange={(event) => setField('amount', decimalText(event.target.value))} />
        </Field>
        <Field label="P/C" layout="col" className="tw:md:w-[70px]">
          <SelectBox className="tw:w-full" value={charge.ppcc} onValueChange={(ppcc) => setField('ppcc', ppcc)} options={PREPAID_COLLECT} />
        </Field>
        <Button variant="default" onClick={add}><Plus /> Add</Button>
      </div>
      <FormError>{error}</FormError>
      <DataTable columns={columns} rows={rows} rowKey="position" emptyText={`No ${entitlement} charges`} containerClassName={GRID_BOX} />
    </ModalFrame>
  );
}
