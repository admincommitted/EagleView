// Screen section: Invoice Details
// Split out of InvoiceGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import ModernDatePicker from '../../../../common/ModernDatePicker';
import React from 'react';
import RichAutocomplete from '../../../../../components/common/RichAutocomplete';
import { PER_100_CURRENCIES } from '../../../../../utils/cbicExchange';

export default function InvoiceDetailsSection({ ctx }) {
  const { handleAdditionalDetailsChange, handleAeoChange, handleBrokerChange, handleConditionsChange, handleInvoiceFieldChange, handleMiscIncludedChange, handleMiscNotIncludedChange, handleOtherInfoChange, handleSupplierSellerChange, handleSvbChange, handleTermsChange, handleThirdPartyChange, invoiceFormData, invoices, jobData, masters, setActiveTerm, setInvoiceFormData, setIsAddressModalOpen, setIsBrokerModalOpen, setIsConditionsModalOpen, setIsMiscIncludedModalOpen, setIsMiscNotIncludedModalOpen, setIsOtherInfoModalOpen, setIsSellerModalOpen, setIsSvbModalOpen, setIsTermsModalOpen } = ctx;
  // 30-Oct-2026: every popup used to open only while the operator TYPED the flag, so a saved invoice (or one read from
  // a file) could not be opened again - the details were in the job but unreachable. Each flag now has an "open" button.
  const Open = ({ onClick, title }) => (
    <button type="button" onClick={onClick} title={title} style={{ border: '1px solid var(--primary-border, #cbd5e1)', background: 'var(--primary-bg-light, #f1f5f9)', color: 'var(--primary-text, #334155)', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Open</button>
  );
  // exchange rate of the invoice currency (the job's rate rows; "Update Exchange Rate" fills them)
  const rateRow = (() => {
    let r = jobData?._exchangeRates; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } }
    const cur = String(invoiceFormData?.currency || invoiceFormData?.invoiceCurrency || '').trim().toUpperCase();
    const row = (Array.isArray(r) ? r : []).find(x => String(x.currencyCode || '').trim().toUpperCase() === cur) || null;
    if (row || !cur || cur === 'INR') return row;
    // 17-Nov-2026: before the invoice is added the job has no rate row yet - the box was empty and "Update Exchange
    // Rate" said all invoices are in INR. The Currency master's import rate is shown meanwhile; it is put on the job
    // when the invoice is added (or with "Update Exchange Rate").
    // 20-Nov-2026: the rate in force on the job's rate day (the BE date when there is one), as the invoice will take it
    const m = (typeof ctx.masterFor === 'function' ? ctx.masterFor(cur) : null) || (masters?.currencies || []).find(x => String(x.currencyCode || '').trim().toUpperCase() === cur);
    const per = PER_100_CURRENCIES.includes(cur) ? 100 : 1;
    return m && parseFloat(m.importRate) ? { currencyCode: cur, rate: +(parseFloat(m.importRate) * per).toFixed(4), unitInRs: per, effectiveDate: m.effectiveDate, source: (m.notificationNo ? m.notificationNo + ', ' : '') + 'in force ' + (ctx.rateDayLabel || 'today') + ' - put on the job when the invoice is added' } : null;
  })();
  const flagRow = (label, name, handler, open, openTitle, extra, derived) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={{ width: '260px', minWidth: '260px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>{label}</label>
      <input type="text" name={name} maxLength={1} className="input-field mandatory-field" placeholder="Y/N" value={invoiceFormData[name] || (derived ? 'Y' : '')}
        onChange={(e) => { const v = { target: { name, value: e.target.value.toUpperCase() } }; handleInvoiceFieldChange(v); if (handler) handler(v); }}
        style={{ width: '50px', color: '#ef4444', border: '1px solid #ef4444', paddingLeft: '8px', textTransform: 'uppercase' }} />
      {open ? <Open onClick={open} title={openTitle} /> : null}
      {extra || null}
    </div>
  );
  return (
    <>
    {/* Panel 1: Invoice Details */}
        <div style={{ background: 'var(--primary-bg-light)', padding: '4px 8px', borderTopLeftRadius: '4px', borderTopRightRadius: '4px', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', borderBottom: '1px solid var(--primary-border)' }}>
            Invoice Details
          </div>
        <div style={{ background: 'var(--bg-panel, #ffffff)', padding: '8px', border: '1px solid var(--primary-border)', borderTop: 'none', display: 'flex', flexDirection: 'column', gap: '8px', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' }}>
          
          {/* SVB Loading field removed from here */}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1 }}>
    <label style={{ color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' }}>Invoice Sr No</label>
    {/* Sr No = position in the list (items are linked by it); it is not typed. 28-Oct-2026 */}
    <input type="text" className="input-field" readOnly title="Set by the order of the invoices (use Arrange Sr No)" value={invoiceFormData.id && invoices.some(i => i.id === invoiceFormData.id) ? (invoices.findIndex(i => i.id === invoiceFormData.id) + 1) : (invoices.length + 1) + ' (new)'} style={{ flex: 1, color: '#64748b', background: '#f8fafc', border: '1px solid #cbd5e1', paddingLeft: '8px' }} />
  </div>
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1.5 }}>
    <label style={{ color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' }}>Invoice No</label>
    <input type="text" name="invNo" className="input-field mandatory-field" value={invoiceFormData.invNo || '' || ''} onChange={handleInvoiceFieldChange} style={{ flex: 1, color: '#ef4444', border: '1px solid #ef4444', paddingLeft: '8px' }} />
  </div>
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1.2 }}>
    <label style={{ color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' }}>Invoice Date</label>
    <ModernDatePicker name="invDate" className="input-field" value={invoiceFormData.invDate || invoiceFormData.invoiceDate || ''} onChange={(e) => handleInvoiceFieldChange({target: {name: 'invDate', value: e?.target?.value !== undefined ? e.target.value : e}})} style={{ flex: 1, color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #cbd5e1', paddingLeft: '8px' }} />
  </div>
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1.2 }}>
    <label style={{ color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' }}>Invoice Value</label>
    <input type="text" name="value" className="input-field mandatory-field" value={invoiceFormData.value || invoiceFormData.invValue || ''} onChange={handleInvoiceFieldChange} style={{ flex: 1, color: '#ef4444', border: '1px solid #ef4444', paddingLeft: '8px' }} />
  </div>
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1 }}>
    <label style={{ color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' }}>Currency</label>
    <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
      <RichAutocomplete 
                    options={masters.currencies || []}
                    value={invoiceFormData?.currency || ''}
                    onChange={v => setInvoiceFormData(prev => ({...prev, currency: v}))}
                    onSelect={c => setInvoiceFormData(prev => ({...prev, currency: c.currencyCode}))}
                    searchFilter={(c, q) => c.currencyName?.toLowerCase()?.includes(q?.toLowerCase()) || c.currencyCode?.toLowerCase()?.includes(q?.toLowerCase())}
                    renderOption={c => (
                      <>
                        <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start)', fontSize: '11px' }}>{c.currencyCode}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{c.currencyName}</div>
                      </>
                    )}
                    placeholder="CUR"
                    inputStyle={{ color: 'var(--primary-color-end)', border: '1px solid #cbd5e1' }}
                  />
      {/* 30-Oct-2026: the exchange rate of this invoice's currency (from the job's rate rows). Read-only - the toolbar's
          "Update Exchange Rate" fills / changes it; before this it was only visible inside that popup. */}
      <input type="text" readOnly value={rateRow ? String(rateRow.rate) + (Number(rateRow.unitInRs) > 1 ? '/' + rateRow.unitInRs : '') : ''}
        placeholder="RATE" title={rateRow ? 'Exchange rate ' + rateRow.rate + (Number(rateRow.unitInRs) > 1 ? ' per ' + rateRow.unitInRs + ' ' + rateRow.currencyCode + ' (CBIC Schedule II), i.e. Rs ' + (Number(rateRow.rate) / Number(rateRow.unitInRs)).toFixed(4) + ' each' : '') + (rateRow.effectiveDate ? ' w.e.f. ' + String(rateRow.effectiveDate).slice(0, 10) : '') + (rateRow.source ? ' (' + rateRow.source + ')' : '') : 'No exchange rate for this currency - use "Update Exchange Rate"'}
        className="input-field" style={{ width: '72px', background: '#f1f5f9', color: 'var(--primary-color-end)', border: '1px solid ' + (rateRow ? '#cbd5e1' : '#ef4444'), textAlign: 'right' }} />
    </div>
  </div>
</div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1 }}>
    <label style={{ color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' }}>Terms <span style={{fontWeight: 'normal', color: '#94a3b8'}}>[FOB/CF/CI/CIF]</span></label>
    <input list="invoice-terms-list" type="text" name="terms" maxLength={4} placeholder="FOB" className="input-field mandatory-field" value={invoiceFormData.terms || invoiceFormData.termsOfInvoice || ''} onChange={(e) => { const v = { target: { name: 'terms', value: e.target.value.toUpperCase() } }; handleInvoiceFieldChange(v); handleTermsChange(v); }} style={{ flex: 1, color: '#ef4444', border: '1px solid #ef4444', textTransform: 'uppercase', paddingLeft: '8px' }} />
    <datalist id="invoice-terms-list">
      <option value="FOB">FOB - free on board (freight and insurance are declared)</option>
      <option value="CF">CF - cost and freight (freight included; insurance is declared)</option>
      <option value="CI">CI - cost and insurance (insurance included; freight is declared)</option>
      <option value="CIF">CIF - cost, insurance and freight (both included)</option>
    </datalist>
    <Open onClick={() => { setActiveTerm(String(invoiceFormData.terms || invoiceFormData.termsOfInvoice || '').toUpperCase()); setIsTermsModalOpen(true); }} title="Freight / insurance for these terms (the same boxes are on the form below)" />
  </div>
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1.5 }}>
    <label style={{ color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' }}>Miscellaneous Charges <span style={{fontWeight: 'normal', color: '#94a3b8'}}>[Included]</span></label>
    <input type="text" name="miscChargesIncluded" className="input-field" value={invoiceFormData.miscChargesIncluded || ''} onChange={(e) => { handleInvoiceFieldChange(e); handleMiscIncludedChange(e); }} style={{ flex: 1, color: '#ef4444', border: '1px solid var(--primary-border)', paddingLeft: '8px', textTransform: 'uppercase' }} />
    <Open onClick={() => setIsMiscIncludedModalOpen(true)} title="Charges already included in the invoice value" />
  </div>
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1.5 }}>
    <label style={{ color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', whiteSpace: 'nowrap' }}>Miscellaneous Charges <span style={{fontWeight: 'normal', color: '#94a3b8'}}>[Not Included]</span></label>
    <input type="text" name="miscChargesNotIncluded" className="input-field" value={invoiceFormData.miscChargesNotIncluded || ''} onChange={(e) => { handleInvoiceFieldChange(e); handleMiscNotIncludedChange(e); }} style={{ flex: 1, color: '#ef4444', border: '1px solid var(--primary-border)', paddingLeft: '8px', textTransform: 'uppercase' }} />
    <Open onClick={() => setIsMiscNotIncludedModalOpen(true)} title="Charge-wise rows not included in the invoice value (brokerage, packing, royalties ...)" />
  </div>
</div>

        </div>

        {/* Lower Split Form Panels */}
        <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
          
          {/* Panel 2: Supplier's Details */}
          <div style={{ flex: '1.2', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'var(--primary-bg-light)', padding: '4px 8px', borderTopLeftRadius: '4px', borderTopRightRadius: '4px', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', borderBottom: '1px solid var(--primary-border)' }}>
            Supplier's Details
          </div>
            <div style={{ background: 'var(--bg-panel, #ffffff)', padding: '8px', border: '1px solid var(--primary-border)', borderTop: 'none', display: 'flex', flexDirection: 'column', gap: '6px', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px', flex: 1 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '180px', minWidth: '180px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Supplier Name</label>
   <RichAutocomplete 
                    options={masters.parties || []}
                    value={invoiceFormData?.supplierName || ''}
                    onChange={v => setInvoiceFormData(prev => ({...prev, supplierName: v}))}
                    onSelect={p => {
                      // party master keeps the address on its branches when it has any
                      const b = (p.branches && p.branches.find(x => x.isDefault)) || (p.branches && p.branches[0]) || null;
                      setInvoiceFormData(prev => ({
                        ...prev, 
                        supplierName: p.name,
                        supplierAddress1: (b ? b.address1 : p.street) || prev.supplierAddress1,
                        supplierAddress2: (b ? [b.address2, b.city].filter(Boolean).join(', ') : p.city) || prev.supplierAddress2,
                        supplierAddress3: (b ? [b.state, b.pinCode].filter(Boolean).join(' ') : [p.stateProvince, p.zipPostcode].filter(Boolean).join(' ')) || prev.supplierAddress3,
                        supplierCountry: (b && b.country) || p.countryCode || prev.supplierCountry
                      }));
                    }}
                    searchFilter={(p, q) => p.name?.toLowerCase()?.includes(q?.toLowerCase())}
                    renderOption={p => (
                      <>
                        <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start)', fontSize: '11px' }}>{p.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{[p.street, p.city, p.stateProvince].filter(Boolean).join(', ')}</div>
                      </>
                    )}
                    placeholder="Search Supplier..."
                    inputStyle={{ background: '#f0fdf4', color: 'var(--primary-color-end)', border: '1px solid #cbd5e1' }}
                  />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '180px', minWidth: '180px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Address1</label>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input type="text" name="supplierAddress1" className="input-field" value={invoiceFormData.supplierAddress1 || '' || ''} onChange={handleInvoiceFieldChange} style={{ width: '100%', color: 'var(--primary-color-end)', background: '#fef9c3', border: '1px solid #cbd5e1', paddingRight: '24px' }} />
                  <div 
                    onClick={() => setIsAddressModalOpen(true)}
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}
                  >
                    i
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '180px', minWidth: '180px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Address2</label>
   <input type="text" name="supplierAddress2" className="input-field" value={invoiceFormData?.supplierAddress2 || '' || ''} onChange={handleInvoiceFieldChange} style={{ flex: 1, color: 'var(--primary-color-end)', border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '180px', minWidth: '180px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Address3</label>
   <input type="text" name="supplierAddress3" className="input-field" value={invoiceFormData?.supplierAddress3 || '' || ''} onChange={handleInvoiceFieldChange} style={{ flex: 1, color: 'var(--primary-color-end)', border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '180px', minWidth: '180px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Country</label>
   <RichAutocomplete 
                    options={masters.countries || []}
                    value={invoiceFormData?.supplierCountry || ''}
                    onChange={v => setInvoiceFormData(prev => ({...prev, supplierCountry: v}))}
                    onSelect={c => setInvoiceFormData(prev => ({...prev, supplierCountry: c.code}))}
                    searchFilter={(c, q) => c.name?.toLowerCase()?.includes(q?.toLowerCase()) || c.code?.toLowerCase()?.includes(q?.toLowerCase())}
                    renderOption={c => (
                      <>
                        <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start)', fontSize: '11px' }}>{c.code}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{c.name}</div>
                      </>
                    )}
                    placeholder="Search..."
                    inputStyle={{ color: 'var(--primary-color-end)', border: '1px solid #cbd5e1' }}
                  />
              </div>
              
              {/* 30-Oct-2026: supplierPin is an ICEGATE invoice field and had no box on any screen */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '180px', minWidth: '180px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>PIN / Zip</label>
                <input type="text" name="supplierPin" maxLength={10} className="input-field" placeholder="supplier's post code" value={invoiceFormData.supplierPin || ''} onChange={handleInvoiceFieldChange} style={{ flex: 1, color: 'var(--primary-color-end)', border: '1px solid #cbd5e1' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <label style={{ width: '180px', minWidth: '180px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Is Supplier & Seller Same</label>
                {/* own field: it used "buyerSellerRelated", which the BE JSON reads as "buyer and seller related" 28-Oct-2026 */}
                <input type="text" name="supplierSellerSame" maxLength={1} className="input-field mandatory-field" value={invoiceFormData.supplierSellerSame || ''} onChange={(e) => { handleInvoiceFieldChange(e); handleSupplierSellerChange(e); }} style={{ width: '50px', color: '#ef4444', border: '1px solid #ef4444', paddingLeft: '8px', textTransform: 'uppercase' }} />
                <Open onClick={() => setIsSellerModalOpen(true)} title="Seller (when the seller is not the supplier): name, address, country, PIN" />
                
                <label style={{ width: '100px', textAlign: 'right', color: '#334155', fontWeight: 'bold', marginLeft: 'auto', textTransform: 'uppercase', fontSize: '10px' }}>Broker Details</label>
                {/* own flag: it wrote into "buyer and seller related" */}
                <input type="text" name="brokerFlag" maxLength={1} className="input-field mandatory-field" value={invoiceFormData.brokerFlag || ''} onChange={(e) => { handleInvoiceFieldChange(e); handleBrokerChange(e); }} style={{ width: '50px', color: '#ef4444', border: '1px solid #ef4444', paddingLeft: '8px', textTransform: 'uppercase' }} />
                <Open onClick={() => setIsBrokerModalOpen(true)} title="Broker: name, address, country, PIN" />
              </div>

            </div>
          </div>

          {/* Panel 3: SVB Loading & Right side fields */}
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'var(--bg-panel, #ffffff)', padding: '8px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '7px', flex: 1 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '260px', minWidth: '260px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>SVB Loading</label>
                {/* Y/N switch; the SVB details (ref no, date, load %) are in the popup. Typing "Y" here went out as the SVB ref no. 28-Oct-2026 */}
                <input type="text" name="svbLoadingFlag" maxLength={1} className="input-field mandatory-field" value={invoiceFormData.svbLoadingFlag || (invoiceFormData.svbReferenceNumber ? 'Y' : '')} onChange={(e) => { handleInvoiceFieldChange(e); handleSvbChange(e); }} style={{ width: '50px', color: 'var(--primary-color-end)', border: '1px solid #ef4444', paddingLeft: '8px', textTransform: 'uppercase' }} />
                <Open onClick={() => setIsSvbModalOpen(true)} title="SVB details: reference no, date, load on value / duty" />
                <span style={{ fontSize: '10px', color: '#64748b' }}>{invoiceFormData.svbReferenceNumber ? 'Ref ' + invoiceFormData.svbReferenceNumber : ''}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '260px', minWidth: '260px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Whether Buyer and Seller are Related</label>
                <input type="text" name="whetherBuyerAndSellerAreRelated" maxLength={1} className="input-field mandatory-field" value={invoiceFormData.whetherBuyerAndSellerAreRelated || invoiceFormData.buyerSellerRelated || ''} onChange={(e) => handleInvoiceFieldChange({ target: { name: 'whetherBuyerAndSellerAreRelated', value: e.target.value.toUpperCase() } })} style={{ width: '50px', color: '#ef4444', border: '1px solid #ef4444', paddingLeft: '8px', textTransform: 'uppercase' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '260px', minWidth: '260px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Nature Of Transaction</label>
                <input list="nature-of-transaction" type="text" name="natureOfTransaction" maxLength={1} className="input-field mandatory-field" value={invoiceFormData.natureOfTransaction || ''} onChange={(e) => handleInvoiceFieldChange({ target: { name: 'natureOfTransaction', value: e.target.value.toUpperCase() } })} style={{ flex: 1, color: 'var(--primary-color-end)', border: '1px solid #ef4444', paddingLeft: '8px' }} />
                <datalist id="nature-of-transaction">
                  <option value="S">S - Sale</option><option value="C">C - Consignment</option><option value="H">H - Hire</option><option value="F">F - Free of cost</option><option value="O">O - Others</option><option value="R">R - Rent / lease</option><option value="P">P - Purchase on high seas</option><option value="G">G - Gift</option><option value="M">M - Mixed</option>
                </datalist>
              </div>

              {/* 29-Oct-2026: Terms of Payment was never on the screen (ICEGATE invoice field, every filed BE carries OTH / DP / LC ...) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '260px', minWidth: '260px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Terms Of Payment</label>
                <input list="payment-terms" type="text" name="paymentTerms" maxLength={3} className="input-field mandatory-field" value={invoiceFormData.paymentTerms || ''} onChange={(e) => handleInvoiceFieldChange({ target: { name: 'paymentTerms', value: e.target.value.toUpperCase() } })} placeholder="OTH" style={{ flex: 1, color: 'var(--primary-color-end)', border: '1px solid #ef4444', paddingLeft: '8px' }} />
                <datalist id="payment-terms">
                  <option value="OTH">OTH - Others</option><option value="AP">AP - Advance payment</option><option value="DP">DP - Delivery against payment</option><option value="DA">DA - Delivery against acceptance</option><option value="LC">LC - Letter of credit</option><option value="FC">FC - Free of cost</option>
                </datalist>
              </div>

              {/* 30-Oct-2026: these two boxes were lost when the tab was split - their popups (Other Relevant
                  Information, Conditions of Restrictions Attached with Sale) had no way left to open, so the data
                  could be neither entered nor seen. Both are ICEGATE invoice fields. */}
              {flagRow('Other Relevant Information', 'otherInfoFlag', handleOtherInfoChange, () => setIsOtherInfoModalOpen(true), 'Other relevant information declared with the invoice',
                <span style={{ fontSize: '10px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoiceFormData.otherRelevantInform || ''}</span>, !!invoiceFormData.otherRelevantInform)}
              {flagRow('Conditions / Restrictions on Sale', 'conditionsFlag', handleConditionsChange, () => setIsConditionsModalOpen(true), 'Conditions / restrictions attached with the sale (up to 5 lines)',
                <span style={{ fontSize: '10px', color: '#64748b' }}>{[1, 2, 3, 4, 5].filter(n => invoiceFormData['conditionsAttachedWithSale' + n]).length ? [1, 2, 3, 4, 5].filter(n => invoiceFormData['conditionsAttachedWithSale' + n]).length + ' line(s)' : ''}</span>, [1, 2, 3, 4, 5].some(n => invoiceFormData['conditionsAttachedWithSale' + n]))}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '260px', minWidth: '260px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Valuation Method</label>
                <input list="valuation-methods" type="text" name="valuationMethod" className="input-field mandatory-field" value={invoiceFormData.valuationMethod || ''} onChange={handleInvoiceFieldChange} style={{ flex: 1, color: 'var(--primary-color-end)', border: '1px solid #ef4444', paddingLeft: '8px' }} />
                <datalist id="valuation-methods">
                  <option value="Rule4 Transaction Value" />
                  <option value="Rule5 Identical Goods" />
                  <option value="Rule6 Similar Goods" />
                  <option value="Rule7 Deductive Value" />
                  <option value="Rule7A Computed Value" />
                  <option value="Rule8 Residual Method Others" />
                  <option value="Rule3 Determination method of valuation" />
                </datalist>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '120px', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Third Party Details</label>
                <input type="text" name="thirdPartyFlag" className="input-field" value={invoiceFormData.thirdPartyFlag || ''} onChange={(e) => { handleInvoiceFieldChange(e); handleThirdPartyChange(e); }} style={{ width: '40px', color: '#1e293b', fontWeight: 'bold', background: '#f0fdf4', border: '1px solid #16a34a', paddingLeft: '8px', textTransform: 'uppercase', textAlign: 'center' }} />
                
                <label style={{ flex: 1, textAlign: 'right', color: '#334155', fontWeight: 'bold', paddingRight: '4px', textTransform: 'uppercase', fontSize: '10px' }}>AEO Details</label>
                <input type="text" name="aeoFlag" className="input-field" value={invoiceFormData.aeoFlag || ''} onChange={(e) => { handleInvoiceFieldChange(e); handleAeoChange(e); }} style={{ width: '40px', color: '#1e293b', fontWeight: 'bold', background: '#f0fdf4', border: '1px solid #16a34a', paddingLeft: '8px', textTransform: 'uppercase', textAlign: 'center' }} />
                
                <label style={{ flex: 1, textAlign: 'right', color: '#334155', fontWeight: 'bold', paddingRight: '4px', textTransform: 'uppercase', fontSize: '10px' }}>Additional Details</label>
                <input type="text" name="additionalDetailsFlag" className="input-field" value={invoiceFormData.additionalDetailsFlag || ''} onChange={(e) => { handleInvoiceFieldChange(e); handleAdditionalDetailsChange(e); }} style={{ width: '40px', color: '#1e293b', fontWeight: 'bold', background: '#f0fdf4', border: '1px solid #16a34a', paddingLeft: '8px', textTransform: 'uppercase', textAlign: 'center' }} />
              </div>

            </div>
          </div>
        </div>

      {/* Dynamic Inline Sections based on Y/N toggles */}
    </>
  );
}
