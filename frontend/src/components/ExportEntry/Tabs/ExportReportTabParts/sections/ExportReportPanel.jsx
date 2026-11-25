// Report list of Export > Get Report, the same panel as Import > Report: grouped list with search, favourites (saved
// per user), record counts, quick print per report, paper / DRAFT mark, Print, Mail, Excel.
import { useEffect, useId, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BadgePercent, Calculator, Container, Download, Files, FileSpreadsheet, Landmark, ListChecks, Mail, Paperclip, Printer, Receipt, RefreshCw, Search, Send,
  Ship, Star, Tags, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Checkbox, Input, Label } from '@/components/ui';
import { asList } from '../../../../../utils/asList';
import { getParties } from '../../../../../utils/partiesCache';
import { exportEntryApi } from '../../../exportEntryApi';

const REPORTS = [
  { id: 'checklist', group: 'Checklists', name: 'S/B Checklist', sub: 'Shipping Bill checklist with items, SW info and RoDTEP', icon: ListChecks, landscape: false, own: true, main: true },
  { id: 'invoicewise', group: 'Checklists', name: 'Invoice Wise Checklist', sub: 'Each invoice with its items, value and FOB', icon: Receipt, landscape: true, main: true },
  { id: 'rodtep', group: 'Checklists', name: 'RoDTEP Wise Checklist', sub: 'Claim per item with rate, cap and estimate', icon: BadgePercent, landscape: true, main: true },
  { id: 'dbk', group: 'Schemes', name: 'Drawback Particulars', sub: 'DBK Sr No, qty, rate and value per item', icon: Calculator, landscape: true },
  { id: 'licence', group: 'Schemes', name: 'Licence Particulars', sub: 'Registration no / date, Part E / C, quantities', icon: Tags, landscape: true },
  { id: 'ar4', group: 'Schemes', name: 'AR4 Particulars', sub: 'AR4 no, date, commissionerate, division, range', icon: Landmark, landscape: true },
  { id: 'reexport', group: 'Schemes', name: 'Re-Export Particulars', sub: 'Import B/E of each re-exported item', icon: RefreshCw, landscape: true },
  { id: 'invparticulars', group: 'Invoice & Shipment', name: 'Invoice Particulars', sub: 'Values, terms, charges, payment, buyer', icon: Receipt, landscape: true },
  { id: 'annexure', group: 'Invoice & Shipment', name: 'S/B Annexure (Items)', sub: 'Invoice-wise items with FOB, PMV, DBK, RoDTEP and totals', icon: Files, landscape: true },
  { id: 'contannex', group: 'Invoice & Shipment', name: 'Container Annexure', sub: 'Container-wise seals, stuffing and S/B summary', icon: Container, landscape: true },
  { id: 'shipment', group: 'Invoice & Shipment', name: 'Shipment & Containers', sub: 'Weights, packages, marks, containers and seals', icon: Ship, landscape: false },
  { id: 'swinfo', group: 'Documents', name: 'SW Info & Statements', sub: 'Single window info rows and statements per item', icon: Files, landscape: true },
  { id: 'docs', group: 'Documents', name: 'Supporting Documents', sub: 'e-Sanchit documents of the SB and items', icon: Paperclip, landscape: true },
];
const GROUPS = ['Checklists', 'Schemes', 'Invoice & Shipment', 'Documents'];

// favourites are saved per user on the server; the browser copy is only a fallback while the server is not reached,
// and is moved to the server the first time
const FAV_KEY = 'export_report_favs';
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

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GROUP_LABEL = 'tw:text-[10.5px] tw:font-extrabold tw:tracking-wider tw:text-muted-foreground tw:uppercase';

async function exporterEmail(partyId) {
  const party = (await getParties()).find((row) => String(row.id) === String(partyId));
  return party && (party.email || (party.branches || []).map((branch) => branch.email1).find(Boolean));
}

function useFavourites() {
  const [favs, setFavs] = useState(readLocalFavs);
  const [favSync, setFavSync] = useState('loading'); // loading | saved | offline

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const pref = savedOrThrow(await exportEntryApi.reportFavourites());
        if (!live) return;
        if (pref.saved) {
          const ids = validIds(pref.value);
          setFavs(ids);
          keepLocalFavs(ids);
        } else {
          const localIds = readLocalFavs();
          if (localIds.length) {
            try { savedOrThrow(await exportEntryApi.saveReportFavourites(localIds)); } catch { /* stays in the browser copy */ }
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
      savedOrThrow(await exportEntryApi.saveReportFavourites(next));
      setFavSync('saved');
    } catch (error) {
      setFavSync('offline');
      toast.error('Favourite not saved to server: ' + errorMessage(error));
    }
  };

  return { favs, favSync, toggleFav };
}

function reportCounts(jobData, items, dbkItems, licenseItems, containers) {
  const invoiceCount = (jobData?.invoices || []).length;
  const shipmentContainers = Array.isArray(jobData?.Containers) && jobData.Containers.length ? jobData.Containers : (containers || []);
  const sumOver = (countOf) => items.reduce((sum, item) => sum + countOf(item), 0);
  const claimsRodtepInfo = (item) => asList(item.swInfos).some((row) => String(row.swInfoField3 || row.code || '').toUpperCase() === 'RODTEPY');
  return {
    invoicewise: invoiceCount,
    invparticulars: invoiceCount,
    rodtep: items.filter((item) => String(item.rodtep || '').toUpperCase() === 'Y' || claimsRodtepInfo(item)).length,
    dbk: (dbkItems || []).length,
    licence: (licenseItems || []).length,
    ar4: items.filter((item) => /^Y/i.test(String(item.ar4 || ''))).length,
    reexport: sumOver((item) => asList(item.reExports).length),
    swinfo: sumOver((item) => asList(item.swInfos).length + asList(item.swStatements).length),
    annexure: items.length,
    contannex: shipmentContainers.length,
    docs: asList(jobData?.eSanchitList).length + sumOver((item) => asList(item.eSanchitList).length),
    shipment: shipmentContainers.length,
  };
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
      <Icon className={cn('tw:size-[15px] tw:shrink-0', report.main ? 'tw:text-destructive' : selected ? 'tw:text-primary' : 'tw:text-muted-foreground')} />
      <div className="tw:min-w-0 tw:flex-1">
        <div className={cn('tw:truncate tw:text-[12.5px]', report.main || selected ? 'tw:font-bold' : 'tw:font-semibold', report.main ? 'tw:text-destructive' : 'tw:text-primary')}>
          {report.name}
          {count !== undefined && <Badge variant={count ? 'info' : 'neutral'} className="tw:ml-1.5">{count}</Badge>}
        </div>
        <div className="tw:truncate tw:text-[10.5px] tw:text-muted-foreground">{report.sub}</div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        title={favourite ? 'Remove from favourites' : 'Add to favourites'}
        className={favourite ? 'tw:text-warning' : 'tw:text-muted-foreground'}
        onClick={(event) => { event.stopPropagation(); onToggleFav(); }}
      >
        <Star className={cn('tw:size-[13px]', favourite && 'tw:fill-current')} />
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
      <Input data-allow-text="" placeholder="To (comma for more)" value={mail.to} onChange={(event) => onChange({ to: event.target.value })} />
      <Input data-allow-text="" placeholder="Subject" value={mail.subject} onChange={(event) => onChange({ subject: event.target.value })} />
      <Button variant="default" disabled={mail.sending} onClick={onSend}><Send /> {mail.sending ? 'Sending...' : 'Send'}</Button>
    </div>
  );
}

export default function ExportReportPanel({ ctx }) {
  const {
    exportReportExcel, reportType, setReportType, landscape, setLandscape, watermark, setWatermark, onPrint, printReportId, handleExportExcel, onRefresh,
    jobData, allItems, dbkItems, licenseItems, containers, sendReportMail,
  } = ctx;
  const watermarkId = useId();
  const [query, setQuery] = useState('');
  const { favs, favSync, toggleFav } = useFavourites();
  const [mail, setMail] = useState(null); // { to, subject, sending }
  const current = REPORTS.find((report) => report.id === reportType) || REPORTS[0];
  const counts = reportCounts(jobData, allItems || [], dbkItems, licenseItems, containers);
  const savedJobNo = jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : null;

  const pick = (report) => { setReportType(report.id); setLandscape(report.landscape); };
  const term = query.trim().toLowerCase();
  const matches = (report) => !term || `${report.name} ${report.sub} ${report.group}`.toLowerCase().includes(term);
  const sections = [
    ...(favs.length ? [{ title: favSync === 'offline' ? 'Favourites (not saved to server)' : 'Favourites', reports: REPORTS.filter((report) => favs.includes(report.id) && matches(report)) }] : []),
    ...GROUPS.map((group) => ({ title: group, reports: REPORTS.filter((report) => report.group === group && matches(report)) })),
  ].filter((section) => section.reports.length);

  // the exporter's e-mail from the Party master, when the job has the exporter party
  const openMail = async () => {
    setMail({ to: '', subject: `${current.name} - Job ${savedJobNo || 'DRAFT'}${jobData?.shipperName ? ' - ' + jobData.shipperName : ''}`, sending: false });
    if (!jobData?.shipperId) return;
    try {
      const email = await exporterEmail(jobData.shipperId);
      if (email) setMail((open) => (open && !open.to ? { ...open, to: email } : open));
    } catch {
      // no exporter e-mail: the user types it
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
          <Badge variant="outline" className="tw:text-[11px]" title="Job these reports are for">Job: {savedJobNo || 'not saved'}</Badge>
        </div>
        <Input className="tw:mt-2" data-allow-text="" leftIcon={Search} placeholder="Search report..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search report" />
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
          <Button size="icon" onClick={handleExportExcel} title="Full S/B checklist in one Excel file"><Download /></Button>
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
