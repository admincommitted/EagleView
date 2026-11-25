import { Anchor, CheckCircle, Clock, Download, FileText, Package, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_STYLE = {
  done: { dot: 'tw:bg-success', icon: CheckCircle, title: 'tw:text-foreground' },
  active: { dot: 'tw:bg-primary', icon: Clock, title: 'tw:text-primary' },
  pending: { dot: 'tw:border-2 tw:border-input tw:bg-muted', icon: null, title: 'tw:text-foreground' },
};

function CargoFact({ icon: Icon, label, value }) {
  return (
    <div className="tw:flex tw:items-center tw:gap-3">
      <Icon className="tw:size-5 tw:text-muted-foreground" />
      <div>
        <div className="tw:text-[11px] tw:text-muted-foreground">{label}</div>
        <div className="tw:font-bold">{value}</div>
      </div>
    </div>
  );
}

function Timeline({ steps, airlineUrl }) {
  return (
    <div>
      <h3 className="tw:mt-0 tw:mb-5 tw:text-[16px] tw:text-foreground">Tracking History</h3>
      <div className="tw:relative tw:flex tw:flex-col tw:gap-5">
        <div className="tw:absolute tw:top-2.5 tw:bottom-2.5 tw:left-[11px] tw:w-0.5 tw:bg-border" />
        {!steps.length && (
          <div className="tw:pl-8 tw:text-[13px] tw:text-muted-foreground">
            No milestone recorded for this AWB yet
            {airlineUrl && <> - <a href={airlineUrl} target="_blank" rel="noreferrer" className="tw:text-primary">check on the airline's site</a></>}
          </div>
        )}
        {steps.map((step, index) => {
          const style = STEP_STYLE[step.status] || STEP_STYLE.done;
          const StepIcon = style.icon;
          return (
            <div key={index} className={cn('tw:relative tw:flex tw:gap-4', step.status === 'pending' && 'tw:opacity-50')}>
              <div className={cn('tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full', style.dot)}>
                {StepIcon && <StepIcon className="tw:size-3.5 tw:text-white" />}
              </div>
              <div>
                <div className={cn('tw:text-[14px] tw:font-bold', style.title)}>{step.event}</div>
                <div className="tw:mt-0.5 tw:text-entry tw:text-muted-foreground">{step.location} &bull; {step.date}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentList({ documents }) {
  return (
    <div>
      <h3 className="tw:mt-0 tw:mb-5 tw:text-[16px] tw:text-foreground">Available Documents</h3>
      <div className="tw:flex tw:flex-col tw:gap-3">
        {!documents.length && <div className="tw:text-[13px] tw:text-muted-foreground">Documents are kept with the AWB - open it in Freight &gt; Air Waybill.</div>}
        {documents.map((document, index) => (
          <div key={index} className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-3">
            <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
              <FileText className="tw:size-5 tw:shrink-0 tw:text-destructive" />
              <div className="tw:min-w-0">
                <div className="tw:truncate tw:text-[13px] tw:font-bold tw:text-foreground">{document.name}</div>
                <div className="tw:text-[11px] tw:text-muted-foreground">{document.type || 'FILE'}{document.size ? ' • ' + document.size : ''}</div>
              </div>
            </div>
            <a
              href={document.path}
              target="_blank"
              rel="noreferrer"
              download
              title={document.path ? 'Open ' + document.name : 'This document has no file on disk'}
              className={cn('tw:inline-flex', document.path ? 'tw:cursor-pointer tw:text-primary' : 'tw:cursor-not-allowed tw:text-input')}
              onClick={(event) => { if (!document.path) event.preventDefault(); }}
            >
              <Download className="tw:size-[18px]" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrackingResult({ tracking }) {
  return (
    <>
      <div className="tw:mb-6 tw:flex tw:flex-col tw:gap-4 tw:border-b tw:border-border tw:pb-5 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
        <div>
          <div className="tw:mb-1 tw:text-[13px] tw:font-bold tw:tracking-wider tw:text-muted-foreground tw:uppercase">AWB / Tracking Number</div>
          <h2 className="tw:m-0 tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:text-[28px] tw:text-foreground">
            {tracking.awb}
            <span className="tw:rounded-full tw:bg-warning/15 tw:px-3 tw:py-1 tw:text-[14px] tw:font-bold tw:text-warning">{tracking.status}</span>
          </h2>
        </div>
        <div className="tw:sm:text-right">
          <div className="tw:text-[13px] tw:font-bold tw:text-muted-foreground">Flight / Vessel</div>
          <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-[18px] tw:font-bold tw:text-foreground tw:sm:justify-end">
            <Plane className="tw:size-[18px] tw:text-primary" /> {tracking.flight}
          </div>
        </div>
      </div>

      <div className="tw:mb-10 tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-[2fr_1fr] tw:md:gap-10">
        <div className="tw:flex tw:items-center tw:gap-4 tw:rounded-lg tw:bg-page tw:p-5">
          <div className="tw:min-w-0 tw:flex-1">
            <div className="tw:mb-1 tw:text-entry tw:text-muted-foreground">ORIGIN</div>
            <div className="tw:text-[18px] tw:font-bold tw:text-foreground">{tracking.origin}</div>
          </div>
          <div className="tw:flex tw:flex-1 tw:flex-col tw:items-center">
            <Plane className="tw:size-6 tw:text-muted-foreground" />
            <div className="tw:mt-2 tw:h-0.5 tw:w-full tw:bg-border" />
          </div>
          <div className="tw:min-w-0 tw:flex-1 tw:text-right">
            <div className="tw:mb-1 tw:text-entry tw:text-muted-foreground">DESTINATION</div>
            <div className="tw:text-[18px] tw:font-bold tw:text-foreground">{tracking.dest}</div>
          </div>
        </div>
        <div className="tw:flex tw:flex-col tw:justify-center tw:gap-3">
          <CargoFact icon={Package} label="TOTAL PIECES" value={tracking.pieces + ' Cartons'} />
          <CargoFact icon={Anchor} label="GROSS WEIGHT" value={tracking.weight} />
        </div>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-10 tw:md:grid-cols-[1.5fr_1fr]">
        <Timeline steps={tracking.timeline} airlineUrl={tracking.airlineUrl} />
        <DocumentList documents={tracking.documents} />
      </div>
    </>
  );
}
