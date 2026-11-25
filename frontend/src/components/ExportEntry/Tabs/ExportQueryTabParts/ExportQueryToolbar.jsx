import toast from 'react-hot-toast';
import { ChevronDown, Download, FileSpreadsheet, FileText, FolderOpen, Plus, Search } from 'lucide-react';
import { ActionMenu, Button, ComboInput, DateInput, Field, FileButton, SelectBox } from '@/components/ui';
import { matchesTypeAhead, MODE_OPTIONS, NO_FILTERS, SEARCH_FIELD_OPTIONS, STATUS_OPTIONS } from './exportJobList';
import { downloadExportSample, readExportJobExcel, SAMPLE_FILES } from './exportJobExcel';

const SAMPLE_MENU = SAMPLE_FILES.map((sample) => ({
  label: sample.title,
  description: sample.note,
  icon: Download,
  onSelect: async () => {
    await downloadExportSample(sample);
    toast.success(`${sample.title} sample downloaded`);
  },
}));

const hasFilters = (filters) => Object.keys(NO_FILTERS).some((key) => filters[key] !== NO_FILTERS[key]);

function JobSearchBox({ jobs, value, onChange }) {
  const matches = value ? jobs.filter((job) => matchesTypeAhead(job, value)) : [];
  return (
    <ComboInput
      leftIcon={Search}
      className="tw:w-full tw:md:w-[260px] tw:md:flex-none"
      listClassName="tw:min-w-72"
      placeholder="Enter Search Term..."
      options={matches}
      filter={() => true}
      limit={Infinity}
      getValue={(job) => job.jobNo}
      getLabel={(job) => job.exporter}
      value={value}
      onValueChange={onChange}
      onSelect={(job) => onChange(job.jobNo)}
    />
  );
}

export default function ExportQueryToolbar({ jobs, filters, onFiltersChange, onSearch, onBulkLeoZip, onAction }) {
  const setFilter = (key) => (value) => onFiltersChange({ ...filters, [key]: value });

  const createJobFromExcel = async ([file]) => {
    if (!file) return;
    try {
      onAction('excel-job', await readExportJobExcel(file));
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-background tw:px-3 tw:py-2">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <Field label="Mode"><SelectBox className="tw:w-20" value={filters.mode} onValueChange={setFilter('mode')} options={MODE_OPTIONS} /></Field>
        <div className="tw:flex tw:w-full tw:min-w-0 tw:items-center tw:gap-1 tw:md:w-auto">
          <SelectBox className="tw:w-28 tw:shrink-0" value={filters.searchType} onValueChange={setFilter('searchType')} options={SEARCH_FIELD_OPTIONS} />
          <JobSearchBox jobs={jobs} value={filters.searchTerm} onChange={setFilter('searchTerm')} />
        </div>
        <Field label="From"><DateInput wrapperClassName="tw:w-32" value={filters.fromDate} onValueChange={setFilter('fromDate')} /></Field>
        <Field label="To"><DateInput wrapperClassName="tw:w-32" value={filters.toDate} onValueChange={setFilter('toDate')} /></Field>
        <Field label="Status"><SelectBox className="tw:w-32" value={filters.status} onValueChange={setFilter('status')} options={STATUS_OPTIONS} /></Field>
        <Button variant="default" onClick={onSearch}><Search /> Search</Button>
        {hasFilters(filters) && <Button onClick={() => onFiltersChange(NO_FILTERS)}>Clear</Button>}
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Button variant="success" onClick={onBulkLeoZip}><FolderOpen /> Bulk LEO Zip</Button>
        <Button variant="success" onClick={() => onAction('new')}><Plus /> New Job</Button>
        <Button variant="success" onClick={() => onAction('import-file', 'flat')}><FileText /> Read Flat File</Button>
        <FileButton variant="success" accept=".xlsx,.xls,.csv" onFiles={createJobFromExcel}><FileSpreadsheet /> Create Job from Excel</FileButton>
        <ActionMenu items={SAMPLE_MENU} className="tw:w-72" trigger={<Button variant="warning"><Download /> Download Sample <ChevronDown /></Button>} />
      </div>
    </div>
  );
}
