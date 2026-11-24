// Printable reports of Export > Get Report (29-Oct-2026): same look as Import > Report (title, job box, bordered tables).
// Each report reads the job on screen (header, invoices, items, scheme rows); nothing is fetched except masters passed in.
import React from 'react';
import { claimsRodtep } from '../../Schemes/RodtepTab';
import { num as n, itemFobInr, rodtepAmount, dbkAmount, CAP_NEEDS_QTY, rodtepRowOf, rodtepRateOf, rodtepQtyOf, itemTotalPmv } from '../../Schemes/schemeUtils';
import { rateText } from '../../../../../utils/cbicExchange';

const cell = { border: '1px solid #475569', padding: '3px 5px', verticalAlign: 'top' };
const head = { ...cell, background: '#e2e8f0', fontWeight: 700, textAlign: 'left' };
const right = { ...cell, textAlign: 'right' };
const fmt = (v, d = 2) => n(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const dmy = (v) => { const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(v || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || ''); };
const arr = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
const invOf = (it) => String(it.invSr || it.invSrNo || 1);
const itmOf = (it, i) => String(it.itemSr || it.itemSrNo || i + 1);
const invNo = (inv) => inv.no || inv.invoiceNo || '';
const Empty = ({ cols, text }) => <tr><td colSpan={cols} style={{ ...cell, textAlign: 'center', color: '#64748b', padding: '10px' }}>{text}</td></tr>;

export function ExportReportHeader({ title, d }) {
  const j = d || {};
  const rows = [
    ['Job No', j.jobNo && j.jobNo !== 'DRAFT' ? j.jobNo : 'DRAFT', 'Job Date', dmy(j.jobDate)],
    ['Exporter', j.shipperName || j.exporterName || '', 'IEC', j.shipperIec || j.ieCode || ''],
    ['S/B No', j.sbNo || j.sbNumber || '', 'S/B Date', dmy(j.sbDate || j.autoField_26)],
    ['MAWB No', j.mawbNo || j.autoField_22 || '', 'HAWB No', j.hawbNo || j.autoField_24 || ''],
    ['Port of Loading', j.loadingPortCode || j.customsPortCode || j.customsPortName || '', 'Destination', [j.destPortName || j.destPortCode, j.destCountryName || j.destCountryCode].filter(Boolean).join(', ')],
  ];
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12pt', marginBottom: '6px', textTransform: 'uppercase' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
        {rows.map((r, i) => <tr key={i}>
          <td style={{ ...cell, fontWeight: 700, width: '15%', background: '#f8fafc' }}>{r[0]}</td><td style={{ ...cell, width: '35%' }}>{r[1]}</td>
          <td style={{ ...cell, fontWeight: 700, width: '15%', background: '#f8fafc' }}>{r[2]}</td><td style={{ ...cell, width: '35%' }}>{r[3]}</td>
        </tr>)}
      </tbody></table>
    </div>
  );
}
const Wrap = ({ children }) => <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '9pt', color: '#000' }}>{children}</div>;
const Note = ({ children }) => <div style={{ marginTop: '6px', fontSize: '8pt', color: '#475569' }}>{children}</div>;

// Invoice-wise checklist: each invoice with its items
export function InvoiceWiseReport({ d, items }) {
  const invs = d?.invoices || [];
  return (
    <Wrap><ExportReportHeader title="Invoice Wise Checklist" d={d} />
      {invs.length === 0 && <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody><Empty cols={1} text="No invoice in this job" /></tbody></table>}
      {invs.map((inv, k) => {
        const rows = (items || []).map((it, i) => ({ it, i })).filter(({ it }) => invOf(it) === String(k + 1));
        const tot = rows.reduce((a, { it }) => a + n(it.totalFc || it.total), 0);
        return (
          <div key={k} style={{ marginBottom: '10px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, margin: '6px 0 3px' }}>Invoice {k + 1}: {invNo(inv)} dt {dmy(inv.date || inv.invoiceDate)} - {inv.currency} {fmt(inv.value || inv.invoiceValue)} ({inv.contractType || inv.natureOfContract || ''}) - FOB ₹ {fmt(inv.invFobInr)}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={head}>Item</th><th style={head}>Scheme</th><th style={head}>RITC</th><th style={head}>Description</th><th style={head}>Qty</th><th style={head}>UQC</th><th style={head}>Rate</th><th style={head}>Value ({inv.currency || 'FC'})</th><th style={head}>FOB ₹</th></tr></thead>
              <tbody>
                {rows.map(({ it, i }) => <tr key={i}>
                  <td style={cell}>{itmOf(it, i)}</td><td style={cell}>{String(it.scheme || '').split(/[\s-]/)[0]}</td><td style={cell}>{it.ritc}</td><td style={cell}>{it.desc || it.description}</td>
                  <td style={right}>{fmt(it.qty, 3)}</td><td style={cell}>{it.unit || it.uqc}</td><td style={right}>{fmt(it.rate || it.price, 4)}</td><td style={right}>{fmt(it.totalFc || it.total)}</td><td style={right}>{fmt(itemFobInr(it))}</td>
                </tr>)}
                {rows.length === 0 && <Empty cols={9} text="No item in this invoice" />}
                <tr><td colSpan={7} style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>Items total</td><td style={{ ...right, fontWeight: 700 }}>{fmt(tot)}</td><td style={{ ...right, fontWeight: 700 }}>{fmt(rows.reduce((a, { it }) => a + itemFobInr(it), 0))}</td></tr>
              </tbody>
            </table>
            {Math.abs(tot - n(inv.value || inv.invoiceValue)) > 0.01 && <Note>⚠ Items total differs from the invoice value by {fmt(tot - n(inv.value || inv.invoiceValue))}</Note>}
          </div>);
      })}
    </Wrap>
  );
}

// RoDTEP wise checklist: claim per item with rate / cap from the RoDTEP master (estimate)
export function RodtepReport({ d, items, rodteps }) {
  // 12-Nov-2026: Appendix 4RE rate for AA / EOU / SEZ items; quantity = SW info DTY / RDT in the schedule unit
  const rateOf = (it) => rodtepRateOf(rodtepRowOf(rodteps, it), it);
  const qtyOf = (it, m) => rodtepQtyOf(it, d && d._infoTypes, m && m.uqc);
  // 30-Oct-2026: amt is null when the cap is per unit and no quantity was keyed. A printed checklist must not
  // carry a figure that was never worked out, so the cell says "qty?" and the total leaves the row out.
  const rows = (items || []).map((it, i) => { const m = rateOf(it); const on = claimsRodtep(it); const q = qtyOf(it, m); return { it, i, m, on, q, amt: on && m ? rodtepAmount({ fob: itemFobInr(it), qty: q.qty, rate: m.rate, cap: m.cap, rsPerUqc: m.rsPerUqc }) : 0 }; });
  const pendingRodtep = rows.filter(r => r.on && r.m && r.amt === null).length;
  return (
    <Wrap><ExportReportHeader title="RoDTEP Wise Checklist" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Inv/Item</th><th style={head}>RITC</th><th style={head}>Description</th><th style={head}>Qty</th><th style={head}>FOB ₹</th><th style={head}>Claim</th><th style={head}>Rate %</th><th style={head}>Cap ₹/unit</th><th style={head}>Est. RoDTEP ₹</th></tr></thead>
        <tbody>
          {rows.map(({ it, i, m, on, amt, q }) => <tr key={i}>
            <td style={cell}>{invOf(it)}/{itmOf(it, i)}</td><td style={cell}>{it.ritc}</td><td style={cell}>{it.desc}</td><td style={right}>{q.qty ? fmt(q.qty, 3) : '-'} {q.unit}</td><td style={right}>{fmt(itemFobInr(it))}</td>
            <td style={cell}>{on ? 'RODTEPY' : 'RODTEPN'}</td><td style={right}>{m ? fmt(m.rate) + (m.appendix === '4RE' ? ' (4RE)' : '') : 'n/a'}</td><td style={right}>{m && n(m.cap) ? fmt(m.cap) : '-'}</td><td style={right} title={amt === null ? CAP_NEEDS_QTY : ''}>{!on || !m ? '-' : (amt === null ? 'qty?' : fmt(amt))}</td>
          </tr>)}
          {rows.length === 0 && <Empty cols={9} text="No item" />}
          <tr><td colSpan={8} style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>Total estimated RoDTEP (claimed items){pendingRodtep > 0 ? ` - ${pendingRodtep} item(s) not worked out` : ''}</td><td style={{ ...right, fontWeight: 700 }}>{fmt(rows.reduce((a, r) => a + (r.amt === null ? 0 : r.amt), 0))}</td></tr>
        </tbody>
      </table>
      <Note>Estimate = rate % of FOB ₹, limited to cap × qty (DTY / RDT quantity in the schedule unit), from the RoDTEP master: Appendix 4R, or 4RE for exports under AA / EOU / SEZ. The amount is worked out by Customs.</Note>
    </Wrap>
  );
}

// Drawback particulars: DBK rows of Scheme > Dbk
export function DrawbackReport({ d, items, dbkItems }) {
  const rows = (dbkItems || []).map((r) => {
    const it = (items || []).find((x, i) => invOf(x) === String(r.invNo) && itmOf(x, i) === String(r.itemNo)) || {};
    // a value typed on the Scheme tab is kept; otherwise it is worked out, and null means it could not be
    const val = String(r.dbkVal || '').trim() !== '' ? n(r.dbkVal) : dbkAmount({ fob: itemFobInr(it), qty: r.dbkQty, rateAdv: r.dbkRtAdv, rateSpe: r.dbkRtSpe, cap: r.dbkCap });
    return { r, it, val };
  });
  return (
    <Wrap><ExportReportHeader title="Drawback Particulars" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Inv/Item</th><th style={head}>Description</th><th style={head}>DBK Sr No</th><th style={head}>DBK Qty</th><th style={head}>Unit</th><th style={head}>FOB ₹</th><th style={head}>Rate %</th><th style={head}>Cap ₹/unit</th><th style={head}>DBK ₹</th><th style={head}>Avail.</th></tr></thead>
        <tbody>
          {rows.map(({ r, it, val }, k) => <tr key={k}>
            <td style={cell}>{r.invNo}/{r.itemNo}</td><td style={cell}>{it.desc || ''}</td><td style={cell}>{r.dbkNo}</td><td style={right}>{fmt(r.dbkQty, 3)}</td><td style={cell}>{r.accUnit}</td>
            <td style={right}>{fmt(itemFobInr(it))}</td><td style={right}>{r.dbkRtAdv ? fmt(r.dbkRtAdv) : '-'}</td><td style={right}>{n(r.dbkCap) ? fmt(r.dbkCap) : '-'}</td><td style={right} title={val === null ? CAP_NEEDS_QTY : ''}>{val === null ? 'qty?' : fmt(val)}</td><td style={cell}>{r.drawbackAvailable || 'Y'}</td>
          </tr>)}
          {rows.length === 0 && <Empty cols={10} text="No drawback item (scheme 19) in this job" />}
          <tr><td colSpan={8} style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>Total drawback{rows.filter(x => x.val === null).length > 0 ? ` - ${rows.filter(x => x.val === null).length} row(s) not worked out` : ''}</td><td style={{ ...right, fontWeight: 700 }}>{fmt(rows.reduce((a, x) => a + (x.val === null ? 0 : x.val), 0))}</td><td style={cell} /></tr>
        </tbody>
      </table>
      <Note>Drawback ₹ as worked out on the Scheme tab (estimate); Customs works out the amount from DBK Sr No and quantity.</Note>
    </Wrap>
  );
}

export function LicenceReport({ d, licenseItems }) {
  const rows = licenseItems || [];
  return (
    <Wrap><ExportReportHeader title="Licence Particulars" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Inv/Item</th><th style={head}>Sr</th><th style={head}>Reg No</th><th style={head}>Reg Date</th><th style={head}>Sr Part E</th><th style={head}>Sr Part C</th><th style={head}>Qty</th><th style={head}>Export Qty</th><th style={head}>UQC</th><th style={head}>Ind/Imp</th><th style={head}>Licence No / Date</th><th style={head}>Type</th></tr></thead>
        <tbody>
          {rows.map((r, k) => <tr key={k}>
            <td style={cell}>{r.invNo}/{r.itemNo}</td><td style={cell}>{r.srNo || 1}</td><td style={cell}>{r.regNo}</td><td style={cell}>{dmy(r.regDate)}</td><td style={cell}>{r.snE}</td><td style={cell}>{r.snC}</td>
            <td style={right}>{fmt(r.qty, 3)}</td><td style={right}>{fmt(r.expQty, 3)}</td><td style={cell}>{r.uqc}</td><td style={cell}>{/^I/i.test(String(r.indImp || '')) && !/^IMP/i.test(String(r.indImp)) ? 'Indigenous' : 'Imported'}</td>
            <td style={cell}>{[r.licNo, dmy(r.licDt)].filter(Boolean).join(' / ')}</td><td style={cell}>{r.licType}</td>
          </tr>)}
          {rows.length === 0 && <Empty cols={12} text="No licence row in this job" />}
        </tbody>
      </table>
    </Wrap>
  );
}

export function Ar4Report({ d, items }) {
  const rows = (items || []).map((it, i) => ({ it, i })).filter(({ it }) => /^Y/i.test(String(it.ar4 || '')));
  return (
    <Wrap><ExportReportHeader title="AR4 Particulars" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Inv/Item</th><th style={head}>Description</th><th style={head}>AR4 No</th><th style={head}>AR4 Date</th><th style={head}>Commissionerate</th><th style={head}>Division</th><th style={head}>Range</th><th style={head}>Remarks</th></tr></thead>
        <tbody>
          {rows.map(({ it, i }) => <tr key={i}><td style={cell}>{invOf(it)}/{itmOf(it, i)}</td><td style={cell}>{it.desc}</td><td style={cell}>{it.ar4No}</td><td style={cell}>{dmy(it.ar4Date)}</td><td style={cell}>{it.commissionerate}</td><td style={cell}>{it.division}</td><td style={cell}>{it.ar4Range}</td><td style={cell}>{it.ar4Remarks}</td></tr>)}
          {rows.length === 0 && <Empty cols={8} text="No item with AR4 = Y" />}
        </tbody>
      </table>
    </Wrap>
  );
}

export function ReExportReport({ d, items }) {
  const rows = (items || []).flatMap((it, i) => arr(it.reExports).map((r) => ({ it, i, r })));
  return (
    <Wrap><ExportReportHeader title="Re-Export Particulars" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>SB Inv/Item</th><th style={head}>BE Site</th><th style={head}>BE No</th><th style={head}>BE Date</th><th style={head}>BE Inv/Item</th><th style={head}>Description</th><th style={head}>Qty Utilised</th><th style={head}>BE Qty</th><th style={head}>Assessed ₹</th><th style={head}>Duty ₹</th></tr></thead>
        <tbody>
          {rows.map(({ it, i, r }, k) => <tr key={k}>
            <td style={cell}>{invOf(it)}/{itmOf(it, i)}</td><td style={cell}>{r.reExpField2}</td><td style={cell}>{r.reExpField3}</td><td style={cell}>{dmy(r.reExpField4)}</td><td style={cell}>{r.reExpField5}/{r.reExpField6}</td>
            <td style={cell}>{r.reExpField9}</td><td style={right}>{fmt(r.reExpField8, 3)} {r.reExpField11 || ''}</td><td style={right}>{r.reExpField10 ? fmt(r.reExpField10, 3) : '-'}</td><td style={right}>{r.reExpField12 ? fmt(r.reExpField12) : '-'}</td><td style={right}>{r.reExpField13 ? fmt(r.reExpField13) : '-'}</td>
          </tr>)}
          {rows.length === 0 && <Empty cols={10} text="No re-export row in this job" />}
        </tbody>
      </table>
    </Wrap>
  );
}

export function InvoiceParticularsReport({ d }) {
  const invs = d?.invoices || [];
  const ch = (inv, k) => [inv[k + 'Rate'], inv[k + 'Curr'], inv[k + 'Amount']].some(v => String(v || '').trim()) ? `${inv[k + 'Rate'] ? fmt(inv[k + 'Rate']) + '% ' : ''}${inv[k + 'Amount'] ? (inv[k + 'Curr'] || inv.currency || '') + ' ' + fmt(inv[k + 'Amount']) : ''}` : '-';
  return (
    <Wrap><ExportReportHeader title="Invoice Particulars" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Sr</th><th style={head}>Invoice No / Date</th><th style={head}>Value</th><th style={head}>Rate</th><th style={head}>Terms</th><th style={head}>Freight</th><th style={head}>Insurance</th><th style={head}>Commission</th><th style={head}>Discount</th><th style={head}>Payment</th><th style={head}>Buyer</th><th style={head}>FOB ₹</th></tr></thead>
        <tbody>
          {invs.map((inv, k) => <tr key={k}>
            <td style={cell}>{k + 1}</td><td style={cell}>{invNo(inv)}<br />{dmy(inv.date || inv.invoiceDate)}</td><td style={right}>{inv.currency} {fmt(inv.value || inv.invoiceValue)}</td><td style={right} title={rateText(inv.currency, inv.exchRate || inv.exchangeRate, inv.unitInRs)}>{fmt(inv.exchRate || inv.exchangeRate, 4)}{Number(inv.unitInRs) > 1 ? '/' + Number(inv.unitInRs) : ''}</td>
            <td style={cell}>{inv.contractType || inv.natureOfContract}{inv.addFreight ? ` (${inv.addFreight})` : ''}</td><td style={cell}>{ch(inv, 'freight')}</td><td style={cell}>{ch(inv, 'insurance')}</td><td style={cell}>{ch(inv, 'commission')}</td><td style={cell}>{ch(inv, 'discount')}</td>
            <td style={cell}>{[inv.pymtNature, inv.pymtPeriod ? inv.pymtPeriod + ' days' : ''].filter(Boolean).join(' / ')}</td><td style={cell}>{inv.buyer || inv.buyerName || d?.consigneeName || ''}</td><td style={right}>{fmt(inv.invFobInr)}</td>
          </tr>)}
          {invs.length === 0 && <Empty cols={12} text="No invoice in this job" />}
          <tr><td colSpan={11} style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>Total FOB ₹</td><td style={{ ...right, fontWeight: 700 }}>{fmt(invs.reduce((a, i) => a + n(i.invFobInr), 0))}</td></tr>
        </tbody>
      </table>
    </Wrap>
  );
}

export function ShipmentReport({ d, containers }) {
  const j = d || {};
  const conts = (Array.isArray(j.Containers) && j.Containers.length ? j.Containers : (containers || []));
  const rows = [
    ['Mode', j.shipmentMode, 'Nature of Cargo', j.natureOfCargo || j.autoField_13],
    ['Gross Wt', j.grossWeight || j.autoField_18 ? `${j.grossWeight || j.autoField_18} ${j.grWtUnit || 'KGS'}` : '', 'Net Wt', j.netWeight || j.autoField_19 ? `${j.netWeight || j.autoField_19} ${j.grWtUnit || 'KGS'}` : ''],
    ['Total Packages', j.totalPackages || j.autoField_14, 'Loose Packets', j.loosePackets || j.autoField_17],
    ['Marks & Nos', [j.autoField_15, j.autoField_16].filter(Boolean).join(' '), 'Containers', conts.length],
    ['Consignee', j.consigneeName, 'Country', j.consigneeCountry || j.consigneeCountryCode],
    ['Discharge Port', j.discPortName || j.discPortCode, 'Flight / Vessel', j.flightNo || j.vesselName || ''],
  ];
  return (
    <Wrap><ExportReportHeader title="Shipment & Container Details" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}><tbody>
        {rows.map((r, i) => <tr key={i}><td style={{ ...cell, fontWeight: 700, width: '15%', background: '#f8fafc' }}>{r[0]}</td><td style={{ ...cell, width: '35%' }}>{r[1] || ''}</td><td style={{ ...cell, fontWeight: 700, width: '15%', background: '#f8fafc' }}>{r[2]}</td><td style={{ ...cell, width: '35%' }}>{r[3] ?? ''}</td></tr>)}
      </tbody></table>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Sr</th><th style={head}>Container No</th><th style={head}>Size</th><th style={head}>Seal No</th><th style={head}>Seal Date</th><th style={head}>Seal Type</th><th style={head}>Pkgs Stuffed</th></tr></thead>
        <tbody>
          {conts.map((c, k) => <tr key={k}><td style={cell}>{k + 1}</td><td style={cell}>{c.ContainerNumber || c.containerNo}</td><td style={cell}>{c.ContainerSize || c.size}</td><td style={cell}>{c.ExciseSealNo || c.sealNo || c.exciseSealNo}</td><td style={cell}>{dmy(c.SealDate || c.sealDate)}</td><td style={cell}>{c.SealTypeIndicator || c.sealType}</td><td style={right}>{c.NoOfPktsStuffed || c.stuffedPkgs || ''}</td></tr>)}
          {conts.length === 0 && <Empty cols={7} text="No container (air / loose cargo)" />}
        </tbody>
      </table>
    </Wrap>
  );
}

export function SwInfoReport({ d, items }) {
  const info = (items || []).flatMap((it, i) => arr(it.swInfos).map(r => ({ it, i, r })));
  const stm = (items || []).flatMap((it, i) => arr(it.swStatements).map(r => ({ it, i, r })));
  return (
    <Wrap><ExportReportHeader title="Single Window Information & Statements" d={d} />
      <div style={{ fontWeight: 700, margin: '6px 0 3px' }}>SW Info</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
        <thead><tr><th style={head}>Inv/Item</th><th style={head}>Type</th><th style={head}>Qualifier</th><th style={head}>Code</th><th style={head}>Text</th><th style={head}>Measure</th><th style={head}>UQC</th></tr></thead>
        <tbody>
          {info.map(({ it, i, r }, k) => <tr key={k}><td style={cell}>{invOf(it)}/{itmOf(it, i)}</td><td style={cell}>{r.swInfoField1 || r.type}</td><td style={cell}>{r.swInfoField2 || r.qual}</td><td style={cell}>{r.swInfoField3 || r.code}</td><td style={cell}>{r.swInfoField4 || r.text || ''}</td><td style={right}>{r.swInfoField5 || r.msr || ''}</td><td style={cell}>{r.swInfoField6 || r.uqc || ''}</td></tr>)}
          {info.length === 0 && <Empty cols={7} text="No SW info row" />}
        </tbody>
      </table>
      <div style={{ fontWeight: 700, margin: '6px 0 3px' }}>SW Statements</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Inv/Item</th><th style={head}>Type</th><th style={head}>Code</th><th style={head}>Text</th></tr></thead>
        <tbody>
          {stm.map(({ it, i, r }, k) => <tr key={k}><td style={cell}>{invOf(it)}/{itmOf(it, i)}</td><td style={cell}>{r.statementType || r.stmtType || r.type || ''}</td><td style={cell}>{r.statementCode || r.stmtCode || r.code || ''}</td><td style={cell}>{r.statementText || r.text || ''}</td></tr>)}
          {stm.length === 0 && <Empty cols={4} text="No SW statement" />}
        </tbody>
      </table>
    </Wrap>
  );
}

export function SupportingDocsReport({ d, items }) {
  const rows = [
    ...arr(d?.eSanchitList).map(r => ({ lvl: 'Whole SB', r })),
    ...(items || []).flatMap((it, i) => arr(it.eSanchitList).map(r => ({ lvl: `Item ${invOf(it)}/${itmOf(it, i)}`, r }))),
  ];
  return (
    <Wrap><ExportReportHeader title="Supporting Documents (e-Sanchit)" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>For</th><th style={head}>IRN</th><th style={head}>Doc Code</th><th style={head}>Ref No</th><th style={head}>Issued By</th><th style={head}>Beneficiary</th><th style={head}>Place</th><th style={head}>Issue Date</th><th style={head}>File</th></tr></thead>
        <tbody>
          {rows.map(({ lvl, r }, k) => <tr key={k}><td style={cell}>{lvl}</td><td style={cell}>{r.irn || r.imageRefNo || ''}</td><td style={cell}>{r.docCode || r.documentCode || ''}</td><td style={cell}>{r.refNo || r.drn || ''}</td><td style={cell}>{r.issuerName || r.issuingParty || ''}</td><td style={cell}>{r.beneficiaryName || r.beneficiaryParty || ''}</td><td style={cell}>{r.placeOfIssue || ''}</td><td style={cell}>{dmy(r.issueDate)}</td><td style={cell}>{r.fileName || ''}</td></tr>)}
          {rows.length === 0 && <Empty cols={9} text="No supporting document in this job" />}
        </tbody>
      </table>
    </Wrap>
  );
}

// Annexure to the S/B (29-Oct-2026): all items invoice by invoice with value, FOB, PMV, drawback and RoDTEP,
// invoice sub-totals and a grand total - the continuation sheet when the items do not fit on the checklist.
export function AnnexureReport({ d, items, dbkItems }) {
  const invs = (d?.invoices || []).length ? d.invoices : [{}];
  const dbkRows = (it, i) => (dbkItems || []).filter(r => String(r.invNo || r.invSr) === invOf(it) && String(r.itemNo || r.itemSr) === itmOf(it, i))
    .map(r => (String(r.dbkVal || '').trim() !== '' ? n(r.dbkVal) : dbkAmount({ fob: itemFobInr(it), qty: r.dbkQty, rateAdv: r.dbkRtAdv, rateSpe: r.dbkRtSpe, cap: r.dbkCap })));
  const dbkOf = (it, i) => dbkRows(it, i).reduce((a, v) => a + (v === null ? 0 : v), 0);
  // a row whose drawback could not be worked out (cap per unit, no quantity) must not read as 0 in the annexure
  const dbkPending = (it, i) => dbkRows(it, i).some(v => v === null);
  const igst = (it) => { const s = String(it.igstPayStatus || ''); return /\(P\)/.test(s) ? 'P' : /LUT/.test(s) ? 'LUT' : /NA/.test(s) ? 'NA' : ''; };
  const grand = { fc: 0, fob: 0, pmv: 0, dbk: 0, n: 0 };
  return (
    <Wrap><ExportReportHeader title="Annexure to Shipping Bill - Invoice & Item Details" d={d} />
      {invs.map((inv, k) => {
        const rows = (items || []).map((it, i) => ({ it, i })).filter(({ it }) => invOf(it) === String(k + 1));
        const t = rows.reduce((a, { it, i }) => ({ fc: a.fc + n(it.totalFc || it.total), fob: a.fob + itemFobInr(it), pmv: a.pmv + itemTotalPmv(it), dbk: a.dbk + dbkOf(it, i) }), { fc: 0, fob: 0, pmv: 0, dbk: 0 });
        grand.fc += t.fc; grand.fob += t.fob; grand.pmv += t.pmv; grand.dbk += t.dbk; grand.n += rows.length;
        return (
          <div key={k} style={{ marginBottom: '10px' }}>
            <div style={{ fontWeight: 700, margin: '6px 0 3px' }}>Invoice {k + 1}: {invNo(inv) || '-'} dt {dmy(inv.date || inv.invoiceDate)} · {inv.currency || ''} · {inv.contractType || inv.natureOfContract || ''} · Buyer: {inv.buyer || inv.buyerName || d?.consigneeName || ''}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Item', 'Scheme', 'RITC', 'Description', 'Qty', 'UQC', 'Rate', `Value (${inv.currency || 'FC'})`, 'FOB ₹', 'PMV ₹', 'DBK ₹', 'RoDTEP', 'IGST', 'End Use'].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(({ it, i }) => <tr key={i} style={{ breakInside: 'avoid' }}>
                  <td style={cell}>{itmOf(it, i)}</td><td style={cell}>{String(it.scheme || '').split(/[\s-]/)[0]}</td><td style={cell}>{it.ritc}</td><td style={cell}>{it.desc || it.description}</td>
                  <td style={right}>{fmt(it.qty, 3)}</td><td style={cell}>{it.unit || it.uqc}</td><td style={right}>{fmt(it.rate || it.price, 4)}</td><td style={right}>{fmt(it.totalFc || it.total)}</td>
                  <td style={right}>{fmt(itemFobInr(it))}</td><td style={right}>{itemTotalPmv(it) ? fmt(itemTotalPmv(it)) : '-'}</td><td style={right} title={dbkPending(it, i) ? CAP_NEEDS_QTY : ''}>{dbkPending(it, i) ? 'qty?' : (dbkOf(it, i) ? fmt(dbkOf(it, i)) : '-')}</td>
                  <td style={cell}>{claimsRodtep(it) ? 'Y' : 'N'}</td><td style={cell}>{igst(it)}</td><td style={cell}>{String(it.endUse || '').split(/[\s|]/)[0]}</td>
                </tr>)}
                {rows.length === 0 && <Empty cols={14} text="No item in this invoice" />}
                <tr style={{ fontWeight: 700 }}><td colSpan={7} style={{ ...cell, textAlign: 'right' }}>Invoice {k + 1} total ({rows.length} item{rows.length === 1 ? '' : 's'})</td>
                  <td style={right}>{fmt(t.fc)}</td><td style={right}>{fmt(t.fob)}</td><td style={right}>{fmt(t.pmv)}</td><td style={right}>{fmt(t.dbk)}</td><td colSpan={3} style={cell} /></tr>
              </tbody>
            </table>
          </div>
        );
      })}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
        <tr style={{ fontWeight: 700 }}><td style={{ ...cell, background: '#f8fafc' }}>Grand total: {invs.length} invoice(s), {grand.n} item(s)</td><td style={right}>FOB ₹ {fmt(grand.fob)}</td><td style={right}>PMV ₹ {fmt(grand.pmv)}</td><td style={right}>Drawback ₹ {fmt(grand.dbk)}</td></tr>
      </tbody></table>
      <Note>FOB / drawback are the screen estimates; Customs works out the final figures. Value in invoice currency is not totalled across invoices.</Note>
    </Wrap>
  );
}

// Container annexure (29-Oct-2026): container-wise stuffing and seal details with the S/B summary, for factory
// stuffed (self-sealed) cargo and the port. Data sheet only - check the annexure format your port asks for.
export function ContainerAnnexureReport({ d, containers }) {
  const j = d || {};
  const conts = (Array.isArray(j.Containers) && j.Containers.length ? j.Containers : (containers || []));
  const stuffedTot = conts.reduce((a, c) => a + n(c.NoOfPktsStuffed || c.stuffedPkgs), 0);
  const factory = /^Y/i.test(String(j.factoryStuffed || ''));
  const rows = [
    ['Stuffing', factory ? 'Factory stuffed (self-sealed)' : 'Dock / CFS stuffed', 'Invoice No(s)', (j.invoices || []).map(invNo).filter(Boolean).join(', ')],
    ['Factory / stuffing address', j.factoryAddress || '', 'Total Packages', [j.totalPackages || j.autoField_14, j.packageUnit || j.autoField_16].filter(Boolean).join(' ')],
    ['Gross Wt', j.autoField_18 || j.grossWeight ? `${j.autoField_18 || j.grossWeight} ${j.grWtUnit || 'KGS'}` : '', 'Net Wt', j.autoField_19 || j.netWeight ? `${j.autoField_19 || j.netWeight} ${j.grWtUnit || 'KGS'}` : ''],
    ['Marks & Nos', j.autoField_15 || '', 'Port of Discharge / Destination', [j.discPortCode || j.discPortName, j.destPortCode || j.destPortName].filter(Boolean).join(' / ')],
  ];
  return (
    <Wrap><ExportReportHeader title="Container Annexure - Stuffing & Sealing Details" d={d} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}><tbody>
        {rows.map((r, i) => <tr key={i}><td style={{ ...cell, fontWeight: 700, width: '18%', background: '#f8fafc' }}>{r[0]}</td><td style={{ ...cell, width: '32%' }}>{r[1] || ''}</td><td style={{ ...cell, fontWeight: 700, width: '18%', background: '#f8fafc' }}>{r[2]}</td><td style={{ ...cell, width: '32%' }}>{r[3] || ''}</td></tr>)}
      </tbody></table>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Sr', 'Container No', 'Size / Type', 'Seal No (e-seal)', 'Seal Date', 'Seal Type', 'Seal Device ID', 'Pkgs Stuffed', 'VGM Kgs'].map(h => <th key={h} style={head}>{h}</th>)}</tr></thead>
        <tbody>
          {conts.map((c, k) => <tr key={k} style={{ breakInside: 'avoid' }}>
            <td style={cell}>{k + 1}</td><td style={{ ...cell, fontWeight: 700 }}>{c.ContainerNumber || c.containerNo}</td><td style={cell}>{[c.ContainerSize || c.size, c.ContainerType || c.type].filter(Boolean).join(' ')}</td>
            <td style={cell}>{c.ExciseSealNo || c.exciseSealNo || c.sealNo}</td><td style={cell}>{dmy(c.SealDate || c.sealDate)}</td><td style={cell}>{c.SealTypeIndicator || c.sealType}</td>
            <td style={cell}>{c.SealDeviceID || c.deviceId}</td><td style={right}>{c.NoOfPktsStuffed || c.stuffedPkgs || ''}</td><td style={right}>{c.VGM || c.vgmWeight || ''}</td>
          </tr>)}
          {conts.length === 0 && <Empty cols={9} text="No container in this job (SB Header > Container Details)" />}
          {conts.length > 0 && <tr style={{ fontWeight: 700 }}><td colSpan={7} style={{ ...cell, textAlign: 'right' }}>{conts.length} container(s) - packages stuffed</td><td style={right}>{stuffedTot || ''}</td><td style={cell} /></tr>}
        </tbody>
      </table>
      {conts.length > 0 && stuffedTot > 0 && n(j.totalPackages || j.autoField_14) && stuffedTot !== n(j.totalPackages || j.autoField_14) && <Note><b>Check:</b> packages stuffed ({stuffedTot}) differ from the S/B total packages ({j.totalPackages || j.autoField_14}).</Note>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '28px' }}><tbody><tr>
        <td style={{ width: '50%', paddingTop: '30px', borderTop: '1px solid #000', textAlign: 'center' }}>Exporter / Authorised Signatory (name, date)</td>
        <td style={{ width: '50%', paddingTop: '30px', borderTop: '1px solid #000', textAlign: 'center' }}>Customs Broker (name, licence no, date)</td>
      </tr></tbody></table>
      <Note>Data sheet built from the job. For factory stuffed cargo use the annexure format and declarations your port / CBIC circular prescribes.</Note>
    </Wrap>
  );
}
