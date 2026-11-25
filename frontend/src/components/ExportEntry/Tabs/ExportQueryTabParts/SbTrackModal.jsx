import { useState } from 'react';
import toast from 'react-hot-toast';
import { toDisplayDate } from '@/lib/dates';
import { Button, Modal } from '@/components/ui';
import { exportEntryApi } from '../../exportEntryApi';
import { findSb, sbNoOf, STAGE_TEXT } from './exportJobList';

const ANSWER_HEADS = { accepted: 'Accepted', rejected: 'REJECTED by ICEGATE', pending: 'Still pending at ICEGATE', error: 'Could not ask ICEGATE' };

const uniqueIdOf = (job) => job.icegateUniqueId || job.uniqueId;

const trackLines = (job) => {
  const sbNo = sbNoOf(job);
  return [
    ['Stage', STAGE_TEXT[job.stage] || job.stage],
    ['ICEGATE', job.icegateStatus ? `${job.icegateStatus}${job.icegateUniqueId ? ` - ${job.icegateUniqueId}` : ''}` : 'Not sent'],
    ['SB No / Date', sbNo ? `${sbNo}${job.sbDate ? ` / ${toDisplayDate(job.sbDate)}` : ''}` : 'Not received'],
    ['LEO', job.leoDate ? toDisplayDate(job.leoDate) : '-'],
  ];
};

function answerMessage(answer) {
  const sbNo = answer.sbNo || findSb(answer.meta).sbNo;
  if (sbNo) return `SB No ${sbNo}${answer.sbDate ? ` dated ${toDisplayDate(answer.sbDate)}` : ''} received from ICEGATE (asked as ${answer.senderId}).`;
  const errors = (answer.errors || []).filter((entry) => entry.text !== answer.message).map((entry) => (entry.code ? `${entry.code}: ` : '') + entry.text);
  const head = ANSWER_HEADS[answer.state] || 'ICEGATE answered';
  return `${head}${answer.message ? `: ${answer.message}` : ''} (asked as ${answer.senderId}).${errors.length ? ` Errors: ${errors.join('; ')}` : ''}`;
}

// SB Track: job stage, SB No and the ICEGATE acknowledgement of the filed SB
export default function SbTrackModal({ job: listedJob, onClose, onTimeline, onJobChanged }) {
  const [job, setJob] = useState(listedJob);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const uniqueId = uniqueIdOf(job);

  // /sb-ack asks with the ICEGATE ID the SB went out with, saves the SB No / status on the job and writes the job log
  const checkIcegate = async () => {
    if (!uniqueId) { setMessage('This SB has not been sent to ICEGATE from here (no Unique ID).'); return; }
    setChecking(true);
    setMessage('');
    try {
      const answer = await exportEntryApi.querySbAck(job.id);
      if (!answer.success) { setMessage(`ICEGATE: ${answer.error || 'no answer'}`); return; }
      const saved = answer.job || {};
      const sbNoChanged = saved.sbNo && saved.sbNo !== String(job.sbNo || '');
      setJob({ ...job, icegateStatus: saved.icegateStatus || job.icegateStatus, sbNo: saved.sbNo || job.sbNo, sbDate: saved.sbDate || job.sbDate });
      if (sbNoChanged) toast.success(`SB No ${saved.sbNo} saved on job ${job.jobNo}`);
      if (saved.icegateStatus !== job.icegateStatus || sbNoChanged) onJobChanged();
      setMessage(answerMessage(answer));
    } catch (error) {
      setMessage(`Could not reach ICEGATE: ${error.message}`);
    } finally {
      setChecking(false);
    }
  };

  const footer = (
    <>
      <Button onClick={() => { onClose(); onTimeline(job.id); }}>Timeline</Button>
      <Button variant="default" disabled={checking || !uniqueId} onClick={checkIcegate}
        title={job.icegateUniqueId ? 'Read the ICEGATE acknowledgement; a SB No found in it is saved on the job' : 'Send the SB to ICEGATE first'}>
        {checking ? 'Checking...' : 'Check on ICEGATE'}
      </Button>
    </>
  );

  return (
    <Modal open title={`SB Track - ${job.jobNo}`} width={440} onClose={onClose} footer={footer} bodyClassName="tw:gap-0">
      {trackLines(job).map(([label, value]) => (
        <div key={label} className="tw:flex tw:border-b tw:border-border tw:py-1">
          <span className="tw:w-[110px] tw:shrink-0 tw:font-semibold tw:text-muted-foreground">{label}</span>
          <span className="tw:font-semibold">{value}</span>
        </div>
      ))}
      {message && <div className="tw:mt-2.5 tw:rounded-sm tw:border tw:border-border tw:bg-page tw:p-2">{message}</div>}
    </Modal>
  );
}
