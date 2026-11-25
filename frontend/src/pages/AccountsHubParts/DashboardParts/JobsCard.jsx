import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { inr, fmtDate } from '../ui';
import { TONE, smallNote } from './format';
import { DashCard, MiniTable } from './widgets';

const DIVISION_SHORT = { AE: 'Air Exp', AI: 'Air Imp', SE: 'Sea Exp', SI: 'Sea Imp' };
const TABLE_HEIGHT = 250;

function Intro({ children }) {
  return <div className="tw:mb-1.5 tw:text-[11.5px] tw:text-muted-foreground">{children}</div>;
}
const Highlight = ({ children }) => <b className={TONE.expense}>{children}</b>;

export function JobsCard({ management, onJob }) {
  const [tab, setTab] = useState('unbilled');
  const { unbilled, loss } = management.jobs;
  const dockets = management.dockets;
  const tabs = [
    ['unbilled', 'Cost booked, no invoice (' + unbilled.count + ')'],
    ['loss', 'Cost more than billing (' + loss.count + ')'],
    ...(dockets && dockets.registered ? [['dockets', 'Dockets not invoiced (' + dockets.notBilled + ')']] : []),
  ];
  const docketDivisions = Object.entries(dockets?.byDiv || {});

  return (
    <DashCard title="Jobs to check" icon={Briefcase} right={<span>{management.jobs.total} jobs with entries this year</span>}>
      <Tabs value={tab} onValueChange={setTab} className="tw:mb-2">
        <TabsList variant="line" className="tw:h-auto tw:flex-wrap">
          {tabs.map(([value, label]) => <TabsTrigger key={value} value={value} className="tw:text-[11px] tw:font-bold">{label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {tab === 'unbilled' && (
        <>
          <Intro>Expenses booked on these jobs, but no sales invoice on the job yet: <Highlight>₹ {inr(unbilled.cost, 0)}</Highlight> waiting to be billed.</Intro>
          <MiniTable
            maxHeight={TABLE_HEIGHT}
            rows={unbilled.list}
            onRow={(job) => onJob(job.jobNo)}
            empty="Every job with a cost has an invoice"
            columns={[
              { header: 'Job / docket', cell: (job) => job.jobNo, bold: true },
              { header: 'Div', cell: (job) => DIVISION_SHORT[job.division] || '-' },
              { header: 'First cost', cell: (job) => fmtDate(job.first) },
              { header: 'Cost', right: true, bold: true, cell: (job) => inr(job.cost, 0) },
            ]}
          />
        </>
      )}
      {tab === 'loss' && (
        <>
          <Intro>Cost on the job is more than what was billed on it: <Highlight>₹ {inr(loss.amount, 0)}</Highlight> in all. Consol / master jobs whose billing sits on house jobs also show here.</Intro>
          <MiniTable
            maxHeight={TABLE_HEIGHT}
            rows={loss.list}
            onRow={(job) => onJob(job.jobNo)}
            empty="No job costs more than its billing"
            columns={[
              { header: 'Job / docket', cell: (job) => job.jobNo, bold: true },
              { header: 'Customer', cell: (job) => job.customer || '-', maxWidth: 170 },
              { header: 'Billed', right: true, cell: (job) => inr(job.income, 0) },
              { header: 'Cost', right: true, cell: (job) => inr(job.cost, 0) },
              { header: 'Short', right: true, bold: true, cell: (job) => inr(job.loss, 0), tone: () => TONE.expense },
            ]}
          />
        </>
      )}
      {tab === 'dockets' && dockets && (
        <>
          <Intro>
            {dockets.registered} dockets registered this year (older than 7 days); <Highlight>{dockets.notBilled}</Highlight> have no sales invoice yet
            {docketDivisions.length ? ' (' + docketDivisions.map(([division, count]) => (DIVISION_SHORT[division] || division) + ' ' + count).join(', ') + ')' : ''}.
          </Intro>
          <MiniTable
            maxHeight={TABLE_HEIGHT}
            rows={dockets.byParty || []}
            empty="Every docket is invoiced"
            columns={[
              { header: 'Party', cell: (party) => party.party, bold: true, maxWidth: 230 },
              { header: 'Dockets', right: true, bold: true, cell: (party) => party.count },
              { header: 'Oldest', cell: (party) => fmtDate(party.oldest) + ' ' + (party.oldestNo || '') },
            ]}
          />
          <div className={smallNote}>{dockets.parties} parties. A party billed in bulk (one invoice for many dockets) shows a large count until the invoice carries each docket no.</div>
        </>
      )}
    </DashCard>
  );
}
