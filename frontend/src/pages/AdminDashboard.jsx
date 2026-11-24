import * as XLSX from 'xlsx';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Download, PieChart as PieChartIcon, IndianRupee, Calendar, BarChart2, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expiringAssets, setExpiringAssets] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [resMonth, resCat, resAlerts] = await Promise.all([
          axios.get('/api/po/dashboard/month-wise-expenses', { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get('/api/po/dashboard/category-wise-expenses', { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get('/api/assets/alerts/expiring', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ data: [] }))
        ]);
        setExpiringAssets(resAlerts.data || []);
        setData(resMonth.data);
        setCategoryData(resCat.data);
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalExpense = data.reduce((sum, item) => sum + (Number(item.expense) || 0), 0);
  
  const currentMonth = new Date().getMonth();
  const currentMonthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonth];
  const currentMonthExpense = data.find(d => d.month === currentMonthName)?.expense || 0;
  
  
  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/po', { headers: { 'Authorization': `Bearer ${token}` } });
      
      const exportData = res.data.filter(po => po.status === 'Approved').map(po => ({
          'PO Number': po.poNumber,
          'Date': new Date(po.date).toLocaleDateString('en-GB'),
          'Category': po.category || 'Other',
          'Vendor Name': po.Vendor ? po.Vendor.vendorName : 'N/A',
          'Branch': po.branch || 'Head Office',
          'Total Amount': parseFloat(po.totalAmount || 0),
          'Status': po.status
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Approved Expenses");
      XLSX.writeFile(wb, "Approved_Expenses_Report.xlsx");
    } catch (err) {
      console.error(err);
      alert('Failed to generate Excel report');
    }
  };

  const topCategory = categoryData.length > 0 ? categoryData.reduce((prev, current) => (prev.expense > current.expense) ? prev : current) : { category: 'None', expense: 0 };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const cardStyle = { background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };

  return (
    <div className="admin-dash" style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: '24px', fontWeight: 'bold' }}>Admin Dashboard</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ color: '#64748b', fontSize: '14px', background: 'white', padding: '8px 16px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            Year-to-Date ({new Date().getFullYear()})
          </div>
          <button onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>
            <Download size={16} /> Export to Excel
          </button>
        </div>
      </div>
      
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <p style={{ color: '#64748b', fontSize: '16px' }}>Loading analytics...</p>
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', color: '#ef4444', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>{error}</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ background: '#fffbeb', padding: '1.5rem', borderRadius: '12px', border: '1px solid #fde68a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b45309', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, paddingBottom: '1rem', borderBottom: '1px solid #fde68a' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            Expiring Asset Warranties
          </h2>
          {expiringAssets.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#b45309', margin: 0, fontWeight: '500' }}>No items expiring soon. All warranties are safe!</p>
          ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {expiringAssets.map(asset => {
                      const days = Math.ceil((new Date(asset.warrantyExpiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                      const isExpired = days < 0;
                      return (
                          <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'white', borderLeft: `4px solid ${isExpired ? '#ef4444' : '#f59e0b'}`, borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                              <div>
                                  <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>{asset.assetName}</strong>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>Assigned: {asset.assignedTo || 'Unassigned'}</span>
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: 'bold', color: isExpired ? '#ef4444' : '#d97706', display: 'flex', alignItems: 'center' }}>
                                  {isExpired ? 'Expired' : `${days} Days Left`}
                              </div>
                          </div>
                      )
                  })}
              </div>
          )}
        </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            
            <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', display: 'flex', alignItems: 'center', gap: '20px', border: 'none' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '16px', borderRadius: '50%', color: 'white' }}>
                <IndianRupee size={32} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#e0f2fe', fontSize: '14px', fontWeight: '500' }}>Total Approved Expenses</p>
                <h3 style={{ margin: 0, color: 'white', fontSize: '28px', fontWeight: 'bold' }}>₹{totalExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              </div>
            </div>

            <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', display: 'flex', alignItems: 'center', gap: '20px', border: 'none' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '16px', borderRadius: '50%', color: 'white' }}>
                <Calendar size={32} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#d1fae5', fontSize: '14px', fontWeight: '500' }}>{currentMonthName} Expenses</p>
                <h3 style={{ margin: 0, color: 'white', fontSize: '28px', fontWeight: 'bold' }}>₹{currentMonthExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              </div>
            </div>

            <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', display: 'flex', alignItems: 'center', gap: '20px', border: 'none' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '16px', borderRadius: '50%', color: 'white' }}>
                <TrendingUp size={32} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#fef3c7', fontSize: '14px', fontWeight: '500' }}>Highest Spend Category</p>
                <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 'bold' }}>{topCategory.category}</h3>
                <p style={{ margin: '4px 0 0 0', color: '#fde68a', fontSize: '13px' }}>₹{topCategory.expense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>

          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            
            {/* Bar Chart */}
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <BarChart2 size={20} color="#3b82f6" />
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>Month-wise Trend</h3>
              </div>
              <div style={{ height: '350px', width: '100%', flex: 1 }}>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94a3b8" tickFormatter={(value) => `₹${value >= 1000 ? (value/1000)+"k" : value}`} axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} />
                    <Tooltip 
                      formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Spent"]}
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="expense" radius={[6, 6, 0, 0]} barSize={36}>
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart */}
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <PieChartIcon size={20} color="#8b5cf6" />
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>Spend by Category</h3>
              </div>
              <div style={{ height: '350px', width: '100%', flex: 1 }}>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="expense"
                      nameKey="category"
                      label={false}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Amount"]}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
