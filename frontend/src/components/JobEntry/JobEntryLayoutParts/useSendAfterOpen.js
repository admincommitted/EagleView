import { useEffect, useRef, useState } from 'react';

const SETTLE_DELAY_MS = 1500;

// Send to ICEGATE needs the job on the screen (save + checks first): a send asked for a job that is not open yet waits
// until that job has opened, then uses the Send of the latest screen state.
export function useSendAfterOpen(jobData, startIcegateSend) {
  const [waitingJobId, setWaitingJobId] = useState(null);
  const latestSend = useRef(startIcegateSend);
  latestSend.current = startIcegateSend;

  useEffect(() => {
    if (!waitingJobId || String(jobData.id) !== String(waitingJobId)) return;
    setWaitingJobId(null);
    setTimeout(() => latestSend.current?.(), SETTLE_DELAY_MS);
  }, [waitingJobId, jobData]);

  return setWaitingJobId;
}
