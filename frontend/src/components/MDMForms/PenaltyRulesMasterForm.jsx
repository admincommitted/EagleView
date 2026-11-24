import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertTriangle, ShieldCheck, DollarSign, List, Edit2, Plus, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { askDelete } from './switchRow';

export default function PenaltyRulesMasterForm() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [tradeFilter, setTradeFilter] = useState('ALL');
  const [rules, setRules] = useState([]);
  
  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/penalty-rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.data || []);
      } else {
        toast.error('API Error: ' + (data.message || data.error || 'Unknown'));
      }
    } catch (err) {
      toast.error('Network Error: ' + err.message);
    }
  };

  const [formData, setFormData] = useState({
    id: null,
    tradeType: 'IMPORT',
    type: 'DEMURRAGE',
    mode: 'SEA',
    basis: 'DISCHARGE_DATE',
    rateUom: 'PER_SHIPMENT_PER_DAY',
    freeDays: 0,
    slab1Rate: 0,
    slab2Rate: 0,
    slab3Rate: 0,
  });

  const handleEdit = (rule) => {
    setFormData(rule);
    setActiveTab('form');
  };

  // 28-Oct-2026: Save really saves to the server (before it only changed the list on screen, lost on refresh)
  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.freeDays === '' || Number(formData.freeDays) < 0) return toast.error('Free days must be 0 or more');
    if ([formData.slab1Rate, formData.slab2Rate, formData.slab3Rate].some(v => Number(v) < 0)) return toast.error('Rates cannot be negative');
    setLoading(true);
    try {
      const { id, createdAt, updatedAt, ...body } = formData;
      const res = await fetch(id ? `/api/penalty-rules/${id}` : '/api/penalty-rules', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || data.error || 'Save failed');
      toast.success(data.message || 'Penalty Rule saved');
      await fetchRules();
      setActiveTab('list');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rule) => {
    if (!(await askDelete(`Delete ${rule.tradeType} ${String(rule.type).replace(/_/g, ' ')} (${rule.mode}) rule?`))) return;
    try {
      const res = await fetch(`/api/penalty-rules/${rule.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Delete failed');
      toast.success('Rule deleted');
      fetchRules();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '8px' }}>
            <AlertTriangle size={24} color="#ef4444" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Penalty & Demurrage Config Master</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Configure Free Days and Slab Rates for Financial Calculations</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          <button 
            onClick={() => setActiveTab('list')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: activeTab === 'list' ? 'white' : 'transparent', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: activeTab === 'list' ? '#0f172a' : '#64748b', boxShadow: activeTab === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}
          >
            <List size={16} /> Directory
          </button>
          <button 
            onClick={() => { setFormData({ id: null, tradeType: 'IMPORT', type: 'DEMURRAGE', mode: 'SEA', basis: 'DISCHARGE_DATE', rateUom: 'PER_SHIPMENT_PER_DAY', freeDays: 0, slab1Rate: 0, slab2Rate: 0, slab3Rate: 0 }); setActiveTab('form'); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: activeTab === 'form' ? 'white' : 'transparent', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: activeTab === 'form' ? '#0f172a' : '#64748b', boxShadow: activeTab === 'form' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}
          >
            <Plus size={16} /> New Rule
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Mode Filters */}
          <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginRight: '8px', display: 'flex', alignItems: 'center' }}>Trade:</span>
            <button onClick={() => setTradeFilter('ALL')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: tradeFilter === 'ALL' ? '#0f172a' : '#f1f5f9', color: tradeFilter === 'ALL' ? 'white' : '#64748b' }}>ALL</button>
            <button onClick={() => setTradeFilter('IMPORT')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: tradeFilter === 'IMPORT' ? '#3b82f6' : '#f1f5f9', color: tradeFilter === 'IMPORT' ? 'white' : '#64748b' }}>IMPORT</button>
            <button onClick={() => setTradeFilter('EXPORT')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: tradeFilter === 'EXPORT' ? '#10b981' : '#f1f5f9', color: tradeFilter === 'EXPORT' ? 'white' : '#64748b', marginRight: '24px' }}>EXPORT</button>
            
            <div style={{ width: '1px', background: '#e2e8f0', margin: '0 8px' }}></div>
            
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginRight: '8px', display: 'flex', alignItems: 'center' }}>Mode:</span>
            <button onClick={() => setModeFilter('ALL')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: modeFilter === 'ALL' ? '#0f172a' : '#f1f5f9', color: modeFilter === 'ALL' ? 'white' : '#64748b' }}>All Rules</button>
            <button onClick={() => setModeFilter('SEA')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: modeFilter === 'SEA' ? '#0ea5e9' : '#f1f5f9', color: modeFilter === 'SEA' ? 'white' : '#64748b' }}>Sea Freight Only</button>
            <button onClick={() => setModeFilter('AIR')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: modeFilter === 'AIR' ? '#8b5cf6' : '#f1f5f9', color: modeFilter === 'AIR' ? 'white' : '#64748b' }}>Air Freight Only</button>
          </div>

          <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', color: '#475569', fontWeight: 600 }}>
              <tr>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Trade</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Penalty Type</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Transport Mode</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Trigger Basis</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Rate UOM</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Free Days</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Slab 1 Rate (&#8377;)</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Slab 2 Rate (&#8377;)</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.filter(r => (modeFilter === 'ALL' || r.mode === modeFilter || r.mode === 'ALL') && (tradeFilter === 'ALL' || r.tradeType === tradeFilter)).map(rule => (
                <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: rule.tradeType === 'IMPORT' ? '#eff6ff' : '#ecfdf5', color: rule.tradeType === 'IMPORT' ? '#2563eb' : '#059669', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>{rule.tradeType}</span></td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#334155' }}>{String(rule.type || '').replace(/_/g, ' ')}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: rule.mode === 'SEA' ? '#e0f2fe' : (rule.mode === 'AIR' ? '#f3e8ff' : '#f1f5f9'), color: rule.mode === 'SEA' ? '#0369a1' : (rule.mode === 'AIR' ? '#7e22ce' : '#475569'), padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>{rule.mode}</span></td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>{String(rule.basis || '').replace(/_/g, ' ')}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{rule.freeDays}</td>
                  <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 600 }}>&#8377; {rule.slab1Rate}</td>
                  <td style={{ padding: '12px 16px', color: '#ea580c', fontWeight: 600 }}>&#8377; {rule.slab2Rate}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => handleEdit(rule)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#0ea5e9' }}><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(rule)} title="Delete" style={{ marginLeft: '6px', background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {activeTab === 'form' && (
        <form onSubmit={handleSave} style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#ef4444" /> System Policy Engine
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>These rules will be directly applied to the Advance Calculator and Financial Radar. Please ensure they match standard tariff agreements.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Trade Type</label>
              <select value={formData.tradeType} onChange={e => setFormData({...formData, tradeType: e.target.value})} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}>
                <option value="IMPORT">Import</option>
                <option value="EXPORT">Export</option>
                <option value="BOTH">Both</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Penalty Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}>
                {formData.tradeType !== 'EXPORT' && (
                  <>
                    <option value="DEMURRAGE">Port/CFS Demurrage (Import)</option>
                    <option value="DETENTION">Shipping Line Detention (Import)</option>
                    <option value="CUSTOMS_LATE_FEE">Customs Late Filing Fee (Sec 46)</option>
                  </>
                )}
                {formData.tradeType === 'EXPORT' && (
                  <>
                    <option value="GROUND_RENT">CFS Ground Rent (Export)</option>
                    <option value="LATE_LEO_FEE">Late LEO Penalty</option>
                    <option value="DETENTION">Container Detention (Export)</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Transport Mode</label>
              <select value={formData.mode} onChange={e => setFormData({...formData, mode: e.target.value})} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}>
                <option value="SEA">Sea Freight</option>
                <option value="AIR">Air Freight</option>
                <option value="ALL">All Modes (Global)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Calculation Trigger (Basis)</label>
              <select value={formData.basis} onChange={e => setFormData({...formData, basis: e.target.value})} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}>
                {formData.tradeType !== 'EXPORT' ? (
                  <>
                    <option value="DISCHARGE_DATE">Discharge Date</option>
                    <option value="IGM_DATE">IGM Date</option>
                    <option value="ARRIVAL_DATE">Vessel/Flight Arrival Date</option>
                    <option value="ASSESSMENT_DATE">Duty Assessment Date</option>
                    <option value="GATE_OUT_DATE">Gate Out Date</option>
                  </>
                ) : (
                  <>
                    <option value="GATE_IN_DATE">Factory / CFS Gate In Date</option>
                    <option value="SHIPPING_BILL_DATE">Shipping Bill Date</option>
                    <option value="LEO_DATE">LEO Date</option>
                    <option value="SAILING_DATE">Vessel Sailing Date</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14}/> Base Free Days</label>
              <input type="number" value={formData.freeDays} onChange={e => setFormData({...formData, freeDays: e.target.value === '' ? '' : Number(e.target.value)})} min="0" step="1" style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', background: '#f0fdf4' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14}/> Slab 1 Daily Rate (&#8377;)</label>
              <input type="number" value={formData.slab1Rate} onChange={e => setFormData({...formData, slab1Rate: Number(e.target.value)})} style={{ padding: '10px', border: '1px solid #bbf7d0', borderRadius: '6px', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#ea580c', display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14}/> Slab 2 Daily Rate (&#8377;)</label>
              <input type="number" value={formData.slab2Rate} onChange={e => setFormData({...formData, slab2Rate: Number(e.target.value)})} style={{ padding: '10px', border: '1px solid #fed7aa', borderRadius: '6px', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14}/> Slab 3 Daily Rate (&#8377;)</label>
              <input type="number" value={formData.slab3Rate} onChange={e => setFormData({...formData, slab3Rate: Number(e.target.value)})} style={{ padding: '10px', border: '1px solid #fecaca', borderRadius: '6px', outline: 'none' }} />
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="submit" disabled={loading} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {loading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} Save Configuration
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
