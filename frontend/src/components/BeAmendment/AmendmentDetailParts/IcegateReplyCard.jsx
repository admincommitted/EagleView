import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { MODE_LABEL } from '../beAmendApi';
import StatusChip from '../StatusChip';
import DetailCard from './DetailCard';

export default function IcegateReplyCard({ amendment, busy, onReply }) {
  const [replyText, setReplyText] = useState('');
  const reply = async (status) => { if (await onReply(status, replyText)) setReplyText(''); };

  return (
    <DetailCard title="ICEGATE">
      <div>
        {MODE_LABEL[amendment.transferMode] || amendment.transferMode} · {amendment.submittedAt ? new Date(amendment.submittedAt).toLocaleString('en-GB') : ''} by {amendment.submittedBy || ''}
        {amendment.mailTo ? ' · to ' + amendment.mailTo : ''}
      </div>
      {amendment.ackStatus && <div className="tw:flex tw:items-center tw:gap-1.5">Reply: <StatusChip status={amendment.ackStatus} /> {amendment.ackText}</div>}
      <div className="tw:flex tw:flex-wrap tw:gap-1.5">
        <Input className="tw:min-w-[180px] tw:flex-1" placeholder="ICEGATE reply / remarks" value={replyText} onChange={(event) => setReplyText(event.target.value)} />
        <Button disabled={Boolean(busy)} onClick={() => reply('Accepted')}>Accepted</Button>
        <Button variant="destructive" disabled={Boolean(busy)} onClick={() => reply('Rejected')}>Rejected</Button>
      </div>
    </DetailCard>
  );
}
