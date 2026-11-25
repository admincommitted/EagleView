import { useRef } from 'react';
import { ChevronDown, Download, FileText, FolderOpen, Plus, Search, Table } from 'lucide-react';
import { ActionMenu, Button, DateInput, Field, Input, SelectBox, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { BE_TYPE_OPTIONS, MODE_OPTIONS, SEARCH_FIELD_OPTIONS } from './jobList';
import { downloadSampleFile, SAMPLE_FILES } from './sampleFiles';

const SAMPLE_MENU = SAMPLE_FILES.map((sample) => ({
  label: sample.label,
  description: `for ${sample.usedBy}`,
  icon: Download,
  onSelect: () => downloadSampleFile(sample),
}));

export default function QueryToolbar({ draft, onDraftChange, onSearch, viewMode, onViewModeChange, onNewJob, onReadFile, onBulkOocZip }) {
  // Kept outside state: typing in the box would otherwise redraw the whole job list on every key.
  const searchTerm = useRef(draft.searchTerm);
  const setDraft = (key) => (value) => onDraftChange({ ...draft, [key]: value });
  const search = () => onSearch({ ...draft, searchTerm: searchTerm.current });

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-page tw:px-3 tw:py-2">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <Field label="Mode"><SelectBox className="tw:w-20" value={draft.mode} onValueChange={setDraft('mode')} options={MODE_OPTIONS} /></Field>
        <Field label="BE Type"><SelectBox className="tw:w-28" value={draft.beType} onValueChange={setDraft('beType')} options={BE_TYPE_OPTIONS} /></Field>
        <div className="tw:flex tw:w-full tw:min-w-0 tw:items-center tw:gap-1 tw:md:w-auto">
          <SelectBox className="tw:w-28 tw:shrink-0" value={draft.searchType} onValueChange={setDraft('searchType')} options={SEARCH_FIELD_OPTIONS} />
          <Input
            leftIcon={Search}
            className="tw:w-full tw:md:w-44"
            placeholder="Enter search term..."
            defaultValue={draft.searchTerm}
            onChange={(event) => { searchTerm.current = event.target.value; }}
            onKeyDown={(event) => event.key === 'Enter' && search()}
          />
        </div>
        <Field label="From"><DateInput wrapperClassName="tw:w-32" value={draft.fromDate} onValueChange={setDraft('fromDate')} /></Field>
        <Field label="To"><DateInput wrapperClassName="tw:w-32" value={draft.toDate} onValueChange={setDraft('toDate')} /></Field>
        <Button variant="default" onClick={search}><Search /> Search</Button>
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Tabs value={viewMode} onValueChange={onViewModeChange}>
          <TabsList variant="pill">
            <TabsTrigger value="list" className="tw:text-[11px]">List View</TabsTrigger>
            <TabsTrigger value="dsr" className="tw:text-[11px]"><Table /> Excel DSR</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="success" onClick={onBulkOocZip}><FolderOpen /> Bulk OOC Zip</Button>
        <Button variant="success" onClick={onNewJob}><Plus /> New Job</Button>
        <Button variant="success" onClick={() => onReadFile('flat')}><FileText /> Read Flat File</Button>
        <Button variant="success" onClick={() => onReadFile('xml')}><FileText /> Read XML</Button>
        <ActionMenu items={SAMPLE_MENU} trigger={<Button variant="warning"><Download /> Download Sample <ChevronDown /></Button>} />
      </div>
    </div>
  );
}
