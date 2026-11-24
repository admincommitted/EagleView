// Screen section: Third Party Details
// Split out of InvoiceGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { ArrowUpDown, CheckSquare, Copy, Edit, RefreshCw, Settings2, X } from 'lucide-react';
import React from 'react';

export default function ThirdPartyDetailsSection({ ctx }) {
  const { handleArrangeSerial, handleClear, handleDelete, handleDeleteMultiple, handleDuplicateInvoice, handleInvoiceFieldChange, handleModify, handleSave, invoiceFormData, setInvoiceFormData, setShowAdditionalDetails, showAdditionalDetails, showAeoDetails, showThirdPartyDetails } = ctx;
  // 30-Oct-2026: "Other Details" was a dead button. It now opens / closes the Additional Details block (revenue deposit,
  // description, PO / contract / LC, hand carriage) and sets the flag with it, so those boxes are reachable without
  // typing Y in the Additional Details box.
  const toggleOther = () => {
    const on = !showAdditionalDetails;
    setShowAdditionalDetails(on);
    setInvoiceFormData(prev => ({ ...prev, additionalDetailsFlag: on ? 'Y' : '' }));
  };
  return (
    <>
    {(showThirdPartyDetails || showAeoDetails || showAdditionalDetails) && (
        <div style={{ marginTop: '15px', background: 'var(--bg-panel, #ffffff)', padding: '12px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {showThirdPartyDetails && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ margin: 0, color: 'var(--primary-text)', fontSize: '13px', background: 'var(--primary-bg-light)', padding: '4px 8px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>Third Party Details</h4>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '60px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Name</label>
                <input type="text" name="thirdPartyName" value={invoiceFormData.thirdPartyName || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="NAME" style={{ flex: 1, background: '#f0fdf4', border: '1px solid #cbd5e1' }} />
                
                <label style={{ width: '180px', minWidth: '180px', whiteSpace: 'nowrap', color: '#334155', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Address1</label>
                <input type="text" name="thirdPartyAddress1" className="input-field" value={invoiceFormData.thirdPartyAddress1 || ''} onChange={handleInvoiceFieldChange} style={{ flex: 1, color: 'var(--primary-color-end)', background: '#f0fdf4', border: '1px solid #cbd5e1' }} />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '60px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Address2</label>
                <input type="text" name="thirdPartyAddress2" value={invoiceFormData.thirdPartyAddress2 || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="ADDRESS2" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                
                <label style={{ width: '60px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>City</label>
                <input type="text" name="thirdPartyCity" value={invoiceFormData.thirdPartyCity || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="CITY" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                
                <label style={{ width: '80px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Sub-Division</label>
                <input type="text" name="thirdPartyCntrySubDvsn" value={invoiceFormData.thirdPartyCntrySubDvsn || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="SUB-DIVISION" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '60px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Pin</label>
                <input type="text" name="thirdPartyPin" value={invoiceFormData.thirdPartyPin || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="PIN" style={{ width: '120px', border: '1px solid #cbd5e1' }} />
                
                <label style={{ width: '60px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Country</label>
                <input list="country-list" type="text" name="thirdPartyCountryCode" value={invoiceFormData.thirdPartyCountryCode || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="COUNTRY" style={{ flex: 1, background: '#f0fdf4', border: '1px solid #cbd5e1' }} />
                
                <label style={{ width: '60px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Terms Place</label>
                <input type="text" name="termsPlace" value={invoiceFormData.termsPlace || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="TERMS PLACE" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
              </div>
            </div>
          )}

            
            {showAeoDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: showThirdPartyDetails ? '8px' : '0' }}>
                <h4 style={{ margin: 0, color: 'var(--primary-text)', fontSize: '13px', background: 'var(--primary-bg-light)', padding: '4px 8px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>AEO Details</h4>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '80px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>AEO Code</label>
                  <input type="text" name="authorizedEconomicOperatorCode" value={invoiceFormData.authorizedEconomicOperatorCode || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="AEO CODE" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                  
                  <label style={{ width: '80px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>AEO Country</label>
                  <input list="country-list" type="text" name="authorizedEconomicOperatorCountry" value={invoiceFormData.authorizedEconomicOperatorCountry || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="COUNTRY" style={{ flex: 1, background: '#f0fdf4', border: '1px solid #cbd5e1' }} />
                  
                  <label style={{ width: '80px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>AEO Role</label>
                  <input type="text" name="authorizedEconomicOperatorRole" value={invoiceFormData.authorizedEconomicOperatorRole || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="AEO ROLE" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                </div>
              </div>
            )}
            
            {showAdditionalDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: (showThirdPartyDetails || showAeoDetails) ? '8px' : '0' }}>
                <h4 style={{ margin: 0, color: 'var(--primary-text)', fontSize: '13px', background: 'var(--primary-bg-light)', padding: '4px 8px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>Additional Details</h4>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ width: '80px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Revenue (%)</label>
                  <input type="text" name="revenuePercent" value={invoiceFormData.revenuePercent || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ width: '80px', border: '1px solid #cbd5e1' }} />
                  
                  <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Revenue Deposit On [Ass. Val/Duty/Both]</label>
                  <input type="text" name="revenueDepositOn" value={invoiceFormData.revenueDepositOn || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ width: '60px', border: '1px solid #cbd5e1' }} />
                  
                  <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Description</label>
                  <input type="text" name="additionalDescription" value={invoiceFormData.additionalDescription || ''} onChange={handleInvoiceFieldChange} className="input-field" placeholder="DESCRIPTION" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                  
                  <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Relationship [B/W Buyer & Seller]</label>
                  <input type="text" name="buyerSellerRelationship" value={invoiceFormData.buyerSellerRelationship || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ width: '40px', color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                  
                  <label style={{ color: 'var(--text-main, var(--text-main, #1e293b))' }}>Hand Carriage [Y/N]</label>
                  <input type="text" name="handCarriage" value={invoiceFormData.handCarriage || ''} onChange={handleInvoiceFieldChange} className="input-field" style={{ width: '40px', color: 'var(--primary-color-end, var(--primary-color-end))', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', padding: '8px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: 'var(--primary-text)', fontSize: '12px', background: 'var(--primary-bg-light)', padding: '4px 8px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>Purchase Order Details</h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ width: '30px' }}>No</label>
                      <input name="purchaseOrderNumber" value={invoiceFormData.purchaseOrderNumber || ''} onChange={handleInvoiceFieldChange} type="text" className="input-field" placeholder="NO" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                      <label style={{ width: '40px' }}>Date</label>
                      <input name="purchaseOrderDate" value={invoiceFormData.purchaseOrderDate || ''} onChange={handleInvoiceFieldChange} type="text" className="input-field" placeholder="DATE" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', padding: '8px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: 'var(--primary-text)', fontSize: '12px', background: 'var(--primary-bg-light)', padding: '4px 8px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>Contract Details</h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ width: '30px' }}>No</label>
                      <input name="contractNumber" value={invoiceFormData.contractNumber || ''} onChange={handleInvoiceFieldChange} type="text" className="input-field" placeholder="NO" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                      <label style={{ width: '40px' }}>Date</label>
                      <input name="contractDate" value={invoiceFormData.contractDate || ''} onChange={handleInvoiceFieldChange} type="text" className="input-field" placeholder="DATE" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', padding: '8px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: 'var(--primary-text)', fontSize: '12px', background: 'var(--primary-bg-light)', padding: '4px 8px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>Letter Of Credit Details</h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ width: '30px' }}>No</label>
                      <input name="lcNumber" value={invoiceFormData.lcNumber || ''} onChange={handleInvoiceFieldChange} type="text" className="input-field" placeholder="NO" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                      <label style={{ width: '40px' }}>Date</label>
                      <input name="lcDate" value={invoiceFormData.lcDate || ''} onChange={handleInvoiceFieldChange} type="text" className="input-field" placeholder="DATE" style={{ flex: 1, border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>
                </div>
                
              </div>
            )}
            
          </div>
        )}

        {/* Action Bottom Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 0 4px 0', borderTop: '1px solid var(--border-color, #cbd5e1)', marginTop: 'auto' }}>
          <button type="button" onClick={handleSave} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <CheckSquare size={14} /> Save
          </button>
          <button type="button" onClick={handleModify} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <Edit size={14} /> Modify
          </button>
          <button type="button" onClick={handleDelete} className="btn btn-danger" style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <X size={14} /> Delete
          </button>
          <button type="button" onClick={handleDeleteMultiple} className="btn btn-danger" style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <X size={14} /> Delete Multiple Invoice
          </button>
          <button type="button" onClick={handleClear} className="btn btn-primary" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <RefreshCw size={14} /> Clear
          </button>
          <button type="button" onClick={handleDuplicateInvoice} className="btn btn-info" style={{ background: 'var(--primary-color-end, var(--primary-color-end))', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <Copy size={14} /> Duplicate Invoice
          </button>
          <button type="button" onClick={handleArrangeSerial} className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <ArrowUpDown size={14} /> Arrange Invoice Serial No
          </button>
          <button type="button" onClick={toggleOther} title="Revenue deposit, description, PO / contract / LC, hand carriage" className="btn btn-success" style={{ background: '#4ade80', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
            <Settings2 size={14} /> Other Details
          </button>
        </div>
    </>
  );
}
