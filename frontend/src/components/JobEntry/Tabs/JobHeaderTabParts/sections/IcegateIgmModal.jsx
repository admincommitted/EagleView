import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Checkbox, DataTable, Field, Input, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { jobEntryApi } from '../../../jobEntryApi';
import { dateColumn } from './igmDisplay';

const upper = (value) => String(value ?? '').trim().toUpperCase();
const lettersAndDigits = (value) => upper(value).replace(/[^A-Z0-9]/g, '');

const withAirNames = (seaAnswer) => ({
  ...seaAnswer,
  hawb: seaAnswer.hbl,
  hawbFound: seaAnswer.hblFound,
  rows: (seaAnswer.rows || []).map((row) => ({ ...row, kind: row.kind === 'HBL' ? 'HAWB' : 'MAWB', mawbNo: row.blNo, hawbNo: row.hblNo, mawbDate: row.blDate, hawbDate: row.hblDate })),
});

function enquiryFailure(error) {
  const { response } = error;
  if (!response) return 'Could not reach the EagleView server.';
  if (typeof response.data === 'object') return errorMessage(error);
  return response.status === 404 ? 'ICEGATE enquiry service not found. Restart the backend.' : `Server answered HTTP ${response.status}`;
}

const typeColumn = { key: 'kind', header: 'Type', className: 'tw:font-semibold', cell: (row) => (row.kind === 'HAWB' ? 'House' : 'Master') };
const houseColumn = (header) => ({ key: 'hawbNo', header, cell: (row) => <span className={cn(row.kind === 'HAWB' && 'tw:font-semibold')}>{row.hawbNo}</span> });

const SEA_COLUMNS = [
  typeColumn,
  { key: 'source', header: 'Source' },
  { key: 'igmNo', header: 'IGM No' },
  dateColumn('igmDate', 'IGM Date'),
  dateColumn('inwardDate', 'Inward Date'),
  { key: 'lineNo', header: 'Line No' },
  { key: 'subLineNo', header: 'Sub Line' },
  { key: 'mawbNo', header: 'BL' },
  dateColumn('mawbDate', 'BL Date'),
  houseColumn('HBL'),
  dateColumn('hawbDate', 'HBL Date'),
  { key: 'totalPkg', header: 'Pkgs' },
  { key: 'pkgCode', header: 'Pkg Code' },
  { key: 'grossWt', header: 'Gross Wt' },
  { key: 'wtUnit', header: 'Unit' },
  { key: 'vessel', header: 'Vessel' },
];

const AIR_COLUMNS = [
  typeColumn,
  { key: 'igmNo', header: 'IGM No' },
  dateColumn('igmDate', 'IGM Date'),
  { key: 'lineNo', header: 'Line No' },
  { key: 'subLineNo', header: 'Sub Line' },
  { key: 'mawbNo', header: 'MAWB' },
  houseColumn('HAWB'),
  { key: 'totalPkg', header: 'Pkgs' },
  { key: 'grossWt', header: 'Gross Wt' },
  { key: 'flightNo', header: 'Flight' },
  dateColumn('flightDate', 'Flight Date'),
  dateColumn('inwardDate', 'Inward Date'),
  { key: 'portOrg', header: 'Origin' },
  { key: 'status', header: 'Status' },
];

const SEA_NOTE = "Master = the BL line of the IGM, House = an HBL (sub line). IGM = ICEGATE's older sea IGM enquiry, SAM = the new Sea Arrival Manifest. Marks are not in this enquiry; fill them yourself.";
const AIR_NOTE = 'Master = the MAWB line of the IGM. House = a HAWB from the console (sub line). Package code and marks are not in this enquiry; fill them yourself.';

const NOTICE_TONES = {
  error: 'tw:border-destructive/30 tw:bg-destructive/5 tw:text-destructive',
  warning: 'tw:border-warning/30 tw:bg-warning/10 tw:text-warning',
};

function Notice({ tone, role, children }) {
  return <div role={role} className={cn('tw:rounded-sm tw:border tw:px-2.5 tw:py-2 tw:text-entry', NOTICE_TONES[tone])}>{children}</div>;
}

export default function IcegateIgmModal({ open, onClose, mode, location, mawb, hawb, onFill }) {
  const sea = mode === 'S';
  const [port, setPort] = useState('');
  const [masterNo, setMasterNo] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [pick, setPick] = useState(-1);
  const [enquiry, setEnquiry] = useState(null);

  useEffect(() => {
    if (!open) return;
    const jobMaster = lettersAndDigits(mawb);
    // a prior BE keeps "NOMAWB" until the master is known - that is not searched
    const noMasterYet = /^NO(MAWB|MBL|BL|AWB)?$/.test(jobMaster);
    const portCode = upper(location), master = noMasterYet ? '' : jobMaster, house = upper(hawb);
    setPort(portCode); setMasterNo(master); setHouseNo(house); setResult(null);
    if (portCode && master) setEnquiry({ portCode, master, house });
    else setError(master ? 'Type the 6-character port (custom site), then press Fetch.' : `Type the ${sea ? 'BL' : 'MAWB'} number${noMasterYet ? ' (this job has ' + upper(mawb) + ')' : ''}, then press Fetch.`);
  }, [open, location, mawb, hawb, sea]);

  useEffect(() => {
    if (!enquiry) return;
    const { portCode, master, house } = enquiry;
    const load = async () => {
      setBusy(true); setError(''); setResult(null); setPick(-1);
      let answer;
      try {
        answer = sea
          ? await jobEntryApi.seaIgm({ location: portCode, bl: master, hbl: house })
          : await jobEntryApi.airIgm({ location: portCode, mawb: master, hawb: house });
      } catch (failure) {
        answer = { success: false, error: enquiryFailure(failure) };
      }
      setBusy(false);
      if (!answer?.success) { setError(answer?.error || 'ICEGATE enquiry failed.'); return; }
      const found = sea ? withAirNames(answer) : answer;
      setResult(found);
      const foundRows = found.rows || [];
      const houseIndex = house ? foundRows.findIndex((row) => row.kind === 'HAWB' && lettersAndDigits(row.hawbNo) === lettersAndDigits(house)) : -1;
      setPick(houseIndex >= 0 ? houseIndex : foundRows.findIndex((row) => row.kind === 'MAWB'));
    };
    load();
  }, [enquiry, sea]);

  const rows = result?.rows || [];
  const selectedRow = rows[pick];
  const pickColumn = {
    key: 'pick', header: '', width: 30, className: 'tw:text-center',
    cell: (_, index) => <Checkbox className="tw:rounded-full" checked={index === pick} onCheckedChange={() => setPick(index)} aria-label={`Pick line ${index + 1}`} />,
  };
  const masterName = sea ? 'BL' : 'MAWB';
  const houseName = sea ? 'HBL' : 'HAWB';

  return (
    <Modal open={open} onClose={onClose} width={1100} title="IGM details from ICEGATE"
      description={sea ? 'public Sea IGM enquiry' : 'public Air IGM / Console enquiry'}
      footer={<>
        <Button variant="default" disabled={!selectedRow} onClick={() => onFill(selectedRow)}><Download /> Fill IGM details</Button>
        <Button onClick={onClose}>Close</Button>
      </>}>
      <form className="tw:flex tw:flex-wrap tw:items-end tw:gap-3 tw:border-b tw:border-border tw:pb-3"
        onSubmit={(event) => { event.preventDefault(); setEnquiry({ portCode: upper(port), master: lettersAndDigits(masterNo), house: upper(houseNo) }); }}>
        <Field label="Port (custom site)" layout="col">
          <Input className="tw:w-[100px]" value={port} onChange={(event) => setPort(event.target.value.toUpperCase())} maxLength={6} placeholder={sea ? 'INNSA1' : 'INDEL4'} />
        </Field>
        <Field label={`${masterName} No`} layout="col">
          <Input className="tw:w-[170px]" value={masterNo} onChange={(event) => setMasterNo(event.target.value.toUpperCase())} maxLength={20} placeholder="MAWB NO" />
        </Field>
        <Field label={`${houseName} No (optional)`} layout="col">
          <Input className="tw:w-[170px]" value={houseNo} onChange={(event) => setHouseNo(event.target.value.toUpperCase())} maxLength={20} placeholder="HAWB NO" />
        </Field>
        <Button type="submit" variant="default" disabled={busy}>{busy ? 'Fetching...' : 'Fetch'}</Button>
      </form>

      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {result?.hawb && result.hawbFound === false && (
        <Notice tone="warning">{houseName} {result.hawb} is not in ICEGATE's {sea ? 'IGM' : 'console'} for this {masterName} yet. You can still take the {masterName} line.</Notice>
      )}
      {result?.errors?.length > 0 && <p className="tw:m-0 tw:text-[11px] tw:text-warning">Some parts could not be read: {result.errors.join('; ')}</p>}

      {busy && <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">Reading ICEGATE...</p>}
      {!busy && rows.length > 0 && (
        <>
          <b className="tw:text-entry">Pick the line for this job</b>
          <DataTable columns={[pickColumn, ...(sea ? SEA_COLUMNS : AIR_COLUMNS)]} rows={rows} rowKey={(_, index) => index}
            selectedKey={pick} onRowClick={(_, index) => setPick(index)}
            containerClassName="tw:max-h-[360px] tw:rounded-sm tw:border tw:border-border" />
          <p className="tw:m-0 tw:text-[10px] tw:text-muted-foreground">{sea ? SEA_NOTE : AIR_NOTE}</p>
        </>
      )}
    </Modal>
  );
}
