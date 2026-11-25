// "Register Shipment" from the job list (click UN-REGISTERED in the Docket No column), the same as the button on the
// job screen (DocketFromJob): choose the branch, OK -> the docket no is made and the shipment entered in Shipment
// Registration. onDone(docket) updates the list row.
import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Field, Modal, SelectBox } from '@/components/ui';
import { sharedWidgetsApi } from './common/sharedWidgetsApi';

export const docketPath = (division, docketNo) => `/freight/shipment/${String(division || 'AI').toLowerCase()}?docket=${encodeURIComponent(docketNo)}`;

const branchOptions = (branches, branch) => [
  ...(branch && !branches.some((option) => option.code === branch) ? [{ value: branch, label: branch }] : []),
  ...branches.map((option) => ({ value: option.code, label: `${option.code} - ${option.name}` })),
];

function DocketResult({ result, onOpen, onClose }) {
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
      width={420}
      footer={(
        <>
          {docket && <Button onClick={copyDocketNo}><Copy /> Copy</Button>}
          {docket && onOpen && <Button variant="default" onClick={() => onOpen(docket)}><ExternalLink /> Open Docket</Button>}
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

export default function DocketRegisterModal({ side = 'Import', job, onClose, onDone, onOpen }) {
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(job.branchCode || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const meta = await sharedWidgetsApi.shipmentMeta();
        setBranches(meta.branches || []);
        if (!job.branchCode && meta.branches?.[0]) setBranch(meta.branches[0].code);
      } catch {
        // the list stays empty; the job's own branch is still offered
      }
    };
    loadBranches();
  }, [job.branchCode]);

  const register = async () => {
    setBusy(true);
    try {
      const docket = await sharedWidgetsApi.docketFromJob({ side, jobId: job.id, jobNo: job.jobNo, branchCode: branch });
      setResult({ message: docket.message, docket });
      onDone?.(docket);
    } catch (error) {
      setResult({ failed: true, message: `Docket not generated: ${errorMessage(error)}` });
    }
    setBusy(false);
  };

  if (result) return <DocketResult result={result} onOpen={onOpen} onClose={onClose} />;

  const transport = /^A/i.test(String(job.shipmentMode || job.modeOfTransport || '')) ? 'Air' : 'Sea';
  return (
    <Modal
      open
      onClose={() => { if (!busy) onClose(); }}
      title="Register Shipment"
      width={420}
      footer={(
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="default" onClick={register} disabled={busy}>{busy ? 'Registering...' : 'Ok'}</Button>
        </>
      )}
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:normal-case">
        <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">
          Make the freight docket of {side === 'Export' ? 'shipping bill' : 'BE'} job <b>{job.jobNo}</b>
          {job.importer ? ` (${job.importer})` : ''} - Shipment Registration, {side} {transport}.
        </p>
        <Field label="Branch" layout="col">
          <SelectBox options={branchOptions(branches, branch)} value={branch} onValueChange={setBranch} className="tw:w-full" />
        </Field>
      </div>
    </Modal>
  );
}
