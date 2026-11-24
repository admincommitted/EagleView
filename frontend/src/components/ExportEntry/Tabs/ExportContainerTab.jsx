import React from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useExportContext } from '../ExportContext';
import ModernDatePicker from '../../common/ModernDatePicker';

export default function ExportContainerTab() {
  const { containers, setContainers } = useExportContext();

  const addContainer = () => {
    const newId = containers.length ? Math.max(...containers.map(c => c.id || 0)) + 1 : 1;
    setContainers([...containers, { id: newId, containerNo: '', size: '20', exciseSealNo: '', sealDate: '', deviceId: '' }]);
  };

  const updateContainer = (id, field, value) => {
    setContainers(containers.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeContainer = (id) => {
    setContainers(containers.filter(c => c.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
      <div className="glass-panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="section-header" style={{ margin: 0 }}>Container Details</h3>
          <button className="btn btn-secondary" onClick={addContainer} style={{ padding: '0.2rem 0.5rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <PlusCircle size={12} /> Add Container
          </button>
        </div>
        
        <table className="compact-table">
          <thead>
            <tr>
              <th>Container No</th>
              <th>Size</th>
              <th>Excise Seal No</th>
              <th>Seal Date</th>
              <th>Device ID</th>
              <th style={{ width: '40px', textAlign: 'center' }}>Act</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((cont, index) => (
              <tr key={cont.id || index}>
                <td><input type="text" className="grid-input" value={cont.containerNo || ''} onChange={e => updateContainer(cont.id, 'containerNo', e.target.value.toUpperCase())} /></td>
                <td>
                  <select className="grid-input" style={{ width: '80px' }} value={cont.size || '20'} onChange={e => updateContainer(cont.id, 'size', e.target.value)}>
                    <option value="20">20</option>
                    <option value="40">40</option>
                    <option value="45">45</option>
                  </select>
                </td>
                <td><input type="text" className="grid-input" placeholder="Seal No" value={cont.exciseSealNo || ''} onChange={e => updateContainer(cont.id, 'exciseSealNo', e.target.value.toUpperCase())} /></td>
                <td><ModernDatePicker className="grid-input" value={cont.sealDate || ''} onChange={e => updateContainer(cont.id, 'sealDate', e.target.value)} /></td>
                <td><input type="text" className="grid-input" placeholder="RFID/Device ID" value={cont.deviceId || ''} onChange={e => updateContainer(cont.id, 'deviceId', e.target.value.toUpperCase())} /></td>
                <td style={{ textAlign: 'center' }}>
                  <Trash2 size={14} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => removeContainer(cont.id)} />
                </td>
              </tr>
            ))}
            {containers.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                  No containers added. Click "Add Container" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
