import React, { useState, useEffect } from 'react';
import { X, Calculator, Calendar, Clock, Ship, FileText, ClipboardCheck, Banknote, Truck, FileWarning, Percent, Warehouse, Package, DollarSign } from 'lucide-react';

export default function ExportPenaltyCalculator({ isOpen, onClose, job }) {
  const [mode, setMode] = useState('SEA');
  const [activeJobRef, setActiveJobRef] = useState(job?.jobNo || 'No job selected');
  
  const [dates, setDates] = useState({
    gateInDate: '',
    sbFilingDate: '',
    leoDate: '',
    sailingDate: '', // EGM / Sailing
  });

  const [params, setParams] = useState({
    groundRentFreeDays: 7, // usually 7 days free ground rent at port
    detentionFreeDays: 5,  // factory stuffing free days
    fobValue: 0,
  });

  // 29-Oct-2026: no invented dates / FOB value any more (gate-in "10 days ago", SB "8 days ago", LEO "5 days ago",
  // FOB 2.5 / 5 lakh were shown under the job's number). The job's own SB date / LEO date / FOB come from the record;
  // the rest stays blank for the user to type.
  useEffect(() => {
    if (!isOpen) return;
    setActiveJobRef(job?.jobNo || 'No job selected');
    const air = String(job?.mode || '').toUpperCase() === 'AIR';
    setMode(air ? 'AIR' : 'SEA');
    setParams({ groundRentFreeDays: air ? 2 : 7, detentionFreeDays: air ? 0 : 5, fobValue: Math.round(parseFloat(job?.fobValue) || 0) });
    const ymd = (v) => { const t = String(v || '').trim(); let m; if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`; if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return ''; };
    setDates({ gateInDate: ymd(job?.gateInDate), sbFilingDate: ymd(job?.sbDate), leoDate: ymd(job?.leoDate), sailingDate: ymd(job?.sailingDate) });
    if (!job?.jobNo) return;
    fetch('/api/export-jobs').then(r => r.json()).then(j => {
      const list = (j && j.success && j.data) || (Array.isArray(j) ? j : []);
      const d = list.find(x => String(x.jobNo) === String(job.jobNo)); if (!d) return;
      const ad = (() => { let a = d.additionalData || d.extendedData; if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = {}; } } return a && typeof a === 'object' ? a : {}; })();
      const mode2 = String(d.shipmentMode || d.mode || '').toUpperCase() === 'AIR';
      setMode(mode2 ? 'AIR' : 'SEA');
      setParams(p => ({ ...p, groundRentFreeDays: mode2 ? 2 : 7, detentionFreeDays: mode2 ? 0 : 5, fobValue: Math.round(parseFloat(d.fobValue || d.totalFob || ad.fobValue || ad.totalFobInr) || p.fobValue || 0) }));
      setDates(x => ({ gateInDate: x.gateInDate || ymd(d.gateInDate || ad.gateInDate || ad.cargoArrivalDate), sbFilingDate: x.sbFilingDate || ymd(d.sbDate || ad.sbDate), leoDate: x.leoDate || ymd(d.leoDate || ad.leoDate), sailingDate: x.sailingDate || ymd(d.sailingDate || ad.sailingDate || ad.egmDate) }));
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

  // 1. Ground Rent (Terminal Demurrage)
  let groundRentDays = 0, groundRent = 0;
  if (dates.gateInDate && dates.sailingDate && isAfter(dates.sailingDate, dates.gateInDate)) {
    const totalPortDays = diffDays(dates.gateInDate, dates.sailingDate);
    groundRentDays = totalPortDays - params.groundRentFreeDays;
    if (groundRentDays < 0) groundRentDays = 0;
    if (groundRentDays > 0) {
      const baseRate = mode === 'AIR' ? 1500 : 2500;
      groundRent = groundRentDays * baseRate; 
    }
  }

  // 2. Late LEO penalty or amendment (simulation)
  let lateLeoDays = 0, lateLeoPenalty = 0;
  if (dates.gateInDate && dates.leoDate && isAfter(dates.leoDate, dates.gateInDate)) {
    lateLeoDays = diffDays(dates.gateInDate, dates.leoDate);
    if (lateLeoDays > 3) {
      lateLeoPenalty = (lateLeoDays - 3) * 1000; // 1000 per day after 3 days
    }
  }

  const totalExposure = groundRent + lateLeoPenalty;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '900px', maxWidth: '95vw',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#e0e7ff', padding: '8px', borderRadius: '8px' }}>
              <Calculator color="#4f46e5" size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>EXPORT FINANCIAL RISK CALCULATOR</h2>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                JOB REF: <span style={{ color: '#4f46e5' }}>{activeJobRef}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}
            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1 }}>
          
          {/* Left: Inputs */}
          <div style={{ flex: 1, padding: '24px', borderRight: '1px solid #e2e8f0' }}>
            
            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#64748b" /> LOGISTICS DATES
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  <Warehouse size={12} /> GATE IN DATE
                </label>
                <input type="date" name="gateInDate" value={dates.gateInDate} onChange={handleChangeDate} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  <FileText size={12} /> SB FILING DATE
                </label>
                <input type="date" name="sbFilingDate" value={dates.sbFilingDate} onChange={handleChangeDate} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  <ClipboardCheck size={12} /> LEO DATE
                </label>
                <input type="date" name="leoDate" value={dates.leoDate} onChange={handleChangeDate} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  <Ship size={12} /> SAILING / FLIGHT DATE
                </label>
                <input type="date" name="sailingDate" value={dates.sailingDate} onChange={handleChangeDate} style={inputStyle} />
              </div>
            </div>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} color="#64748b" /> POLICY & FREE DAYS
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  <Warehouse size={12} /> GROUND RENT FREE DAYS
                </label>
                <input type="number" name="groundRentFreeDays" value={params.groundRentFreeDays} onChange={handleChangeParam} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  <DollarSign size={12} /> FOB VALUE (₹)
                </label>
                <input type="number" name="fobValue" value={params.fobValue} onChange={handleChangeParam} style={inputStyle} />
              </div>
            </div>

          </div>

          {/* Right: Output */}
          <div style={{ width: '380px', padding: '24px', background: '#f8fafc' }}>
            
            <div style={{ 
              background: 'linear-gradient(135deg, #fef2f2, #fff1f2)', 
              border: '1px solid #fecdd3', borderRadius: '8px', padding: '20px', 
              textAlign: 'center', marginBottom: '24px' 
            }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#e11d48', letterSpacing: '1px', marginBottom: '8px' }}>TOTAL EXPOSURE</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#be123c' }}>
                ₹ {totalExposure.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Warehouse size={16} color="#10b981" />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>GROUND RENT (DEMURRAGE)</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{groundRentDays} BILLABLE DAYS</div>
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>₹ {groundRent.toLocaleString('en-IN')}</div>
              </div>

              <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileWarning size={16} color="#f59e0b" />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>LATE LEO PENALTY</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{lateLeoDays > 3 ? lateLeoDays - 3 : 0} LATE DAYS</div>
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f59e0b' }}>₹ {lateLeoPenalty.toLocaleString('en-IN')}</div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
  fontSize: '13px', color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box'
};
