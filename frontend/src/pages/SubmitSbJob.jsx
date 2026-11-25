import { useEffect, useState } from 'react';
import { CheckCircle, Download, FileJson, Mail, Search } from 'lucide-react';
import { Button, DataTable, Field, Input, SelectBox, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';
import { exportEntryApi } from '@/components/ExportEntry/exportEntryApi';

const ICEGATE_USERS = [{ value: 'user1', label: 'User 1' }, { value: 'user2', label: 'User 2' }];

const FILE_ACTIONS = [
  { label: 'Download Signed File', icon: Download, variant: 'default' },
  { label: 'Download UnSigned File', icon: Download, variant: 'default' },
  { label: 'File Mail to ICE Gate', icon: Mail, variant: 'success' },
  { label: 'Validate Job', icon: CheckCircle, variant: 'success' },
  { label: 'Download With Duplicate Job No.', icon: Download, variant: 'default' },
];
const GR_ACTIONS = [
  { label: 'Download GR', icon: Download, variant: 'default' },
  { label: 'Download GR UnSigned File', icon: Download, variant: 'default' },
  { label: 'Mail GR File to ICE Gate', icon: Mail, variant: 'success' },
];
const JSON_ACTIONS = [
  { label: '{Json} Submit eSign via API', variant: 'destructive' },
  { label: '{Json} Download eSigned', variant: 'success' },
  { label: '{Json} Download UnSigned', variant: 'default' },
];

const toTableRow = (job) => ({
  id: job.jobNo || job.id,
  iceName: job.shipperName || 'N/A',
  consignee: job.consigneeName || 'N/A',
  port: job.customsPort || 'N/A',
  location: job.shipmentMode + ' EXPORT',
  enteredBy: 'admin',
  enteredAt: new Date(job.createdAt).toLocaleString(),
});

const jobColumns = (selectedId) => [
  {
    key: 'select',
    header: 'Select',
    width: '40px',
    align: 'center',
    cell: (row) => <span className={cn('tw:inline-block tw:size-3 tw:rounded-full tw:border tw:border-input', row.id === selectedId && 'tw:border-primary tw:bg-primary')} />,
  },
  { key: 'id', header: 'Job No', width: '60px' },
  { key: 'iceName', header: 'ICE Name' },
  { key: 'consignee', header: 'Consignee Name' },
  { key: 'port', header: 'Discharge Port' },
  { key: 'location', header: 'Location' },
  { key: 'enteredBy', header: 'Entered By' },
  { key: 'enteredAt', header: 'Entered Dt' },
];

function ActionRow({ actions, className }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:justify-center tw:gap-2', className)}>
      {actions.map(({ label, icon: Icon, variant }) => (
        <Button key={label} variant={variant}>{Icon && <Icon />} {label}</Button>
      ))}
    </div>
  );
}

export default function SubmitSbJob() {
  const [submissionStatus, setSubmissionStatus] = useState('unsubmitted');
  const [jobNo, setJobNo] = useState('');
  const [icegateUserId, setIcegateUserId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [tableRows, setTableRows] = useState([]);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const answer = await exportEntryApi.queryJobs();
        if (answer.success) setTableRows(answer.data.map(toTableRow));
      } catch (error) {
        console.error(error);
      }
    };
    loadJobs();
  }, []);

  return (
    <div className="glass-panel tw:flex tw:h-full tw:flex-col tw:p-0 tw:normal-case">
      <div className="tw:rounded-t-xl tw:border-b tw:border-primary/25 tw:bg-primary/10 tw:px-4 tw:py-2">
        <h2 className="tw:m-0 tw:text-[14px] tw:text-head tw:normal-case">Submit SB Job</h2>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border tw:bg-page tw:px-4 tw:py-3 tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:gap-6">
        <Tabs value={submissionStatus} onValueChange={setSubmissionStatus}>
          <TabsList variant="pill">
            <TabsTrigger value="unsubmitted">UnSubmitted</TabsTrigger>
            <TabsTrigger value="submitted">Submitted</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="tw:flex tw:items-center tw:gap-2">
          <Field label="Job No">
            <Input className="tw:w-full tw:md:w-[150px]" placeholder="JOB NO" value={jobNo} onChange={(event) => setJobNo(event.target.value)} />
          </Field>
          <Button variant="default"><Search /> Search</Button>
        </div>
        <Field label="Icegate UserId" className="tw:md:ml-auto">
          <SelectBox className="tw:w-full tw:md:w-[200px]" placeholder="Select" clearable clearLabel="Select" value={icegateUserId} onValueChange={setIcegateUserId} options={ICEGATE_USERS} />
        </Field>
      </div>

      <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:bg-page tw:p-2">
        <div className="tw:overflow-hidden tw:rounded-sm tw:border tw:border-border tw:bg-background">
          <DataTable
            columns={jobColumns(selectedJobId)}
            rows={tableRows}
            className="tw:min-w-[900px]"
            selectedKey={selectedJobId}
            onRowClick={(row) => setSelectedJobId(row.id)}
            emptyText="No export job"
          />
        </div>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-t tw:border-primary/25 tw:bg-primary/10 tw:p-3">
        <ActionRow actions={FILE_ACTIONS} />
        <ActionRow actions={GR_ACTIONS} />
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-destructive/25 tw:bg-destructive/10 tw:p-3">
        <Button variant="secondary"><FileJson /> {'{Json}'}</Button>
        <ActionRow actions={JSON_ACTIONS} />
      </div>

      <div className="tw:rounded-b-xl tw:bg-page tw:px-4 tw:py-1.5 tw:text-[11px] tw:font-medium tw:text-foreground">
        Use Internet Explorer For Submission
      </div>
    </div>
  );
}
