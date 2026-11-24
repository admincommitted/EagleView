// Printable reports for "Get Report" (28-Oct-2026): duty sheet, invoice / item annexure, supporting documents.
// Duty figures use computeItemDuty, the same estimate as 4. Items and the E-Annex checklist.
import React from 'react';
import { computeItemDuty } from '../../ItemGridTabParts/helpers';

const F = { fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '9pt', color: '#000' };
const cell = { border: '1px solid #475569', padding: '3px 5px', verticalAlign: 'top' };
const head = { ...cell, background: '#e2e8f0', fontWeight: 700, textAlign: 'left' };
const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
const fmt = (v, d = 2) => num(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || ''); };
const invNoOf = (inv) => inv.invNo || inv.invoiceNo || '';
const invSrOf = (inv, i) => String(inv.invoiceSrNo || inv.invSrNo || i + 1);
const itemInvSr = (it) => String(it.invSrNo || it.invoiceSrNo || 1);

export function ReportHeader({ title, jobData }) {
  const j = jobData || {};
  const rows = [
    ['Job No', j.jobNo && j.jobNo !== 'DRAFT' ? j.jobNo : 'DRAFT', 'Job Date', dmy(j.jobDate)],
    ['Importer', j.nameOfImporter || j.autoField_4 || '', 'IEC', j.iecCode || j.autoField_5 || ''],
    ['B/E No', j.beNo || '', 'B/E Date', dmy(j.beDate)],
    ['MAWB / BL', j.mawbNo || j.mawbblNo || '', 'HAWB / HBL', j.hawbNo || j.hawbhblNo || ''],
    ['IGM No', j.igmNumber || j.igmNo || '', 'Port', j.branchCode || j.portCode || ''],
  ];
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12pt', marginBottom: '6px', textTransform: 'uppercase' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
        {rows.map((r, i) => <tr key={i}>
          <td style={{ ...cell, fontWeight: 700, width: '14%', background: '#f8fafc' }}>{r[0]}</td><td style={{ ...cell, width: '36%' }}>{r[1]}</td>
          <td style={{ ...cell, fontWeight: 700, width: '14%', background: '#f8fafc' }}>{r[2]}</td><td style={{ ...cell, width: '36%' }}>{r[3]}</td>
        </tr>)}
      </tbody></table>
    </div>
  );
}

export function DutySheetReport({ jobData, items }) {
  const invoices = jobData?.invoices || [];
  const rows = (items || []).map(it => ({ it, d: computeItemDuty(it, invoices, jobData || {}) }));
  const tot = (k) => rows.reduce((s, r) => s + (r.d[k] || 0), 0);
  const missingRate = rows.some(r => !r.d.rateFound);
  return (
    <div style={F}>
      <ReportHeader title="Item-wise Duty Sheet (Estimate)" jobData={jobData} />
      {missingRate && <div className="no-print" style={{ border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', padding: '4px 8px', marginBottom: '6px' }}>Exchange rate missing for some invoices - assessable value may be wrong.</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Inv/Item', 'Description', 'CTH', 'Qty', 'Ass. Value', 'BCD %', 'BCD', 'SWS', 'IGST %', 'IGST', 'Other', 'Total Duty'].map(h => <th key={h} style={{ ...head, textAlign: ['Description', 'CTH', 'Inv/Item'].includes(h) ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(({ it, d }, i) => {
            let igRate = ''; try { const g = typeof it.igstData === 'string' ? JSON.parse(it.igstData) : it.igstData; igRate = g && g.rate != null ? g.rate : ''; } catch (e) { /* none */ }
            return <tr key={i}>
              <td style={cell}>{itemInvSr(it)}/{it.itemSrNo || it.itemNo || i + 1}</td>
              <td style={cell}>{String(it.desc || it.productDescription || '').slice(0, 120)}</td>
              <td style={cell}>{it.ritc || it.hsCode || it.cth || ''}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{fmt(it.qty || it.quantity, 3)} {it.uqc || it.unit || ''}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{fmt(d.av)}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{it.bcdRate ?? ''}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{fmt(d.bcd)}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{fmt(d.sws)}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{igRate}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{fmt(d.igst)}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{fmt(d.health + d.add + d.other)}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{fmt(d.total)}</td>
            </tr>;
          })}
          {rows.length === 0 && <tr><td colSpan={12} style={{ ...cell, textAlign: 'center' }}>No items in this job</td></tr>}
        </tbody>
        {rows.length > 0 && <tfoot><tr style={{ fontWeight: 700, background: '#f1f5f9' }}>
          <td style={cell} colSpan={4}>TOTAL ({rows.length} items)</td>
          <td style={{ ...cell, textAlign: 'right' }}>{fmt(tot('av'))}</td><td style={cell} />
          <td style={{ ...cell, textAlign: 'right' }}>{fmt(tot('bcd'))}</td>
          <td style={{ ...cell, textAlign: 'right' }}>{fmt(tot('sws'))}</td><td style={cell} />
          <td style={{ ...cell, textAlign: 'right' }}>{fmt(tot('igst'))}</td>
          <td style={{ ...cell, textAlign: 'right' }}>{fmt(tot('health') + tot('add') + tot('other'))}</td>
          <td style={{ ...cell, textAlign: 'right' }}>{fmt(tot('total'))}</td>
        </tr></tfoot>}
      </table>
      <div style={{ marginTop: '6px', fontSize: '8pt', color: '#475569' }}>Estimate only. Final duty is as assessed by Customs (ICES).</div>
    </div>
  );
}

export function AnnexureReport({ jobData, items }) {
  const invoices = jobData?.invoices || [];
  const groups = invoices.length ? invoices.map((inv, i) => ({ inv, sr: invSrOf(inv, i), list: (items || []).filter(it => itemInvSr(it) === invSrOf(inv, i)) }))
    : [{ inv: {}, sr: '1', list: items || [] }];
  const orphan = (items || []).filter(it => invoices.length && !invoices.some((inv, i) => invSrOf(inv, i) === itemInvSr(it)));
  if (orphan.length) groups.push({ inv: { invNo: '(no matching invoice)' }, sr: '-', list: orphan });
  return (
    <div style={F}>
      <ReportHeader title="Invoice & Item Annexure" jobData={jobData} />
      {groups.map((g, gi) => {
        const total = g.list.reduce((s, it) => s + (num(it.qty || it.quantity) * num(it.price || it.unitPrice) || num(it.value)), 0);
        return (
          <div key={gi} style={{ marginBottom: '10px', breakInside: 'avoid-page' }}>
            <div style={{ fontWeight: 700, background: '#1e3a5f', color: '#fff', padding: '3px 6px' }}>
              Invoice {g.sr}: {invNoOf(g.inv)} {g.inv.invDate || g.inv.invoiceDate ? `Dt. ${dmy(g.inv.invDate || g.inv.invoiceDate)}` : ''} &nbsp; | &nbsp; {g.inv.currency || ''} {g.inv.value || g.inv.invValue ? fmt(g.inv.value || g.inv.invValue) : ''} &nbsp; {g.inv.terms || g.inv.termsOfInvoice || ''}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Item', 'Description', 'CTH', 'Qty', 'UQC', 'Unit Price', 'Amount', 'Country of Origin'].map(h => <th key={h} style={{ ...head, textAlign: ['Qty', 'Unit Price', 'Amount'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {g.list.map((it, i) => <tr key={i}>
                  <td style={cell}>{it.itemSrNo || it.itemNo || i + 1}</td>
                  <td style={cell}>{it.desc || it.productDescription || ''}</td>
                  <td style={cell}>{it.ritc || it.hsCode || it.cth || ''}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{fmt(it.qty || it.quantity, 3)}</td>
                  <td style={cell}>{it.uqc || it.unit || ''}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{fmt(it.price || it.unitPrice, 4)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{fmt(num(it.qty || it.quantity) * num(it.price || it.unitPrice) || num(it.value))}</td>
                  <td style={cell}>{it.countryOfOrigin || it.coo || jobData?.countryOfOrigin || ''}</td>
                </tr>)}
                {g.list.length === 0 && <tr><td colSpan={8} style={{ ...cell, textAlign: 'center' }}>No items</td></tr>}
              </tbody>
              {g.list.length > 0 && <tfoot><tr style={{ fontWeight: 700, background: '#f1f5f9' }}><td style={cell} colSpan={6}>Invoice total ({g.list.length} items)</td><td style={{ ...cell, textAlign: 'right' }}>{fmt(total)}</td><td style={cell} /></tr></tfoot>}
            </table>
          </div>
        );
      })}
    </div>
  );
}

export function SupportingDocsReport({ jobData, docs }) {
  const list = docs || [];
  return (
    <div style={F}>
      <ReportHeader title="Supporting Documents (e-Sanchit)" jobData={jobData} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['#', 'Doc Code', 'IRN', 'DRN', 'Document / File', 'Issued By', 'Issue Date', 'Expiry'].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
        <tbody>
          {list.map((d, i) => <tr key={i}>
            <td style={cell}>{i + 1}</td><td style={cell}>{d.docCode || d.documentTypeCode || ''}</td><td style={cell}>{d.irn || ''}</td><td style={cell}>{d.drn || ''}</td>
            <td style={cell}>{d.fileName || d.docName || ''}</td><td style={cell}>{d.issuerName || ''}</td><td style={cell}>{dmy(d.issueDate)}</td><td style={cell}>{dmy(d.expiryDate)}</td>
          </tr>)}
          {list.length === 0 && <tr><td colSpan={8} style={{ ...cell, textAlign: 'center' }}>No supporting documents uploaded for this job</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---- more reports for the Report list (28-Oct-2026) ----
const jsonList = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
const jsonObj = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } } return v && typeof v === 'object' ? v : {}; };
const T = ({ cols, rows, empty, foot, align = {} }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead><tr>{cols.map(c => <th key={c} style={{ ...head, textAlign: align[c] || 'left' }}>{c}</th>)}</tr></thead>
    <tbody>
      {rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} style={{ ...cell, textAlign: align[cols[j]] || 'left' }}>{v}</td>)}</tr>)}
      {rows.length === 0 && <tr><td colSpan={cols.length} style={{ ...cell, textAlign: 'center' }}>{empty}</td></tr>}
    </tbody>
    {foot && rows.length > 0 && <tfoot><tr style={{ fontWeight: 700, background: '#f1f5f9' }}>{foot.map((v, j) => <td key={j} style={{ ...cell, textAlign: align[cols[j]] || 'left' }}>{v}</td>)}</tr></tfoot>}
  </table>
);
const rightCols = (...c) => Object.fromEntries(c.map(x => [x, 'right']));

// Invoice-wise checklist: per invoice its header, items and the duty of those items
export function InvoiceWiseChecklistReport({ jobData, items }) {
  const invoices = jobData?.invoices || [];
  const groups = invoices.length ? invoices.map((inv, i) => ({ inv, sr: invSrOf(inv, i), list: (items || []).filter(it => itemInvSr(it) === invSrOf(inv, i)) })) : [{ inv: {}, sr: '1', list: items || [] }];
  let grand = { av: 0, duty: 0 };
  return (
    <div style={F}>
      <ReportHeader title="Invoice-wise Checklist" jobData={jobData} />
      {groups.map((g, gi) => {
        const rows = g.list.map((it, i) => ({ it, i, d: computeItemDuty(it, invoices, jobData || {}) }));
        const av = rows.reduce((s, r) => s + r.d.av, 0), duty = rows.reduce((s, r) => s + r.d.total, 0);
        grand = { av: grand.av + av, duty: grand.duty + duty };
        const inv = g.inv;
        return (
          <div key={gi} style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, background: '#1e3a5f', color: '#fff', padding: '3px 6px' }}>Invoice {g.sr}: {invNoOf(inv)} {inv.invDate || inv.invoiceDate ? `Dt. ${dmy(inv.invDate || inv.invoiceDate)}` : ''}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}><tbody><tr>
              {[['Supplier', inv.supplierName || jobData?.supplierName || ''], ['Currency', inv.currency || ''], ['Inv. Value', inv.value || inv.invValue ? fmt(inv.value || inv.invValue) : ''], ['Terms', inv.terms || inv.termsOfInvoice || ''],
                ['Freight', inv.freight ? fmt(inv.freight) : ''], ['Insurance', inv.insurance ? fmt(inv.insurance) : ''], ['Misc', inv.miscCharges ? fmt(inv.miscCharges) : '']].map(([k, v]) =>
                <td key={k} style={{ ...cell, fontSize: '8.5pt' }}><b>{k}:</b> {v || '-'}</td>)}
            </tr></tbody></table>
            <T cols={['Item', 'Description', 'CTH', 'Qty / UQC', 'Ass. Value', 'BCD', 'SWS', 'IGST', 'Total Duty']} align={rightCols('Ass. Value', 'BCD', 'SWS', 'IGST', 'Total Duty')}
              rows={rows.map(({ it, i, d }) => [it.itemSrNo || it.itemNo || i + 1, String(it.desc || it.productDescription || '').slice(0, 100), it.ritc || it.hsCode || it.cth || '', `${fmt(it.qty || it.quantity, 3)} ${it.uqc || it.unit || ''}`, fmt(d.av), fmt(d.bcd), fmt(d.sws), fmt(d.igst), fmt(d.total)])}
              foot={['', `Invoice total (${rows.length} items)`, '', '', fmt(av), '', '', '', fmt(duty)]} empty="No items in this invoice" />
          </div>
        );
      })}
      <div style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid #000', paddingTop: '4px' }}>Grand total - Ass. Value: {fmt(grand.av)} &nbsp;&nbsp; Duty (estimate): {fmt(grand.duty)}</div>
    </div>
  );
}

export function ClassificationReport({ jobData, items }) {
  const list = items || [];
  return (
    <div style={F}>
      <ReportHeader title="Classification Details" jobData={jobData} />
      <T cols={['Inv/Item', 'Description', 'CTH (RITC)', 'BCD Notn / Sr', 'BCD %', 'IGST Notn / Sr', 'IGST %', 'Country of Origin']} align={rightCols('BCD %', 'IGST %')}
        rows={list.map((it, i) => { const g = jsonObj(it.igstData); return [`${itemInvSr(it)}/${it.itemSrNo || it.itemNo || i + 1}`, it.desc || it.productDescription || '', it.ritc || it.hsCode || it.cth || '',
          [it.bcdNotificationNo || it.bcdNotification, it.bcdSrNo || it.bcdNotificationSrNo].filter(Boolean).join(' / ') || '-', it.bcdRate ?? '', [g.notnNo, g.srNo].filter(Boolean).join(' / ') || '-', g.rate ?? '', it.countryOfOrigin || it.coo || jobData?.countryOfOrigin || '']; })}
        empty="No items in this job" />
    </div>
  );
}

export function ExemptionReport({ jobData, items }) {
  const rows = [];
  (items || []).forEach((it, i) => {
    const tag = `${itemInvSr(it)}/${it.itemSrNo || it.itemNo || i + 1}`, cth = it.ritc || it.hsCode || it.cth || '', desc = String(it.desc || it.productDescription || '').slice(0, 80);
    if (it.bcdNotificationNo || it.bcdNotification) rows.push([tag, cth, desc, 'BCD', it.bcdNotificationNo || it.bcdNotification, it.bcdSrNo || it.bcdNotificationSrNo || '', it.bcdRate ?? '']);
    const g = jsonObj(it.igstData); if (g.notnNo) rows.push([tag, cth, desc, 'IGST', g.notnNo, g.srNo || '', g.rate ?? '']);
    const a = jsonObj(it.addData); if (a.notnNo || a.notificationNo) rows.push([tag, cth, desc, 'ADD', a.notnNo || a.notificationNo, a.srNo || a.notificationSrNo || '', a.rate ?? '']);
    Object.entries(jsonObj(it.otherDutyData)).filter(([k, v]) => /_notificationNo$|_notnNo$/.test(k) && v).forEach(([k, v]) => rows.push([tag, cth, desc, k.split('_')[0].toUpperCase(), v, jsonObj(it.otherDutyData)[k.replace(/No$/, 'SrNo')] || '', '']));
  });
  return (
    <div style={F}>
      <ReportHeader title="Duty Exemption / Notification Details" jobData={jobData} />
      <T cols={['Inv/Item', 'CTH', 'Description', 'Duty', 'Notification', 'Sr No', 'Rate %']} align={rightCols('Rate %')} rows={rows} empty="No exemption notification claimed on any item" />
    </div>
  );
}

export function InvoiceParticularsReport({ jobData }) {
  const invoices = jobData?.invoices || [];
  const rateOf = (cur, inv) => { const x = exRateOf(cur, jobData, inv); return x ? fmt(x, 4) : ''; };
  return (
    <div style={F}>
      <ReportHeader title="Invoice Particulars" jobData={jobData} />
      <T cols={['Sr', 'Invoice No', 'Date', 'Supplier', 'Terms', 'Currency', 'Ex. Rate', 'Invoice Value', 'Freight', 'Insurance', 'Misc']} align={rightCols('Ex. Rate', 'Invoice Value', 'Freight', 'Insurance', 'Misc')}
        rows={invoices.map((inv, i) => [invSrOf(inv, i), invNoOf(inv), dmy(inv.invDate || inv.invoiceDate), inv.supplierName || jobData?.supplierName || '', inv.terms || inv.termsOfInvoice || '', inv.currency || '',
          rateOf(inv.currency, inv), fmt(inv.value || inv.invValue), fmt(inv.freight), fmt(inv.insurance), fmt(inv.miscCharges)])}
        empty="No invoices in this job" />
    </div>
  );
}

export function IgmDetailsReport({ jobData }) {
  const j = jobData || {};
  const rows = jsonList(j._igmRows);
  const main = [['IGM No', j.igmNumber || j.igmNo || ''], ['IGM Date', dmy(j.igmDate)], ['Inward Date', dmy(j.inwardDate)], ['Port / Gateway', j.portCode || j.branchCode || ''], ['Flight / Voyage', j.flightVoyage || ''],
    ['MAWB / MBL No', j.mawbNo || ''], ['MAWB Date', dmy(j.mawbDate)], ['HAWB / HBL No', j.hawbNo || ''], ['HAWB Date', dmy(j.hawbDate)], ['Packages', [j.totalPkg || j.pkg, j.pkgType].filter(Boolean).join(' ')],
    ['Gross Weight', [j.grossWt, j.grossWtUnit].filter(Boolean).join(' ')], ['Chargeable Wt', j.chargableWeight || ''], ['Marks & Nos', j.marksAndNumbers1 || '']];
  return (
    <div style={F}>
      <ReportHeader title="IGM Details" jobData={jobData} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}><tbody>
        {main.map(([k, v]) => <tr key={k}><td style={{ ...cell, fontWeight: 700, width: '28%', background: '#f8fafc' }}>{k}</td><td style={cell}>{v || '-'}</td></tr>)}
      </tbody></table>
      {rows.length > 0 && <T cols={['#', 'IGM No', 'IGM Date', 'Inward Date', 'Gateway', 'MAWB', 'HAWB', 'Pkgs', 'Gross Wt']} align={rightCols('Pkgs', 'Gross Wt')}
        rows={rows.map((r, i) => [i + 1, r.igmNo || r.igmNumber || '', dmy(r.igmDate), dmy(r.inwardDate), r.gatewayPort || r.portCode || '', r.mawbNo || '', r.hawbNo || '', r.pkg || r.totalPkg || '', r.grossWt || ''])} empty="" />}
    </div>
  );
}

export function ContainerReport({ jobData }) {
  const list = jsonList(jobData?.containers);
  return (
    <div style={F}>
      <ReportHeader title="Container Details" jobData={jobData} />
      <T cols={['#', 'Container No', 'Size', 'Type', 'LCL / FCL', 'Seal No', 'IGM No', 'IGM Date']} rows={list.map((c, i) => [c.srNo || i + 1, c.contNo || '', c.contSize || '', c.contType || '', c.lclFcl || '', c.sealNo || '', c.igmNo || '', dmy(c.igmDate)])}
        empty="No containers in this job (air shipment or not entered)" />
    </div>
  );
}

export function BondReport({ jobData }) {
  const j = jobData || {};
  let list = jsonList(j._bondRows).filter(b => b && (b.bondNo || b.bondCode));
  if (!list.length && (j.bondNo || j.autoField_24)) list = [{ bondNo: j.bondNo || j.autoField_24, bondCode: j.autoField_26, bondPort: j.autoField_27, bondType: j.bondType, bondAmt: j.bondAmount }];
  return (
    <div style={F}>
      <ReportHeader title="Bond Details" jobData={jobData} />
      <div style={{ marginBottom: '6px' }}><b>B/E Type:</b> {j.boeType || 'HOME'} {j.warehouseCode ? <>&nbsp; <b>Warehouse:</b> {j.warehouseCode}</> : null}</div>
      <T cols={['#', 'Bond No', 'Bond Code', 'Bond Type', 'Port', 'Amount']} align={rightCols('Amount')}
        rows={list.map((b, i) => [i + 1, b.bondNo || '', b.bondCode || b.bond || '', b.bondType || '', b.bondPort || '', b.bondAmt || b.bondAmount ? fmt(b.bondAmt || b.bondAmount) : ''])}
        empty="No bond in this job (bond is needed only for Warehouse B/E)" />
    </div>
  );
}

// exchange rate of a currency for this job (same source as the duty estimate: job exchange rates, else invoice rate)
export function exRateOf(cur, jobData, inv = {}) {
  const c = String(cur || '').trim().toUpperCase();
  if (!c || c === 'INR') return 1;
  const r = jsonList(jobData?._exchangeRates).find(x => String(x.currencyCode || '').toUpperCase() === c);
  if (r) return num(r.rate) / (num(r.unitInRs) || 1);
  return num(inv.exRate || inv.exchangeRate) || 0;
}

// CHA Checklist: job totals, then per invoice the items with assessable value and each duty (28-Oct-2026)
export function ChaChecklistReport({ jobData, items }) {
  const j = jobData || {};
  const invoices = j.invoices || [];
  const groups = invoices.length ? invoices.map((inv, i) => ({ inv, sr: invSrOf(inv, i), list: (items || []).filter(it => itemInvSr(it) === invSrOf(inv, i)) })) : [{ inv: {}, sr: '1', list: items || [] }];
  const all = groups.flatMap(g => g.list.map(it => computeItemDuty(it, invoices, j)));
  const totAv = all.reduce((s, d) => s + d.av, 0), totDuty = all.reduce((s, d) => s + d.total, 0);
  const conts = jsonList(j.containers).length;
  const c = { ...cell, fontSize: '8pt' }, h = { ...head, fontSize: '8pt', verticalAlign: 'bottom' }, r = { ...c, textAlign: 'right' };
  const pct = (v) => (String(v ?? '').trim() === '' ? '' : `${fmt(v)} %`);
  const H = ['Item No', 'Item Details', 'Unit Price', 'Qty', 'UQC', 'Assess Value', 'CTH', 'CETH', 'BCD Rate', 'BCD (Rs)', 'SWS Rate', 'SWS (Rs)', 'IGST Rate', 'IGST (Rs)', 'Other Duty (Rs)', 'Total Duty (Rs)'];
  const lab = { fontWeight: 700, padding: '2px 8px 2px 0', whiteSpace: 'nowrap' }, val = { padding: '2px 18px 2px 0' };
  return (
    <div style={F}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12pt', borderBottom: '1.5px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>CHA Checklist</div>
      <table style={{ borderCollapse: 'collapse', marginBottom: '8px' }}><tbody>
        <tr><td style={lab}>Job No.</td><td style={val}>{j.jobNo && j.jobNo !== 'DRAFT' ? j.jobNo : 'DRAFT'}</td><td style={lab}>Total Value</td><td style={val}>{fmt(totAv)}</td><td style={lab}>Total Duty</td><td style={val}>{fmt(totDuty)}</td></tr>
        <tr><td style={lab}>Importer</td><td style={val} colSpan={3}>{j.nameOfImporter || j.autoField_4 || ''}</td><td style={lab}>IEC</td><td style={val}>{j.iecCode || j.autoField_5 || ''}</td></tr>
        <tr><td style={lab}>MAWB / HAWB No</td><td style={val} colSpan={3}>({j.mawbNo || 'NOMAWB'} / {j.hawbNo || '-'})</td><td style={lab}>B/E No.</td><td style={val}>{j.beNo ? `${j.beNo} Dt. ${dmy(j.beDate)}` : ''}</td></tr>
        <tr><td style={lab}>No. of Pkgs</td><td style={val}>{j.totalPkg || j.pkg || ''}</td><td style={lab}>Gross Wt.</td><td style={val}>{j.grossWt ? `${fmt(j.grossWt, 3)} ${j.grossWtUnit || ''}` : ''}</td><td style={lab}>No. of Containers</td><td style={val}>{conts || ''}</td></tr>
      </tbody></table>
      {groups.map((g, gi) => {
        const inv = g.inv, rate = exRateOf(inv.currency, j, inv);
        const rows = g.list.map((it, i) => ({ it, i, d: computeItemDuty(it, invoices, j), ig: jsonObj(it.igstData) }));
        const lic = g.list.flatMap(it => jsonList(it.licenceData).filter(x => x && x.licenceNo).map(x => ({ ...x, item: it.itemSrNo || it.itemNo })));
        return (
          <div key={gi} style={{ marginBottom: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><td colSpan={11} style={{ ...c, fontSize: '9pt', fontWeight: 700 }}>Invoice No. &amp; Date : {invNoOf(inv)}{inv.invDate || inv.invoiceDate ? ` - ${dmy(inv.invDate || inv.invoiceDate)}` : ''} &nbsp; ({inv.currency || ''} {inv.value || inv.invValue ? fmt(inv.value || inv.invValue) : ''} {inv.terms || inv.termsOfInvoice || ''})</td>
                  <td colSpan={5} style={{ ...c, fontSize: '9pt', fontWeight: 700, textAlign: 'right' }}>Exchange Rate : {rate ? fmt(rate, 4) : 'not entered'}</td></tr>
                <tr>{H.map(x => <th key={x} style={{ ...h, textAlign: ['Item No', 'Item Details', 'UQC', 'CTH', 'CETH'].includes(x) ? 'left' : 'right' }}>{x}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ it, i, d, ig }) => <tr key={i}>
                  <td style={c}>{it.itemSrNo || it.itemNo || i + 1}</td>
                  <td style={{ ...c, minWidth: '140px' }}>{it.desc || it.productDescription || ''}</td>
                  <td style={r}>{fmt(it.price || it.unitPrice, 6)}</td>
                  <td style={r}>{fmt(it.qty || it.quantity, 3)}</td>
                  <td style={c}>{it.uqc || it.unit || ''}</td>
                  <td style={r}>{fmt(d.av)}</td>
                  <td style={c}>{it.ritc || it.hsCode || it.cth || ''}</td>
                  <td style={c}>{it.ceth || it.cethCode || it.ritc || it.hsCode || it.cth || ''}</td>
                  <td style={r}>{pct(it.bcdRate)}</td><td style={r}>{fmt(d.bcd)}</td>
                  <td style={r}>{pct(String(it.swsRate ?? '').trim() === '' ? 10 : it.swsRate)}</td><td style={r}>{fmt(d.sws)}</td>
                  <td style={r}>{pct(ig.rate)}</td><td style={r}>{fmt(d.igst)}</td>
                  <td style={r}>{fmt(d.health + d.add + d.other)}</td>
                  <td style={{ ...r, fontWeight: 700 }}>{fmt(d.total)}</td>
                </tr>)}
                {rows.length === 0 && <tr><td colSpan={16} style={{ ...c, textAlign: 'center' }}>No items in this invoice</td></tr>}
              </tbody>
              {rows.length > 0 && <tfoot><tr style={{ fontWeight: 700, background: '#f1f5f9' }}>
                <td style={c} colSpan={5}>Invoice total ({rows.length} items)</td><td style={r}>{fmt(rows.reduce((s, x) => s + x.d.av, 0))}</td><td style={c} colSpan={3} />
                <td style={r}>{fmt(rows.reduce((s, x) => s + x.d.bcd, 0))}</td><td style={c} /><td style={r}>{fmt(rows.reduce((s, x) => s + x.d.sws, 0))}</td><td style={c} />
                <td style={r}>{fmt(rows.reduce((s, x) => s + x.d.igst, 0))}</td><td style={r}>{fmt(rows.reduce((s, x) => s + x.d.health + x.d.add + x.d.other, 0))}</td><td style={r}>{fmt(rows.reduce((s, x) => s + x.d.total, 0))}</td>
              </tr></tfoot>}
            </table>
            <table style={{ borderCollapse: 'collapse', marginTop: '6px', fontSize: '8.5pt' }}><tbody>
              {lic.length ? lic.map((x, k) => <tr key={k}>
                <td style={lab}>Licence No. &amp; Dt.</td><td style={val}>{x.licenceNo}{x.licenceDate ? ` - ${dmy(x.licenceDate)}` : ''}{x.licenceCode ? ` (${x.licenceCode})` : ''} &nbsp; [Item {x.item}]</td>
                <td style={lab}>Debited Value</td><td style={val}>{x.debitValue ? fmt(x.debitValue) : ''}</td>
                <td style={lab}>Debited Quantity</td><td style={val}>{x.debitQty ? `${fmt(x.debitQty, 3)} ${x.debitUqc || ''}` : ''}</td>
              </tr>) : <>
                <tr><td style={lab}>Licence No. &amp; Dt.</td><td style={val}>-</td></tr>
                <tr><td style={lab}>Debited Value</td><td style={val}>-</td></tr>
                <tr><td style={lab}>Debited Quantity</td><td style={val}>-</td></tr>
              </>}
            </tbody></table>
          </div>
        );
      })}
      <div style={{ fontSize: '7.5pt', color: '#475569' }}>Duty is our estimate from the rates entered in the job; final duty is as assessed by Customs (ICES).</div>
    </div>
  );
}
