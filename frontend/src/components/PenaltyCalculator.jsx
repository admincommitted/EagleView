import React, { useState, useEffect } from 'react';
import { X, Calculator, Calendar, Clock, Ship, FileText, ClipboardCheck, Banknote, Truck, FileWarning, Percent, Warehouse, Package, DollarSign } from 'lucide-react';

export default function PenaltyCalculator({ isOpen, onClose, job }) {
  const [mode, setMode] = useState('SEA');
  const [activeJobRef, setActiveJobRef] = useState(job?.jobNo || 'No job selected');
  const [dates, setDates] = useState({
    dischargeDate: '',
    beFilingDate: '',
    assessmentDate: '',
    dutyPaymentDate: '',
    clearanceDate: '',
  });

  const [params, setParams] = useState({
    dutyAmount: 0,
    demurrageFreeDays: 5,
    detentionFreeDays: 14,
  });

  // 29-Oct-2026: the calculator used to open with invented figures (duty 2.5 / 5 lakh, arrival "10 days ago", BE filed
  // "8 days ago" ...) shown under the job's own number. Now it reads the job (IGM inward / arrival date, BE date, duty
  // estimate) and leaves what the job does not have blank for the user to type - nothing is made up.
  useEffect(() => {
    if (!isOpen) return;
    setActiveJobRef(job?.jobNo || 'No job selected');
    const air = String(job?.mode || '').toUpperCase() === 'AIR';
    setMode(air ? 'AIR' : 'SEA');
    setParams({ dutyAmount: 0, demurrageFreeDays: air ? 2 : 5, detentionFreeDays: air ? 0 : 14 });
    setDates({ dischargeDate: '', beFilingDate: '', assessmentDate: '', dutyPaymentDate: '', clearanceDate: '' });
    if (!job?.jobNo) return;
    const ymd = (v) => { const t = String(v || '').trim(); let m; if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`; if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return ''; };
    const pj = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return Array.isArray(v) ? v : []; };
    fetch('/api/import-jobs/by-jobno/' + encodeURIComponent(job.jobNo)).then(r => r.json()).then(j => {
      const d = (j && j.success && j.data) || null; if (!d) return;
      const igm = pj(d._igmRows)[0] || {};
      const mode2 = String(d.shipmentMode || '').toUpperCase() === 'AIR';
      setMode(mode2 ? 'AIR' : 'SEA');
      setParams(p => ({ ...p, demurrageFreeDays: mode2 ? 2 : 5, detentionFreeDays: mode2 ? 0 : 14, dutyAmount: Math.round(parseFloat(d.totalDuty) || 0) }));
      setDates({ dischargeDate: ymd(igm.inwardDate || d.inwardDate || igm.igmDate || d.igmDate || d.arrivalDate || d.autoField_17), beFilingDate: ymd(d.beDate), assessmentDate: ymd(d.assessmentDate),
        dutyPaymentDate: ymd(d.dutyPaymentDate || d.dutyPaidDate), clearanceDate: ymd(d.oocDate || d.clearanceDate) });
    }).catch(() => {});
  }, [isOpen, job]);

  if (!isOpen) return null;

  const handleChangeDate = (e) => {
    setDates(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleChangeParam = (e) => {
    setParams(prev => ({ ...prev, [e.target.name]: Number(e.target.value) }));
  };

  const diffDays = (start, end) => {
    if (!start || !end) return 0;
    const diffTime = new Date(end) - new Date(start);
    if (diffTime < 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isAfter = (d1, d2) => new Date(d1) > new Date(d2);

  let beLateDays = 0, bePenalty = 0;
  if (dates.dischargeDate && dates.beFilingDate && isAfter(dates.beFilingDate, dates.dischargeDate)) {
    beLateDays = diffDays(dates.dischargeDate, dates.beFilingDate) - 1;
    if (beLateDays < 0) beLateDays = 0;
    if (beLateDays > 0) {
      const initialDays = Math.min(beLateDays, 3);
      const subsequentDays = Math.max(0, beLateDays - 3);
      bePenalty = (initialDays * 5000) + (subsequentDays * 10000);
    }
  }

  let dutyLateDays = 0, dutyInterest = 0;
  if (dates.assessmentDate && dates.dutyPaymentDate && isAfter(dates.dutyPaymentDate, dates.assessmentDate)) {
    dutyLateDays = diffDays(dates.assessmentDate, dates.dutyPaymentDate) - 1;
    if (dutyLateDays < 0) dutyLateDays = 0;
    if (dutyLateDays > 0) {
      dutyInterest = Math.round((params.dutyAmount * 0.15 / 365) * dutyLateDays);
    }
  }

  let demurrageDays = 0, demurragePenalty = 0;
  if (dates.dischargeDate && dates.clearanceDate && isAfter(dates.clearanceDate, dates.dischargeDate)) {
    const totalPortDays = diffDays(dates.dischargeDate, dates.clearanceDate);
    demurrageDays = totalPortDays - params.demurrageFreeDays;
    if (demurrageDays < 0) demurrageDays = 0;
    if (demurrageDays > 0) {
      let d = demurrageDays;
      if (mode === 'SEA') {
        const slab1 = Math.min(d, 3); d -= slab1;
        const slab2 = Math.min(d, 4); d -= slab2;
        const slab3 = d;
        demurragePenalty = (slab1 * 2500) + (slab2 * 4000) + (slab3 * 7000);
      } else {
        const slab1 = Math.min(d, 2); d -= slab1;
        const slab2 = Math.min(d, 3); d -= slab2;
        const slab3 = d;
        demurragePenalty = (slab1 * 1500) + (slab2 * 3000) + (slab3 * 6000);
      }
    }
  }

  let detentionDays = 0, detentionPenalty = 0;
  if (dates.dischargeDate && dates.clearanceDate && isAfter(dates.clearanceDate, dates.dischargeDate)) {
    const totalLineDays = diffDays(dates.dischargeDate, dates.clearanceDate);
    detentionDays = totalLineDays - params.detentionFreeDays;
    if (detentionDays < 0) detentionDays = 0;
    if (detentionDays > 0) {
      let d = detentionDays;
      const slab1 = Math.min(d, 7); d -= slab1;
      const slab2 = d;
      detentionPenalty = (slab1 * 4500) + (slab2 * 9000);
    }
  }

  const totalRisk = bePenalty + dutyInterest + demurragePenalty + detentionPenalty;

  const InputLabel = ({ icon: Icon, text }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
      <Icon size={10} color="#94a3b8" /> {text}
    </label>
  );

  const inputStyle = { padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', width: '100%', boxSizing: 'border-box', background: '#f8fafc', outline: 'none', fontSize: '12px', color: '#0f172a', fontWeight: 500 };

  const handleModeSea = () => { setMode('SEA'); setParams({ ...params, demurrageFreeDays: 5, detentionFreeDays: 14 }); };

  const handleModeAir = () => { setMode('AIR'); setParams({ ...params, demurrageFreeDays: 2, detentionFreeDays: 0 }); };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', color: '#0f172a', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px' }}>
              <Calculator size={20} color="#3b82f6" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Advance Penalty Calculator</h2>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>JOB REF: <span style={{ color: '#3b82f6' }}>{activeJobRef}</span></span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1 }}>
          
          {/* Left Panel: Inputs */}
          <div style={{ flex: '1.2', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  <Calendar size={14} color="#3b82f6" /> Logistics Dates
                </h3>
                
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <InputLabel icon={Ship} text="Discharge Date" />
                  <input type="date" name="dischargeDate" value={dates.dischargeDate} onChange={handleChangeDate} style={inputStyle} />
                </div>
                <div>
                  <InputLabel icon={FileText} text="BE Filing Date" />
                  <input type="date" name="beFilingDate" value={dates.beFilingDate} onChange={handleChangeDate} style={inputStyle} />
                </div>
                <div>
                  <InputLabel icon={ClipboardCheck} text="Assessment Date" />
                  <input type="date" name="assessmentDate" value={dates.assessmentDate} onChange={handleChangeDate} style={inputStyle} />
                </div>
                <div>
                  <InputLabel icon={Banknote} text="Duty Payment Date" />
                  <input type="date" name="dutyPaymentDate" value={dates.dutyPaymentDate} onChange={handleChangeDate} style={inputStyle} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <InputLabel icon={Truck} text="Clearance / Gate Out Date" />
                  <input type="date" name="clearanceDate" value={dates.clearanceDate} onChange={handleChangeDate} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', fontWeight: 700 }}>
                <Clock size={14} color="#8b5cf6" /> Policy & Free Days
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <InputLabel icon={Warehouse} text="Demurrage Free Days" />
                  <input type="number" name="demurrageFreeDays" value={params.demurrageFreeDays} onChange={handleChangeParam} style={inputStyle} />
                </div>
                <div>
                  <InputLabel icon={Package} text="Detention Free Days" />
                  <input type="number" name="detentionFreeDays" value={params.detentionFreeDays} onChange={handleChangeParam} style={inputStyle} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <InputLabel icon={DollarSign} text="Total Custom Duty (&#8377;)" />
                  <input type="number" name="dutyAmount" value={params.dutyAmount} onChange={handleChangeParam} style={{...inputStyle, fontWeight: 'bold'}} />
                </div>
              </div>
            </div>

          </div>

          {/* Right Panel: Calculations */}
          <div style={{ flex: '0.8', background: '#f8fafc', padding: '20px', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{ 
              textAlign: 'center', padding: '20px', 
              background: totalRisk > 0 ? '#fef2f2' : '#f0fdf4', 
              border: `1px solid ${totalRisk > 0 ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '12px', color: totalRisk > 0 ? '#b91c1c' : '#15803d',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: totalRisk > 0 ? '#ef4444' : '#22c55e' }}>Total Exposure</span>
              <h1 style={{ margin: '6px 0 0 0', fontSize: '32px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: totalRisk > 0 ? '#dc2626' : '#16a34a' }}>
                &#8377; {totalRisk.toLocaleString()}
              </h1>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <div style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', borderLeft: `4px solid ${bePenalty > 0 ? '#ef4444' : '#22c55e'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <FileWarning size={16} color={bePenalty > 0 ? '#ef4444' : '#22c55e'} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Late BE Filing</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{beLateDays} days late</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: bePenalty > 0 ? '#ef4444' : '#22c55e' }}>&#8377; {bePenalty.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', borderLeft: `4px solid ${dutyInterest > 0 ? '#f59e0b' : '#22c55e'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Percent size={16} color={dutyInterest > 0 ? '#f59e0b' : '#22c55e'} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Duty Interest</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{dutyLateDays} days late</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: dutyInterest > 0 ? '#f59e0b' : '#22c55e' }}>&#8377; {dutyInterest.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', borderLeft: `4px solid ${demurragePenalty > 0 ? '#8b5cf6' : '#22c55e'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Warehouse size={16} color={demurragePenalty > 0 ? '#8b5cf6' : '#22c55e'} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Demurrage</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{demurrageDays} billable days</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: demurragePenalty > 0 ? '#8b5cf6' : '#22c55e' }}>&#8377; {demurragePenalty.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', borderLeft: `4px solid ${detentionPenalty > 0 ? '#ec4899' : '#22c55e'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Package size={16} color={detentionPenalty > 0 ? '#ec4899' : '#22c55e'} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Detention</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{detentionDays} billable days</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: detentionPenalty > 0 ? '#ec4899' : '#22c55e' }}>&#8377; {detentionPenalty.toLocaleString()}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
