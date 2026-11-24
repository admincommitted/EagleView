import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AirExportActionTabs from './AirExportActionTabs';
import { Search } from 'lucide-react';
import ModernDatePicker from '../common/ModernDatePicker';

export default function ForwarderTransactionsReport() {
  const navigate = useNavigate();

  // Data states
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ totalMawb: 0, totalHawb: 0, totalRecords: 0 });
  const [companyInfo, setCompanyInfo] = useState({ name: 'ALL COMPANIES', address: '---' });
  const [loading, setLoading] = useState(false);
  
  // Dropdown options
  const [airlines, setAirlines] = useState([]);
  const [parties, setParties] = useState([]);

  // Filter states
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(50);

  const [filters, setFilters] = useState({
    companyId: '',
    reportType: 'MONTHLY',
    fromDate: '',
    toDate: '',
    docType: 'All',
    airline: ''
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const clearFilters = () => {
    setFilters({ companyId: '', reportType: 'MONTHLY', fromDate: '', toDate: '', docType: 'All', airline: '' });
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/reports/forwarder-transactions?${queryParams}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data || []);
        setCurrentPage(1);
        setSummary(result.summary || { totalMawb: 0, totalHawb: 0, totalRecords: 0 });
        setCompanyInfo(result.companyInfo || { name: 'ALL COMPANIES', address: '---' });
        if (result.airlines) setAirlines(result.airlines);
        if (result.parties) setParties(result.parties);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReportData();
  }, []);

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

  const summaryHeaderStyle = {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--text-main, var(--text-main, #0f172a))',
    borderRight: '1px solid var(--border-color, #cbd5e1)',
    borderBottom: '1px solid var(--border-color, #cbd5e1)',
    background: 'var(--bg-app, var(--bg-app, #f8fafc))',
    textTransform: 'uppercase'
  };

  const summaryCellStyle = {
    padding: '12px 16px',
    fontSize: '12px',
    color: 'var(--text-main, var(--text-main, #1e293b))',
    borderRight: '1px solid var(--border-color, #cbd5e1)',
    borderBottom: '1px solid var(--border-color, #cbd5e1)',
    background: 'var(--bg-panel, var(--bg-panel, #ffffff))',
    textTransform: 'uppercase'
  };

  const tableHeaderStyle = {
    background: 'var(--bg-app, var(--bg-app, #f8fafc))',
    color: '#334155',
    fontWeight: 'bold',
    fontSize: '11px',
    padding: '8px',
    borderBottom: '2px solid var(--border-color, #cbd5e1)',
    textAlign: 'left',
    textTransform: 'uppercase'
  };

  const tableCellStyle = {
    padding: '8px',
    fontSize: '11px',
    color: 'var(--text-main, var(--text-main, #1e293b))',
    borderBottom: '1px solid var(--border-color, #e2e8f0)',
    background: 'var(--bg-panel, var(--bg-panel, #ffffff))'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
      <AirExportActionTabs activeTab="forwarder-report" />
      
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <h2 style={{ fontSize: '20px', color: 'var(--text-main, var(--text-main, #0f172a))', margin: 0, fontWeight: '700', letterSpacing: '-0.5px' }}>Forwarder Transactions Report</h2>

        {/* Filter Panel */}
        <div style={panelStyle}>
          <div style={{ padding: '16px', display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1.5 }}>
              <div style={labelStyle}>Company Name</div>
              <select name="companyId" value={filters.companyId} onChange={handleFilterChange} style={inputStyle}>
                <option value="">ALL COMPANIES</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Report Type</div>
              <select name="reportType" value={filters.reportType} onChange={handleFilterChange} style={inputStyle}>
                <option value="MONTHLY">MONTHLY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="DAILY">DAILY</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>From Date</div>
              <ModernDatePicker name="fromDate" value={filters.fromDate} onChange={handleFilterChange} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>To Date</div>
              <ModernDatePicker name="toDate" value={filters.toDate} onChange={handleFilterChange} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Document Type</div>
              <select name="docType" value={filters.docType} onChange={handleFilterChange} style={inputStyle}>
                <option value="All">All</option>
                <option value="MAWB">MAWB</option>
                <option value="HAWB">HAWB</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Airline Name</div>
              <select name="airline" value={filters.airline} onChange={handleFilterChange} style={inputStyle}>
                <option value="">All Airlines</option>
                {airlines.map(al => (
                  <option key={al.id} value={al.code2}>{al.name} ({al.code2})</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
            <span style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }} onClick={() => { clearFilters(); setTimeout(fetchReportData, 100); }}>Clear</span>
            <button style={btnStyle} onClick={fetchReportData}><Search size={14} /> Search</button>
          </div>
        </div>

        {/* Results Panel */}
        <div style={panelStyle}>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <div style={{ color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: '700', fontSize: '15px' }}>Search Results</div>
            
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

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRadius: '8px', overflow: 'hidden' }}>
              
              {/* Summary Section */}
              <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2px solid var(--border-color, #cbd5e1)' }}>
                <tbody>
                  <tr>
                    <td style={{ ...summaryHeaderStyle, width: '15%' }}>Company Name</td>
                    <td style={{ ...summaryCellStyle, width: '35%', fontWeight: 'bold' }}>{companyInfo.name}</td>
                    <td style={{ ...summaryHeaderStyle, width: '25%', textAlign: 'center', borderRight: 'none', background: 'var(--primary-bg-light, #e0f2fe)' }} colSpan={2}>Summary</td>
                  </tr>
                  <tr>
                    <td style={{ ...summaryHeaderStyle, verticalAlign: 'top' }} rowSpan={4}>Address</td>
                    <td style={{ ...summaryCellStyle, verticalAlign: 'top', color: 'var(--text-muted, var(--text-muted, #64748b))' }} rowSpan={4}>{companyInfo.address || '---'}</td>
                    <td style={{ ...summaryHeaderStyle, borderRight: 'none' }}>Period:</td>
                    <td style={{ ...summaryCellStyle }}>
                      {filters.fromDate && filters.toDate ? `${filters.fromDate} to ${filters.toDate}` : 'ALL TIME'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...summaryHeaderStyle, borderRight: 'none' }}>No of AWBs/Master AWBs</td>
                    <td style={{ ...summaryCellStyle, fontWeight: 'bold', color: '#0f766e' }}>{summary.totalMawb}</td>
                  </tr>
                  <tr>
                    <td style={{ ...summaryHeaderStyle, borderRight: 'none' }}>No of House Waybills</td>
                    <td style={{ ...summaryCellStyle, fontWeight: 'bold', color: 'var(--primary-text, #0369a1)' }}>{summary.totalHawb}</td>
                  </tr>
                  <tr>
                    <td style={{ ...summaryHeaderStyle, borderRight: 'none' }}>Total No of Records</td>
                    <td style={{ ...summaryCellStyle, fontWeight: 'bold', color: '#b91c1c' }}>{summary.totalRecords}</td>
                  </tr>
                  <tr>
                    <td style={summaryHeaderStyle}>Report Name</td>
                    <td style={summaryCellStyle}>Forwarder Transaction Report</td>
                    <td style={{ ...summaryHeaderStyle, borderRight: 'none' }}></td>
                    <td style={summaryCellStyle}></td>
                  </tr>
                </tbody>
              </table>

              {/* Data Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>S.No</th>
                    <th style={tableHeaderStyle}>Document<br/>Type</th>
                    <th style={tableHeaderStyle}>AWB/MAWB No</th>
                    <th style={tableHeaderStyle}>House Waybill<br/>No</th>
                    <th style={tableHeaderStyle}>Airline</th>
                    <th style={tableHeaderStyle}>Origin</th>
                    <th style={tableHeaderStyle}>Destination</th>
                    <th style={tableHeaderStyle}>Gross<br/>Weight</th>
                    <th style={tableHeaderStyle}>No.of<br/>Pieces</th>
                    <th style={tableHeaderStyle}>Shipper</th>
                    <th style={tableHeaderStyle}>Submitted<br/>Date</th>
                    <th style={tableHeaderStyle}>Submitted<br/>By</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="12" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Loading data...</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan="12" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>No transactions found.</td></tr>
                  ) : (
                    (data.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)).map((row, idx) => (
                      <tr key={idx} style={{ background: row.docType === 'MAWB' ? '#f0fdf4' : '#f0f9ff' }}>
                        <td style={tableCellStyle}>{row.sno}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 'bold', color: row.docType === 'MAWB' ? '#166534' : '#075985' }}>{row.docType}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>{row.mawbNo}</td>
                        <td style={tableCellStyle}>{row.hawbNo || '-'}</td>
                        <td style={tableCellStyle}>{row.airline}</td>
                        <td style={tableCellStyle}>{row.origin}</td>
                        <td style={tableCellStyle}>{row.destination}</td>
                        <td style={tableCellStyle}>{row.grossWeight}</td>
                        <td style={tableCellStyle}>{row.pieces}</td>
                        <td style={tableCellStyle}>{row.shipper}</td>
                        <td style={tableCellStyle}>{new Date(row.submittedDate).toLocaleDateString('en-GB')}</td>
                        <td style={tableCellStyle}>{row.submittedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted, var(--text-muted, #475569))' }}>
                <div>
                  Showing {((currentPage - 1) * entriesPerPage) + 1} to {Math.min(currentPage * entriesPerPage, data.length)} of {data.length} entries
                </div>
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
                    disabled={currentPage === Math.ceil(data.length / entriesPerPage) || data.length === 0}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    style={{ padding: '6px 12px', border: '1px solid var(--border-color, #e2e8f0)', background: currentPage === Math.ceil(data.length / entriesPerPage) || data.length === 0 ? 'var(--bg-app, var(--bg-app, #f8fafc))' : 'var(--bg-panel, var(--bg-panel, #ffffff))', color: currentPage === Math.ceil(data.length / entriesPerPage) || data.length === 0 ? 'var(--border-color, var(--border-color, #cbd5e1))' : '#334155', borderRadius: '6px', cursor: currentPage === Math.ceil(data.length / entriesPerPage) || data.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
