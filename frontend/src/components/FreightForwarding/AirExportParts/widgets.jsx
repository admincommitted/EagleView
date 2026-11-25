import { CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, Printer, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, CardHeader, CardTitle, SelectBox, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import AirExportActionTabs from '../AirExportActionTabs';
import { shortDateTime, stageLabel, STAGES } from './airExport';

export function AirExportPage({ activeTab, showTabs = true, className, children }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col">
      {showTabs && <AirExportActionTabs activeTab={activeTab} />}
      <div className={cn('tw:flex tw:min-w-0 tw:flex-col tw:gap-3 tw:py-3', className)}>{children}</div>
    </div>
  );
}

const DOC_TYPES = {
  M: 'tw:border-primary/40 tw:bg-primary/10 tw:text-primary',
  H: 'tw:border-warning/40 tw:bg-warning/10 tw:text-warning',
  A: 'tw:border-success/40 tw:bg-success/10 tw:text-success',
};

const docLetter = (type) => {
  const upper = String(type).toUpperCase();
  if (upper === 'MASTER' || upper === 'MAWB') return 'M';
  if (upper === 'HOUSE' || upper === 'HAWB') return 'H';
  return 'A';
};

export function DocTypeBadge({ type }) {
  if (!type) return null;
  const letter = docLetter(type);
  return <Badge className={cn('tw:size-6 tw:rounded-sm tw:text-[11px]', DOC_TYPES[letter])}>{letter}</Badge>;
}

export function StageText({ stage, short }) {
  return (
    <span className={cn('tw:font-bold', STAGES[stage]?.className ?? 'tw:text-muted-foreground')}>
      {stageLabel(stage, { short }) || '-'}
    </span>
  );
}

// FNA is the airline's rejection, so a filled FNA shows a red cross instead of a tick.
export function Milestone({ value, rejected = false, withTime = false }) {
  if (value === true || value === 'true' || value === 'Y') return <CheckCircle2 className="tw:mx-auto tw:size-3.5 tw:text-success" />;
  if (!value) return withTime ? <span className="tw:text-input">-</span> : null;
  return (
    <span title={shortDateTime(value)} className="tw:inline-flex tw:flex-col tw:items-center tw:leading-tight">
      <span className={cn('tw:font-extrabold', rejected ? 'tw:text-destructive' : 'tw:text-success')}>{rejected ? '✕' : '✓'}</span>
      {withTime && <span className="tw:text-[9px] tw:text-muted-foreground">{shortDateTime(value)}</span>}
    </span>
  );
}

export function ChoiceGroup({ label, value, onValueChange, options }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:max-w-full tw:flex-wrap tw:items-center tw:gap-2">
      {label && <span className="tw:text-[10px] tw:font-bold tw:tracking-wide tw:text-muted-foreground">{label}</span>}
      <Tabs value={value} onValueChange={onValueChange} className="tw:min-w-0 tw:max-w-full">
        <TabsList variant="pill" className="tw:h-7 tw:max-w-full tw:justify-start tw:overflow-x-auto">
          {options.map((option) => (
            <TabsTrigger key={option.value} value={option.value} title={option.title} className="tw:text-[11px]">{option.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

export function PageSizeSelect({ value, sizes, onValueChange }) {
  return (
    <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-entry">
      Show
      <SelectBox className="tw:w-16" value={value} onValueChange={(size) => onValueChange(Number(size))} options={sizes.map(String)} />
      entries
    </span>
  );
}

export function Pager({ page, pageCount, onPageChange, summary, className }) {
  const pages = Array.from({ length: pageCount }, (_, index) => String(index + 1));
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:text-entry tw:text-muted-foreground', className)}>
      <span>{summary}</span>
      <div className="tw:flex tw:items-center tw:gap-1.5">
        <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft /> Previous</Button>
        <span>Page</span>
        <SelectBox className="tw:w-16" value={page} onValueChange={(picked) => onPageChange(Number(picked))} options={pages} />
        <span>of {pageCount}</span>
        <Button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next <ChevronRight /></Button>
      </div>
    </div>
  );
}

export function ReportHeader({ title, ready, onShow, onPrint, onExcel }) {
  return (
    <CardHeader className="tw:flex-wrap tw:border-b tw:border-border tw:py-1.5">
      <CardTitle className="tw:mr-auto tw:text-sm tw:text-foreground">{title}</CardTitle>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button variant="default" onClick={onShow}><Search /> SHOW</Button>
        <Button disabled={!ready} onClick={onPrint}><Printer /> PRINT</Button>
        <Button variant="success" disabled={!ready} onClick={onExcel}><FileSpreadsheet /> EXCEL</Button>
      </div>
    </CardHeader>
  );
}
