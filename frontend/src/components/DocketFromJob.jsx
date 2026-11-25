import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, ExternalLink, Plane, Ship } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { cn } from '@/lib/utils';
import { Button, Field, Modal, SelectBox, badgeVariants } from '@/components/ui';
import { jobEntryApi } from './JobEntry/jobEntryApi';

const docketPath = (docket) => `/freight/shipment/${String(docket.division).toLowerCase()}?docket=${encodeURIComponent(docket.docketNo)}`;

const savedJobNo = (job) => (job?.jobNo && !/^draft$/i.test(job.jobNo) ? job.jobNo : '');

function useJobDocket(jobNo) {
  const [docket, setDocket] = useState(null);
  useEffect(() => {
    setDocket(null);
    if (!jobNo) return undefined;
    let isCurrent = true;
    const load = async () => {
      try {
        const found = await jobEntryApi.shipmentByJob(jobNo);
        if (isCurrent) setDocket(found);
      } catch {
        if (isCurrent) setDocket(null);
      }
    };
    load();
    return () => { isCurrent = false; };
  }, [jobNo]);
  return [docket, setDocket];
}

// iCAFFE "Register Shipment" popup: OK / Change Branch / Cancel
function RegisterShipmentModal({ side, job, jobNo, branches, branch, onBranchChange, onOk, onClose }) {
  const branchOptions = [
    ...(branch && !branches.some((option) => option.code === branch) ? [{ value: branch, label: branch }] : []),
    ...branches.map((option) => ({ value: option.code, label: `${option.code} - ${option.name}` })),
  ];
  const transport = /^A/i.test(String(job.shipmentMode || job.modeOfTransport || '')) ? 'Air' : 'Sea';
  return (
    <Modal open onClose={onClose} title="Register Shipment" width={420} onOk={onOk} okLabel="Ok">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:normal-case">
        <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">
          Make the freight docket of {side === 'Export' ? 'shipping bill' : 'BE'} job <b>{jobNo}</b> (Shipment Registration, {side} {transport}).
        </p>
        <Field label="Change Branch" layout="col">
          <SelectBox options={branchOptions} value={branch} onValueChange={onBranchChange} className="tw:w-full" />
        </Field>
      </div>
    </Modal>
  );
}

function DocketResultModal({ result, onOpenDocket, onClose }) {
  const { docket } = result;
  const copyDocketNo = async () => {
    try {
      await navigator.clipboard.writeText(docket.docketNo);
    } catch {
      // the browser does not allow the copy
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={result.failed ? 'Docket not generated' : 'Docket generated'}
      width={480}
      footer={(
        <>
          {docket && <Button onClick={copyDocketNo}><Copy /> Copy</Button>}
          {docket && <Button variant="default" onClick={() => onOpenDocket(docket)}><ExternalLink /> Open Docket</Button>}
          <Button variant="secondary" onClick={onClose}>OK</Button>
        </>
      )}
    >
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:text-center tw:normal-case">
        {docket && <CheckCircle2 className="tw:size-9 tw:text-success" />}
        <p className={cn('tw:m-0 tw:text-[13px] tw:font-bold', result.failed ? 'tw:text-destructive' : 'tw:text-foreground')}>{result.message}</p>
        {docket && <p className="tw:m-0 tw:text-[22px] tw:font-extrabold tw:tracking-wide tw:text-primary">{docket.docketNo}</p>}
      </div>
    </Modal>
  );
}

// "Register Shipment (Docket No)" on the customs job screens (Import BE, Export SB), as on iCAFFE: the docket already
// made for the job (click to open it), or a button that makes it from the saved job.
export default function DocketFromJob({ side, job }) {
  const navigate = useNavigate();
  const jobNo = savedJobNo(job);
  const [docket, setDocket] = useJobDocket(jobNo);
  const [isRegistering, setIsRegistering] = useState(false);
  const [result, setResult] = useState(null);
  const [isAsking, setIsAsking] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState('');

  const openDocket = (shipment) => navigate(docketPath(shipment));

  const loadBranches = async () => {
    try {
      const meta = await jobEntryApi.shipmentMeta();
      setBranches(meta.branches || []);
      if (!job.branchCode && meta.branches?.[0]) setBranch(meta.branches[0].code);
    } catch {
      // the list stays empty; the job's own branch is still offered
    }
  };

  const askToRegister = () => {
    if (!jobNo) {
      setResult({ failed: true, message: 'Save the job first - the docket is made from the saved job.' });
      return;
    }
    setBranch(job.branchCode || '');
    setIsAsking(true);
    if (!branches.length) loadBranches();
  };

  const registerShipment = async () => {
    setIsAsking(false);
    setIsRegistering(true);
    try {
      const made = await jobEntryApi.docketFromJob({ side, jobId: job.id, jobNo, branchCode: branch });
      setDocket(made);
      setResult({ message: made.message, docket: made });
    } catch (error) {
      setResult({ failed: true, message: `Docket not generated: ${errorMessage(error)}` });
    }
    setIsRegistering(false);
  };

  const DocketIcon = docket && /^A/.test(docket.division || '') ? Plane : Ship;

  return (
    <>
      <span className="tw:text-border">|</span>
      {docket ? (
        <Button size="sm" className={cn(badgeVariants({ variant: 'success' }), 'tw:h-auto tw:cursor-pointer')} title="Open the freight docket (Shipment Registration)" onClick={() => openDocket(docket)}>
          <DocketIcon className="tw:size-3" /> DOCKET: {docket.docketNo}{docket.currentStatus ? ` - ${docket.currentStatus}` : ''}
        </Button>
      ) : (
        <Button
          size="sm"
          className={cn(badgeVariants({ variant: jobNo ? 'info' : 'neutral' }), 'tw:h-auto tw:cursor-pointer')}
          disabled={isRegistering}
          title={jobNo ? 'Make the freight docket of this job (Shipment Registration)' : 'Save the job first'}
          onClick={askToRegister}
        >
          {isRegistering ? 'Registering...' : '+ Register Shipment (Docket No)'}
        </Button>
      )}
      {isAsking && (
        <RegisterShipmentModal
          side={side}
          job={job}
          jobNo={jobNo}
          branches={branches}
          branch={branch}
          onBranchChange={setBranch}
          onOk={registerShipment}
          onClose={() => setIsAsking(false)}
        />
      )}
      {result && (
        <DocketResultModal
          result={result}
          onOpenDocket={(shipment) => { setResult(null); openDocket(shipment); }}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}
