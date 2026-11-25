import { useEffect, useRef, useState } from 'react';

const SEND_DELAY_MS = 1500;
const FILE_DELAY_MS = 1200;

// The job list's "Opens the job and starts" actions: the action runs once that job is on the screen. It waits a little:
// on opening the screen fills values (FOB INR, drawback rows, Nature of Cargo, party class / branch, port names), and a
// file or a send made from the job as saved was different. what = 'send' | 'preview' | 'flat'.
export function useRunAfterOpen(exportData, { startIcegateSend, askIcegateId }) {
  const [pending, setPending] = useState(null);
  const latestActions = useRef({ startIcegateSend, askIcegateId });
  latestActions.current = { startIcegateSend, askIcegateId };

  useEffect(() => {
    if (!pending || String(exportData.id) !== String(pending.id)) return;
    const { what } = pending;
    setPending(null);
    if (what === 'send') setTimeout(() => latestActions.current.startIcegateSend(), SEND_DELAY_MS);
    else setTimeout(() => latestActions.current.askIcegateId(what), FILE_DELAY_MS);
  }, [pending, exportData]);

  return (jobId, what) => setPending({ id: jobId, what });
}
