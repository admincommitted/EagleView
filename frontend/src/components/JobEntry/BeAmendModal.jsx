// BE amendment window of the Job Entry (the iCAFFE way).
// On a filed BE job: its amendments, and "New amendment" - takes the next amendment number (continues iCAFFE's
// series) and makes the amended job, a full copy of the BE job where the changes are made. The filed job is not touched.
// On an amended job: that amendment - what changed, codes, file (unsigned / signed / direct to ICEGATE).
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Checkbox, DataTable, DateInput, Field, Input, Label, Modal, SelectBox } from '@/components/ui';
import askConfirm from '../common/askConfirm';
import { api, dmy, ymd } from '../BeAmendment/beAmendApi';
import AmendmentDetail, { StatusChip } from '../BeAmendment/AmendmentDetail';
import { defaultIcegateId, rememberIcegateId } from '../common/IcegateIdPickModal';

const todayIso = () => new Date().toISOString().slice(0, 10);

function amendmentColumns(openJob) {
  return [
    { key: 'amendNo', header: 'Amend No', className: 'tw:font-bold' },
    { key: 'amendDate', header: 'Date', cell: (row) => dmy(row.amendDate) },
    { key: 'codes', header: 'Codes', cell: (row) => (row.codes || []).join(', ') || '-' },
    { key: 'reason', header: 'Reason', className: 'tw:whitespace-normal' },
    { key: 'status', header: 'Status', cell: (row) => <StatusChip status={row.status} /> },
    {
      key: 'open',
      header: '',
      align: 'right',
      cell: (row) => row.amendedJobId && row.status !== 'Void' && <Button onClick={() => openJob(row.amendedJobId)}>Open amended job</Button>,
    },
  ];
}

function CodeChoices({ codes, ticked, onToggle }) {
  return (
    <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] tw:gap-x-3 tw:gap-y-0.5">
      {codes.map((code) => (
        <Label key={code.code} className="tw:cursor-pointer tw:gap-1.5">
          <Checkbox checked={ticked.includes(code.code)} onCheckedChange={() => onToggle(code.code)} />
          <b className="tw:w-[70px] tw:flex-none">{code.code}</b>
          <span className="tw:truncate" title={code.label}>{code.label}</span>
        </Label>
      ))}
    </div>
  );
}

export default function BeAmendModal({ open, jobData, ...props }) {
  if (!open) return null;
  return <BeAmendWindow key={jobData?.id} jobData={jobData} {...props} />;
}

function BeAmendWindow({ onClose, jobData, onOpenJob }) {
  const [list, setList] = useState(null);
  const [series, setSeries] = useState(null);
  const [codes, setCodes] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(() => ({
    beNo: String(jobData?.beNo || jobData?.beNumber || ''), beDate: ymd(jobData?.beDate), reqLetterNo: '', reqLetterDate: todayIso(), reason: '', codes: [],
  }));
  const [busy, setBusy] = useState(false);
  const [profileId, setProfileId] = useState(''); // ICEGATE ID the amendment file is sent with
  const [problem, setProblem] = useState('');
  const jobId = jobData?.id;
  const amendmentId = jobData?._amendmentId ? Number(jobData._amendmentId) : null;
  const chaCode = jobData?.autoField_3 || jobData?.chaCode;

  const load = useCallback(async () => {
    if (!jobId) return;
    try {
      const [amendments, settings] = await Promise.all([api('/by-job/' + jobId), api('/settings')]);
      setList(amendments);
      setSeries(settings);
      setProfileId(defaultIcegateId(settings?.profiles || [], chaCode));
      setShowNew(!amendments.data.some((row) => ['Draft', 'Ready'].includes(row.status)) && !amendmentId && amendments.data.length === 0);
    } catch (error) {
      setProblem(error.message);
    }
  }, [jobId, amendmentId, chaCode]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const loadCodes = async () => {
      try {
        const answer = await api('/codes');
        setCodes(answer.data || []);
      } catch {
        setCodes([]);
      }
    };
    loadCodes();
  }, []);

  const close = () => { if (!busy) onClose(); };
  const openJob = (id) => { onClose(); onOpenJob?.(id); };
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const toggleCode = (code) => setForm((current) => ({ ...current, codes: current.codes.includes(code) ? current.codes.filter((other) => other !== code) : [...current.codes, code] }));

  const profiles = series?.profiles || [];
  const branch = String(jobData?.branchCode || '').toUpperCase();
  const allSeries = series?.series || [];
  const currentSeries = allSeries.find((entry) => (!branch || entry.branchCode === branch) && entry.fyCode === series.fy) || allSeries[0];

  const create = async () => {
    setProblem('');
    const missing = [];
    if (!form.beNo.trim()) missing.push('BE No');
    if (!form.beDate) missing.push('BE Date');
    if (!form.reason.trim()) missing.push('Reason');
    if (missing.length) { setProblem('Fill in: ' + missing.join(', ')); return; }
    const goAhead = await askConfirm({
      title: 'Make the amended job?',
      message: `Amendment no ${currentSeries ? currentSeries.nextNo : '(next)'} is taken for BE ${form.beNo}.`,
      okLabel: 'Make amended job',
      cancelLabel: 'Not now',
    });
    if (!goAhead) return;
    setBusy(true);
    try {
      if (profileId) rememberIcegateId(profileId);
      const made = await api('/', { method: 'POST', body: { importJobId: jobId, ...form, icegateProfileId: profileId || profiles[0]?.id || null } });
      toast.success(`Amendment ${made.data.amendNo} made - amended job ${made.amendedJobNo} opened. Make the changes there and save.`, { duration: 7000 });
      openJob(made.amendedJobId);
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  const rows = list?.data || [];
  const parentText = list?.parent ? `BE job ${list.parent.jobNo} · BE ${list.parent.beNo || '-'} dt ${dmy(list.parent.beDate)}` : '';
  const profileOptions = profiles.map((profile) => ({
    value: String(profile.id),
    label: `${profile.loginId}${profile.profileName && profile.profileName !== profile.loginId ? ' - ' + profile.profileName : ''}`,
  }));
  const formOpen = showNew || (list && !rows.length);

  return (
    <Modal
      open
      onClose={close}
      width={860}
      title={(
        <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-2.5">
          BE Amendment
          <span className="tw:text-entry tw:text-muted-foreground">{parentText}</span>
          <Button asChild variant="link" className="tw:ml-auto tw:text-entry">
            <a href="/be-amendments" onClick={(event) => { event.preventDefault(); onClose(); window.location.assign('/be-amendments'); }}>Register</a>
          </Button>
        </span>
      )}
      description={parentText || undefined}
      bodyClassName="tw:bg-page"
    >
      {!jobId && <div className="tw:text-entry tw:text-destructive">Save the job first.</div>}
      {problem && <div className="tw:rounded-md tw:bg-destructive/10 tw:p-2 tw:text-entry tw:text-destructive">{problem}</div>}

      {amendmentId ? (
        <AmendmentDetail id={amendmentId} currentJobId={jobId} onOpenJob={openJob} onChanged={load} />
      ) : (
        <>
          {rows.length > 0 && <DataTable columns={amendmentColumns(openJob)} rows={rows} containerClassName="tw:border tw:border-border" />}

          {!formOpen ? (
            <div><Button variant="default" size="lg" onClick={() => setShowNew(true)}>New amendment</Button></div>
          ) : (
            <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-md tw:border tw:border-border tw:bg-background tw:p-3">
              <div className="tw:flex tw:items-baseline tw:gap-2.5">
                <b className="tw:text-[13px]">New amendment</b>
                <span className="tw:text-entry tw:text-muted-foreground">
                  Number: <b className="tw:text-[15px] tw:text-foreground">{currentSeries ? currentSeries.nextNo : '…'}</b>
                  {currentSeries ? ` (${currentSeries.branchCode}/${currentSeries.division}, FY ${currentSeries.fyCode})` : ''}
                </span>
              </div>
              <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] tw:gap-2">
                <Field label="Filed BE No" layout="col">
                  <Input value={form.beNo} maxLength={7} onChange={(event) => setField('beNo', event.target.value.replace(/\D/g, ''))} />
                </Field>
                <Field label="BE Date" layout="col">
                  <DateInput value={form.beDate} onValueChange={(day) => setField('beDate', day)} />
                </Field>
                <Field label="Request letter no" layout="col">
                  <Input value={form.reqLetterNo} maxLength={30} onChange={(event) => setField('reqLetterNo', event.target.value)} />
                </Field>
                <Field label="Request letter date" layout="col">
                  <DateInput value={form.reqLetterDate} onValueChange={(day) => setField('reqLetterDate', day)} />
                </Field>
                <Field label="ICEGATE ID" hint="Sender of the amendment file" layout="col">
                  <SelectBox value={profileId} onValueChange={setProfileId} options={profileOptions} placeholder={profiles.length ? 'Select...' : 'No ICEGATE ID set up'} />
                </Field>
              </div>
              <Field label="Reason" layout="col">
                <Input value={form.reason} maxLength={120} placeholder="e.g. PRIOR TO FINAL" onChange={(event) => setField('reason', event.target.value)} />
              </Field>
              <Field label="Codes (can be ticked later, from the changes)" layout="col">
                <CodeChoices codes={codes} ticked={form.codes} onToggle={toggleCode} />
              </Field>
              <div className="tw:text-[11px] tw:text-muted-foreground">A copy of this job is made as the amended job. Make the changes there; the filed BE job stays as it is.</div>
              <div className="tw:flex tw:justify-end tw:gap-2">
                {rows.length > 0 && <Button size="lg" disabled={busy} onClick={() => setShowNew(false)}>Cancel</Button>}
                <Button variant="default" size="lg" disabled={busy || !jobId} onClick={create}>{busy ? 'Making…' : 'Make amendment'}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
