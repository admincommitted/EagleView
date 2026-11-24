import React, { useState } from 'react';
import { Search, Download, Mail, CheckCircle, FileJson } from 'lucide-react';

export default function SubmitSbJob() {
  const [submissionStatus, setSubmissionStatus] = useState('unsubmitted');
  const [jobNo, setJobNo] = useState('');
  const [icegateUserId, setIcegateUserId] = useState('');

  const [tableData, setTableData] = useState([]);

  React.useEffect(() => {
    fetch('/api/export-jobs')
      .then(res => res.json())
      .then(data => {
        if(data.success) {
          const mapped = data.data.map(job => ({
            id: job.jobNo || job.id,
            iceName: job.shipperName || 'N/A',
            consignee: job.consigneeName || 'N/A',
            port: job.customsPort || 'N/A',
            loc: job.shipmentMode + ' EXPORT',
            enteredBy: 'admin',
            enteredDt: new Date(job.createdAt).toLocaleString()
          }));
          setTableData(mapped);
        }
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="glass-panel" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ background: '#e0f2fe', padding: '0.5rem 1rem', borderBottom: '1px solid #bae6fd', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
        <h2 style={{ color: 'var(--primary-text, #0369a1)', margin: 0, fontSize: '14px', textTransform: 'none' }}>Submit SB Job</h2>
      </div>

      {/* Filters Section */}
      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', background: 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', margin: 0, textTransform: 'none', fontWeight: 500, color: 'var(--text-main, var(--text-main, #0f172a))' }}>
            <input 
              type="radio" 
              name="status" 
              value="unsubmitted" 
              checked={submissionStatus === 'unsubmitted'}
              onChange={(e) => setSubmissionStatus(e.target.value)}
            />
            UnSubmitted
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', margin: 0, textTransform: 'none', fontWeight: 500, color: 'var(--text-main, var(--text-main, #0f172a))' }}>
            <input 
              type="radio" 
              name="status" 
              value="submitted" 
              checked={submissionStatus === 'submitted'}
              onChange={(e) => setSubmissionStatus(e.target.value)}
            />
            Submitted
          </label>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ margin: 0, textTransform: 'none', fontWeight: 500 }}>Job No</label>
          <input 
            type="text" 
            placeholder="JOB NO" 
            value={jobNo}
            onChange={(e) => setJobNo(e.target.value)}
            className="input-field"
            style={{ width: '150px' }}
          />
          <button className="btn btn-info" style={{ padding: '0.3rem 0.75rem', background: 'var(--primary-color-end, #2563eb)', border: 'none' }}>
            <Search size={14} /> Search
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <label style={{ margin: 0, textTransform: 'none', fontWeight: 500 }}>Icegate UserId</label>
          <select 
            value={icegateUserId} 
            onChange={(e) => setIcegateUserId(e.target.value)}
            className="input-field"
            style={{ width: '200px' }}
          >
            <option value="">Select</option>
            <option value="user1">User 1</option>
            <option value="user2">User 2</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
        <div style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input, var(--bg-input, #f1f5f9))' }}>
                <th style={{ width: '40px', textAlign: 'center', textTransform: 'none', color: 'var(--text-muted, var(--text-muted, #475569))' }}>Select</th>
                <th style={{ width: '60px', textTransform: 'none', color: 'var(--text-muted, var(--text-muted, #475569))' }}>Job No</th>
                <th style={{ textTransform: 'none', color: 'var(--text-muted, var(--text-muted, #475569))' }}>ICE Name</th>
                <th style={{ textTransform: 'none', color: 'var(--text-muted, var(--text-muted, #475569))' }}>Consignee Name</th>
                <th style={{ textTransform: 'none', color: 'var(--text-muted, var(--text-muted, #475569))' }}>Discharge Port</th>
                <th style={{ textTransform: 'none', color: 'var(--text-muted, var(--text-muted, #475569))' }}>Location</th>
                <th style={{ textTransform: 'none', color: 'var(--text-muted, var(--text-muted, #475569))' }}>Entered By</th>
                <th style={{ textTransform: 'none', color: 'var(--text-muted, var(--text-muted, #475569))' }}>Entered Dt</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', background: '#fff', textTransform: 'none', color: '#334155' }}>
                  <td style={{ textAlign: 'center' }}>
                    <input type="radio" name="jobSelect" />
                  </td>
                  <td>{row.jobNo || row.id}</td>
                  <td>{row.iceName}</td>
                  <td>{row.consignee}</td>
                  <td>{row.port}</td>
                  <td>{row.loc}</td>
                  <td>{row.enteredBy}</td>
                  <td>{row.enteredDt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ padding: '0.75rem', background: '#e0f2fe', borderTop: '1px solid #bae6fd', display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn" style={{ background: 'var(--primary-color-end, #2563eb)', color: 'white', padding: '0.4rem 1rem' }}><Download size={14} /> Download Signed File</button>
        <button className="btn" style={{ background: 'var(--primary-color-end, #2563eb)', color: 'white', padding: '0.4rem 1rem' }}><Download size={14} /> Download UnSigned File</button>
        <button className="btn btn-success" style={{ background: '#22c55e', color: 'white', padding: '0.4rem 1rem' }}><Mail size={14} /> File Mail to ICE Gate</button>
        <button className="btn btn-success" style={{ background: '#22c55e', color: 'white', padding: '0.4rem 1rem' }}><CheckCircle size={14} /> Validate Job</button>
        <button className="btn" style={{ background: 'var(--primary-color-end, #2563eb)', color: 'white', padding: '0.4rem 1rem' }}><Download size={14} /> Download With Duplicate Job No.</button>
      </div>

      <div style={{ padding: '0.5rem 0.75rem 0.75rem', background: '#e0f2fe', display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn" style={{ background: 'var(--primary-color-end, #2563eb)', color: 'white', padding: '0.4rem 1rem' }}><Download size={14} /> Download GR</button>
        <button className="btn" style={{ background: 'var(--primary-color-end, #2563eb)', color: 'white', padding: '0.4rem 1rem' }}><Download size={14} /> Download GR UnSigned File</button>
        <button className="btn btn-success" style={{ background: '#22c55e', color: 'white', padding: '0.4rem 1rem' }}><Mail size={14} /> Mail GR File to ICE Gate</button>
      </div>

      {/* API Action Buttons */}
      <div style={{ padding: '0.75rem', background: '#fee2e2', borderTop: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn" style={{ background: 'var(--text-muted, var(--text-muted, #475569))', color: '#fff', padding: '0.4rem 0.75rem', border: 'none' }}><FileJson size={14} /> {'{Json}'}</button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-danger" style={{ background: '#ef4444', color: 'white', padding: '0.4rem 1rem' }}>{'{Json}'} Submit eSign via API</button>
          <button className="btn btn-success" style={{ background: '#22c55e', color: 'white', padding: '0.4rem 1rem' }}>{'{Json}'} Download eSigned</button>
          <button className="btn btn-primary" style={{ background: '#3b82f6', color: 'white', padding: '0.4rem 1rem' }}>{'{Json}'} Download UnSigned</button>
        </div>
      </div>

      {/* Footer Text */}
      <div style={{ padding: '0.4rem 1rem', fontSize: '11px', color: 'var(--text-main, var(--text-main, #1e293b))', background: 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', fontWeight: 500 }}>
        Use Internet Explorer For Submission
      </div>
    </div>
  );
}
