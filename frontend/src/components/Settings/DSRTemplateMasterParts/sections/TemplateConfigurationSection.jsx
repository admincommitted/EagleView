// Screen section: Template Configuration
// Split out of DSRTemplateMaster.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { ArrowDown, ArrowUp, Database, Plus, Save, Settings, Trash2 } from 'lucide-react';
import CustomAutocomplete from '../../../CustomAutocomplete';
import React from 'react';

export default function TemplateConfigurationSection({ ctx }) {
  const { activeTemplate, handleDeleteTemplate, handleAddColorRule, handleAddColumn, handleMoveCol, handleRemoveColorRule, handleRemoveColumn, handleSaveTemplate, handleUpdateActive, handleUpdateColorRule, handleUpdateColumn, setIsModalOpen } = ctx;
  return (
    <>
    <div className="glass-panel" style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'auto' }}>
        {activeTemplate ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color="#3b82f6" />
                <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Template Configuration</h2>
              </div>
              <button onClick={handleDeleteTemplate} className="btn" style={{ padding: '6px 12px', fontSize: '12px', gap: '6px', display: 'flex', alignItems: 'center', color: '#dc2626', border: '1px solid #fca5a5', background: '#fff', marginLeft: 'auto', marginRight: '8px' }}>
                <Trash2 size={14} /> Delete
              </button>
              <button onClick={handleSaveTemplate} className="btn btn-success" style={{ padding: '6px 16px', fontSize: '12px', gap: '6px', display: 'flex', alignItems: 'center' }}>
                <Save size={14} /> Save Template
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Template Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '100%' }}
                  value={activeTemplate.name} 
                  onChange={e => handleUpdateActive('name', e.target.value)} 
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Target Client (Optional)</label>
                <CustomAutocomplete 
                  fetchUrl="/api/masters/parties"
                  mapData={(data) => {
                    const arr = Array.isArray(data) ? data : data.data || [];
                    return arr.map(p => ({
                       title: p.name,
                       subtitle: [p.street, p.city, p.stateProvince, p.countryCode].filter(Boolean).join(', ') + (p.email ? ' | Email: ' + p.email : ''),
                       searchKey: p.name,
                       original: p
                    }));
                  }}
                  value={activeTemplate.client}
                  onChange={e => handleUpdateActive('client', e.target.value)}
                  onSelect={item => handleUpdateActive('client', item.title)}
                  placeholder="Search Party Master..."
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Auto-Dispatch Schedule</label>
                <select 
                   className="input-field" 
                   style={{ width: '100%' }}
                   value={activeTemplate.scheduleType || 'MANUAL'} 
                   onChange={e => handleUpdateActive('scheduleType', e.target.value)}
                >
                   <option value="MANUAL">Manual Dispatch Only</option>
                   <option value="DAILY">Daily</option>
                   <option value="WEEKLY">Weekly</option>
                   <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              
              {activeTemplate.scheduleType && activeTemplate.scheduleType !== 'MANUAL' && (
                <>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Dispatch Time</label>
                    <input 
                      type="time" 
                      className="input-field" 
                      style={{ width: '100%' }}
                      value={activeTemplate.scheduleTime || '18:00'} 
                      onChange={e => handleUpdateActive('scheduleTime', e.target.value)} 
                    />
                  </div>
                  
                  {activeTemplate.scheduleType === 'WEEKLY' && (
                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Day of Week</label>
                        <select className="input-field" style={{ width: '100%' }} value={activeTemplate.scheduleDay || 'Monday'} onChange={e => handleUpdateActive('scheduleDay', e.target.value)}>
                           <option value="Monday">Monday</option>
                           <option value="Tuesday">Tuesday</option>
                           <option value="Wednesday">Wednesday</option>
                           <option value="Thursday">Thursday</option>
                           <option value="Friday">Friday</option>
                           <option value="Saturday">Saturday</option>
                           <option value="Sunday">Sunday</option>
                        </select>
                     </div>
                  )}

                  {activeTemplate.scheduleType === 'MONTHLY' && (
                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Date of Month</label>
                        <input type="number" min="1" max="31" className="input-field" style={{ width: '100%' }} placeholder="e.g. 1" value={activeTemplate.scheduleDate || 1} onChange={e => handleUpdateActive('scheduleDate', e.target.value)} />
                     </div>
                  )}
                </>
              )}
            </div>

            
            {/* Email & WhatsApp Recipients */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>📧 Email Recipients (Comma separated)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '100%' }}
                  placeholder="e.g. client1@example.com, client2@example.com"
                  value={activeTemplate.emailRecipients || ''} 
                  onChange={e => handleUpdateActive('emailRecipients', e.target.value)} 
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                  📱 WhatsApp Numbers (Comma separated)
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '100%', border: '1px solid #86efac', background: '#f0fdf4' }}
                  placeholder="e.g. +919876543210, +919998887776"
                  value={activeTemplate.whatsappRecipients || ''} 
                  onChange={e => handleUpdateActive('whatsappRecipients', e.target.value)} 
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
                  📂 SFTP / FTP Auto-Push (Corporate)
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '100%', border: '1px solid #fcd34d', background: '#fffbeb' }}
                  placeholder="e.g. sftp://client-erp.com/upload"
                  value={activeTemplate.sftpHost || ''} 
                  onChange={e => handleUpdateActive('sftpHost', e.target.value)} 
                />
              </div>
            </div>

            {/* Internal Escalation Matrix */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>
                  🚨 Internal Escalation Rules (Logic)
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '100%', borderColor: '#fca5a5', fontFamily: 'monospace', fontSize: '12px', color: '#7f1d1d' }}
                  placeholder="e.g. Job.status == 'QUERY' OR Job.tatDays > 3"
                  value={activeTemplate.escalationRule || ''} 
                  onChange={e => handleUpdateActive('escalationRule', e.target.value)} 
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>
                  Manager CC / BCC Emails
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '100%', borderColor: '#fca5a5', background: 'white' }}
                  placeholder="manager@company.com"
                  value={activeTemplate.escalationEmails || ''} 
                  onChange={e => handleUpdateActive('escalationEmails', e.target.value)} 
                />
              </div>
            </div>



            
            {/* Advanced Enterprise Rules */}
            <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={16} color="#8b5cf6" /> Advanced Enterprise Settings
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                
                {/* Report Output Format */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>File Attachments & Format</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                     <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#334155' }}>
                        <input type="checkbox" checked={activeTemplate.formatExcel !== false} onChange={e => handleUpdateActive('formatExcel', e.target.checked)} style={{ width: '14px', height: '14px' }} /> Excel (.xlsx)
                     </label>
                     <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#334155' }}>
                        <input type="checkbox" checked={activeTemplate.formatPdf || false} onChange={e => handleUpdateActive('formatPdf', e.target.checked)} style={{ width: '14px', height: '14px' }} /> PDF Report
                     </label>
                     <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#334155' }}>
                        <input type="checkbox" checked={activeTemplate.formatHtml || false} onChange={e => handleUpdateActive('formatHtml', e.target.checked)} style={{ width: '14px', height: '14px' }} /> Email Body Table
                     </label>
                     <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#16a34a', fontWeight: 600 }}>
                        <input type="checkbox" checked={activeTemplate.formatLink || false} onChange={e => handleUpdateActive('formatLink', e.target.checked)} style={{ width: '14px', height: '14px' }} /> 🔗 Live Web Portal Link
                     </label>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                     <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#4338ca', fontWeight: 600 }}>
                        <input type="checkbox" checked={activeTemplate.attachDocs || false} onChange={e => handleUpdateActive('attachDocs', e.target.checked)} style={{ width: '14px', height: '14px' }} /> 📎 Auto-Attach BOE / OOC Docs (Zip Bundle)
                     </label>
                     <span style={{ fontSize: '10px', color: '#64748b', alignSelf: 'center' }}>(System will scan completed jobs and attach their respective PDF documents)</span>
                  </div>
                </div>

                {/* Grouping */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Data Grouping (Smart Pivot)</label>
                  <select className="input-field" style={{ width: '100%' }} value={activeTemplate.groupBy || ''} onChange={e => handleUpdateActive('groupBy', e.target.value)}>
                    <option value="">None (Flat Standard Table)</option>
                    <option value="Job.customsPort">Group by Customs Port</option>
                    <option value="Job.shipmentMode">Group by Mode (Air / Sea)</option>
                    <option value="Job.status">Group by Job Status</option>
                    <option value="Invoice.currency">Group by Currency</option>
                  </select>
                </div>

                
                {/* Visual Analytics & Charts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2', paddingBottom: '12px', borderBottom: '1px dashed #cbd5e1', marginBottom: '8px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Visual Analytics & Embedded Charts</label>
                  <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                     <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#334155' }}>
                        <input type="checkbox" checked={activeTemplate.chartTat || false} onChange={e => handleUpdateActive('chartTat', e.target.checked)} style={{ width: '14px', height: '14px' }} /> 📊 Clearance TAT (Bar Chart)
                     </label>
                     <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#334155' }}>
                        <input type="checkbox" checked={activeTemplate.chartStatus || false} onChange={e => handleUpdateActive('chartStatus', e.target.checked)} style={{ width: '14px', height: '14px' }} /> 🥧 Pipeline Status (Pie Chart)
                     </label>
                     <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#334155' }}>
                        <input type="checkbox" checked={activeTemplate.chartVolume || false} onChange={e => handleUpdateActive('chartVolume', e.target.checked)} style={{ width: '14px', height: '14px' }} /> 🍩 Volume by Port (Doughnut)
                     </label>
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Selected charts will be dynamically generated and embedded at the top of the PDF Report and Email Body.</span>
                </div>

                {/* Auto-Exclusion Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Smart Exclusion Rule (SQL/Logic)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}
                    placeholder="e.g. Job.status != 'CLEARED' AND Job.isAmended == false (Leave empty to send all client jobs)"
                    value={activeTemplate.exclusionRule || ''} 
                    onChange={e => handleUpdateActive('exclusionRule', e.target.value)} 
                  />
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '4px', lineHeight: '1.4' }}>
                    Use this to prevent sending already delivered or cleared jobs in daily reports.<br/>
                    <strong>💡 Hint / Examples:</strong> <br/>
                    <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', color: '#0f172a' }}>Job.status != 'CLEARED'</code> (Hides cleared jobs) <br/>
                    <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', color: '#0f172a' }}>Job.customsPort == 'INNSA1' AND Job.shipmentMode == 'SEA'</code> (Filters by Port & Mode)
                  </span>
                </div>

                {/* Excel Color Coding By Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2', marginTop: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      🎨 Excel Row Color Coding (By Status)
                    </label>
                    <button onClick={handleAddColorRule} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '10px', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Plus size={12}/> Add Color Rule
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(activeTemplate.colorRules || []).map((rule, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'white', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                         <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>If Status is:</span>
                         <select className="input-field" style={{ flex: 1, padding: '4px 8px' }} value={rule.status} onChange={e => handleUpdateColorRule(idx, 'status', e.target.value)}>
                            <option value="DRAFT">DRAFT</option>
                            <option value="PENDING">PENDING</option>
                            <option value="QUERY">QUERY / CUSTOMS HOLD</option>
                            <option value="OOC">OOC / CLEARED</option>
                            <option value="LEO GENERATED">LEO GENERATED</option>
                         </select>
                         <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Excel Row Color:</span>
                         <select className="input-field" style={{ flex: 1, padding: '4px 8px', backgroundColor: rule.color }} value={rule.color} onChange={e => handleUpdateColorRule(idx, 'color', e.target.value)}>
                            <option value="#ffffff">White (Default)</option>
                            <option value="#fecaca">Red (Critical/Hold)</option>
                            <option value="#fef08a">Yellow (Pending)</option>
                            <option value="#bbf7d0">Green (Cleared/Done)</option>
                            <option value="#bfdbfe">Blue (Processing)</option>
                         </select>
                         <button onClick={() => handleRemoveColorRule(idx)} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '4px' }}>
                           <Trash2 size={14}/>
                         </button>
                      </div>
                    ))}
                    {!(activeTemplate.colorRules?.length > 0) && <span style={{ fontSize: '10px', color: '#64748b' }}>No color rules defined. All Excel rows will have a white background.</span>}
                  </div>
                </div>

              </div>
            </div>

<div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>Selected DSR Columns ({activeTemplate.columns.length})</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setIsModalOpen(true)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', gap: '6px', display: 'flex', alignItems: 'center' }}>
                    <Database size={14} /> Select DB Fields
                  </button>
                  <button onClick={handleAddColumn} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', gap: '6px', display: 'flex', alignItems: 'center' }}>
                    <Plus size={14} /> Add Manual Field
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeTemplate.columns.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                    No columns selected. Click "Select DB Fields" to pick from the database, or "Add Manual Field" to create your own editable column.
                  </div>
                ) : (
                  activeTemplate.columns.map((col, idx) => (
                    <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button onClick={() => handleMoveCol(idx, -1)} disabled={idx === 0} style={{ background: 'transparent', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#cbd5e1' : '#64748b', padding: '2px' }}>
                          <ArrowUp size={16} />
                        </button>
                        <button onClick={() => handleMoveCol(idx, 1)} disabled={idx === activeTemplate.columns.length - 1} style={{ background: 'transparent', border: 'none', cursor: idx === activeTemplate.columns.length - 1 ? 'not-allowed' : 'pointer', color: idx === activeTemplate.columns.length - 1 ? '#cbd5e1' : '#64748b', padding: '2px' }}>
                          <ArrowDown size={16} />
                        </button>
                      </div>

                      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Display Header Name (Editable)</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          style={{ width: '100%', fontWeight: 600, color: '#0f172a' }}
                          value={col.header} 
                          onChange={e => handleUpdateColumn(col.id, 'header', e.target.value)} 
                        />
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Database Field Mapping</label>
                        <div style={{ padding: '0.4rem 0.75rem', background: col.field.startsWith('custom_') ? '#fef3c7' : '#f1f5f9', borderRadius: '4px', fontSize: '12px', color: '#334155', border: '1px solid #e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col.field}>
                           {col.field.startsWith('custom_') ? '✏️ USER DEFINED MANUAL FIELD' : '🔗 ' + col.field}
                        </div>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Formula / Default Value</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace', color: '#0f172a' }}
                          placeholder="e.g. =C2*0.18 or leave blank"
                          value={col.formula || ''} 
                          onChange={e => handleUpdateColumn(col.id, 'formula', e.target.value)} 
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '8px', borderLeft: '1px solid #e2e8f0' }}>
                        <button onClick={() => handleRemoveColumn(col.id)} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '4px' }} title="Remove Column">
                          <Trash2 size={18} />
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div></>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>
            Select a template from the left or create a new one.
          </div>
        )}
      </div>
    </>
  );
}
