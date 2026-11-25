// Commodity-wise break-up of the shipment. The rows are kept with the AWB (extra document COMMODITY).
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, ComboInput, DataTable, Field, Input } from '@/components/ui';
import ModalFrame, { ENTRY_ROW, FormError, GRID_BOX } from './_ModalFrame';

const COMMODITIES = ['GENERAL CARGO', 'GARMENTS', 'TEXTILES', 'PHARMACEUTICALS', 'ELECTRONICS', 'MACHINERY PARTS', 'AIRCRAFT PARTS', 'AUTOMOBILE PARTS', 'LEATHER GOODS', 'HANDICRAFTS', 'GEMS & JEWELLERY', 'PERISHABLES', 'DOCUMENTS', 'CHEMICALS (NON-DG)', 'OTHERS'];
const EMPTY_LINE = { commodity: '', pkgs: '', grossWt: '', chgWt: '' };
const decimalText = (text) => String(text || '').replace(/[^\d.]/g, '');

const CommodityModal = ({ isOpen, onClose, rows = [], setRows }) => {
  const [line, setLine] = useState(EMPTY_LINE);
  const [error, setError] = useState('');
  if (!isOpen) return null;

  const lines = rows || [];
  const setField = (field, value) => setLine((current) => ({ ...current, [field]: value }));
  const add = () => {
    setError('');
    if (!line.commodity.trim()) return setError('Choose or type the commodity');
    if (!(parseInt(line.pkgs, 10) > 0)) return setError('Enter the number of packages');
    if (!(parseFloat(line.grossWt) > 0)) return setError('Enter the gross weight');
    setRows?.([...lines, { ...line, commodity: line.commodity.trim().toUpperCase(), id: Date.now() }]);
    setLine(EMPTY_LINE);
  };
  const total = (field) => lines.reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0);
  const columns = [
    { key: 'number', header: '#', cell: (_, index) => index + 1 },
    { key: 'commodity', header: 'Commodity' },
    { key: 'pkgs', header: 'Pkgs', align: 'right' },
    { key: 'grossWt', header: 'Gr.Wt', align: 'right' },
    { key: 'chgWt', header: 'Chg.Wt', align: 'right' },
    {
      key: 'delete', header: 'Delete', align: 'center',
      cell: (_, index) => (
        <Button variant="ghost" size="icon-sm" className="tw:text-destructive" aria-label="Delete" onClick={() => setRows?.(lines.filter((__, rowIndex) => rowIndex !== index))}><X /></Button>
      ),
    },
  ];

  return (
    <ModalFrame title="Commodity" width={620} onClose={onClose}
      footer={`Total: ${total('pkgs')} pkgs, Gr.Wt ${total('grossWt').toFixed(2)}, Chg.Wt ${total('chgWt').toFixed(2)} - saved with the AWB`}>
      <div className={ENTRY_ROW}>
        <Field label="Commodity" layout="col" className="tw:md:flex-[2]">
          <ComboInput options={COMMODITIES} value={line.commodity} onValueChange={(text) => setField('commodity', text)} placeholder="Select or type" />
        </Field>
        <Field label="Pkgs" layout="col" className="tw:md:flex-1">
          <Input value={line.pkgs} onChange={(event) => setField('pkgs', decimalText(event.target.value).replace('.', ''))} />
        </Field>
        <Field label="Gr.Wt" layout="col" className="tw:md:flex-1">
          <Input value={line.grossWt} onChange={(event) => setField('grossWt', decimalText(event.target.value))} />
        </Field>
        <Field label="Chg.Wt" layout="col" className="tw:md:flex-1">
          <Input value={line.chgWt} onChange={(event) => setField('chgWt', decimalText(event.target.value))} />
        </Field>
        <Button variant="default" onClick={add}><Plus /> Add</Button>
      </div>
      <FormError>{error}</FormError>
      <DataTable columns={columns} rows={lines} rowKey={(row, index) => row.id || index} emptyText="No commodity lines" containerClassName={GRID_BOX} />
    </ModalFrame>
  );
};

export default CommodityModal;
