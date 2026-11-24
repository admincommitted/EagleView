// Tab 5 "Supporting Docs": the e-Sanchit documents of the whole job (BE / invoice / item level). The screen itself is
// EsanchitDocsPanel, shared with the item popup (Items tab > Supporting Docs). 29-Oct-2026
import React from 'react';
import EsanchitDocsPanel from '../EsanchitDocsPanel';
import { useJobContext } from '../JobContext';

export default function EsanchitDocsTab() {
  const { jobData, items, esanchitDocs, setEsanchitDocs } = useJobContext();
  // IRNs kept on the items (their own popup rows) - a second entry of one of them here is refused
  const itemIrns = (items || []).flatMap(it => { let d = it.docsData; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = []; } } return (Array.isArray(d) ? d : []).map(r => r && r.irn).filter(Boolean); });
  return <EsanchitDocsPanel rows={esanchitDocs} setRows={setEsanchitDocs} jobData={jobData} otherIrns={itemIrns} />;
}
