import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AirExportActionTabs from './AirExportActionTabs';
import { Search, FileText, Download } from 'lucide-react';
import ModernDatePicker from '../common/ModernDatePicker';

export default function ExportData() {
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(50);
  
  const [filters, setFilters] = useState({
    fileType: 'MAWB',
    fromDate: '',
    toDate: ''
  });

  const [selectedRows, setSelectedRows] = useState(new Set());

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const clearFilters = () => {
    setFilters({ fileType: 'MAWB', fromDate: '', toDate: '' });
  };

  const fetchExportData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/reports/export-data?${queryParams}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data || []);
        setCurrentPage(1);
        setSelectedRows(new Set());
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExportData();
  }, []);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(data.map((_, i) => i));
      setSelectedRows(allIds);
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (idx) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedRows(newSelected);
  };

  const handleExport = () => {
    if (selectedRows.size === 0) {
      alert('Please select at least one record to export.');
      return;
    }
    
    // Generate simple CSV
    const rowsToExport = data.filter((_, i) => selectedRows.has(i));
    const headers = ['TYPE', 'AWB NUMBER', 'STATUS', 'AIRLINE CODE', 'ORIGIN', 'DEPARTURE DATE', 'DESTINATION', 'AWB DATE'];
    const csvContent = [
      headers.join(','),
      ...rowsToExport.map(r => [r.type, r.awb, r.status, r.airlineCode, r.origin, r.dep, r.dst, r.awbDate].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `export_data_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const labelStyle = { fontSize: '12px', fontWeight: '600', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '8px', letterSpacing: '0.5px' };
  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid var(--border-color, #e2e8f0)',
    borderRadius: '6px',
    fontSize: '13px',
    width: '100%',
    color: '#064e3b',
    background: '#dcfce7',
    outline: 'none',
    transition: 'all 0.2s',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
  };

  const panelStyle = {
    border: '1px solid var(--border-color, #e2e8f0)',
    background: 'var(--bg-panel, var(--bg-panel, #ffffff))',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    overflow: 'hidden'
  };

  const btnStyle = {
    background: '#3b82f6',
    color: 'var(--bg-panel, var(--bg-panel, #ffffff))',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
    transition: 'background 0.2s'
  };

  const tableHeaderStyle = {
    background: 'var(--bg-app, var(--bg-app, #f8fafc))',
    color: '#334155',
    fontWeight: 'bold',
    fontSize: '11px',
    padding: '10px 8px',
    borderBottom: '2px solid var(--border-color, #cbd5e1)',
    textAlign: 'left',
    textTransform: 'uppercase'
  };

  const tableCellStyle = {
    padding: '10px 8px',
    fontSize: '12px',
    color: 'var(--text-main, var(--text-main, #1e293b))',
    borderBottom: '1px solid var(--border-color, #e2e8f0)',
    background: 'var(--bg-panel, var(--bg-panel, #ffffff))'
  };

  const currentData = data.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
      <AirExportActionTabs activeTab="export-data" />
      
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px' }}>
        
        <h2 style={{ fontSize: '20px', color: 'var(--text-main, var(--text-main, #0f172a))', margin: 0, fontWeight: '700', letterSpacing: '-0.5px' }}>EXPORT DATA</h2>

        {/* Filter Panel */}
        <div style={panelStyle}>
          <div style={{ padding: '16px', display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>FILE TYPE <span style={{color: '#ef4444'}}>*</span></div>
              <select name="fileType" value={filters.fileType} onChange={handleFilterChange} style={inputStyle}>
                <option value="All">All Types</option>
                <option value="MAWB">AIR WAYBILL</option>
                <option value="HAWB">HOUSE WAYBILL</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>FROM DATE <span style={{color: '#ef4444'}}>*</span></div>
              <ModernDatePicker name="fromDate" value={filters.fromDate} onChange={handleFilterChange} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>TO DATE <span style={{color: '#ef4444'}}>*</span></div>
              <ModernDatePicker name="toDate" value={filters.toDate} onChange={handleFilterChange} style={inputStyle} />
            </div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
            <span style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }} onClick={() => { clearFilters(); setTimeout(fetchExportData, 100); }}>CLEAR</span>
            <button style={btnStyle} onClick={fetchExportData}><Search size={14} /> SEARCH</button>
          </div>
        </div>

        {/* Results Panel */}
        <div style={panelStyle}>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <div style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: '700', fontSize: '15px' }}>SEARCH RESULTS</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
              <span>Show</span>
              <select value={entriesPerPage} onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '4px 8px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', outline: 'none' }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries</span>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...tableHeaderStyle, width: '40px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={data.length > 0 && selectedRows.size === data.length}
                        onChange={handleSelectAll} 
                      />
                    </th>
                    <th style={{ ...tableHeaderStyle, width: '40px' }}></th>
                    <th style={tableHeaderStyle}>TYPE</th>
                    <th style={tableHeaderStyle}>AIR WAYBILL NUMBER</th>
                    <th style={tableHeaderStyle}>STATUS</th>
                    <th style={tableHeaderStyle}>AIRLINE CODE</th>
                    <th style={tableHeaderStyle}>ORIGIN</th>
                    <th style={tableHeaderStyle}>DEPARTURE DATE</th>
                    <th style={tableHeaderStyle}>DESTINATION</th>
                    <th style={tableHeaderStyle}>AWB DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Loading data...</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>No data available for export.</td></tr>
                  ) : (
                    currentData.map((row, i) => {
                      const absoluteIndex = (currentPage - 1) * entriesPerPage + i;
                      return (
                        <tr key={absoluteIndex} style={{ background: selectedRows.has(absoluteIndex) ? '#f0f9ff' : 'white', transition: 'background 0.2s' }}>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedRows.has(absoluteIndex)}
                              onChange={() => handleSelectRow(absoluteIndex)} 
                            />
                          </td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                            <FileText size={16} color={row.type === 'MAWB' ? "#16a34a" : "var(--primary-text, #0284c7)"} />
                          </td>
                          <td style={{ ...tableCellStyle, fontWeight: 'bold', color: row.type === 'MAWB' ? '#166534' : '#075985' }}>{row.type}</td>
                          <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>{row.awb}</td>
                          <td style={tableCellStyle}>{row.status}</td>
                          <td style={tableCellStyle}>{row.airlineCode}</td>
                          <td style={tableCellStyle}>{row.origin}</td>
                          <td style={tableCellStyle}>{row.dep}</td>
                          <td style={tableCellStyle}>{row.dst}</td>
                          <td style={tableCellStyle}>{row.awbDate}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Export Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted, var(--text-muted, #475569))' }}>
              <div>
                {data.length > 0 ? (
                  `Showing ${((currentPage - 1) * entriesPerPage) + 1} to ${Math.min(currentPage * entriesPerPage, data.length)} of ${data.length} entries`
                ) : 'Showing 0 entries'}
              </div>

              {data.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{ padding: '6px 12px', border: '1px solid var(--border-color, #e2e8f0)', background: currentPage === 1 ? 'var(--bg-app, var(--bg-app, #f8fafc))' : 'var(--bg-panel, var(--bg-panel, #ffffff))', color: currentPage === 1 ? 'var(--border-color, var(--border-color, #cbd5e1))' : '#334155', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Previous
                  </button>
                  
                  <span>Page</span>
                  <select 
                    value={currentPage}
                    onChange={(e) => setCurrentPage(Number(e.target.value))}
                    style={{ padding: '6px 12px', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '6px', outline: 'none', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', color: '#334155', cursor: 'pointer' }}
                  >
                    {Array.from({ length: Math.ceil(data.length / entriesPerPage) }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                  <span>of {Math.ceil(data.length / entriesPerPage)}</span>

                  <button 
                    disabled={currentPage === Math.ceil(data.length / entriesPerPage)}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    style={{ padding: '6px 12px', border: '1px solid var(--border-color, #e2e8f0)', background: currentPage === Math.ceil(data.length / entriesPerPage) ? 'var(--bg-app, var(--bg-app, #f8fafc))' : 'var(--bg-panel, var(--bg-panel, #ffffff))', color: currentPage === Math.ceil(data.length / entriesPerPage) ? 'var(--border-color, var(--border-color, #cbd5e1))' : '#334155', borderRadius: '6px', cursor: currentPage === Math.ceil(data.length / entriesPerPage) ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
              <button style={{ ...btnStyle, background: '#ef4444', boxShadow: 'none' }} onClick={clearFilters}>RESET</button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button style={{ ...btnStyle, background: '#94a3b8', boxShadow: 'none' }} onClick={() => navigate('/freight/air-export')}>CANCEL</button>
                <button style={btnStyle} onClick={handleExport}><Download size={16} /> EXPORT CSV</button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
