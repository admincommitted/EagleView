// Screen section: Additional Details
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { ArrowUpDown, CheckSquare, Edit, Info, RefreshCw, X } from 'lucide-react';
import React from 'react';

export default function AdditionalDetailsSection({ ctx }) {
  const { addInMiddle, handleArrangeItemSerial, handleClear, handleDelete, handleDeleteMultiple, handleModify, handleSave, onValidate, openPolicyParaModal, openPreviousBeModal, saveItemTemplate, selectedItem, setAddInMiddle, useItemTemplate, jobData } = ctx;
  // 29-Oct-2026: the item particulars ICEGATE wants on every BE item (brand, model, end use are mandatory - the validator
  // refused every screen-typed BE because there was no box for them; generic description, manufacturer, country of
  // origin, accessories, source / transit country go in the item model too). Saved by SAVE / MODIFY like every other box.
  const P = (name, label, max, extra = {}) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', ...(extra.span ? { gridColumn: 'span ' + extra.span } : {}) }}>
      <label style={{ color: '#334155', fontWeight: 'bold', whiteSpace: 'nowrap', minWidth: extra.lw || '90px' }} title={extra.title || ''}>{label}</label>
      <input type="text" name={name} className="input-field" maxLength={max} placeholder={extra.ph || ''} defaultValue={selectedItem[name] || extra.dflt || ''} onBlur={name === 'model' ? () => { if (ctx.askItemHistory) ctx.askItemHistory(false); } : undefined}
        style={{ flex: 1, minWidth: 0, border: '1px solid ' + (extra.req ? '#ef4444' : '#cbd5e1'), textTransform: 'uppercase', ...(extra.style || {}) }} />
    </div>);
  const hdrCoo = (jobData && (jobData.autoField_20 || jobData.countryOfOrigin)) || '';
  return (
    <>
    <div style={{ background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--primary-border)', borderRadius: '4px' }}>
          <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>
            Item Particulars (ICEGATE)
          </div>
          <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {P('brandName', 'Brand *', 20, { req: true, ph: 'N.A. when none', title: 'Mandatory on every item - type N.A. when the goods have no brand' })}
            {P('model', 'Model *', 20, { req: true, ph: 'N.A. when none', title: 'Mandatory - N.A. when none' })}
            {P('endUse', 'End use *', 20, { req: true, ph: 'e.g. GNX200', title: 'ICEGATE end-use code, e.g. GNX200 (general), GNX100...' })}
            {P('countryOfOrigin', 'Country of origin', 2, { ph: hdrCoo || 'CC', dflt: '', title: 'Two-letter code; blank = the country of origin on the Job Header (' + (hdrCoo || '-') + ')' })}
            {P('genericDesc', 'Generic description', 60, { span: 2, lw: '130px', title: 'Generic name of the goods for ICEGATE (60 characters)' })}
            {P('manufacturer', 'Manufacturer', 50, { span: 2, lw: '90px' })}
            {P('accessories', 'Accessories', 2000, { span: 2, lw: '90px', ph: 'accessories supplied with the item, if any' })}
            {P('sourceCountry', 'Source country', 2, { ph: 'CC', title: 'Country the goods were bought from, when different' })}
            {P('transitCountry', 'Transit country', 2, { ph: 'CC' })}
          </div>
    </div>
    <div style={{ background: 'var(--bg-panel, #ffffff)', border: '1px solid var(--primary-border)', borderRadius: '4px' }}>
          <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>
            Additional Details
          </div>
          <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {/* 30-Oct-2026: the "Packing Details" Y/N box is gone - the BE carries packing with the IGM /
                  container rows, nothing read this flag. */}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ color: '#334155', fontWeight: 'bold' }}>Policy Para</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="text" name="policyParaFlag" className="input-field" defaultValue={selectedItem.policyParaFlag || ''} style={{ width: '40px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }} 
                  onChange={(e) => {
                    if (e.target.value.toUpperCase() === 'Y') {
                      openPolicyParaModal();
                    }
                  }}
                />
                <Info size={14} color="var(--primary-color-end, var(--primary-color-end))" style={{ cursor: 'pointer' }} onClick={openPolicyParaModal} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gridColumn: 'span 2' }}>
              <label style={{ color: '#334155', fontWeight: 'bold' }}>Customs Notn Exempting Central Excise Flag (C)</label>
                <input type="text" name="exciseFlag"
                            className="input-field"
                            defaultValue={selectedItem.exciseFlag || ''}
                          style={{ width: '40px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ color: '#334155', fontWeight: 'bold' }}>Print Gen Desc.</label>
              <input type="text" name="printGenDescFlag" className="input-field" defaultValue={selectedItem.printGenDescFlag || ''} style={{ width: '40px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ color: '#334155', fontWeight: 'bold' }}>Previous BE</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="text" name="previousBeFlag" className="input-field" defaultValue={selectedItem.previousBeFlag || ''} style={{ width: '40px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }} 
                  onChange={(e) => {
                    if (e.target.value.toUpperCase() === 'Y') {
                      openPreviousBeModal();
                    }
                  }}
                />
                <Info size={14} color="var(--primary-color-end, var(--primary-color-end))" style={{ cursor: 'pointer' }} onClick={openPreviousBeModal} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ color: '#334155', fontWeight: 'bold' }}>FOC</label>
              <input type="text" name="foc" className="input-field" defaultValue={selectedItem.foc || 'N'} style={{ width: '40px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }} />
              <label style={{ color: '#334155', fontWeight: 'bold', marginLeft: 'auto' }}>Add In Middle</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  value={addInMiddle}
                  onChange={(e) => setAddInMiddle(e.target.value.toUpperCase())}
                  style={{ width: '40px', border: '1px solid #cbd5e1', color: 'var(--primary-color-end, var(--primary-color-end))', textAlign: 'center' }} 
                />
                {addInMiddle === 'Y' && (
                  <span style={{ fontSize: '11px', color: '#9a3412', background: '#fed7aa', padding: '4px 10px', borderRadius: '4px' }}>Type the wanted Item Sr. No. in the box on the first row - later items move down</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
              {/* 30-Oct-2026: these were two Y/N boxes that saved a letter and did nothing. The item template master
                  (Masters > Item Template) already existed, so the buttons really save and re-use an item. */}
              <button type="button" onClick={saveItemTemplate} title="Save this item in the Item Template master so it can be used in any job" style={{ height: '24px', padding: '0 10px', fontSize: '11px', fontWeight: 'bold', border: '1px solid var(--primary-border, #cbd5e1)', background: 'var(--primary-bg-light, #f1f5f9)', color: 'var(--primary-text, #334155)', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add to Template</button>
              <button type="button" onClick={useItemTemplate} title="Add an item from the Item Template master to this invoice" style={{ height: '24px', padding: '0 10px', fontSize: '11px', fontWeight: 'bold', border: '1px solid var(--primary-border, #cbd5e1)', background: 'var(--primary-bg-light, #f1f5f9)', color: 'var(--primary-text, #334155)', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Use Template</button>
            </div>

          </div>
        </div>

        {/* Action Bottom Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 0 24px 0', marginTop: 'auto' }}>
          <button type="button" onClick={handleSave} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <CheckSquare size={14} /> Save
          </button>
          <button type="button" onClick={handleModify} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <Edit size={14} /> Modify
          </button>
          <button type="button" onClick={handleDelete} className="btn btn-danger" style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <X size={14} /> Delete
          </button>
          <button type="button" onClick={handleDeleteMultiple} className="btn btn-danger" style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <X size={14} /> Delete Multiple Item
          </button>
          <button type="button" onClick={handleArrangeItemSerial} title="Re-number the items of each invoice 1, 2, 3 ... in their present order"  className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <ArrowUpDown size={14} /> Arrange Item Serial No
          </button>
          <button type="button" onClick={handleClear} className="btn btn-primary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <RefreshCw size={14} /> Clear
          </button>
          <button type="button" onClick={onValidate} title="Check this job against the ICEGATE rules without saving or sending"  className="btn btn-danger" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <CheckSquare size={14} /> Validate Job
          </button>
        </div>
    </>
  );
}
