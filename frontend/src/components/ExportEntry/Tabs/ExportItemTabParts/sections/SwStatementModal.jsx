import { Edit2, Trash2 } from 'lucide-react';
import { asList } from '@/utils/asList';
import { Button, ComboInput, DataTable, Field, Input, Modal, SelectBox } from '@/components/ui';
import { SB_STATEMENT_CODES, SB_STATEMENT_TYPES } from '../swCodes';

const NOT_CHOSEN = 'Select';
const EMPTY_STATEMENT = { typeCode: NOT_CHOSEN, statementCode: NOT_CHOSEN, text: '', statementFor: NOT_CHOSEN };
const TYPE_OPTIONS = [NOT_CHOSEN, ...SB_STATEMENT_TYPES];
const FOR_OPTIONS = [NOT_CHOSEN, 'I'];
const CODE_OPTIONS = SB_STATEMENT_CODES.map(([value, label]) => ({ value, label }));

// the statement being typed is kept on the item as tempSwStmt
export default function SwStatementModal({ ctx }) {
  const { formData, handleFormChange, isSwStatementModalOpen, setIsSwStatementModalOpen } = ctx;
  const draft = formData.tempSwStmt || {};
  const statements = asList(formData.swStatements);
  const setDraft = (key, value) => handleFormChange('tempSwStmt', { ...draft, [key]: value });
  const close = () => setIsSwStatementModalOpen(false);

  const addStatement = () => {
    handleFormChange('swStatements', [...statements, { ...draft, id: Date.now() }]);
    handleFormChange('tempSwStmt', EMPTY_STATEMENT);
  };
  const removeStatement = (statement) => handleFormChange('swStatements', statements.filter((other) => other.id !== statement.id));

  const columns = [
    {
      key: 'edit', header: 'Edit', width: 40, align: 'center',
      cell: (statement) => (
        <Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit statement" onClick={() => { handleFormChange('tempSwStmt', statement); removeStatement(statement); }}><Edit2 /></Button>
      ),
    },
    {
      key: 'remove', header: 'Remove', width: 50, align: 'center',
      cell: (statement) => <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove" aria-label="Remove statement" onClick={() => removeStatement(statement)}><Trash2 /></Button>,
    },
    { key: 'statementFor', header: 'Statement For' },
    { key: 'typeCode', header: 'Type Code' },
    { key: 'statementCode', header: 'Statement Code' },
    { key: 'text', header: 'Statement Text', className: 'tw:whitespace-normal' },
  ];

  return (
    <Modal
      open={isSwStatementModalOpen} title="Single Window Statement" width={700} onClose={close}
      footer={<><Button variant="default" onClick={close}>OK</Button><Button onClick={close}>CANCEL</Button></>}
    >
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-[1fr_1fr_2fr_1fr]">
        <Field label="Type Code" layout="col">
          <SelectBox options={TYPE_OPTIONS} value={draft.typeCode || NOT_CHOSEN} onValueChange={(type) => setDraft('typeCode', type)} />
        </Field>
        <Field label="Statement Code" layout="col">
          <ComboInput upper maxLength={7} placeholder="e.g. RD001" options={CODE_OPTIONS}
            value={draft.statementCode && draft.statementCode !== NOT_CHOSEN ? draft.statementCode : ''}
            onValueChange={(code) => setDraft('statementCode', code.toUpperCase().replace(/\s/g, ''))} />
        </Field>
        <Field label="Statement Text" layout="col">
          <Input data-allow-text="" value={draft.text || ''} onChange={(event) => setDraft('text', event.target.value)} />
        </Field>
        <Field label="Statement For" layout="col">
          <SelectBox options={FOR_OPTIONS} value={draft.statementFor || NOT_CHOSEN} onValueChange={(choice) => setDraft('statementFor', choice)} />
        </Field>
      </div>
      <div>
        <Button variant="default" onClick={addStatement}>ADD</Button>
      </div>
      <DataTable columns={columns} rows={statements} rowKey={(statement, index) => statement.id ?? index} emptyText="No statement yet"
        containerClassName="tw:min-h-[150px] tw:max-h-[200px] tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}
