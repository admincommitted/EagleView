// Screen section: BE Filing Details (30-Oct-2026)
// BE No / BE Date and the clearance dates of a job. The ICEGATE acknowledgement fills BE No / Date when it comes
// through the API; a BE filed by uploading the file on the portal is typed here. These are real columns on the job
// (ImportJob.beNo ...), used by the ex-bond chain, the dashboard, OOC / first-copy documents and the checklist.
import ModernDatePicker from '../../../../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box like the invoice screens (same YYYY-MM-DD value)
import React from 'react';

export default function BeFilingSection({ ctx }) {
  const { jobData, handleChange } = ctx;
  const st = String(jobData.icegateStatus || '').toLowerCase();
  const fromAck = st === 'accepted' && jobData.beNo;
  const box = { flex: 1, color: '#0f172a', border: '1px solid var(--primary-border, #cbd5e1)', backgroundColor: '#fff' };
  const lbl = (w) => ({ width: w, minWidth: w, whiteSpace: 'nowrap' });
  return (
    <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
      <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>BE Filing Details</span>
        {jobData.icegateStatus && <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'none', color: st === 'accepted' ? '#15803d' : st === 'rejected' ? '#b91c1c' : '#1d4ed8', background: '#fff', border: '1px solid currentColor', borderRadius: '4px', padding: '1px 8px' }}>ICEGATE: {jobData.icegateStatus}{jobData.icegateUniqueId ? ' (' + jobData.icegateUniqueId + ')' : ''}</span>}
        <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'none', color: 'var(--text-muted, #64748b)' }}>{fromAck ? 'BE No / Date came from the ICEGATE acknowledgement' : 'Type the BE No / Date here when the BE was filed by uploading the file on the ICEGATE portal'}</span>
      </div>
      <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={lbl('130px')}>BE No</label>
          <input name="beNo" type="text" className="input-field" inputMode="numeric" maxLength={7} placeholder="7 digits" title="Bill of Entry number given by ICEGATE (7 digits)" style={box} value={jobData.beNo || ''} onChange={e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 7); handleChange(e); }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={lbl('130px')}>BE Date</label>
          <ModernDatePicker name="beDate" className="input-field" style={box} value={jobData.beDate || ''} onChange={handleChange} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={lbl('130px')}>Assessment Date</label>
          <ModernDatePicker name="assessmentDate" className="input-field" title="Date the BE was assessed (first / second check done)" style={box} value={jobData.assessmentDate || ''} onChange={handleChange} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={lbl('130px')}>Duty Paid Date</label>
          <ModernDatePicker name="dutyPaidDate" className="input-field" style={box} value={jobData.dutyPaidDate || ''} onChange={handleChange} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={lbl('130px')}>Challan No</label>
          <input name="challanNo" type="text" className="input-field" maxLength={30} placeholder="duty challan / TR-6" style={box} value={jobData.challanNo || ''} onChange={handleChange} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={lbl('130px')}>Out of Charge Date</label>
          <ModernDatePicker name="oocDate" className="input-field" title="Out of Charge (OOC) date - the job is cleared after this" style={box} value={jobData.oocDate || ''} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}
