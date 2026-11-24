import React, { useState, useEffect, useRef } from 'react';

export default function DsrExcelGrid({ data, onSave }) {
  const [localData, setLocalData] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, field }
  const tableRef = useRef(null);

  useEffect(() => {
    // Unpack extendedData
    const mapped = data.map(job => {
      let ext = {};
      try { ext = JSON.parse(job.extendedData || '{}'); } catch(e){}
      return {
        ...job,
        latestRemark: ext.latestRemark || '',
        doDate: ext.doDate || '',
        clearanceDate: ext.clearanceDate || ''
      };
    });
    setLocalData(mapped);
  }, [data]);

  const columns = [
    { field: 'jobNo', label: 'Job No', readOnly: true, width: 120 },
    { field: 'beNo', label: 'BE No', readOnly: true, width: 130 },
    { field: 'importerName', label: 'Importer', readOnly: true, width: 200 },
    { field: 'igmNo', label: 'IGM No', readOnly: true, width: 130 },
    { field: 'status', label: 'Status', readOnly: false, width: 130 },
    { field: 'doDate', label: 'DO Date', readOnly: false, width: 120 },
    { field: 'clearanceDate', label: 'Clearance Date', readOnly: false, width: 120 },
    { field: 'latestRemark', label: 'Latest Remark', readOnly: false, width: 250 },
    { field: 'assignedTo', label: 'Assigned To', readOnly: true, width: 120 }
  ];

  const handleKeyDown = (e, rowIndex, colIndex) => {
    if (editingCell) return;
    
    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (e.key === 'ArrowDown') nextRow = Math.min(rowIndex + 1, localData.length - 1);
    else if (e.key === 'ArrowUp') nextRow = Math.max(rowIndex - 1, 0);
    else if (e.key === 'ArrowRight') nextCol = Math.min(colIndex + 1, columns.length - 1);
    else if (e.key === 'ArrowLeft') nextCol = Math.max(colIndex - 1, 0);
    else if (e.key === 'Enter') {
      const field = columns[colIndex].field;
      if (!columns[colIndex].readOnly) setEditingCell({ rowIndex, field });
      e.preventDefault();
      return;
    } else {
       if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !columns[colIndex].readOnly) {
           setEditingCell({ rowIndex, field: columns[colIndex].field });
       }
       return;
    }

    if (nextRow !== rowIndex || nextCol !== colIndex) {
      e.preventDefault();
      const td = tableRef.current.querySelector(`td[data-r="${nextRow}"][data-c="${nextCol}"]`);
      if (td) td.focus();
    }
  };

  const saveChange = async (jobId, field, value) => {
    if (onSave) {
      await onSave(jobId, field, value);
    }
  };

  const handleInputBlur = (rowIndex, field, value) => {
    setEditingCell(null);
    const row = localData[rowIndex];
    if (row[field] !== value) {
       const newData = [...localData];
       newData[rowIndex][field] = value;
       setLocalData(newData);
       saveChange(row.id, field, value);
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 220px)', overflow: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
      <table ref={tableRef} style={{ borderCollapse: 'collapse', width: '100%', minWidth: '1000px', backgroundColor: '#fff' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr>
            {columns.map(c => (
              <th key={c.field} style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '6px 12px', fontSize: '11px', color: '#475569', textAlign: 'left', width: c.width, userSelect: 'none' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {localData.map((row, rIdx) => (
            <tr key={row.id}>
              {columns.map((c, cIdx) => {
                const isEditing = editingCell?.rowIndex === rIdx && editingCell?.field === c.field;
                const cellValue = row[c.field] || '';
                
                return (
                  <td 
                    key={c.field} 
                    data-r={rIdx} 
                    data-c={cIdx}
                    tabIndex={c.readOnly ? -1 : 0}
                    onDoubleClick={() => !c.readOnly && setEditingCell({ rowIndex: rIdx, field: c.field })}
                    onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                    style={{ 
                      border: '1px solid #cbd5e1', 
                      padding: isEditing ? 0 : '6px 12px', 
                      fontSize: '11px', 
                      color: c.readOnly ? '#64748b' : '#0f172a',
                      background: c.readOnly ? '#f1f5f9' : '#fff',
                      cursor: c.readOnly ? 'default' : 'cell',
                      outline: 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: c.width
                    }}
                  >
                    {isEditing ? (
                      <input 
                        autoFocus
                        defaultValue={cellValue}
                        onBlur={(e) => handleInputBlur(rIdx, c.field, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                             e.preventDefault();
                             e.target.blur();
                             setTimeout(() => {
                                const nextTd = tableRef.current?.querySelector(`td[data-r="${Math.min(rIdx+1, localData.length-1)}"][data-c="${cIdx}"]`);
                                if (nextTd) nextTd.focus();
                             }, 50);
                          }
                          if (e.key === 'Escape') {
                             setEditingCell(null);
                          }
                        }}
                        style={{ width: '100%', height: '100%', border: '2px solid #2563eb', padding: '4px 10px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    ) : (
                      cellValue
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <style dangerouslySetInnerHTML={{__html: `
        td:focus {
           outline: 2px solid #2563eb !important;
           outline-offset: -2px;
           background-color: #eff6ff !important;
        }
      `}} />
    </div>
  );
}
