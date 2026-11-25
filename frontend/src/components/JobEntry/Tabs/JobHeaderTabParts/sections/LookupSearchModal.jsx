import { X } from 'lucide-react';
import { Button, DataTable, Field, Input, Modal } from '@/components/ui';

/** rows: [{ code, name }]; a click on a row (or Enter in the filter, when onFilterEnter is given) picks it. */
function LookupSearchModal({ open, onClose, filter, onFilterChange, placeholder = 'ENTER FILTER', codeHeader = 'CODE', nameHeader = 'DESCRIPTION', rows, onPick, onFilterEnter, emptyText }) {
  const columns = [
    { key: 'pick', header: '', width: 30, align: 'center', cell: () => <span className="tw:inline-block tw:size-3.5 tw:rounded-full tw:bg-success" /> },
    { key: 'code', header: codeHeader },
    { key: 'name', header: nameHeader },
  ];
  const pickOnEnter = (event) => {
    if (event.key === 'Enter' && onFilterEnter && rows[0]) {
      event.preventDefault();
      onFilterEnter(rows[0]);
    }
  };

  return (
    <Modal open={open} title="Search" width={500} onClose={onClose}
      footer={<Button variant="destructive" onClick={onClose}><X /> Cancel</Button>}>
      <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">Search by code or description</p>
      <Field label="Filter" labelWidth="55px">
        <Input name="enterFilter" placeholder={placeholder} autoFocus value={filter} onChange={(event) => onFilterChange(event.target.value)} onKeyDown={pickOnEnter} />
      </Field>
      <DataTable columns={columns} rows={rows} rowKey="code" onRowClick={onPick} rowTitle="Click to select" emptyText={emptyText}
        containerClassName="tw:min-h-[120px] tw:max-h-[50vh] tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

export { LookupSearchModal };
