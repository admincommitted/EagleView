import { CheckCircle } from 'lucide-react';
import { Button, DataTable, Field, Input, Modal } from '@/components/ui';

const MAX_RITC_ROWS = 100;
const DEFAULT_UNIT = 'KGS';

const pickColumn = { key: 'pick', header: '', align: 'center', width: 40, cell: () => <CheckCircle className="tw:inline tw:size-3.5 tw:text-success" /> };

function CodeSearchModal({ open, title, width, filter, onFilterChange, rows, rowKey, columns, onPick, onClose }) {
  return (
    <Modal open={open} title={title} width={width} onClose={onClose} footer={<Button onClick={onClose}>CANCEL</Button>}>
      <Field label="Find" labelWidth="40px">
        <Input data-allow-text="" placeholder="ENTER FILTER" value={filter} onChange={(event) => onFilterChange(event.target.value)} />
      </Field>
      <DataTable columns={columns} rows={rows} rowKey={rowKey} onRowClick={onPick} containerClassName="tw:max-h-[320px] tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

const includesText = (value, text) => String(value || '').toLowerCase().includes(String(text || '').toLowerCase());

export default function CodeSearchModals({ ctx }) {
  const {
    schemesList, tariffs, isSchemeModalOpen, setIsSchemeModalOpen, schemeFilter, setSchemeFilter, handleSchemeSelect,
    isRitcModalOpen, setIsRitcModalOpen, ritcFilter, setRitcFilter, handleRitcSelect,
  } = ctx;
  const schemes = schemesList.filter((scheme) => scheme.code?.includes(schemeFilter) || includesText(scheme.desc, schemeFilter));
  const ritcRows = tariffs.filter((tariff) => tariff.hsnCode?.includes(ritcFilter) || includesText(tariff.description, ritcFilter)).slice(0, MAX_RITC_ROWS);

  return (
    <>
      <CodeSearchModal
        open={isSchemeModalOpen} title="Search Scheme Code" width={600} filter={schemeFilter} onFilterChange={setSchemeFilter}
        rows={schemes} rowKey="code" onClose={() => setIsSchemeModalOpen(false)} onPick={(scheme) => handleSchemeSelect(scheme.code, scheme.desc)}
        columns={[pickColumn, { key: 'code', header: 'CODE', width: 60, className: 'tw:font-semibold' }, { key: 'desc', header: 'DESCRIPTION', className: 'tw:whitespace-normal' }]}
      />
      <CodeSearchModal
        open={isRitcModalOpen} title="Search RITC Code" width={700} filter={ritcFilter} onFilterChange={setRitcFilter}
        rows={ritcRows} rowKey={(tariff, index) => tariff.id ?? index} onClose={() => setIsRitcModalOpen(false)}
        onPick={(tariff) => handleRitcSelect(tariff.hsnCode, tariff.description, tariff.uqc || DEFAULT_UNIT)}
        columns={[
          pickColumn,
          { key: 'hsnCode', header: 'CODE', width: 80, className: 'tw:font-semibold' },
          { key: 'description', header: 'DESCRIPTION', className: 'tw:whitespace-normal' },
          { key: 'uqc', header: 'UNIT', width: 60, className: 'tw:font-semibold tw:text-muted-foreground', cell: (tariff) => tariff.uqc || DEFAULT_UNIT },
        ]}
      />
    </>
  );
}
