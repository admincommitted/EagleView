// Screen section: Freight, Insurance & Other Charges of the invoice (30-Oct-2026)
// These boxes were only reachable through the popup that opens when the Terms box is typed (and the misc / discount
// ones through other popups), so the main form looked empty next to the other ERP's invoice screen. They are now
// always on the form; the popups keep working and write the same keys.
//   Amount OR rate per charge (ICES takes one of the two), currency with an amount; freight boxes are closed for
//   CIF / CF terms and insurance boxes for CIF / CI (the terms already include them - the save refuses otherwise).
import React from 'react';

export default function ChargesSection({ ctx }) {
  const { masters, handleInvoiceFieldChange, invoiceFormData } = ctx;
  const f = invoiceFormData || {};
  const terms = String(f.terms || f.termsOfInvoice || '').trim().toUpperCase();
  const noFreight = ['CIF', 'CF', 'C&F', 'CFR'].includes(terms);
  const noIns = ['CIF', 'CI'].includes(terms);
  const invCur = String(f.currency || f.invoiceCurrency || '').toUpperCase();
  const lbl = { color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' };
  const head = { ...lbl, textAlign: 'center', color: '#64748b' };
  const box = (name, opts = {}) => {
    const off = !!opts.off;
    return <input type="text" name={name} inputMode={opts.text ? undefined : 'decimal'} list={opts.list} maxLength={opts.max} placeholder={off ? '-' : (opts.ph || '')}
      title={off ? `Terms ${terms} already include this charge` : (opts.title || '')} disabled={off} className="input-field"
      value={off ? '' : (f[name] ?? '')} onChange={handleInvoiceFieldChange}
      style={{ width: '100%', color: 'var(--primary-color-end)', border: '1px solid ' + (opts.red ? '#ef4444' : '#cbd5e1'), background: off ? '#f1f5f9' : '#fff', textTransform: opts.upper ? 'uppercase' : 'none', ...(opts.style || {}) }} />;
  };
  const cur = (name, off) => box(name, { off, list: 'inv-currency-list', max: 3, text: true, upper: true, ph: invCur || 'CUR', title: 'Currency of the amount (blank = invoice currency ' + (invCur || '') + ')' });
  const row = (label, amt, rate, curName, off, extra) => (
    <React.Fragment key={label}>
      <label style={lbl}>{label}</label>
      {box(amt, { off, ph: 'Amount', title: label + ' amount' })}
      {box(rate, { off, ph: '%', title: label + ' as % of the invoice value (amount OR rate)' })}
      {cur(curName, off)}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>{extra || null}</div>
    </React.Fragment>
  );
  return (
    <>
      <div style={{ background: 'var(--primary-bg-light)', padding: '4px 8px', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', borderBottom: '1px solid var(--primary-border)', borderTopLeftRadius: '4px', borderTopRightRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>Freight, Insurance &amp; Other Charges</span>
        <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'none', color: 'var(--text-muted, #64748b)' }}>amount OR rate per charge; {terms ? 'terms ' + terms + (noFreight && noIns ? ' include freight and insurance' : noFreight ? ' include freight' : noIns ? ' include insurance' : ': freight and insurance are declared here') : 'enter the Terms first'}</span>
      </div>
      <div style={{ background: 'var(--bg-panel, #ffffff)', padding: '6px 8px', border: '1px solid var(--primary-border)', borderTop: 'none', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px', display: 'grid', gridTemplateColumns: '130px 110px 70px 60px 1fr 130px 110px 70px 60px 1fr', gap: '4px 8px', alignItems: 'center' }}>
        <span /><span style={head}>Amount</span><span style={head}>Rate %</span><span style={head}>Cur</span><span />
        <span /><span style={head}>Amount</span><span style={head}>Rate %</span><span style={head}>Cur</span><span />
        {row('Freight', 'freightValue', 'freightRate', 'freightCurrency', noFreight,
          <><label style={lbl} title="Y = actual freight amount declared, N = notional (rate / included)">Actual</label>
            {box('whetherFreightActual', { off: noFreight, max: 1, text: true, upper: true, ph: 'Y/N', style: { width: '46px', textAlign: 'center' } })}</>)}
        {row('Insurance', 'insuranceValue', 'insuranceRate', 'insuranceCurrency', noIns)}
        {row('Misc. charges', 'miscCharges', 'miscChargesRate', 'miscCurrency', false,
          <span style={{ fontSize: '10px', color: '#64748b' }} title="The charge-wise rows (brokerage, packing, royalties ...) are in the Misc. Charges [Not Included] popup">{(() => { let r = f.miscChargeRows; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } } return Array.isArray(r) && r.length ? r.length + ' charge row(s)' : ''; })()}</span>)}
        {row('Loading charges', 'loadingAmount', 'loadingRate', 'loadingCurrency', false)}
        {row('Agency commission', 'agencyCommAmount', 'agencyCommRate', 'agencyCommCurrency', false)}
        {row('Discount', 'discountAmount', 'discountRate', 'discountCurrency', false,
          <><label style={lbl}>Nature</label>{box('natureOfDiscount', { text: true, max: 35, ph: 'e.g. TRADE DISCOUNT', upper: true, style: { flex: 1 } })}</>)}
        {row('HSS load', 'hssLoadAmount', 'hssLoadRate', 'hssCurrency', false,
          <><label style={lbl} title="Landing charges % (ICEGATE landingRate); blank = the ICES default">Landing %</label>{box('landingRate', { ph: 'default', style: { width: '90px' } })}</>)}
        <datalist id="inv-currency-list">{(masters?.currencies || []).map(c => <option key={c.currencyCode} value={c.currencyCode}>{c.currencyName}</option>)}</datalist>
      </div>
    </>
  );
}
