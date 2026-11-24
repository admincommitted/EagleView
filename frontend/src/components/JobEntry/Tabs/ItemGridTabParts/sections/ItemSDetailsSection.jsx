// Screen section: Item's Details
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckSquare, Info } from 'lucide-react';
import React from 'react';
import { refreshItemDutyBoxes } from '../helpers';

export default function ItemSDetailsSection({ ctx }) {
  const { handleDutyCalculate, jobData, openIgstModal, openSvbModal, selectedItem, transportMode, items, selectedRowId, nextItemSr, openTariffSearch, autoDesc, setAutoDesc, setFormValue, invoices } = ctx;
  // Total Amount = quantity x unit price, and the duty estimate follows. 30-Oct-2026: these two boxes used a
  // document-wide [name="qty"] / [name="price"] lookup - the Customs CVD and Other Duty popups have boxes of the
  // same names, so an open popup could be read or written instead of the item form. Everything goes through the
  // item form now, and the duty boxes are refreshed as well (a specific rate is multiplied by the quantity).
  // 22-Nov-2026: ex-bond item - the warehouse figures were kept with the item but never shown (only MODIFY refused a
  // quantity above the balance). whQty follows the Quantity box so "left" changes while typing.
  const [whQty, setWhQty] = React.useState(null);
  React.useEffect(() => { setWhQty(null); }, [selectedRowId]);
  const whLine = (() => {
    if (!selectedItem || selectedItem._whBalanceQty === undefined || selectedItem._whBalanceQty === null) return null;
    const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
    const bal = num(selectedItem._whBalanceQty), orig = num(selectedItem._whOriginalQty), cleared = num(selectedItem._whClearedQty), draft = num(selectedItem._whDraftQty);
    const q = num(whQty === null ? (selectedItem.qty || selectedItem.quantity) : whQty); const left = Math.round((bal - q) * 1e6) / 1e6;
    return { bal, orig, cleared, draft, q, left };
  })();
  const recalcValue = () => {
    const f = document.getElementById('item-form'); if (!f) return;
    const num = (n) => { const e = f.elements[n]; return parseFloat(String(e && e.value).replace(/,/g, '')) || 0; };
    const v = f.elements.value;
    if (v) v.value = (num('qty') * num('price')).toFixed(2);
    refreshItemDutyBoxes(selectedItem, invoices || jobData?.invoices || [], jobData || {});
  };
  // 29-Oct-2026: Item Sr No on the first row (it was only shown with "Add In Middle = Y", yet the save needs it, so a
  // normal new item could not be saved); next free number of the chosen invoice for a new item. RITC / CTH / CETH
  // with (i) lookup on the Tariff master, next to Rate Type / Calculator / Product Code, as on the item screens the
  // CHAs are used to.
  const invSrOf = (invNo) => { const i = (jobData?.invoices || []).findIndex(inv => (inv.invNo || inv.invoiceSerialNumber) === invNo); return i >= 0 ? String(i + 1) : '1'; };
  const defaultSr = selectedItem.itemSrNo || (nextItemSr ? nextItemSr(items || [], selectedItem.invSrNo || invSrOf(selectedItem.invNo)) : '1');
  // invoice changed in the box: the selected item's own Sr No when it is that item's invoice, else the next free number there
  const srForInvoice = (invNo) => { const sr = invSrOf(invNo); const own = selectedItem && selectedItem.id === selectedRowId && String(selectedItem.invSrNo || invSrOf(selectedItem.invNo)) === sr; return own ? String(selectedItem.itemSrNo || '') : (nextItemSr ? nextItemSr(items || [], sr) : '1'); };
  const codeBox = (name, label, ph) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <label style={{ fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap' }}>{label}</label>
      <input name={name} type="text" defaultValue={selectedItem?.[name] || (name === 'ritc' ? selectedItem?.hsCode : '') || ''} placeholder={ph} maxLength={8} onBlur={name === 'ritc' ? (e) => { if (ctx.autoTariff) ctx.autoTariff(e.target.value); } : undefined}
        style={{ width: '110px', padding: '4px 6px', border: '1px solid ' + (name === 'ritc' ? '#ef4444' : '#cbd5e1'), borderRadius: '4px', fontSize: '13px', background: '#fefce8', letterSpacing: '0.5px' }} />
      <Info size={15} color="#1d4ed8" style={{ cursor: 'pointer' }} title={'Search ' + label + ' in the Tariff master'} onClick={() => openTariffSearch && openTariffSearch(name)} />
    </div>);
  return (
    <>
    {/* 22-Nov-2026: what earlier jobs used for this product (useItemGridTab1 askItemHistory) */}
    {ctx.itemHistory && ctx.itemHistory.options.length > 0 && (
      <div data-item-history style={{ border: '1px solid #c4b5fd', background: '#f5f3ff', borderRadius: '4px', marginBottom: '6px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderBottom: '1px solid #ddd6fe', color: '#5b21b6', fontWeight: 700 }}>
          <span>Last used for this product</span>
          <span style={{ fontWeight: 400, color: '#6d28d9' }}>{ctx.itemHistory.options.length > 1 ? 'Earlier jobs used more than one heading - pick the right one.' : 'Only blank boxes are filled; nothing is saved before SAVE / MODIFY.'}</span>
          <button type="button" onClick={() => ctx.setItemHistory(null)} title="Hide" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6d28d9', fontWeight: 700 }}>x</button>
        </div>
        {ctx.itemHistory.options.map((g, k) => { const F = g.fields || {}; const dt = String(g.lastJobDate || '').slice(0, 10).split('-').reverse().join('-');
          const how = g.scope === 'others' ? 'Other client' + (g.importer ? ': ' + g.importer : '') : g.matchedBy === 'similar' ? 'This importer - description starts the same' : g.matchedBy === 'model' ? 'This importer - same model no' : 'This importer - same description';
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 8px', borderTop: k ? '1px solid #ede9fe' : 'none', flexWrap: 'wrap' }}>
              <button type="button" data-history-use onClick={() => ctx.applyItemHistory(g)} className="btn btn-primary" style={{ padding: '2px 12px', fontSize: '11px', fontWeight: 700 }}>Use</button>
              <span style={{ fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>RITC {F.ritc}</span>
              <span>BCD {F.bcdRate === null || F.bcdRate === undefined || F.bcdRate === '' ? '-' : F.bcdRate + '%'}</span>
              <span>IGST {F.igstData && F.igstData.rate !== '' ? F.igstData.rate + '%' + (F.igstData.srNo ? ' (' + F.igstData.notnNo + ' Sl ' + F.igstData.srNo + ')' : '') : '-'}</span>
              {F.uqc ? <span>UQC {F.uqc}</span> : null}
              {g.lastPrice ? <span title="Unit price of the earlier entry - shown only, not filled">last price {g.lastPrice} {g.lastCurrency || ''}</span> : null}
              <span style={{ color: g.scope === 'others' || g.matchedBy !== 'description' ? '#b45309' : '#166534', fontWeight: 600 }}>{how}</span>
              <span style={{ color: '#64748b' }}>{g.count} time(s) in {g.jobs} job(s), last job {g.lastJobNo}{dt ? ' of ' + dt : ''}</span>
              {g.matchedBy === 'similar' || g.scope === 'others' ? <span style={{ color: '#64748b', maxWidth: '420px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.description}>"{g.description}"</span> : null}
            </div>); })}
      </div>
    )}
    {/* 22-Nov-2026: BCD exemption / concession notifications for the RITC (useItemGridTab1 askBcdExemptions) */}
    {ctx.bcdExemptions && ctx.bcdExemptions.options.length > 0 && (() => { const X = ctx.bcdExemptions; return (
      <div data-bcd-exemptions style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: '4px', marginBottom: '6px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderBottom: '1px solid #fde68a', color: '#92400e', fontWeight: 700 }}>
          <span>BCD notifications for RITC {X.ritc}</span>
          <span style={{ fontWeight: 400 }}>{X.tariffBcd === null ? '' : 'Tariff rate ' + X.tariffBcd + '%. '}{X.itemsFiled ? X.itemsFiled + ' item(s) of this RITC in earlier jobs.' : 'No earlier job has this RITC.'} An exemption has conditions - check them.</span>
          <button type="button" onClick={() => ctx.setBcdExemptions(null)} title="Hide" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontWeight: 700 }}>x</button>
        </div>
        {X.options.map((g, k) => { const dt = String(g.lastUsed || '').slice(0, 10).split('-').reverse().join('-'); const share = X.itemsFiled && g.used ? Math.round(g.used * 100 / X.itemsFiled) : 0;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 8px', borderTop: k ? '1px solid #fef3c7' : 'none', flexWrap: 'wrap' }}>
              <button type="button" data-exemption-use onClick={() => ctx.applyBcdExemption(g)} className="btn btn-primary" style={{ padding: '2px 12px', fontSize: '11px', fontWeight: 700 }}>Use</button>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{g.notifNo}{g.serialNo ? ' Sl ' + g.serialNo : ''}</span>
              <span style={{ fontWeight: 700 }}>BCD {g.rate === null || g.rate === undefined ? '-' : g.rate + '%'}</span>
              {g.used > 0
                ? <span style={{ color: '#166534', fontWeight: 600 }}>filed on {g.used} of {X.itemsFiled} item(s){share ? ' (' + share + '%)' : ''}, {g.importers} importer(s){dt ? ', last ' + dt : ''}</span>
                : <span style={{ color: '#b45309', fontWeight: 600 }}>in the Notification master - not filed here yet</span>}
              {g.used > 0 && !g.inMaster ? <span style={{ color: '#b45309' }}>not in the Notification master</span> : null}
              {g.conditionNo ? <span>condition {g.conditionNo}</span> : null}
              {g.countries && g.countries.length ? <span style={{ color: '#b45309' }}>country notification ({g.countries.slice(0, 5).join(', ')}{g.countries.length > 5 ? ' ...' : ''}) - certificate of origin</span> : null}
              {g.description ? <span style={{ color: '#64748b', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.description}>{g.description}</span> : null}
            </div>); })}
        {X.also.length > 0 && <div style={{ padding: '4px 8px', borderTop: '1px solid #fef3c7', color: '#64748b' }}>Also in the Notification master for this RITC (several serials - pick the serial from the notification): {X.also.map(a => a.notifNo + ' (' + a.serials + ')').join(', ')}</div>}
      </div>); })()}
    {/* Item's Details */}
        <div style={{ background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--primary-border)', borderRadius: '4px' }}>
          <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>
            Item's Details {transportMode === 'A' ? '(Air Shipment)' : transportMode === 'L' ? '(Land Shipment)' : '(Sea Shipment)'}
          </div>
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            {/* row 1: invoice / serial / rate type / product code - row 2: tariff codes + calculator (two rows, nothing wraps) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '160px', minWidth: '160px', whiteSpace: 'nowrap', color: '#000', fontSize: '15px' }}>Inv No.</label>
              <select name="invNo" className="input-field" defaultValue={selectedItem.invNo || ''} style={{ width: '140px', border: '1px solid #ef4444' }}
                onChange={(e) => { if (setFormValue) setFormValue('itemSrNo', srForInvoice(e.target.value)); }}>
                  <option value="">--Select--</option>
                  {jobData?.invoices?.map((inv, idx) => (
                    <option key={idx} value={inv.invNo || inv.invoiceSerialNumber}>{inv.invNo || inv.invoiceSerialNumber}</option>
                  ))}
                </select>
              <label style={{ fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', marginLeft: '12px' }}>Item Sr. No.</label>
              <input type="text" name="itemSrNo" className="input-field" defaultValue={defaultSr} title="Serial of the item within its invoice - the next free number for a new item" style={{ width: '56px', border: '1px solid #ef4444', textAlign: 'center', background: '#fef2f2' }} />
              <label style={{ fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', marginLeft: '12px' }}>Rate Type</label>
                {/* 30-Oct-2026: a drop-down instead of a 1-letter box; ICEGATE takes only S or P, a new item starts as S */}
                <select name="rateTypeFlag" className="input-field" defaultValue={/^P/i.test(String(selectedItem.rateTypeFlag || '')) ? 'P' : 'S'} title="S = standard rate, P = preferential (FTA / CEPA notification) rate - with P the BCD notification must be the trade-agreement one and a COO certificate goes in the item's supporting docs"
                          style={{ width: '150px', border: '1px solid #ef4444', color: 'var(--primary-color-end, #075985)', fontWeight: 600 }}>
                  <option value="S">S - Standard</option>
                  <option value="P">P - Preferential (FTA)</option>
                </select>
              <label style={{ fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', marginLeft: 'auto' }}>Product Code</label>
              <input type="text" name="productCode" className="input-field" defaultValue={selectedItem.productCode || ''} style={{ width: '140px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '160px', minWidth: '160px', whiteSpace: 'nowrap', color: '#000', fontSize: '15px' }}>Tariff (HS)</label>
              {codeBox('ritc', 'RITC *', 'RITC')}
              <span style={{ width: '12px' }} />
              {codeBox('cth', 'CTH', 'CTH')}
              <span style={{ width: '12px' }} />
              {codeBox('ceth', 'CETH', 'CETH')}
              <button type="button" onClick={handleDutyCalculate} className="btn btn-secondary" style={{ marginLeft: '16px', background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                  <CheckSquare size={12} /> Customs Duty Calculator
                </button>
              <span title="Picking a RITC from the Tariff master also fills CTH / CETH, UQC and the description" style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>ⓘ = Tariff master search</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '160px', minWidth: '160px', whiteSpace: 'nowrap', color: '#000', fontSize: '15px' }}>Item Description</label>
                {/* switch: on = the tariff text of a picked RITC replaces the description; off = only fills an empty box */}
                <div role="switch" aria-checked={!!autoDesc} title={autoDesc ? 'Auto: the picked RITC\'s tariff description replaces this box (click to switch off)' : 'Manual: a picked RITC fills this box only when it is empty (click to switch on)'} onClick={() => setAutoDesc && setAutoDesc(!autoDesc)}
                  style={{ position: 'relative', width: '40px', height: '22px', borderRadius: '34px', backgroundColor: autoDesc ? '#16a34a' : '#cbd5e1', cursor: 'pointer', transition: '.3s', flex: 'none' }}>
                  <span style={{ position: 'absolute', height: '16px', width: '16px', left: autoDesc ? '21px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s' }} />
                </div>
                <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>{autoDesc ? 'from tariff' : 'manual'}</span>
                <input type="text" name="desc" className="input-field" onBlur={() => { if (ctx.askItemHistory) ctx.askItemHistory(false); }} defaultValue={selectedItem.desc || selectedItem.productDescription || ''} style={{ flex: 1, border: '1px solid #ef4444', background: '#f0fdf4' }} />
              </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '160px', minWidth: '160px', whiteSpace: 'nowrap', color: '#000', fontSize: '15px' }}>Desc Only in Checklist</label>
                <input type="text" name="descOnlyInChecklist" className="input-field" defaultValue={selectedItem?.descOnlyInChecklist || ''} style={{ flex: 1, color: '#94a3b8', border: '1px solid #0d9488' }} />
              </div>
              <div style={{ paddingLeft: '172px', fontSize: '12px', color: '#64748b', marginTop: '-4px' }}>
                [This Desc display only in checklist not in Customs Flatfile.]
              </div>
            

            {whLine && (
              <div className="wh-balance-line" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', margin: '2px 0 2px 168px', padding: '3px 10px', fontSize: '12px', textTransform: 'none', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '4px', color: '#4c1d95', width: 'fit-content' }}>
                <span>WH BE qty <b>{whLine.orig}</b></span>
                <span>Cleared by earlier ex-bonds <b>{whLine.cleared}</b></span>
                {whLine.draft > 0 && <span title="In other ex-bond jobs that are not filed yet - not deducted from the balance">In draft ex-bonds <b>{whLine.draft}</b></span>}
                <span>Balance <b>{whLine.bal}</b></span>
                <span style={{ color: whLine.left < 0 ? '#dc2626' : whLine.left === 0 ? '#15803d' : '#b45309', fontWeight: 700 }}>{whLine.left < 0 ? `Over the balance by ${-whLine.left}` : `Left in warehouse after this BE ${whLine.left}`}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ width: '160px', minWidth: '160px', whiteSpace: 'nowrap', color: '#000', fontSize: '15px' }}>Quantity</label>
              <input type="text" 
                name="qty" 
                className="input-field" 
                defaultValue={selectedItem.qty || selectedItem.quantity || ''} 
                style={{ width: '120px', border: '1px solid #ef4444', color: '#ef4444' }} 
                onChange={(e) => { recalcValue(); setWhQty(e.target.value); }}
              />
              
              <label style={{ width: '40px', fontWeight: 'bold', color: '#334155', textAlign: 'right' }}>Unit</label>
              <input type="text" name="uqc" list="uqc-list" className="input-field mandatory-field" title="Unit of measure - mandatory on every BE item" defaultValue={selectedItem?.uqc || selectedItem?.unit || ''} style={{ width: '80px', border: '1px solid #ef4444', color: '#16a34a', textTransform: 'uppercase' }} />
              
              <label style={{ width: '70px', fontWeight: 'bold', color: '#334155', textAlign: 'right' }}>Unit Price</label>
              <input type="text" 
                name="price" 
                className="input-field" 
                defaultValue={selectedItem.price || selectedItem.unitPrice || ''} 
                style={{ width: '120px', border: '1px solid #ef4444', color: '#ef4444' }} 
                onChange={() => recalcValue()}
              />
              
              <label style={{ width: '80px', fontWeight: 'bold', color: '#334155', textAlign: 'right' }}>Total Amount</label>
              <input type="text" name="value" className="input-field" defaultValue={selectedItem.value || selectedItem.assessableValue || ''} style={{ width: '120px', border: '1px solid #ef4444', color: '#ef4444' }} />
              
              <label style={{ width: '80px', fontWeight: 'bold', color: '#000', textAlign: 'right' }}>IGST Duty</label>
                <input type="text" 
                  name="igstDutyFlag"
                            className="input-field"
                            defaultValue={selectedItem.igstDutyFlag || ''}
                          style={{ width: '40px', border: '1px solid #ef4444', color: '#ef4444', textAlign: 'center' }} 
                onChange={(e) => {
                  if (e.target.value.toUpperCase() === 'Y') {
                    openIgstModal();
                  }
                }}
              />
              <Info size={14} color="var(--primary-color-end, var(--primary-color-end))" style={{ cursor: 'pointer' }} onClick={openIgstModal} />
              
              <label style={{ width: '100px', fontWeight: 'bold', color: '#334155', textAlign: 'right' }}>SVB <span style={{fontWeight: 'normal', color: '#94a3b8'}}>[Item Wise]</span></label>
                <input 
                  type="text" 
                  name="svbFlag"
                            className="input-field"
                            defaultValue={selectedItem.svbFlag || ''}
                          style={{ width: '40px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }} 
                onChange={(e) => {
                  if (e.target.value.toUpperCase() === 'Y') {
                    openSvbModal();
                  }
                }}
              />
              <Info size={14} color="var(--primary-color-end, var(--primary-color-end))" style={{ cursor: 'pointer' }} onClick={openSvbModal} />
            </div>

          </div>
        </div>

        {/* 3 Columns Section: Duty, Other Duty, Single Window */}
    </>
  );
}
