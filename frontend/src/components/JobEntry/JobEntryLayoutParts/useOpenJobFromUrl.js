import { useEffect, useRef } from 'react';

// /job-entry?openJob=<id>[&amend=1] opens that job (Customs > BE Amendments); amend=1 also opens its amendment window.
export function useOpenJobFromUrl(openJob) {
  const openJobOnce = useRef(openJob);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('openJob');
    if (!jobId) return;
    const withAmendment = params.get('amend') === '1';
    window.history.replaceState(null, '', window.location.pathname);
    openJobOnce.current(jobId, withAmendment);
  }, []);
}
