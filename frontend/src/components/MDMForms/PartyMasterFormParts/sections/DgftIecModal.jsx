// Fetch from DGFT: the DGFT "View Any IEC" captcha is shown here; the user types it, and the IEC details with all
// branches come back. The party loaded from the database stays as it is; the user picks which DGFT branches to add.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Checkbox, DataTable, Field, Input, Label, Modal } from '@/components/ui';
import { mastersFormApi } from '../../masterKit/masterRecordsApi';
import { dgftMerc, dgftSrNo, mercView, nameKey, planDgft, up } from '../dgftMatch';

const DETAIL_ORDER = ['IEC Number', 'Firm Name', 'IEC Status', 'DEL Status', 'IEC Issuance Date', 'PAN Number', 'Date of Birth / Incorporation',
  'Nature of Concern / Firm', 'Category of Exporters', 'DGFT RA Office', 'File Number', 'File Date', 'IEC Cancelled Date', 'IEC Suspended Date', 'Address'];

// the DGFT calls answer { success, error, ... } also with an HTTP error status
const dgftAnswer = async (request) => {
  try {
    return await request();
  } catch (error) {
    const { response } = error;
    if (!response) return { success: false, error: error.message };
    const answer = response.data && typeof response.data === 'object' ? response.data : { success: false, error: `Server answered HTTP ${response.status}` };
    if (response.status === 404 && !answer.error) return { ...answer, error: 'DGFT service not found. Restart the backend.' };
    return answer;
  }
};

// DGFT matches the start of the registered name, and "IMPERIAL AUTO INDUSTRIES LIMITED.." misses because of the dots,
// so it is searched with the first word(s) - at least 3 letters
const firstWords = (name) => {
  const words = up(name).replace(/^M\s*\/\s*S\.?\s+/, '').replace(/[^A-Z0-9&.\s-]/g, ' ').split(/\s+/).filter(Boolean);
  let searchText = '';
  for (const word of words) {
    searchText = searchText ? `${searchText} ${word}` : word;
    if (searchText.replace(/[^A-Z0-9]/g, '').length >= 3) break;
  }
  return searchText.replace(/[.\s-]+$/, '') || up(name);
};
const fullName = (name) => up(name).replace(/[.,\s]+$/, '');
const bySrNo = (first, second) => (parseInt(dgftSrNo(first), 10) || 0) - (parseInt(dgftSrNo(second), 10) || 0);
const pickAddable = (plan) => Object.fromEntries(plan.map((row, index) => [index, row.action !== 'skip']).filter(([, addable]) => addable));

function NameAndCategory({ details, name, merc, onUseName, takeName, setTakeName }) {
  const dgftName = details['Firm Name'] || '';
  const sameName = !dgftName || nameKey(dgftName) === nameKey(name);
  const category = details['Category of Exporters'] || '';
  const dgftMercValue = dgftMerc(category);
  const currentMerc = mercView(merc);
  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      {dgftName && (sameName
        ? <div className="tw:text-[11px] tw:text-success">Party name matches DGFT.</div>
        : (
          <div className="tw:flex tw:flex-col tw:gap-2.5 tw:rounded tw:border tw:border-warning/40 tw:bg-warning/10 tw:px-2.5 tw:py-1.5 tw:text-[11px] tw:md:flex-row tw:md:items-center tw:md:justify-between">
            <div>
              <div><span className="tw:text-warning">Party name in EagleView:</span> <b>{up(name) || '-'}</b></div>
              <div><span className="tw:text-warning">Name at DGFT:</span> <b>{dgftName}</b></div>
              <label className="tw:m-0 tw:mt-1 tw:flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:text-warning">
                <Checkbox checked={takeName} onCheckedChange={(checked) => setTakeName(checked === true)} />
                Change the party name to the DGFT name when I add / update branches or fill party fields
              </label>
            </div>
            <Button onClick={() => onUseName(dgftName)}>Use DGFT name now</Button>
          </div>
        ))}
      {category && (
        <div className="tw:text-[11px]">
          {!dgftMercValue && <>DGFT category &quot;{category}&quot; has no Merchant / Manufacturer match; [R]Merc / [F]Manuf stays {currentMerc}.</>}
          {dgftMercValue && dgftMercValue === currentMerc && <>[R]Merc / [F]Manuf is already <b>{dgftMercValue}</b> (DGFT: {category}).</>}
          {dgftMercValue && dgftMercValue !== currentMerc && (
            <>[R]Merc / [F]Manuf will be set to <b>{dgftMercValue}</b> (now {currentMerc}; DGFT: {category}) when you add / update branches or fill party fields.</>
          )}
        </div>
      )}
    </div>
  );
}

function BranchAddressCell({ branch, plan }) {
  return (
    <div className="tw:whitespace-normal">
      {branch.overflow && <div className="tw:text-[10px] tw:font-bold tw:text-destructive">Longer than ICEGATE allows (35 + 35). Shorten after adding; left out: {branch.overflow}</div>}
      {branch.registered && <div className="tw:text-[10px] tw:font-bold tw:text-head">Registered office (IEC address)</div>}
      {branch.address}
      {plan.note && <div className={cn('tw:text-[10px]', plan.action === 'update' ? 'tw:font-semibold tw:text-primary' : 'tw:text-muted-foreground')}>{plan.note}</div>}
    </div>
  );
}

export default function DgftIecModal({ open, onClose, iec, name, merc, addresses, onAddBranches, onFillParty, onUseName }) {
  const [sessionId, setSessionId] = useState('');
  const [picture, setPicture] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [firm, setFirm] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState({});
  const [takeName, setTakeName] = useState(true);
  const captchaRef = useRef(null);
  const focusCaptcha = () => captchaRef.current?.focus();

  const branches = useMemo(() => result?.branches || [], [result]);
  // what Add would do with each DGFT branch: update the matching address here, add it, or skip it (see ../dgftMatch.js)
  const plan = useMemo(() => planDgft(branches, addresses || []), [branches, addresses]);

  const start = async () => {
    setBusy('start');
    setError('');
    setPicture('');
    setCaptcha('');
    const answer = await dgftAnswer(() => mastersFormApi.dgftIecStart());
    setBusy('');
    if (!answer.success) {
      setError(answer.error || 'Could not open the DGFT site.');
      return;
    }
    setSessionId(answer.sessionId);
    setPicture(answer.captcha);
    setTimeout(focusCaptcha, 50);
  };

  const refresh = async () => {
    if (!sessionId) return start();
    setBusy('refresh');
    setError('');
    setCaptcha('');
    const answer = await dgftAnswer(() => mastersFormApi.dgftIecCaptchaRefresh(sessionId));
    setBusy('');
    if (!answer.success) return start();
    setPicture(answer.captcha);
    focusCaptcha();
  };

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setPicked({});
    setTakeName(true);
    setError('');
    setFirm(fullName(name));
    start();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the window opens, with the name typed then

  const fetchIec = async (event) => {
    event.preventDefault();
    if (up(firm).length < 3) {
      setError('Enter at least the first 3 letters of the firm name.');
      return;
    }
    if (!captcha.trim()) {
      setError('Type the captcha shown in the picture.');
      focusCaptcha();
      return;
    }
    setBusy('fetch');
    setError('');
    const answer = await dgftAnswer(() => mastersFormApi.dgftIecFetch({ sessionId, iec: up(iec), name: firstWords(firm), captcha: captcha.trim() }));
    setBusy('');
    if (!answer.success) {
      setError(answer.error || 'DGFT fetch failed.');
      setCaptcha('');
      if (answer.captcha) setPicture(answer.captcha);
      else if (/expired/i.test(answer.error || '')) start();
      focusCaptcha();
      return;
    }
    const sorted = { ...answer, branches: [...(answer.branches || [])].sort(bySrNo) };
    setResult(sorted);
    setPicked(pickAddable(planDgft(sorted.branches, addresses || [])));
  };

  const details = result?.details || {};
  const status = details['IEC Status'] || '';
  const active = /^(active|valid)/i.test(status);
  const pickedList = branches.filter((_, index) => picked[index]);
  const pickedUpdates = branches.filter((_, index) => picked[index] && plan[index]?.action === 'update').length;
  // the DGFT name goes with Add / update and Fill only when it really differs (dots, M/S, PVT / LTD do not count) and the box is ticked
  const nameOption = () => {
    const dgftName = details['Firm Name'] || '';
    return { name: takeName && dgftName && nameKey(dgftName) !== nameKey(name) ? dgftName : '' };
  };
  const detailKeys = DETAIL_ORDER.filter((key) => details[key] && key !== 'Firm Name' && key !== 'IEC Status')
    .concat(Object.keys(details).filter((key) => !DETAIL_ORDER.includes(key)));
  const overflowCount = branches.filter((branch) => branch.overflow).length;
  const branchRows = branches.map((branch, index) => ({ branch, index, plan: plan[index] || {} }));

  const branchColumns = [
    {
      key: 'pick', header: '', width: 28,
      cell: (row) => (
        <Checkbox aria-label={`Select branch ${row.branch.branchCode}`} disabled={row.plan.action === 'skip'} checked={Boolean(picked[row.index])}
          onCheckedChange={(checked) => setPicked((current) => ({ ...current, [row.index]: checked === true }))} />
      ),
    },
    { key: 'srNo', header: 'Sr No', cell: (row) => dgftSrNo(row.branch) },
    { key: 'address', header: 'DGFT address', className: 'tw:align-top', cell: (row) => <BranchAddressCell branch={row.branch} plan={row.plan} /> },
    { key: 'city', header: 'City', cell: (row) => row.branch.city },
    { key: 'state', header: 'State', cell: (row) => row.branch.state },
    { key: 'pinCode', header: 'PIN', cell: (row) => row.branch.pinCode },
    {
      key: 'gstin', header: 'GSTIN', className: 'tw:font-mono',
      cell: (row) => (
        <>
          {row.branch.gstin || row.branch.gstinMasked}
          {!row.branch.gstin && row.branch.gstinMasked && <div className="tw:font-sans tw:text-[10px] tw:text-muted-foreground">Hidden by DGFT</div>}
        </>
      ),
    },
  ];
  const branchRowClass = (row) => {
    if (row.plan.action === 'skip') return 'tw:bg-page tw:even:bg-page tw:text-muted-foreground';
    return picked[row.index] ? 'tw:bg-primary/5 tw:even:bg-primary/5' : undefined;
  };

  const footer = (
    <>
      <div className="tw:mr-auto tw:text-[10px] tw:text-muted-foreground">Where DGFT hides the GSTIN, type it in the branch after adding, then save the party.</div>
      {result && <Button onClick={() => onFillParty(result, nameOption())}>Fill empty party fields</Button>}
      {result && (
        <Button variant="default" disabled={!pickedList.length} onClick={() => onAddBranches(pickedList, result, nameOption())}>
          <Download /> {pickedUpdates ? `Add / update ${pickedList.length}` : `Add ${pickedList.length || ''}`} selected branch{pickedList.length === 1 ? '' : 'es'}
        </Button>
      )}
      <Button onClick={onClose}>Close</Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} width={980} footer={footer}
      title={<>Fetch IEC from DGFT <span className="tw:text-muted-foreground">for IEC {up(iec)}</span></>}>
      <form onSubmit={fetchIec} className="tw:flex tw:flex-wrap tw:items-end tw:gap-3 tw:border-b tw:border-border tw:pb-3">
        <Field label="IEC number" layout="col" className="tw:w-full tw:sm:w-[130px]">
          <Input value={up(iec)} readOnly />
        </Field>
        <Field label="Firm name" layout="col" className="tw:min-w-0 tw:flex-[1_1_220px]" note={`DGFT is searched with: ${firstWords(firm) || '-'}`}>
          <Input data-allow-text="" value={firm} placeholder="FIRM NAME" onChange={(event) => setFirm(event.target.value.toUpperCase())} />
        </Field>
        <div className="tw:flex tw:flex-col tw:gap-0.5">
          <Label htmlFor="dgft-captcha">Captcha</Label>
          <div className="tw:flex tw:items-center tw:gap-1.5">
            <div className="tw:flex tw:h-[44px] tw:w-[150px] tw:items-center tw:justify-center tw:overflow-hidden tw:rounded tw:border tw:border-input tw:bg-background">
              {picture
                ? <img src={picture} alt="DGFT captcha" className="tw:max-h-full tw:max-w-full" />
                : <span className="tw:text-[10px] tw:text-muted-foreground">{busy ? 'Loading…' : 'No picture'}</span>}
            </div>
            <Button size="icon" onClick={refresh} disabled={!!busy} title="New captcha">
              <RefreshCw className={cn((busy === 'refresh' || busy === 'start') && 'tw:animate-spin')} />
            </Button>
            <Input id="dgft-captcha" ref={captchaRef} data-allow-text="" className="tw:w-[110px] tw:normal-case" value={captcha} maxLength={6}
              placeholder="Type captcha" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={(event) => setCaptcha(event.target.value)} />
          </div>
        </div>
        <Button type="submit" variant="default" size="lg" disabled={!!busy || !sessionId} className={cn(busy && 'tw:cursor-wait')}>
          {busy === 'fetch' ? 'Fetching…' : 'Fetch'}
        </Button>
      </form>

      {error && <div role="alert" className="tw:rounded tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:px-2.5 tw:py-2 tw:text-entry tw:text-destructive">{error}</div>}

      {!result && !error && (
        <div className="tw:text-entry tw:text-muted-foreground">
          Type the captcha from the picture and press Fetch. The party loaded from the database is not changed until you add branches below and save.
        </div>
      )}

      {result && (
        <>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
            <div className="tw:text-sm tw:font-bold">{details['Firm Name'] || up(firm)}</div>
            {status && <Badge variant={active ? 'success' : 'danger'}>IEC {status}</Badge>}
          </div>
          {!active && status && <div className="tw:text-[11px] tw:text-destructive">This IEC is not active at DGFT. Check with the client before filing.</div>}
          <NameAndCategory details={details} name={name} merc={merc} onUseName={onUseName} takeName={takeName} setTakeName={setTakeName} />

          <div className="tw:grid tw:grid-cols-1 tw:gap-x-[18px] tw:gap-y-1 tw:text-[11px] tw:sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {detailKeys.map((key) => (
              <div key={key} className={cn('tw:flex tw:gap-1.5', key === 'Address' && 'tw:col-span-full')}>
                <span className="tw:min-w-[150px] tw:text-muted-foreground">{key}</span><span className="tw:font-semibold">{details[key]}</span>
              </div>
            ))}
          </div>

          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
            <div className="tw:text-entry tw:font-bold">
              Branches at DGFT ({branches.length})
              {overflowCount > 0 && <span className="tw:ml-2 tw:font-semibold tw:text-destructive">{overflowCount} address(es) longer than ICEGATE allows</span>}
            </div>
            {branches.length > 0 && (
              <div className="tw:flex tw:gap-2.5">
                <Button variant="link" size="sm" onClick={() => setPicked(pickAddable(plan))}>Select all</Button>
                <Button variant="link" size="sm" onClick={() => setPicked({})}>Clear</Button>
              </div>
            )}
          </div>
          {branches.length === 0
            ? <div className="tw:text-[11px] tw:text-muted-foreground">DGFT shows no branches for this IEC.</div>
            : (
              <DataTable columns={branchColumns} rows={branchRows} rowKey="index" rowClassName={branchRowClass}
                containerClassName="tw:max-h-[280px] tw:rounded tw:border tw:border-border" />
            )}

          {(result.people || []).length > 0 && (
            <>
              <div className="tw:mt-1.5 tw:text-entry tw:font-bold">Proprietor / partners / directors</div>
              <div className="tw:flex tw:flex-wrap tw:gap-x-[18px] tw:gap-y-1 tw:text-[11px]">
                {result.people.map((person, index) => (
                  <span key={index}>{person.Name || Object.values(person).filter(Boolean).slice(1, 2).join(' ')}{person.Designation ? ` (${person.Designation})` : ''}</span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
