import { PlusSquare } from 'lucide-react';
import { Button, DataTable, Field, Input, Modal, SelectBox, Textarea } from '@/components/ui';
import { RichPartySelect } from '../RichPartySelect';
import { editColumn, removeColumn } from './rowActionColumns';

// 0 = the seller who bought from abroad, 1 = who bought from level 0, and so on
const PRECEDING_LEVELS = Array.from({ length: 10 }, (_, level) => `Level- ${level}`);

const SELLER_ADDRESS_FIELDS = [
  { name: 'autoField_42', label: 'Address1' },
  { name: 'autoField_43', label: 'Address2' },
  { name: 'autoField_44', label: 'City' },
];

const SELLER_COLUMNS = [
  { key: 'importerName', header: 'Importer Name', className: 'tw:font-semibold' },
  { key: 'iecNo', header: 'IEC No' },
  { key: 'branchSrNo', header: 'Branch Sr. No' },
  { key: 'address1', header: 'Address1' },
  { key: 'address2', header: 'Address2' },
  { key: 'city', header: 'City' },
  { key: 'pin', header: 'Pin' },
  { key: 'precedingLevel', header: 'Level', className: 'tw:font-semibold', cell: (row) => String(row.precedingLevel || 'Level- 0').replace('Level- ', '') },
];

const PERMISSIONS = [
  { code: 'S48', reasonKey: 'section48Reason', openKey: 'isSection48ModalOpen', setOpenKey: 'setIsSection48ModalOpen' },
  { code: 'FCK', reasonKey: 'firstCheckReason', openKey: 'isFirstCheckModalOpen', setOpenKey: 'setIsFirstCheckModalOpen' },
  { code: 'PRV', reasonKey: 'provAssessReason', openKey: 'isProvAssessModalOpen', setOpenKey: 'setIsProvAssessModalOpen' },
];

function branchOptions(branches, currentBranch) {
  const listed = branches.map((branch) => ({ value: String(branch.branchSrNo), label: `${branch.branchSrNo} - ${branch.branchName || branch.city || ''}` }));
  const currentIsListed = branches.some((branch) => String(branch.branchSrNo) === String(currentBranch));
  return currentBranch && !currentIsListed ? [{ value: String(currentBranch), label: currentBranch }, ...listed] : listed;
}

function PermissionModal({ code, reasonKey, open, onClose, jobData, setJobData }) {
  return (
    <Modal open={open} title={`Permission(${code})`} width={600} onClose={onClose} onOk={onClose} closeOnOutside={false}>
      <Field label="Permission Code" labelWidth="120px">
        <Input readOnly value={code} className="tw:text-primary" />
      </Field>
      <Field label="Reason" labelWidth="120px" className="tw:items-start">
        <Textarea name={reasonKey} className="tw:h-[150px] tw:resize-none" value={jobData[reasonKey] || ''}
          onChange={(event) => { const { name, value } = event.target; setJobData((previous) => ({ ...previous, [name]: value })); }} />
      </Field>
    </Modal>
  );
}

function HighSeaSaleModal({ ctx }) {
  const { hssBranches, handleHssBranchChange, handleChange, handleHssAdd, handleHssEdit, handleHssRemove, hssEditIdx, hssRows, isHighSeaSaleModalOpen, jobData, masters, parties, setIsHighSeaSaleModalOpen, setJobData } = ctx;
  const close = () => setIsHighSeaSaleModalOpen(false);
  const columns = [editColumn(handleHssEdit), removeColumn(handleHssRemove), ...SELLER_COLUMNS];

  return (
    <Modal open={isHighSeaSaleModalOpen} title="High Sea Sale Details" width={900} onClose={close} onOk={close} closeOnOutside={false}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end">
        <Field label="Importer Name" layout="col" className="tw:md:flex-[1.5]">
          <RichPartySelect parties={parties} jobData={jobData} setJobData={setJobData} type="HIGH_SEA" masters={masters} />
        </Field>
        <Field label="IEC Code" required layout="col" className="tw:flex-1">
          <Input name="autoField_41" required className="tw:bg-success/10" value={jobData.autoField_41 || ''} onChange={handleChange} />
        </Field>
        <Field label="Branch Sr. No" required layout="col" className="tw:flex-1">
          <SelectBox name="autoField_60" required placeholder="Select Branch" clearable clearLabel="Select Branch"
            options={branchOptions(hssBranches, jobData.autoField_60)} value={jobData.autoField_60 || ''}
            onValueChange={(value) => handleHssBranchChange({ target: { name: 'autoField_60', value } })} />
        </Field>
        {SELLER_ADDRESS_FIELDS.map(({ name, label }) => (
          <Field key={name} label={label} layout="col" className="tw:flex-1">
            <Input name={name} value={jobData[name] || ''} onChange={handleChange} />
          </Field>
        ))}
      </div>

      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:gap-4">
        <Field label="Pin" labelWidth="30px">
          <Input name="autoField_45" className="tw:w-full tw:md:w-[120px]" value={jobData.autoField_45 || ''} onChange={handleChange} />
        </Field>
        <Field label="Preceeding Level" required>
          <SelectBox name="autoField_61" required className="tw:w-full tw:md:w-[120px]" placeholder="Level- 0" options={PRECEDING_LEVELS}
            value={jobData.autoField_61 || ''} onValueChange={(value) => handleChange({ target: { name: 'autoField_61', value } })} />
        </Field>
        <Button variant="default" onClick={handleHssAdd}><PlusSquare /> {hssEditIdx !== null ? 'Update' : 'Add'}</Button>
      </div>

      <DataTable columns={columns} rows={hssRows} rowKey={(_, index) => index} selectedKey={hssEditIdx}
        emptyText="No entries added yet. Fill the fields above and click Add." containerClassName="tw:min-h-[80px] tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

export default function HighSeaSaleSection({ ctx }) {
  return (
    <>
      <HighSeaSaleModal ctx={ctx} />
      {PERMISSIONS.map(({ code, reasonKey, openKey, setOpenKey }) => (
        <PermissionModal key={code} code={code} reasonKey={reasonKey} open={ctx[openKey]} onClose={() => ctx[setOpenKey](false)}
          jobData={ctx.jobData} setJobData={ctx.setJobData} />
      ))}
    </>
  );
}
