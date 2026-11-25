// All job reports in one grouped list, with search, favourites, record counts, quick print per report and
// "Send checklist to mail". Click a report to see it on the right.
import { useEffect, useId, useState } from 'react';
import toast from 'react-hot-toast';
import { BadgePercent, Calculator, Container, Download, Files, FileSpreadsheet, FileText, Landmark, ListChecks, Mail, Paperclip, Pill, Printer, Receipt, RefreshCw, Search, Send, Sheet, Ship, Stamp, Star, Tags, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Checkbox, Input, Label } from '@/components/ui';
import { getParties } from '../../../../../utils/partiesCache';
import { jobEntryApi } from '../../../jobEntryApi';

const REPORTS = [
  { id: 'eannex', group: 'Checklists', name: 'Checklist', sub: 'Bill of Entry checklist (standard format)', icon: ListChecks, landscape: false, own: true, main: true },
  { id: 'chachecklist', group: 'Checklists', name: 'CHA Checklist', sub: 'Invoice-wise items with value and each duty; Excel', icon: Sheet, landscape: true, main: true },
  { id: 'invoicewise', group: 'Checklists', name: 'Invoice Wise Checklist', sub: 'Each invoice with its items and duty', icon: Receipt, landscape: true, main: true },
  { id: 'fields', group: 'Checklists', name: 'Detailed Checklist', sub: 'All Bill of Entry fields, section-wise', icon: FileText, landscape: false, main: true },
  { id: 'dutysheet', group: 'Duty & Classification', name: 'Item-wise Duty Sheet', sub: 'Assessable value and duty per item (estimate)', icon: Calculator, landscape: true },
  { id: 'classification', group: 'Duty & Classification', name: 'Classification Details', sub: 'CTH, notifications and rates per item', icon: Tags, landscape: true },
  { id: 'exemption', group: 'Duty & Classification', name: 'Duty Exemption Details', sub: 'Notifications claimed (BCD / IGST / ADD)', icon: BadgePercent, landscape: true },
  { id: 'invparticulars', group: 'Invoice & Annexure', name: 'Invoice Particulars', sub: 'Invoice values, terms, freight, insurance', icon: Receipt, landscape: true },
  { id: 'annexure', group: 'Invoice & Annexure', name: 'Invoice & Item Annexure', sub: 'Invoice-wise item list with totals', icon: Files, landscape: true },
  { id: 'igm', group: 'Shipment', name: 'IGM Details', sub: 'IGM, inward date, MAWB / HAWB, packages', icon: Ship, landscape: false },
  { id: 'containers', group: 'Shipment', name: 'Container Details', sub: 'Containers and seals', icon: Container, landscape: false },
  { id: 'bond', group: 'Shipment', name: 'Bond Details', sub: 'Bonds of a warehouse B/E', icon: Landmark, landscape: false },
  { id: 'docs', group: 'Documents', name: 'Supporting Documents', sub: 'e-Sanchit documents of the job', icon: Paperclip, landscape: false },
  { id: 'adc', group: 'Other Sheets', name: 'ADC Sheet', sub: 'Drugs Controller (CDSCO port office) NOC particulars - batch, mfg, expiry', icon: Pill, landscape: true },
  { id: 'stampduty', group: 'Other Sheets', name: 'Stamp Duty Sheet', sub: 'B/E value and stamp duty at the rate set on the sheet', icon: Stamp, landscape: false },
];
const GROUPS = ['Checklists', 'Duty & Classification', 'Invoice & Annexure', 'Shipment', 'Documents', 'Other Sheets'];

// favourites are saved per user on the server; the browser copy is only a fallback while the server is not reached,
// and is moved to the server the first time
const FAV_KEY = 'import_report_favs';
const validIds = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string' && REPORTS.some((report) => report.id === id)) : []);
const readLocalFavs = () => {
  try {
    return validIds(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  } catch {
    return [];
  }
};
const keepLocalFavs = (ids) => {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  } catch {
    // private mode: the server copy is enough
  }
};
const savedOrThrow = (result) => {
  if (result.success === false) throw new Error(result.error || 'not saved');
  return result;
};
const loadServerFavs = async () => savedOrThrow(await jobEntryApi.userPref(FAV_KEY));
const saveServerFavs = async (ids) => savedOrThrow(await jobEntryApi.saveUserPref(FAV_KEY, ids));

const jsonList = (value) => {
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

async function importerEmail(partyId) {
  const party = (await getParties()).find((row) => String(row.id) === String(partyId));
  return party && (party.email || (party.branches || []).map((branch) => branch.email1).find(Boolean));
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GROUP_LABEL = 'tw:text-[10.5px] tw:font-extrabold tw:tracking-wider tw:text-muted-foreground tw:uppercase';

function useFavourites() {
  const [favs, setFavs] = useState(readLocalFavs);
  const [favSync, setFavSync] = useState('loading'); // loading | saved | offline

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const pref = await loadServerFavs();
        if (!live) return;
        if (pref.saved) {
          const ids = validIds(pref.value);
          setFavs(ids);
          keepLocalFavs(ids);
        } else {
          const localIds = readLocalFavs();
          if (localIds.length) {
            try { await saveServerFavs(localIds); } catch { /* stays in the browser copy */ }
          }
        }
        setFavSync('saved');
      } catch {
        if (live) setFavSync('offline');
      }
    };
    load();
    return () => { live = false; };
  }, []);

  const toggleFav = async (id) => {
    const next = favs.includes(id) ? favs.filter((favId) => favId !== id) : [...favs, id];
    setFavs(next);
    keepLocalFavs(next);
    try {
      await saveServerFavs(next);
      setFavSync('saved');
    } catch (error) {
      setFavSync('offline');
      toast.error('Favourite not saved to server: ' + errorMessage(error));
    }
  };

  return { favs, favSync, toggleFav };
}

function ReportListRow({ report, selected, favourite, count, onPick, onToggleFav, onPrint }) {
  const Icon = report.icon;
  const pickOnKey = (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(); }
  };
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onPick}
      onKeyDown={pickOnKey}
      className={cn(
        'tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:border-l-[3px] tw:py-1.5 tw:pr-2 tw:pl-2.5 tw:hover:bg-accent tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-primary',
        selected ? 'tw:border-l-primary tw:bg-secondary' : 'tw:border-l-transparent'
      )}
    >
      <Icon className={cn('tw:size-[15px] tw:shrink-0', report.main ? 'tw:text-[#dc2626]' : selected ? 'tw:text-primary' : 'tw:text-muted-foreground')} />
      <div className="tw:min-w-0 tw:flex-1">
        <div className={cn('tw:truncate tw:text-[12.5px]', report.main || selected ? 'tw:font-bold' : 'tw:font-semibold', report.main ? 'tw:text-[#b91c1c]' : 'tw:text-primary')}>
          {report.name}
          {count !== undefined && <Badge variant={count ? 'info' : 'neutral'} className="tw:ml-1.5">{count}</Badge>}
        </div>
        <div className="tw:truncate tw:text-[10.5px] tw:text-muted-foreground">{report.sub}</div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        title={favourite ? 'Remove from favourites' : 'Add to favourites'}
        className={favourite ? 'tw:text-[#f59e0b]' : 'tw:text-muted-foreground'}
        onClick={(event) => { event.stopPropagation(); onToggleFav(); }}
      >
        <Star className="tw:size-[13px]" fill={favourite ? '#f59e0b' : 'none'} />
      </Button>
      <Button variant="ghost" size="icon-sm" title={`Print ${report.name}`} className="tw:text-muted-foreground" onClick={(event) => { event.stopPropagation(); onPrint(); }}>
        <Printer className="tw:size-[13px]" />
      </Button>
    </div>
  );
}

function MailBox({ reportName, mail, onChange, onSend, onClose }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5 tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-2">
      <div className="tw:flex tw:items-center tw:justify-between">
        <b className="tw:text-entry">Send "{reportName}" by mail</b>
        <Button variant="ghost" size="icon-sm" title="Close" onClick={onClose}><X className="tw:size-[13px]" /></Button>
      </div>
      <Input placeholder="To (comma for more)" value={mail.to} onChange={(event) => onChange({ to: event.target.value })} />
      <Input placeholder="Subject" value={mail.subject} onChange={(event) => onChange({ subject: event.target.value })} />
      <Button variant="default" disabled={mail.sending} onClick={onSend}><Send /> {mail.sending ? 'Sending...' : 'Send'}</Button>
    </div>
  );
}

export default function GetReportPanel({ ctx }) {
  const { exportReportExcel, reportType, setReportType, landscape, setLandscape, watermark, setWatermark, onPrint, printReportId, handleExportExcel, onRefresh, jobData, allItems, esanchitDocs, sendReportMail } = ctx;
  const watermarkId = useId();
  const [query, setQuery] = useState('');
  const { favs, favSync, toggleFav } = useFavourites();
  const [mail, setMail] = useState(null); // { to, subject, sending }
  const current = REPORTS.find((report) => report.id === reportType) || REPORTS[0];
  const invoiceCount = (jobData?.invoices || []).length;
  const itemCount = (allItems || []).length;
  const counts = {
    invoicewise: invoiceCount, chachecklist: itemCount, dutysheet: itemCount, classification: itemCount, annexure: itemCount, invparticulars: invoiceCount,
    containers: jsonList(jobData?.containers).length, bond: jsonList(jobData?._bondRows).filter((bond) => bond?.bondNo).length, docs: (esanchitDocs || []).length,
  };

  const pick = (report) => { setReportType(report.id); setLandscape(report.landscape); };
  const term = query.trim().toLowerCase();
  const matches = (report) => !term || `${report.name} ${report.sub} ${report.group}`.toLowerCase().includes(term);
  const sections = [
    ...(favs.length ? [{ title: favSync === 'offline' ? 'Favourites (not saved to server)' : 'Favourites', reports: REPORTS.filter((report) => favs.includes(report.id) && matches(report)) }] : []),
    ...GROUPS.map((group) => ({ title: group, reports: REPORTS.filter((report) => report.group === group && matches(report)) })),
  ].filter((section) => section.reports.length);

  const openMail = async () => {
    const jobNo = jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : 'DRAFT';
    setMail({ to: '', subject: `${current.name} - Job ${jobNo}${jobData?.nameOfImporter ? ' - ' + jobData.nameOfImporter : ''}`, sending: false });
    if (!jobData?.importerPartyId) return;
    try {
      const email = await importerEmail(jobData.importerPartyId);
      if (email) setMail((open) => (open && !open.to ? { ...open, to: email } : open));
    } catch {
      // no importer e-mail: the user types it
    }
  };

  const send = async () => {
    const recipients = String(mail.to || '').split(/[;,]/).map((address) => address.trim()).filter(Boolean);
    if (!recipients.length || recipients.some((address) => !EMAIL_PATTERN.test(address))) {
      toast.error('Enter valid e-mail address(es), separated by comma');
      return;
    }
    setMail((open) => ({ ...open, sending: true }));
    const sent = await sendReportMail(recipients.join(','), mail.subject);
    setMail(sent ? null : (open) => ({ ...open, sending: false }));
  };

  return (
    <div className="no-print tw:flex tw:h-full tw:flex-col tw:overflow-hidden tw:rounded-lg tw:border tw:border-border tw:bg-card">
      <div className="tw:border-b tw:border-border tw:bg-secondary tw:px-3 tw:py-2.5">
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <div className="tw:text-sm tw:font-extrabold">Reports</div>
          <Badge variant="outline" className="tw:text-[11px]" title="Job these reports are for">
            Job: {jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : 'not saved'}
          </Badge>
        </div>
        <Input className="tw:mt-2" leftIcon={Search} placeholder="Search report..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search report" />
      </div>

      <div className="tw:flex-1 tw:overflow-y-auto tw:py-1" role="listbox" aria-label="Reports">
        {sections.map((section) => (
          <div key={section.title}>
            <div className={cn(GROUP_LABEL, 'tw:px-3 tw:pt-2 tw:pb-1')}>{section.title}</div>
            {section.reports.map((report) => (
              <ReportListRow
                key={section.title + report.id}
                report={report}
                selected={report.id === current.id}
                favourite={favs.includes(report.id)}
                count={counts[report.id]}
                onPick={() => pick(report)}
                onToggleFav={() => toggleFav(report.id)}
                onPrint={() => { pick(report); printReportId(report.id); }}
              />
            ))}
          </div>
        ))}
        {sections.length === 0 && <div className="tw:p-4 tw:text-center tw:text-entry tw:text-muted-foreground">No report matches "{query}"</div>}
      </div>

      <div className="tw:flex tw:flex-col tw:gap-[7px] tw:border-t tw:border-border tw:px-3 tw:py-2.5 tw:text-entry">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
          <span className={GROUP_LABEL}>Paper</span>
          {current.own
            ? <span className="tw:text-muted-foreground">Checklist size</span>
            : (
              <div className="tw:flex tw:gap-1">
                <Button size="sm" variant={landscape ? 'outline' : 'default'} onClick={() => setLandscape(false)}>Portrait</Button>
                <Button size="sm" variant={landscape ? 'default' : 'outline'} onClick={() => setLandscape(true)}>Landscape</Button>
              </div>
            )}
          <div className="tw:ml-auto tw:flex tw:items-center tw:gap-1">
            <Checkbox id={watermarkId} checked={watermark} onCheckedChange={(checked) => setWatermark(checked === true)} />
            <Label htmlFor={watermarkId} className="tw:cursor-pointer">DRAFT mark</Label>
          </div>
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          <Button variant="default" className="tw:flex-1" onClick={onPrint}><Printer /> Print / PDF</Button>
          <Button onClick={openMail} title="Send the report shown to an e-mail"><Mail /> Mail</Button>
          <Button onClick={exportReportExcel} title="This report to Excel"><FileSpreadsheet /> Excel</Button>
          <Button size="icon" onClick={handleExportExcel} title="All job data (header, invoices, items, documents, duty) in one Excel file"><Download /></Button>
          <Button size="icon" onClick={onRefresh} title="Rebuild the report from the latest job data"><RefreshCw /></Button>
        </div>
        {mail && (
          <MailBox
            reportName={current.name}
            mail={mail}
            onChange={(change) => setMail((open) => ({ ...open, ...change }))}
            onSend={send}
            onClose={() => setMail(null)}
          />
        )}
      </div>
    </div>
  );
}
