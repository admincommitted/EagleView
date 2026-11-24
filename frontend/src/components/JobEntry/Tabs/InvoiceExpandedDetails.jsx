import React, { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import Modal from '../../common/Modal';
import ModernDatePicker from '../../common/ModernDatePicker';

export default function InvoiceExpandedDetails({ invoice, onClose }) {
  const [activeTab, setActiveTab] = useState('financials');
  const [isSvbModalOpen, setSvbModalOpen] = useState(false);

  return (
    <div style={{ background: 'var(--bg-panel, #ffffff)', padding: '1rem', borderTop: '1px dashed var(--border-color, #cbd5e1)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header & Close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main, var(--text-main, #0f172a))' }}>Invoice Exhaustive Details (ICEGATE_InvoiceModel)</span>
        <X size={16} color="var(--text-muted, var(--text-muted, #64748b))" style={{ cursor: 'pointer' }} onClick={onClose} />
      </div>

      {/* Sub-Tabs Navigation (Segmented Control Style) */}
      <div className="tab-container" style={{ marginBottom: '1.25rem' }}>
        <button className={`custom-tab ${activeTab === 'financials' ? 'active' : ''}`} onClick={() => setActiveTab('financials')}>
          Financials & Charges
        </button>
        <button className={`custom-tab ${activeTab === 'parties' ? 'active' : ''}`} onClick={() => setActiveTab('parties')}>
          Supplier & Third Parties
        </button>
        <button className={`custom-tab ${activeTab === 'svb' ? 'active' : ''}`} onClick={() => setActiveTab('svb')}>
          Terms & SVB Details
        </button>
      </div>

      {/* Tab A: Financials */}
      {activeTab === 'financials' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          <div><label style={{ fontSize: '10px' }}>Freight Value</label><input type="number" className="input-field" defaultValue={invoice.freight || ''} /></div>
          <div><label style={{ fontSize: '10px' }}>Freight Currency</label><input type="text" className="input-field" placeholder="USD" /></div>
          <div><label style={{ fontSize: '10px' }}>Freight Rate</label><input type="number" className="input-field" placeholder="0.0000" /></div>
          <div><label style={{ fontSize: '10px' }}>Actual Freight?</label><select className="input-field"><option>Y</option><option>N</option></select></div>
          <div />

          <div><label style={{ fontSize: '10px' }}>Insurance Value</label><input type="number" className="input-field" defaultValue={invoice.insurance || ''} /></div>
          <div><label style={{ fontSize: '10px' }}>Insurance Currency</label><input type="text" className="input-field" placeholder="USD" /></div>
          <div><label style={{ fontSize: '10px' }}>Insurance Rate</label><input type="number" className="input-field" placeholder="0.0000" /></div>
          <div style={{ gridColumn: 'span 2' }} />

          <div><label style={{ fontSize: '10px' }}>Misc Charges</label><input type="number" className="input-field" defaultValue={invoice.misc || ''} /></div>
          <div><label style={{ fontSize: '10px' }}>Misc Currency</label><input type="text" className="input-field" placeholder="USD" /></div>
          <div><label style={{ fontSize: '10px' }}>Misc Rate</label><input type="number" className="input-field" placeholder="0.0000" /></div>
          <div style={{ gridColumn: 'span 2' }} />

          <div><label style={{ fontSize: '10px' }}>Agency Commission</label><input type="number" className="input-field" placeholder="0.00" /></div>
          <div><label style={{ fontSize: '10px' }}>Comm. Currency</label><input type="text" className="input-field" placeholder="USD" /></div>
          <div><label style={{ fontSize: '10px' }}>Comm. Rate</label><input type="number" className="input-field" placeholder="0.0000" /></div>
          <div style={{ gridColumn: 'span 2' }} />

          <div><label style={{ fontSize: '10px' }}>Discount Amount</label><input type="number" className="input-field" placeholder="0.00" /></div>
          <div><label style={{ fontSize: '10px' }}>Discount Rate</label><input type="number" className="input-field" placeholder="0.0000" /></div>
          <div style={{ gridColumn: 'span 3' }}><label style={{ fontSize: '10px' }}>Nature of Discount</label><input type="text" className="input-field" placeholder="e.g. Trade Discount" /></div>

          <div><label style={{ fontSize: '10px' }}>HSS Load Amt</label><input type="number" className="input-field" placeholder="0.00" /></div>
          <div><label style={{ fontSize: '10px' }}>HSS Load Rate</label><input type="number" className="input-field" placeholder="0.00" /></div>
          <div><label style={{ fontSize: '10px' }}>Loading Charges</label><input type="number" className="input-field" placeholder="0.00" /></div>
          <div><label style={{ fontSize: '10px' }}>Loading Curr</label><input type="text" className="input-field" placeholder="INR" /></div>
          <div><label style={{ fontSize: '10px' }}>Landing Rate</label><input type="number" className="input-field" placeholder="0.0000" /></div>
        </div>
      )}

      {/* Tab B: Parties */}
      {activeTab === 'parties' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ border: '1px solid var(--border-color, #cbd5e1)', padding: '0.75rem', borderRadius: '4px', background: '#fff' }}>
            <strong style={{ fontSize: '11px', display: 'block', marginBottom: '0.5rem' }}>Supplier Details</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              <div style={{ gridColumn: 'span 2' }}><input type="text" className="input-field" placeholder="Name" defaultValue={invoice.supplier} /></div>
              <div style={{ gridColumn: 'span 3' }}><input type="text" className="input-field" placeholder="Address 1" /></div>
              <div style={{ gridColumn: 'span 2' }}><input type="text" className="input-field" placeholder="Address 2" /></div>
              <div><input type="text" className="input-field" placeholder="Country" /></div>
              <div><input type="text" className="input-field" placeholder="PIN" /></div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border-color, #cbd5e1)', padding: '0.75rem', borderRadius: '4px', background: '#fff' }}>
            <strong style={{ fontSize: '11px', display: 'block', marginBottom: '0.5rem' }}>Seller Details</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              <div style={{ gridColumn: 'span 2' }}><input type="text" className="input-field" placeholder="Name" /></div>
              <div style={{ gridColumn: 'span 3' }}><input type="text" className="input-field" placeholder="Address 1" /></div>
              <div style={{ gridColumn: 'span 2' }}><input type="text" className="input-field" placeholder="Address 2" /></div>
              <div><input type="text" className="input-field" placeholder="Country" /></div>
              <div><input type="text" className="input-field" placeholder="PIN" /></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ border: '1px solid var(--border-color, #cbd5e1)', padding: '0.75rem', borderRadius: '4px', background: '#fff' }}>
              <strong style={{ fontSize: '11px', display: 'block', marginBottom: '0.5rem' }}>Third Party</strong>
              <input type="text" className="input-field" placeholder="Name" style={{ marginBottom: '0.5rem' }} />
              <input type="text" className="input-field" placeholder="Address" style={{ marginBottom: '0.5rem' }} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" className="input-field" placeholder="Country" />
                <input type="text" className="input-field" placeholder="PIN" />
              </div>
            </div>
            
            <div style={{ border: '1px solid var(--border-color, #cbd5e1)', padding: '0.75rem', borderRadius: '4px', background: '#fff' }}>
              <strong style={{ fontSize: '11px', display: 'block', marginBottom: '0.5rem' }}>Broker</strong>
              <input type="text" className="input-field" placeholder="Name" style={{ marginBottom: '0.5rem' }} />
              <input type="text" className="input-field" placeholder="Address" style={{ marginBottom: '0.5rem' }} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" className="input-field" placeholder="Country" />
                <input type="text" className="input-field" placeholder="PIN" />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab C: Terms & SVB */}
      {activeTab === 'svb' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          
          {/* Contracts & PO */}
          <div><label style={{ fontSize: '10px' }}>Purchase Order No</label><input type="text" className="input-field" /></div>
          <div><label style={{ fontSize: '10px' }}>PO Date</label><ModernDatePicker className="input-field" /></div>
          <div><label style={{ fontSize: '10px' }}>Contract No</label><input type="text" className="input-field" /></div>
          <div><label style={{ fontSize: '10px' }}>Contract Date</label><ModernDatePicker className="input-field" /></div>
          <div><label style={{ fontSize: '10px' }}>LC Number</label><input type="text" className="input-field" /></div>

          {/* SVB Fields */}
          <div>
            <label style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
              SVB Flag
              {isSvbModalOpen === false && <ExternalLink size={10} style={{ cursor: 'pointer', color: 'var(--primary-color)' }} onClick={() => setSvbModalOpen(true)} title="Open SVB Details" />}
            </label>
            <select 
              className="input-field" 
              defaultValue=""
              onBlur={(e) => {
                if (e.target.value === 'Y') {
                  setSvbModalOpen(true);
                }
              }}
            >
              <option value="N">N</option>
              <option value="Y">Y</option>
            </select>
          </div>

          <Modal isOpen={isSvbModalOpen} onClose={() => setSvbModalOpen(false)} title="SVB Loading Invoice Details">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div><label style={{ fontSize: '11px' }}>SVB Ref No.</label><input type="text" className="input-field" /></div>
              <div><label style={{ fontSize: '11px' }}>SVB Ref Date</label><ModernDatePicker className="input-field" /></div>
              <div><label style={{ fontSize: '11px' }}>SVB Load (Ass. Val) %</label><input type="number" className="input-field" placeholder="0.00" /></div>
              <div><label style={{ fontSize: '11px' }}>SVB Load Status</label><select className="input-field"><option>Final</option><option>Provisional</option></select></div>
              <div><label style={{ fontSize: '11px' }}>SVB Load (Duty) %</label><input type="number" className="input-field" placeholder="0.00" /></div>
              <div><label style={{ fontSize: '11px' }}>SVB Load Status</label><select className="input-field"><option>Final</option><option>Provisional</option></select></div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px' }}>Customs House</label><input type="text" className="input-field" placeholder="e.g. INDEL4" />
              </div>
            </div>
          </Modal>

          <div><label style={{ fontSize: '10px' }}>Prov. Load (Ass. Val)</label><select className="input-field"><option>N</option><option>Y</option></select></div>
          <div><label style={{ fontSize: '10px' }}>Prov. Load (Duty)</label><select className="input-field"><option>N</option><option>Y</option></select></div>
          <div><label style={{ fontSize: '10px' }}>Customs House (Load)</label><input type="text" className="input-field" placeholder="Port Code" /></div>
          <div><label style={{ fontSize: '10px' }}>Valuation Method</label><input type="text" className="input-field" /></div>
          <div><label style={{ fontSize: '10px' }}>Payment Terms</label><input type="text" className="input-field" /></div>

          {/* Conditions */}
          <div style={{ gridColumn: 'span 5', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', borderTop: '1px solid var(--border-color, #cbd5e1)', paddingTop: '0.75rem' }}>
            <div><label style={{ fontSize: '10px' }}>Condition 1</label><input type="text" className="input-field" /></div>
            <div><label style={{ fontSize: '10px' }}>Condition 2</label><input type="text" className="input-field" /></div>
            <div><label style={{ fontSize: '10px' }}>Condition 3</label><input type="text" className="input-field" /></div>
            <div><label style={{ fontSize: '10px' }}>Condition 4</label><input type="text" className="input-field" /></div>
            <div><label style={{ fontSize: '10px' }}>Condition 5</label><input type="text" className="input-field" /></div>
          </div>
          
        </div>
      )}

    </div>
  );
}
