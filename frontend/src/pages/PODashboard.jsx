import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { getUser } from '../utils/permissions';
import { FileText, Eye, CheckCircle, Clock, XCircle, FilePlus, Search, Filter, AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Send } from 'lucide-react';

export default function PODashboard({ externalSearchTerm = "", externalStatusFilter = "All", externalBranchFilter = "All" }) {
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  // 16-Nov-2026: paging always shown; rows per page kept for this browser
  const [itemsPerPage, setItemsPerPage] = useState(() => { try { const n = Number(localStorage.getItem('poDash.perPage')); return [10, 25, 50, 100].includes(n) ? n : 10; } catch (e) { return 10; } });
  const changePerPage = (n) => { setItemsPerPage(n); setCurrentPage(1); try { localStorage.setItem('poDash.perPage', String(n)); } catch (e) { /* not kept */ } };
  
  useEffect(() => {
    setCurrentPage(1);
  }, [externalSearchTerm, externalStatusFilter, externalBranchFilter]);

  // Search States
  

  useEffect(() => {
    fetchPOs();
  }, []);

  // 16-Nov-2026: an admin or a Director (PO approver) approves / rejects / holds a PO here after logging in
  const role = String(getUser().role || '').toLowerCase();
  const canDecide = role === 'admin' || role === 'director';
  const isDirector = role === 'director';
  const [decide, setDecide] = useState(null); // { po, status }
  const [decideNote, setDecideNote] = useState('');
  const [decideBusy, setDecideBusy] = useState(false);
  const [decideErr, setDecideErr] = useState('');
  const openDecide = (po, status) => { setDecide({ po, status }); setDecideNote(''); setDecideErr(''); };
  const saveDecide = async () => {
    if (!decide) return;
    if (decide.status !== 'Approved' && !decideNote.trim()) { setDecideErr('Write a reason for ' + (decide.status === 'Rejected' ? 'rejecting' : 'holding') + ' this PO.'); return; }
    setDecideBusy(true); setDecideErr('');
    try {
      await axios.put(`/api/po/${decide.po.id}/action`, { status: decide.status, remarks: decideNote.trim() });
      setDecide(null);
      fetchPOs();
    } catch (e) {
      setDecideErr((e.response && e.response.data && e.response.data.error) || e.message || 'Not saved');
    }
    setDecideBusy(false);
  };
  const DECIDE = { Approved: { verb: 'Approve', color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' }, Rejected: { verb: 'Reject', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }, Hold: { verb: 'Hold', color: '#b45309', bg: '#fffbeb', border: '#fde68a' } };
  // 16-Nov-2026: row actions are small icon buttons in one line (name on hover), so a row stays one line high
  const iconBtn = (color, bg, border) => ({ color, background: bg, border: '1px solid ' + border, width: '30px', height: '30px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: '4px', flex: '0 0 auto', textDecoration: 'none' });
  const decideBtn = (st) => iconBtn(DECIDE[st].color, DECIDE[st].bg, DECIDE[st].border);

  const fetchPOs = async () => {
    try {
      const res = await axios.get('/api/po');
      setPos(res.data);
    } catch(err) { console.error(err); }
    setLoading(false);
  };

  const getBadge = (status) => {
    if(status === 'Approved') return <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{status}</span>;
    if(status === 'Rejected') return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{status}</span>;
    return <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{status}</span>;
  };

  // Filter Logic
  const filteredPOs = pos.filter(po => {
    const vendorName = po.Vendor ? po.Vendor.vendorName.toLowerCase() : '';
    const poNumber = po.poNumber ? po.poNumber.toLowerCase() : '';
    const searchMatch = vendorName.includes(externalSearchTerm.toLowerCase()) || poNumber.includes(externalSearchTerm.toLowerCase());
    
    const statusMatch = externalStatusFilter === 'All' || po.status === externalStatusFilter;
    const branchMatch = externalBranchFilter === 'All' || po.branch === externalBranchFilter;

    return searchMatch && statusMatch && branchMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPOs.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages); // after a delete the last page can disappear
  const indexOfLastItem = page * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPOs = filteredPOs.slice(indexOfFirstItem, indexOfLastItem);
  // page numbers: first, last, and two on each side of the current page
  const pageList = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) pageList.push(i);
    else if (pageList[pageList.length - 1] !== '...') pageList.push('...');
  }
  const goTo = (n) => setCurrentPage(Math.min(Math.max(1, n), totalPages));
  const pgBtn = (off, active) => ({ minWidth: '26px', height: '26px', padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + (active ? '#0284c7' : '#e2e8f0'), background: active ? '#e0f2fe' : off ? '#f8fafc' : 'white', color: active ? '#0369a1' : off ? '#cbd5e1' : '#0f172a', borderRadius: '4px', cursor: off ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' });

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>


      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>Total POs Found: <span style={{ color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>{filteredPOs.length}</span></span>
        </div>

        {loading ? <p>Loading...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...thStyle, width: '4%' }}>Sr.</th>
                <th style={{ ...thStyle, width: '11%' }}>PO Number</th>
                <th style={{ ...thStyle, width: '10%' }}>Submitted On</th>
                <th style={{ ...thStyle, width: '10%' }}>Vendor</th>
                <th style={{ ...thStyle, width: '15%' }}>Items</th>
                <th style={{ ...thStyle, width: '9%' }}>Branch</th>
                <th style={{ ...thStyle, width: '9%', textAlign: 'right' }}>Total Amount</th>
                <th style={{ ...thStyle, width: '17%' }}>Status</th>
                <th style={{ ...thStyle, width: '15%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentPOs.map((po, index) => {
                const itemCount = po.items ? po.items.length : 0;
                const firstItemName = itemCount > 0 ? po.items[0].itemName : 'No Items';
                
                return (
                    <tr key={po.id} style={{ background: '#ffffff', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
                    <td style={tdStyle}>{indexOfFirstItem + index + 1}</td>
                    <td style={tdStyle}><span style={{ background: '#e0f2fe', color: '#0284c7', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', border: '1px solid #bae6fd' }}>{po.poNumber}</span></td>
                    <td style={tdStyle}>
    <div style={{ fontWeight: '500' }}>{new Date(po.submittedAt || po.createdAt).toLocaleDateString('en-GB')}</div>
    <div style={{ fontSize: '11px', color: '#64748b' }}>{new Date(po.submittedAt || po.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
  </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '600' }}>{po.Vendor ? po.Vendor.vendorName : 'N/A'}</div>
                    </td>
                    <td style={{...tdStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={firstItemName + (itemCount > 1 ? ' (+' + (itemCount - 1) + ' more)' : '')}>
                        <div style={{ fontSize: '13px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {firstItemName}
                          {itemCount > 1 && <span style={{ color: '#64748b', fontStyle: 'italic', marginLeft: '5px' }}>(+{itemCount - 1} more)</span>}
                        </div>
                      </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', background: '#f8fafc', padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                        {po.branch}
                      </span>
                    </td>
                    <td style={{...tdStyle, textAlign: 'right'}}><strong style={{ color: '#0f172a' }}>&#8377;{Number(po.totalAmount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
                    <td style={tdStyle}>
                      {!po.directorRemarks && getBadge(po.status)}
                      {po.directorRemarks && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0px', fontSize: '11px', color: po.status === 'Approved' ? '#10b981' : '#ef4444', fontWeight: 'bold', background: po.status === 'Approved' ? '#ecfdf5' : '#fef2f2', padding: '6px 8px', borderRadius: '4px', border: '1px solid', borderColor: po.status === 'Approved' ? '#a7f3d0' : '#fecaca', display: 'inline-flex' }}>
                            <CheckCircle size={12} style={{ display: po.status === 'Approved' ? 'block' : 'none' }} />
                            <AlertCircle size={12} style={{ display: po.status !== 'Approved' ? 'block' : 'none' }} />
                            <span style={{ textTransform: 'uppercase', lineHeight: '1.4' }}>
                              {po.directorRemarks === 'Action taken directly from Email' ? (
                                <>
                                  <span>{po.directorRemarks}</span>
                                </>
                              ) : (
                                <>
                                  <span>{po.directorRemarks}</span>
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      {(po.actionAt || po.updatedAt) && po.status !== 'Pending Approval' && po.status !== 'Draft' && (
                        <div style={{ marginTop: '2px', fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>
                          ON {new Date(po.actionAt || po.updatedAt).toLocaleDateString('en-GB')} AT {new Date(po.actionAt || po.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      )}
                    </td>
                    <td style={{...tdStyle, textAlign: 'center'}}>
                      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                        <Link to={`/po-view/${po.id}`} title="View" aria-label={'View ' + po.poNumber} style={iconBtn('#2563eb', '#eff6ff', '#bfdbfe')}><Eye size={15} /></Link>
                        {canDecide && (po.status === 'Pending Approval' || po.status === 'Hold') && (
                          <>
                            <button type="button" title="Approve" aria-label={'Approve ' + po.poNumber} onClick={() => openDecide(po, 'Approved')} style={decideBtn('Approved')}><CheckCircle size={15} /></button>
                            <button type="button" title="Reject" aria-label={'Reject ' + po.poNumber} onClick={() => openDecide(po, 'Rejected')} style={decideBtn('Rejected')}><XCircle size={15} /></button>
                            {po.status !== 'Hold' && <button type="button" title="Hold" aria-label={'Hold ' + po.poNumber} onClick={() => openDecide(po, 'Hold')} style={decideBtn('Hold')}><Clock size={15} /></button>}
                          </>
                        )}
                        {!isDirector && (po.status === 'Pending Approval') && (
                          <button type="button" title="Resend to Director" aria-label={'Resend ' + po.poNumber}
                            onClick={async () => {
                              if(window.confirm('Resend approval request to Director via Email & WhatsApp?')) {
                                try {
                                  const res = await axios.post(`/api/po/${po.id}/resend`);
                                  alert(res.data.message || 'Resent successfully!');
                                } catch(e) {
                                  alert('Error resending PO');
                                }
                              }
                            }}
                            style={iconBtn('#0f766e', '#f0fdfa', '#99f6e4')}
                          ><Send size={15} /></button>
                        )}
                        {!isDirector && (po.status === 'Pending Approval' || po.status === 'Draft') && (
                          <button type="button" title="Delete" aria-label={'Delete ' + po.poNumber}
                            onClick={async () => {
                              if(window.confirm('Are you sure you want to delete this Purchase Order?')) {
                                try {
                                  await axios.delete(`/api/po/${po.id}`);
                                  fetchPOs();
                                } catch(e) {
                                  alert('Error deleting PO');
                                }
                              }
                            }}
                            style={iconBtn('#ef4444', '#fef2f2', '#fecaca')}
                          ><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPOs.length === 0 && <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No Purchase Orders match your search.</td></tr>}
            </tbody>
          </table>
          )}
          {!loading && filteredPOs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredPOs.length)} of {filteredPOs.length}</span>
                <select value={itemsPerPage} onChange={e => changePerPage(Number(e.target.value))} title="Rows per page" aria-label="Rows per page" style={{ height: '26px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button type="button" disabled={page === 1} onClick={() => goTo(1)} style={pgBtn(page === 1)} title="First page" aria-label="First page"><ChevronsLeft size={14} /></button>
                <button type="button" disabled={page === 1} onClick={() => goTo(page - 1)} style={pgBtn(page === 1)} title="Previous page" aria-label="Previous page"><ChevronLeft size={14} /></button>
                {pageList.map((n, i) => n === '...'
                  ? <span key={'gap' + i} style={{ padding: '0 2px', color: '#94a3b8', fontWeight: 'bold' }}>...</span>
                  : <button type="button" key={n} onClick={() => goTo(n)} style={pgBtn(false, n === page)} aria-current={n === page ? 'page' : undefined}>{n}</button>)}
                <button type="button" disabled={page === totalPages} onClick={() => goTo(page + 1)} style={pgBtn(page === totalPages)} title="Next page" aria-label="Next page"><ChevronRight size={14} /></button>
                <button type="button" disabled={page === totalPages} onClick={() => goTo(totalPages)} style={pgBtn(page === totalPages)} title="Last page" aria-label="Last page"><ChevronsRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      {decide && (
        <div role="dialog" aria-modal="true" aria-label={DECIDE[decide.status].verb + ' PO'} onClick={() => !decideBusy && setDecide(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '440px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '15px', color: DECIDE[decide.status].color }}>{DECIDE[decide.status].verb} {decide.po.poNumber}</div>
            <div style={{ padding: '14px 18px', fontSize: '13px', color: '#334155', display: 'grid', gap: '6px' }}>
              <div><strong>Vendor:</strong> {decide.po.Vendor ? decide.po.Vendor.vendorName : 'N/A'}</div>
              <div><strong>Amount:</strong> &#8377;{Number(decide.po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &nbsp; <strong>Branch:</strong> {decide.po.branch}</div>
              <div><strong>Items:</strong> {(decide.po.items || []).map(i => i.itemName).filter(Boolean).join(', ') || 'No items'}</div>
              <label style={{ marginTop: '6px', fontWeight: 'bold', fontSize: '12px', color: '#475569' }}>
                Remarks {decide.status === 'Approved' ? '(optional)' : '(required)'}
                <textarea autoFocus value={decideNote} onChange={e => setDecideNote(e.target.value)} maxLength={500} rows={3} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', textTransform: 'none' }} />
              </label>
              {decideErr && <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 8px', borderRadius: '4px' }}>{decideErr}</div>}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" disabled={decideBusy} onClick={() => setDecide(null)} style={{ padding: '7px 14px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Cancel</button>
              <button type="button" disabled={decideBusy} onClick={saveDecide} style={{ padding: '7px 14px', border: 'none', background: DECIDE[decide.status].color, color: 'white', borderRadius: '4px', cursor: decideBusy ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>{decideBusy ? 'Saving...' : DECIDE[decide.status].verb + ' PO'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' };
const tdStyle = { padding: '14px 12px', borderBottom: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a' };
