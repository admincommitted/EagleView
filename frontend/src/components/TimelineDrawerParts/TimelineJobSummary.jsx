import { Briefcase, FileText, Hash, User } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatTimelineDay } from './timelineFormat';

function SummaryCell({ icon: Icon, iconClassName, label, children }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-px">
      <div className="tw:flex tw:items-center tw:gap-1">
        <Icon className={`tw:size-3 ${iconClassName}`} />
        <span className="tw:text-[9px] tw:font-bold tw:text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function agentOf(jobInfo, chaNames) {
  const code = String(jobInfo.chaCode || jobInfo.autoField_3 || jobInfo.customHouseAgent || '').trim();
  if (!code) return '-';
  const name = chaNames[code.toUpperCase()];
  return name ? <span title={code}>{name}</span> : code;
}

export default function TimelineJobSummary({ jobInfo, module, chaNames }) {
  const isExport = module === 'EXPORT';
  const filingNo = isExport ? (jobInfo.sbNo || '-') : (jobInfo.beNumber || jobInfo.beNo || '-');
  const filingDate = isExport ? jobInfo.sbDate : jobInfo.beDate;
  const partyName = isExport
    ? (jobInfo.shipperName || jobInfo.exporterName || '-')
    : (jobInfo.autoField_4 || jobInfo.importerName || jobInfo.nameOfImporter || '-');

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:border-b tw:border-border tw:bg-page tw:px-3.5 tw:py-2.5 tw:sm:grid-cols-[1.2fr_1fr]">
      <SummaryCell icon={FileText} iconClassName="tw:text-primary" label="JOB NO">
        <div className="tw:flex tw:flex-wrap tw:items-baseline tw:gap-1">
          <span className="tw:text-[11px] tw:font-bold tw:text-foreground">{jobInfo.jobNo || '-'}</span>
          {jobInfo.status && <Badge variant="info" className="tw:text-[8px]">{String(jobInfo.status).replace(/_/g, ' ')}</Badge>}
          <span className="tw:text-[9px] tw:text-muted-foreground">{formatTimelineDay(jobInfo.jobDate)}</span>
        </div>
      </SummaryCell>
      <SummaryCell icon={Hash} iconClassName="tw:text-head" label={isExport ? 'SB NO' : 'BE NO'}>
        <div className="tw:flex tw:items-baseline tw:gap-1">
          <span className="tw:text-[11px] tw:font-bold tw:text-foreground">{filingNo}</span>
          <span className="tw:text-[9px] tw:text-muted-foreground">{formatTimelineDay(filingDate)}</span>
        </div>
      </SummaryCell>
      <SummaryCell icon={User} iconClassName="tw:text-success" label={isExport ? 'EXPORTER' : 'IMPORTER'}>
        <span className="tw:truncate tw:text-[11px] tw:font-semibold tw:text-foreground">{partyName}</span>
      </SummaryCell>
      <SummaryCell icon={Briefcase} iconClassName="tw:text-destructive" label="AGENT">
        <span className="tw:truncate tw:text-[11px] tw:font-semibold tw:text-foreground">{agentOf(jobInfo, chaNames)}</span>
      </SummaryCell>
    </div>
  );
}
