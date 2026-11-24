import React from 'react';
import ModernDatePicker from '../../../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box (same YYYY-MM-DD value)
import { useExportContext } from '../../ExportContext';

export default function MoowrTab() {
  const { exportData, setExportData } = useExportContext();

  const handleMoowrChange = (field, value) => {
    setExportData(prev => ({
      ...prev,
      moowrDetails: {
        ...(prev.moowrDetails || {}),
        [field]: value
      }
    }));
  };

  const moowr = exportData.moowrDetails || {};

  return (
    <div style={{ padding: '1rem' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        Manufacture and Other Operations in Warehouse (MOOWR)
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500 }}>Warehouse Code (From Ex-Bond Header)</label>
          {/* the header keeps the ex-bond warehouse in code / warehousename (SB 2 tab: warehouseCode); autoField_28 is
              the container Sr No box, so this showed a wrong or empty value. 29-Oct-2026 */}
          <input 
            type="text" 
            className="input-field" 
            style={{ border: '1px solid #e2e8f0', padding: '0.4rem 0.5rem', background: 'var(--bg-app, #f8fafc)', color: '#64748b', cursor: 'not-allowed' }} 
            value={[exportData.code || exportData.warehouseCode || '', exportData.warehousename || ''].filter(Boolean).join(' - ')} 
            readOnly
            title="This value is picked from the Ex-Bond details in the Header tab."
            placeholder="Select the WareHouse Code in SB Header (Ex-Bond Job = Y)"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500 }}>License No / Job Number</label>
          <input 
            type="text" 
            className="input-field" 
            style={{ border: '1px solid #cbd5e1', padding: '0.4rem 0.5rem' }} 
            value={moowr.licenseNo || ''} 
            onChange={e => handleMoowrChange('licenseNo', e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500 }}>Approval Date</label>
          <ModernDatePicker
            className="input-field" 
            style={{ border: '1px solid #cbd5e1', padding: '0.4rem 0.5rem' }} 
            value={moowr.approvalDate || ''} 
            onChange={e => handleMoowrChange('approvalDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
