// Query Resolution drawer (Job Query / Export Query): the ICEGATE status / unique id and the last acknowledgement (its
// message and error lines), plus the job's own remarks. The reply is saved to the job timeline (a record the team
// sees) and can be copied for the ICEGATE portal - ICES has no API that accepts a query reply, so nothing sends one.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Copy, Paperclip, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label, Textarea } from '@/components/ui';
import { jobEntryApi } from '../jobEntryApi';

const asText = (value) => (value === null || value === undefined ? '' : String(value));
const CARD = 'tw:rounded-lg tw:border tw:border-input tw:p-4 tw:text-entry';
const SECTION_LABEL = 'tw:text-entry tw:font-semibold tw:text-foreground';

// pulls the readable lines out of whatever the ICEGATE acknowledgement held
function ackLines(ack) {
  if (!ack) return [];
  const lines = [];
  const walk = (value, key) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) { value.forEach((entry) => walk(entry, key)); return; }
    if (typeof value === 'object') { Object.entries(value).forEach(([childKey, entry]) => walk(entry, childKey)); return; }
    const text = asText(value).trim();
    if (!text || text === 'null') return;
    if (/message|error|status|remark|reason|description|desc/i.test(asText(key))) lines.push((/error/i.test(asText(key)) ? '⚠ ' : '') + text);
  };
  walk(ack.meta || ack, '');
  return [...new Set(lines)].slice(0, 30);
}

const answerOrNull = async (request) => {
  try {
    return await request;
  } catch {
    return null;
  }
};

export default function QueryResolutionDrawer({ isOpen, onClose, job, module = 'IMPORT' }) {
  const [replyText, setReplyText] = useState('');
  const [ack, setAck] = useState(null);
  const [remarks, setRemarks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const jobId = job?.id;

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    const [ackAnswer, timeline] = await Promise.all([
      module === 'IMPORT' ? answerOrNull(jobEntryApi.icegateAck('BE', jobId)) : null,
      answerOrNull(jobEntryApi.jobTimeline(module, jobId)),
    ]);
    if (ackAnswer?.success) setAck(ackAnswer);
    if (timeline) setRemarks(Array.isArray(timeline.data) ? timeline.data : []);
    setLoading(false);
  }, [jobId, module]);

  useEffect(() => {
    if (!isOpen) return;
    setReplyText('');
    setAck(null);
    setRemarks([]);
    load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const status = asText(ack?.icegateStatus || job?.icegateStatus);
  const lines = ackLines(ack?.ack);
  const queryRemarks = remarks.filter((remark) => /QUERY|REMARK/i.test(asText(remark.eventType)));

  const saveReply = async () => {
    const message = replyText.trim();
    if (!message) { toast.error('Type the reply first'); return; }
    if (!jobId) { toast.error('Open the job from the list first'); return; }
    setBusy(true);
    try {
      const answer = await jobEntryApi.addTimelineEntry({ jobId: String(jobId), module, eventType: 'REMARK', message: 'Query reply: ' + message });
      if (answer?.success === false) throw new Error(answer.error || 'not saved');
      toast.success('Saved to the job timeline');
      setReplyText('');
      load();
    } catch (error) {
      toast.error('Could not save: ' + errorMessage(error));
    }
    setBusy(false);
  };

  const copyReply = async () => {
    const message = replyText.trim();
    if (!message) { toast.error('Type the reply first'); return; }
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Reply copied - paste it in the ICEGATE query reply box');
    } catch {
      toast.error('Could not copy - select the text and copy it');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="tw:top-0 tw:right-0 tw:left-auto tw:h-screen tw:max-h-screen tw:w-[460px] tw:max-w-full tw:translate-x-0 tw:translate-y-0 tw:rounded-none tw:border-y-0 tw:border-r-0 tw:uppercase tw:sm:max-w-full"
      >
        <DialogHeader className="tw:flex-row tw:items-center tw:justify-between tw:bg-page tw:p-4 tw:pr-12">
          <DialogTitle className="tw:flex tw:items-center tw:gap-2 tw:text-base tw:font-semibold">
            <AlertTriangle className="tw:size-[18px] tw:text-destructive" /> Query Resolution
          </DialogTitle>
          <DialogDescription className="tw:sr-only">ICEGATE answer and remarks of the job</DialogDescription>
          <Button variant="ghost" size="icon" title="Reload" aria-label="Reload" onClick={load}><RefreshCw /></Button>
        </DialogHeader>

        <DialogBody className="tw:gap-5 tw:p-5">
          <div className={cn(CARD, 'tw:bg-page')}>
            <div className="tw:mb-1.5 tw:font-semibold tw:text-foreground">Job {asText(job?.jobNo) || '-'}{job?.beNo ? ' | BE ' + job.beNo : ''}</div>
            <div className="tw:text-muted-foreground">
              ICEGATE status: <strong>{status || 'not filed through the API'}</strong>
              {ack?.uniqueId && <> &nbsp;|&nbsp; Unique id: <strong>{ack.uniqueId}</strong></>}
              {ack?.at && <> &nbsp;|&nbsp; last answer {new Date(ack.at).toLocaleString('en-GB')}</>}
            </div>
          </div>

          <div className="tw:flex tw:flex-col tw:gap-2">
            <span className={SECTION_LABEL}>Last ICEGATE answer</span>
            <div className={cn(CARD, lines.length ? 'tw:border-destructive/30 tw:bg-destructive/5 tw:text-destructive' : 'tw:bg-background tw:text-muted-foreground')}>
              {loading ? 'Loading...' : lines.length ? (
                <ul className="tw:m-0 tw:pl-4 tw:leading-normal">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
              ) : 'No acknowledgement stored for this job. An assessment query raised by the officer comes by e-mail / on the ICEGATE portal, not through the filing API - record it below so the team can see it.'}
            </div>
          </div>

          {queryRemarks.length > 0 && (
            <div className="tw:flex tw:flex-col tw:gap-2">
              <span className={SECTION_LABEL}>Job remarks</span>
              <div className="tw:flex tw:flex-col tw:gap-1.5">
                {queryRemarks.slice(-8).map((remark) => (
                  <div key={remark.id} className={cn(CARD, 'tw:bg-background tw:px-2.5 tw:py-2')}>
                    <div className="tw:whitespace-pre-wrap tw:text-foreground">{asText(remark.message)}</div>
                    <div className="tw:mt-1 tw:text-[10px] tw:text-muted-foreground">{asText(remark.author)} | {remark.createdAt ? new Date(remark.createdAt).toLocaleString('en-GB') : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="tw:flex tw:flex-col tw:gap-2">
            <Label htmlFor="query-reply" className={SECTION_LABEL}>Your reply / note</Label>
            <Textarea
              id="query-reply"
              className="tw:min-h-[120px] tw:p-3"
              placeholder="What was asked and what is being answered - saved on the job and copied for the ICEGATE reply box"
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
            />
          </div>

          <div className={cn(CARD, 'tw:flex tw:items-start tw:gap-2 tw:border-dashed tw:bg-background tw:text-muted-foreground')}>
            <Paperclip className="tw:mt-px tw:size-4 tw:shrink-0" />
            <span>Documents asked for in a query are uploaded as e-Sanchit documents (Job Entry &gt; e-Sanchit), so that their IRN goes with the BE. There is no separate upload here.</span>
          </div>
        </DialogBody>

        <DialogFooter className="tw:flex-wrap tw:p-4">
          <Button size="lg" onClick={onClose}>Close</Button>
          <Button size="lg" onClick={copyReply}><Copy /> Copy reply</Button>
          <Button size="lg" variant="success" onClick={saveReply} disabled={busy}><Save /> {busy ? 'Saving...' : 'Save to job'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
