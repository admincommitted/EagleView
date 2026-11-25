import { useCallback, useEffect, useState } from 'react';

/** Loads the report for the period; each report keeps its last rows, `meta` is the answer of the last load. */
export default function useReportData(report, from, to) {
  const [rowsByReport, setRowsByReport] = useState({});
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (report.embedded) return;
    setLoading(true);
    setError('');
    try {
      const result = await report.load({ from, to });
      setRowsByReport((current) => ({ ...current, [report.id]: result.rows }));
      setMeta({ ...result.meta, kind: report.id });
    } catch (loadError) {
      setError(loadError.message);
      setMeta({});
      setRowsByReport((current) => ({ ...current, [report.id]: [] }));
    }
    setLoading(false);
  }, [report, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows: rowsByReport[report.id] || [], meta, loading, error, reload: load };
}
