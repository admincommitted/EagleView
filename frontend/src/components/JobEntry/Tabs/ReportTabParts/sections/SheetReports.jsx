// ADC sheet and Stamp duty sheet for Import > Reports & Submission (14-Nov-2026).
// No office sample was available, so both follow a standard layout:
//  - ADC sheet: the particulars the Assistant Drugs Controller (CDSCO port office) asks for to give the NOC for drugs /
//    cosmetics / medical devices - importer, BE, AWB / BL, invoices, and per item the product, CTH, manufacturer and the
//    batch / mfg / expiry rows of 4. Items > SW production details. Licence numbers are not kept in EagleView: they are
//    typed on the sheet (click the dotted box) before printing.
//  - Stamp duty sheet: office rule (user, 14-Nov-2026): (assessable value + total duty) x 0.1 %, rounded up to the next
//    Rs 10 (their B/E: 2,76,80,235.00 + 76,77,113.20 = 3,53,57,348.20 -> 35,357.35 -> Rs 35,360). Rate / basis /
//    rounding can still be changed on the sheet; the choice is kept in this browser.
// Values (assessable value, duty) are the same estimate as the Duty Sheet (computeItemDuty).
import React from 'react';
import { computeItemDuty } from '../../ItemGridTabParts/helpers';
import { ReportHeader } from './SimpleReports';

const F = { fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '9pt', color: '#000' };
const cell = { border: '1px solid #475569', padding: '3px 5px', verticalAlign: 'top' };
const head = { ...cell, background: '#e2e8f0', fontWeight: 700, textAlign: 'left' };
const lab = { ...cell, fontWeight: 700, background: '#f8fafc', width: '22%' };
const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
const fmt = (v, d = 2) => num(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const dmy = (v) => { const s = String(v || '').trim(); let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s); if (m) return `${m[3]}/${m[2]}/${m[1]}`; return s; };
const itemInvSr = (it) => String(it.invSrNo || it.invoiceSrNo || 1);
const invSrOf = (inv, i) => String(inv.invoiceSrNo || inv.invSrNo || i + 1);
const asArr = (v) => { if (Array.isArray(v)) return v; if (typeof v === 'string' && v.trim()) { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch (e) { return []; } } return []; };
const join = (...a) => a.map(x => String(x || '').trim()).filter(Boolean).join(', ');

// a box the operator types into before printing (its text goes into the print and the mail; inputs would not)
function Fill({ minWidth = '160px' }) {
  return <span contentEditable suppressContentEditableWarning style={{ display: 'inline-block', minWidth, minHeight: '14px', borderBottom: '1px dotted #64748b', outline: 'none' }} />;
}

export function AdcSheetReport({ jobData, items }) {
  const j = jobData || {};
  const invoices = j.invoices || [];
  const port = j.portName || j.locationName || j.autoField_1 || j.portCode || j.customHouseCode || '';
  const invText = invoices.map(inv => [inv.invNo || inv.invoiceNo, inv.invDate || inv.invoiceDate ? 'Dt. ' + dmy(inv.invDate || inv.invoiceDate) : ''].filter(Boolean).join(' ')).filter(Boolean).join('; ');
  const rows = [];
  (items || []).forEach((it, i) => {
    const d = computeItemDuty(it, invoices, j);
    const qty = num(it.qty || it.quantity); const uqc = it.uqc || it.unit || '';
    const batches = asArr(it.swProdData).filter(b => b && (b.batch || b.mnfDate || b.expDate));
    const base = { inv: itemInvSr(it) + '/' + (it.itemSrNo || it.itemNo || i + 1), desc: it.desc || it.productDescription || '', generic: it.genericDesc || '',
      cth: it.ritc || it.hsCode || it.cth || '', mfr: join(it.manufacturerName || it.manufacturer, it.itemManufacturerCity), av: d.av || 0 };
    if (!batches.length) { rows.push({ ...base, batch: '', mfg: '', exp: '', qty, uqc, value: base.av }); return; }
    const bq = batches.reduce((s, b) => s + num(b.qty), 0);
    batches.forEach((b, k) => {
      const q = num(b.qty);
      // the item's value is shared by batch quantity when the batch quantities add up to the item; else it stays on the first row
      const value = bq > 0 && Math.abs(bq - qty) < 1e-6 ? base.av * q / bq : (k === 0 ? base.av : 0);
      rows.push({ ...base, batch: b.batch || '', mfg: b.mnfDate || '', exp: b.expDate || b.bestBefore || '', qty: q || (k === 0 ? qty : 0), uqc: b.uqc || uqc, value, more: k > 0 });
    });
  });
  const total = rows.reduce((s, r) => s + r.value, 0);
  const noBatch = (items || []).length > 0 && rows.some(r => !r.batch);
  return (
    <div style={F}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12pt', textTransform: 'uppercase' }}>ADC Sheet</div>
      <div style={{ textAlign: 'center', fontSize: '9pt', marginBottom: '6px' }}>Particulars for the NOC of the Assistant Drugs Controller (India), Port Office{port ? ' - ' + port : ''}<br />Drugs / Cosmetics / Medical Devices</div>
      <div className="no-print" style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1e3a8a', padding: '4px 8px', marginBottom: '6px' }}>
        Click the dotted boxes to type the licence / registration details before printing. Batch, Mfg and Expiry come from 4. Items &gt; SW production details{noBatch ? ' - some items have none (blank on the sheet).' : '.'}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}><tbody>
        <tr><td style={lab}>Importer</td><td style={cell} colSpan={3}><b>{j.nameOfImporter || j.autoField_4 || ''}</b><br />{join(j.address1 || j.autoField_6, j.address2 || j.autoField_7, j.city || j.autoField_8, j.state || j.autoField_9, j.pin || j.autoField_10)}</td></tr>
        <tr><td style={lab}>IEC</td><td style={cell}>{j.iecCode || j.autoField_5 || ''}</td><td style={lab}>GSTIN</td><td style={cell}>{j.commercialTaxRegistrationNo || j.autoField_13 || ''}</td></tr>
        <tr><td style={lab}>Job No / Date</td><td style={cell}>{j.jobNo && j.jobNo !== 'DRAFT' ? j.jobNo : 'DRAFT'} {j.jobDate ? 'Dt. ' + dmy(j.jobDate) : ''}</td><td style={lab}>B/E No / Date</td><td style={cell}>{j.beNo || ''} {j.beDate ? 'Dt. ' + dmy(j.beDate) : ''}</td></tr>
        <tr><td style={lab}>MAWB / BL</td><td style={cell}>{j.mawbNo || j.mawbblNo || ''} {j.mawbDate ? 'Dt. ' + dmy(j.mawbDate) : ''}</td><td style={lab}>HAWB / HBL</td><td style={cell}>{j.hawbNo || j.hawbhblNo || ''} {j.hawbDate ? 'Dt. ' + dmy(j.hawbDate) : ''}</td></tr>
        <tr><td style={lab}>IGM No / Date</td><td style={cell}>{j.igmNumber || j.igmNo || ''} {j.igmDate ? 'Dt. ' + dmy(j.igmDate) : ''}</td><td style={lab}>Packages / Gross Wt</td><td style={cell}>{j.totalPkg || ''} {j.pkg || ''} / {j.grossWt || ''} {j.grossWtUnit || ''}</td></tr>
        <tr><td style={lab}>Supplier</td><td style={cell}>{j.supplierName || ''}</td><td style={lab}>Country of Origin / Consignment</td><td style={cell}>{j.countryOfOriginName || j.countryOfOrigin || ''} / {j.countryOfConsignmentName || j.countryOfConsignment || ''}</td></tr>
        <tr><td style={lab}>Invoice No / Date</td><td style={cell} colSpan={3}>{invText}</td></tr>
        <tr><td style={lab}>Import Licence / Registration No (Form 10 / 10A / 41 / MD-15)</td><td style={cell}><Fill /></td><td style={lab}>Valid up to</td><td style={cell}><Fill minWidth="90px" /></td></tr>
        <tr><td style={lab}>Importer's Drug Licence No (Form 20B / 21B) / other</td><td style={cell}><Fill /></td><td style={lab}>Valid up to</td><td style={cell}><Fill minWidth="90px" /></td></tr>
      </tbody></table>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Sr', 'Inv/Item', 'Name of the Product', 'CTH', 'Manufacturer', 'Batch No', 'Mfg Date', 'Expiry Date', 'Quantity', 'Value (Rs)'].map(h => <th key={h} style={{ ...head, textAlign: ['Quantity', 'Value (Rs)'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>
            <td style={cell}>{i + 1}</td>
            <td style={cell}>{r.more ? '' : r.inv}</td>
            <td style={cell}>{r.more ? '' : <>{r.desc}{r.generic && r.generic !== r.desc ? <div style={{ color: '#334155' }}>{r.generic}</div> : null}</>}</td>
            <td style={cell}>{r.more ? '' : r.cth}</td>
            <td style={cell}>{r.more ? '' : r.mfr}</td>
            <td style={cell}>{r.batch}</td>
            <td style={cell}>{dmy(r.mfg)}</td>
            <td style={cell}>{dmy(r.exp)}</td>
            <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.qty ? fmt(r.qty, 3) + ' ' + r.uqc : ''}</td>
            <td style={{ ...cell, textAlign: 'right' }}>{r.value ? fmt(r.value) : ''}</td>
          </tr>)}
          {rows.length === 0 && <tr><td colSpan={10} style={{ ...cell, textAlign: 'center' }}>No items in this job</td></tr>}
        </tbody>
        {rows.length > 0 && <tfoot><tr style={{ fontWeight: 700, background: '#f1f5f9' }}><td style={cell} colSpan={9}>TOTAL ({(items || []).length} items)</td><td style={{ ...cell, textAlign: 'right' }}>{fmt(total)}</td></tr></tfoot>}
      </table>
      <div style={{ marginTop: '10px', breakInside: 'avoid' }}>
        <div>We declare that the above particulars are true and correct, and that the goods are imported under the licence / registration stated above.</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '28px' }}><tbody><tr>
          <td style={{ width: '50%', paddingTop: '4px', borderTop: '1px solid #000' }}>Signature of the Importer / Authorised Signatory<br />Place: ............ &nbsp; Date: ............</td>
          <td style={{ width: '5%' }} />
          <td style={{ width: '45%', paddingTop: '4px', borderTop: '1px solid #000' }}>Customs Broker {j.chaCode ? '(' + j.chaCode + ')' : ''}</td>
        </tr></tbody></table>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}><tbody><tr><td style={{ ...cell, height: '60px' }}><b>For the Port Office (ADC) - remarks / NOC</b></td></tr></tbody></table>
      </div>
      <div style={{ marginTop: '6px', fontSize: '8pt', color: '#475569' }}>Value = assessable value (estimate, as the Duty Sheet). Final values are as assessed by Customs (ICES).</div>
    </div>
  );
}

const CFG_KEY = 'stamp_duty_sheet_cfg_v2'; // v2: office defaults (AV + duty, 0.10 %, up to the next Rs 10)
const readCfg = () => { try { const c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); return c && typeof c === 'object' ? c : {}; } catch (e) { return {}; } };

export function StampDutySheetReport({ jobData, items }) {
  const j = jobData || {};
  const invoices = j.invoices || [];
  const saved = readCfg();
  const [rate, setRate] = React.useState(saved.rate != null ? String(saved.rate) : '0.10');
  const [basis, setBasis] = React.useState(saved.basis || 'avduty');
  const [round, setRound] = React.useState(saved.round || 'up10');
  React.useEffect(() => { try { localStorage.setItem(CFG_KEY, JSON.stringify({ rate, basis, round })); } catch (e) { /* storage blocked */ } }, [rate, basis, round]);

  const lines = (items || []).map(it => ({ sr: itemInvSr(it), d: computeItemDuty(it, invoices, j) }));
  const groups = (invoices.length ? invoices : [{}]).map((inv, i) => {
    const sr = invoices.length ? invSrOf(inv, i) : '1';
    const mine = lines.filter(l => !invoices.length || l.sr === sr);
    return { inv, sr, av: mine.reduce((s, l) => s + (l.d.av || 0), 0), duty: mine.reduce((s, l) => s + (l.d.total || 0), 0), n: mine.length };
  });
  const av = groups.reduce((s, g) => s + g.av, 0); const duty = groups.reduce((s, g) => s + g.duty, 0);
  const value = basis === 'avduty' ? av + duty : av;
  const r = Math.max(0, num(rate));
  const exact = value * r / 100;
  // up10: up to the next Rs 10 (a tiny tolerance so 35,360.00 itself is not pushed to 35,370)
  const stamp = round === 'per1000' ? Math.ceil(value / 1000) * (r * 10) : round === 'up10' ? Math.ceil(exact / 10 - 1e-9) * 10 : Math.round(exact);
  const basisText = basis === 'avduty' ? 'Assessable value + duty' : 'Assessable value';
  const ruleText = round === 'per1000' ? `Rs ${fmt(r * 10)} per Rs 1,000 or part` : round === 'up10' ? `${fmt(r, 2)} % of the value (${fmt(exact)}), rounded up to the next Rs 10` : `${fmt(r, 2)} % of the value, rounded to the rupee`;
  const sel = { height: '24px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 4px' };
  return (
    <div style={F}>
      <ReportHeader title="Stamp Duty Sheet" jobData={j} />
      <div className="no-print" style={{ border: '1px solid #f59e0b', background: '#fffbeb', color: '#78350f', padding: '6px 8px', marginBottom: '6px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span><b>Rate %</b> <input aria-label="Stamp duty rate %" style={{ ...sel, width: '64px' }} value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.]/g, ''))} /></span>
        <span><b>On</b> <select aria-label="Stamp duty basis" style={sel} value={basis} onChange={e => setBasis(e.target.value)}><option value="av">Assessable value</option><option value="avduty">Assessable value + duty</option></select></span>
        <span><b>Worked out</b> <select aria-label="Stamp duty rounding" style={sel} value={round} onChange={e => setRound(e.target.value)}><option value="up10">%, rounded up to the next Rs 10</option><option value="exact">%, rounded to the rupee</option><option value="per1000">Per Rs 1,000 or part</option></select></span>
        <span style={{ flexBasis: '100%', fontSize: '10px' }}>Office rule: (assessable value + total duty) x 0.10 %, rounded up to the next Rs 10. Duty here is the estimate; after assessment check it with the assessed B/E. This setting is kept in this browser.</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
        <thead><tr>{['Inv', 'Invoice No', 'Date', 'Currency', 'Invoice Value', 'Items', 'Assessable Value (Rs)', 'Duty (Rs)'].map(h => <th key={h} style={{ ...head, textAlign: ['Invoice Value', 'Items', 'Assessable Value (Rs)', 'Duty (Rs)'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>
          {groups.map((g, i) => <tr key={i}>
            <td style={cell}>{g.sr}</td>
            <td style={cell}>{g.inv.invNo || g.inv.invoiceNo || ''}</td>
            <td style={cell}>{dmy(g.inv.invDate || g.inv.invoiceDate)}</td>
            <td style={cell}>{g.inv.currency || j.currency || ''}</td>
            <td style={{ ...cell, textAlign: 'right' }}>{g.inv.value || g.inv.invValue || g.inv.invoiceValue ? fmt(g.inv.value || g.inv.invValue || g.inv.invoiceValue) : ''}</td>
            <td style={{ ...cell, textAlign: 'right' }}>{g.n}</td>
            <td style={{ ...cell, textAlign: 'right' }}>{fmt(g.av)}</td>
            <td style={{ ...cell, textAlign: 'right' }}>{fmt(g.duty)}</td>
          </tr>)}
        </tbody>
        <tfoot><tr style={{ fontWeight: 700, background: '#f1f5f9' }}><td style={cell} colSpan={6}>TOTAL</td><td style={{ ...cell, textAlign: 'right' }}>{fmt(av)}</td><td style={{ ...cell, textAlign: 'right' }}>{fmt(duty)}</td></tr></tfoot>
      </table>
      <table style={{ width: '60%', borderCollapse: 'collapse', marginLeft: 'auto' }}><tbody>
        <tr><td style={lab}>Value for stamp duty</td><td style={cell}>{basisText}</td><td style={{ ...cell, textAlign: 'right' }}>{fmt(value)}</td></tr>
        <tr><td style={lab}>Rate</td><td style={cell} colSpan={2}>{ruleText}</td></tr>
        <tr style={{ fontWeight: 700, background: '#f1f5f9' }}><td style={lab}>Stamp duty (Rs)</td><td style={cell} /><td style={{ ...cell, textAlign: 'right', fontSize: '11pt' }}>{fmt(stamp)}</td></tr>
      </tbody></table>
      <div style={{ marginTop: '6px', fontSize: '8pt', color: '#475569' }}>Assessable value and duty are the estimate of the Duty Sheet; after assessment use the values of the assessed B/E.</div>
    </div>
  );
}
