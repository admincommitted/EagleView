import { useState, useEffect, useCallback } from 'react';

export function useGridFeatures({ 
  initialData, 
  storageKey, // 30-Oct-2026: kept for callers, no longer used - the browser draft is gone (see below)
  onPasteRowMapping, // Function to map an array of string values from clipboard to an object (null = skip the row)
  onPasteRows, // optional: (parsedRows, currentData) => rows to add (the owner checks duplicates / numbering); [] = nothing
  onDuplicate // optional: (selectedRowId) => void - Ctrl+D. Without it Ctrl+D does nothing (30-Oct-2026: the old
              // silent clone made a second invoice with the same Invoice No / a second item with the same Sr No)
}) {
  // 1. State Management
  // 30-Oct-2026: the localStorage "draft" of the grid was removed. Every save gives the rows new database ids, so a
  // draft restored after a reload carried ids that no longer existed: the form showed row 1, "Modify" matched
  // nothing and the job was still reported as saved. The server copy (job load) is the only source now; the
  // operator works with Save / Modify only.
  const [data, setData] = useState(() => (Array.isArray(initialData) ? initialData : []));
  const [selectedRowId, setSelectedRowId] = useState(null);
  void storageKey;

  // a selected id that is no longer in the data (rows re-created by a save, job switched) is dropped, never
  // silently replaced by another row
  useEffect(() => {
    if (selectedRowId !== null && selectedRowId !== undefined && !data.some(d => d.id === selectedRowId)) setSelectedRowId(null);
  }, [data, selectedRowId]);
  const rowExists = (id) => id !== null && id !== undefined && data.some(d => d.id === id);

  // 2. Bulk Edit / Mass Update (Checkboxes)
  const [checkedIds, setCheckedIds] = useState([]);

  const toggleCheck = (id) => {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const checkAll = () => {
    if (checkedIds.length === data.length) {
      setCheckedIds([]); // uncheck all
    } else {
      setCheckedIds(data.map(d => d.id)); // check all
    }
  };

  const applyBulkUpdate = (updates) => {
    if (checkedIds.length === 0) return;
    setData(prev => prev.map(item => 
      checkedIds.includes(item.id) ? { ...item, ...updates } : item
    ));
    setCheckedIds([]); // clear selection after update
  };

  // 3. Duplicate Row
  const duplicateRow = (id) => {
    const itemToClone = data.find(item => item.id === id);
    if (!itemToClone) return;

    const newId = Math.max(0, ...data.map(d => d.id)) + 1;
    const clonedItem = { ...itemToClone, id: newId };
    
    // Find index to insert right after
    const index = data.findIndex(item => item.id === id);
    const newData = [...data];
    newData.splice(index + 1, 0, clonedItem);
    
    setData(newData);
    setSelectedRowId(newId);
  };

  // 3.5 Delete Selected
  const deleteSelected = () => {
    if (checkedIds.length === 0) return;
    setData(prev => prev.filter(item => !checkedIds.includes(item.id)));
    if (checkedIds.includes(selectedRowId)) {
      setSelectedRowId(null);
    }
    setCheckedIds([]);
  };

  // 4. Keyboard Navigation
  const handleKeyDown = useCallback((e) => {
    if (data.length === 0) return;
    // do not steal arrow keys / Ctrl+D while the user is typing in a field or choosing in a dropdown
    const tg = e.target || {};
    if (tg.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tg.tagName)) return;
    const currentIndex = data.findIndex(item => item.id === selectedRowId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < data.length - 1) {
        setSelectedRowId(data[currentIndex + 1].id);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) {
        setSelectedRowId(data[currentIndex - 1].id);
      }
    } else if (e.key === 'd' && e.ctrlKey) {
       // Ctrl+D to duplicate selected - only through the owner's own copy logic (new Invoice No / next Item Sr No)
       e.preventDefault();
       if (selectedRowId !== null && typeof onDuplicate === 'function') onDuplicate(selectedRowId);
    }
  }, [data, selectedRowId, onDuplicate]);

  useEffect(() => {
    // Add global listener for this tab
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 5. Excel Smart Paste
  const handlePaste = useCallback((e) => {
    // Only handle paste if user is not typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('Text');
    if (!pastedText) return;

    if (typeof onPasteRowMapping !== 'function') return; // this grid does not take pasted rows
    const rows = pastedText.split(/\r?\n/).filter(r => r.trim() !== '');
    if (rows.length === 0) return;

    let nextId = Math.max(0, ...data.map(d => +d.id || 0)) + 1;
    let newItems = rows.map(row => {
      const cells = row.split('\t').map(c => String(c).trim()); // Excel separates columns by tab
      const parsedItem = onPasteRowMapping(cells);
      return parsedItem ? { ...parsedItem, id: nextId++ } : null;
    }).filter(Boolean);
    if (typeof onPasteRows === 'function') newItems = onPasteRows(newItems, data) || [];
    if (!newItems.length) return;

    setData(prev => [...prev, ...newItems]);
  }, [data, onPasteRowMapping, onPasteRows]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return {
    data,
    setData,
    selectedRowId,
    setSelectedRowId,
    checkedIds,
    toggleCheck,
    checkAll,
    applyBulkUpdate,
    duplicateRow,
    deleteSelected,
    rowExists
  };
}
