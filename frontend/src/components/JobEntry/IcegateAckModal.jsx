// ICEGATE reply (acknowledgement) of a BE / Shipping Bill filed through the API. "Sent to ICEGATE" only means the file
// was taken; this window asks ICEGATE (getAck) what ICES answered: BE No / Date, or the error list, or still pending.
// The server also asks on its own every 10 minutes for 3 days after filing.
// It asks with the ICEGATE ID the BE was sent with (another ID gets "Authorization failed"); "Ask as" picks another
// one. A job with no Unique ID takes the Unique ID from the ICEGATE mail - it is kept on the job when ICEGATE answers
// for it. Every new answer also goes to the job log.
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button, DataTable, Field, Input, Modal, SelectBox } from '@/components/ui';
import { jobEntryApi } from './jobEntryApi';

const STATE_COLOUR = { accepted: 'tw:text-success', rejected: 'tw:text-destructive', pending: 'tw:text-warning', error: 'tw:text-destructive', unknown: 'tw:text-muted-foreground' };
const STATE_LABEL = { accepted: 'ACCEPTED BY ICES', rejected: 'REJECTED BY ICEGATE', pending: 'STILL PENDING AT ICEGATE', error: 'COULD NOT ASK ICEGATE', unknown: 'ANSWER RECEIVED - read it below' };

const ERROR_COLUMNS = [
  { key: 'code', header: 'Code', width: '80px', className: 'tw:font-bold', cell: (error) => error.code || error.key || '' },
  { key: 'text', header: 'Error', className: 'tw:whitespace-normal' },
];

const readableAnswer = (ackText) => {
  try {
    return JSON.stringify(JSON.parse(ackText), null, 2);
  } catch {
    return ackText;
  }
};

function AnswerBox({ reply, kind }) {
  const [showRaw, setShowRaw] = useState(false);
  const documentNo = reply.beNo || reply.sbNo || reply.beNoJob;
  const documentDate = reply.beDate || reply.sbDate || reply.beDateJob;
  const showErrors = reply.errors?.some((error) => error.text !== reply.message || error.code);
  return (
    <div className="tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-3 tw:py-2.5">
      <div className={cn('tw:text-[13px] tw:font-extrabold', STATE_COLOUR[reply.state] || 'tw:text-muted-foreground')}>{STATE_LABEL[reply.state] || reply.state}</div>
      {reply.message && <div className="tw:mt-1 tw:text-entry tw:text-foreground">{reply.message}</div>}
      {documentNo && (
        <div className="tw:mt-1.5 tw:text-[13px]">
          {kind} No <strong>{documentNo}</strong>
          {documentDate && <> · {kind} Date <strong>{documentDate}</strong></>}
          {(reply.beNo || reply.sbNo) && <span className="tw:text-[11px] tw:text-muted-foreground"> (put in the job)</span>}
        </div>
      )}
      {showErrors && <DataTable columns={ERROR_COLUMNS} rows={reply.errors} rowKey={(_, index) => index} containerClassName="tw:mt-2" />}
      {reply.ackText && (
        <div className="tw:mt-2">
          <Button variant="link" size="sm" onClick={() => setShowRaw((shown) => !shown)}>{showRaw ? 'Hide' : 'Show'} the full answer from ICEGATE</Button>
          {showRaw && (
            <pre className="tw:max-h-60 tw:overflow-auto tw:rounded-md tw:bg-foreground tw:p-2 tw:text-[10px] tw:break-all tw:whitespace-pre-wrap tw:text-background">
              {readableAnswer(reply.ackText)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// kind 'SB': the same window for a Shipping Bill (export job)
export default function IcegateAckModal({ open, onClose, jobId, uniqueId, onResult, kind = 'BE' }) {
  const documentKind = kind === 'SB' ? 'SB' : 'BE';
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState(null); // { state, message, beNo, beDate, errors, ackText, at, ... }
  const [profiles, setProfiles] = useState([]);
  const [askAs, setAskAs] = useState(''); // '' = the ICEGATE ID the BE was sent with
  const [typedUniqueId, setTypedUniqueId] = useState(''); // Unique ID from the ICEGATE mail, for a job that has none
  const knownUniqueId = uniqueId || reply?.uniqueId || '';
  const jobNoOf = (job) => job && (documentKind === 'SB' ? job.sbNo : job.beNo);
  const jobDateOf = (job) => job && (documentKind === 'SB' ? job.sbDate : job.beDate);

  useEffect(() => {
    if (!open) return;
    setReply(null);
    setTypedUniqueId('');
    if (!jobId) return;
    const loadStoredAnswer = async () => {
      try {
        const stored = await jobEntryApi.icegateAck(documentKind, jobId);
        if (!stored.success || !stored.ack?.interp) return;
        setReply({
          ...stored.ack.interp, ackText: stored.ack.ackText, at: stored.ack.at, senderId: stored.ack.senderId, uniqueId: stored.ack.uniqueId,
          beNoJob: documentKind === 'SB' ? stored.sbNo : stored.beNo, beDateJob: documentKind === 'SB' ? stored.sbDate : stored.beDate, icegateStatus: stored.icegateStatus,
        });
      } catch {
        setReply(null);
      }
    };
    loadStoredAnswer();
  }, [open, jobId, documentKind]);

  useEffect(() => {
    if (!open || profiles.length) return;
    const loadProfiles = async () => {
      try {
        const answer = await jobEntryApi.icegateProfiles();
        if (answer?.success) setProfiles(answer.data || []);
      } catch {
        setProfiles([]);
      }
    };
    loadProfiles();
  }, [open, profiles.length]);

  const askIcegate = async () => {
    if (!jobId) { toast.error('Save the job first'); return; }
    const typed = typedUniqueId.trim();
    if (!knownUniqueId && !typed) { toast.error('Type the Unique ID from the ICEGATE mail'); return; }
    setBusy(true);
    try {
      const answer = await jobEntryApi.askIcegateAck(documentKind, { jobId, profileId: askAs || undefined, uniqueId: knownUniqueId ? undefined : typed });
      if (!answer.success) { toast.error(answer.error || 'ICEGATE did not answer'); return; }
      setReply({
        ...answer, at: new Date().toISOString(), beNoJob: jobNoOf(answer.job), beDateJob: jobDateOf(answer.job),
        icegateStatus: answer.job?.icegateStatus, uniqueId: answer.saved === false ? '' : answer.uniqueId,
      });
      if (answer.saved === false) {
        toast.error(`ICEGATE did not answer for this Unique ID with this ICEGATE ID - it was not kept on the job. Check the ID, or pick the ICEGATE ID the ${documentKind} was sent with.`, { duration: 9000 });
        return;
      }
      onResult?.(answer);
      if (answer.state === 'error') toast.error('Could not ask ICEGATE: ' + (answer.message || 'no answer'));
      else if (answer.state === 'accepted') toast.success(`${documentKind} ${answer.beNo || answer.sbNo || answer.job?.beNo || answer.job?.sbNo || ''} accepted by ICES`);
      else if (answer.state === 'rejected') toast.error(`ICEGATE rejected the ${documentKind}: ${answer.errors.length} error(s)`);
      else toast(answer.message || 'No final answer yet - try again in a few minutes', { icon: '⏳' });
    } catch (error) {
      toast.error(error.response ? (error.response.data?.error || 'ICEGATE did not answer') : 'Could not ask ICEGATE: ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const cannotAsk = busy || (!knownUniqueId && !typedUniqueId.trim());
  const description = `Unique ID ${knownUniqueId || '-'}${reply?.senderId ? ` · asked as ${reply.senderId}` : ''}${reply?.at ? ` · last asked ${new Date(reply.at).toLocaleString('en-GB')}` : ''}`;
  const defaultIdLabel = knownUniqueId ? `The ICEGATE ID the ${documentKind} was sent with` : 'Default ICEGATE ID';
  const profileOptions = profiles.map((profile) => ({ value: String(profile.id), label: `${profile.loginId}${profile.profileName ? ' - ' + profile.profileName : ''}` }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnOutside={!busy}
      title="ICEGATE reply (acknowledgement)"
      description={description}
      width={640}
      footer={(
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="default" onClick={askIcegate} disabled={cannotAsk}>
            <RefreshCw className={cn(busy && 'tw:animate-spin')} /> {busy ? 'Asking ICEGATE…' : 'Ask ICEGATE now'}
          </Button>
        </>
      )}
    >
      {!knownUniqueId && (
        <div className="tw:grid tw:gap-1.5 tw:rounded-md tw:bg-warning/10 tw:px-2.5 tw:py-2 tw:text-entry tw:text-warning">
          <div>
            No ICEGATE Unique ID on this job. If the {documentKind} was sent to ICEGATE, type the Unique ID from the ICEGATE mail (for example
            120823330511717112026{documentKind === 'SB' ? 'CACHE01' : 'CACHI01'}) and pick the ICEGATE ID it was sent with. A {documentKind} filed by
            file upload has no Unique ID - read the ICEGATE mail / portal.
          </div>
          <Input value={typedUniqueId} onChange={(event) => setTypedUniqueId(event.target.value.replace(/\s+/g, ''))} placeholder="Unique ID from the ICEGATE mail"
            aria-label="Unique ID" className="tw:h-[30px] tw:border-warning/50" />
        </div>
      )}
      <Field label="Ask as">
        <SelectBox value={askAs} onValueChange={setAskAs} options={profileOptions} placeholder={defaultIdLabel} clearable clearLabel={defaultIdLabel} />
      </Field>
      {reply && <AnswerBox reply={reply} kind={documentKind} />}
      {!reply && knownUniqueId && (
        <div className="tw:text-entry tw:text-muted-foreground">No answer stored yet. Click "Ask ICEGATE now" - ICES usually answers within a few minutes of filing.</div>
      )}
      <div className="tw:text-[11px] tw:text-muted-foreground">
        Pending states ("validation in progress", "acknowledgment generation in progress") mean ask again later. "DSC validation failed" or "rejected
        during system validation" mean the file itself was refused - fix and send again. A rejection with error codes: correct the job and send a fresh {documentKind}.
      </div>
    </Modal>
  );
}
