// State and logic
// Split out of DSRTemplateMaster.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

export default function useDSRTemplateMaster(ctx) {
  const [templates, setTemplates] = useState([]);
  
  const fetchTemplates = async () => {
     try {
       const res = await fetch('/api/dsr-templates');
       const json = await res.json();
       // 28-Oct-2026: a failed load showed the sample template (saving it made a copy); now an error is shown
       if (!json.success) { toast.error('Could not load DSR templates: ' + (json.message || res.status)); return; }
       if(json.data.length > 0) {
          setTemplates(prev => {
            // keep templates not saved yet ('new_...') and the one being worked on
            const unsaved = prev.filter(t => String(t.id).startsWith('new_'));
            return [...json.data, ...unsaved];
          });
          setActiveId(cur => (json.data.some(t => t.id === cur) || String(cur).startsWith('new_')) ? cur : json.data[0].id);
       } else {
          // Fallback initial dummy state if DB is empty
          setTemplates([{ id: 'new_' + Date.now(), name: 'Default Template', module: 'IMPORT', client: 'ALL', clientRole: 'IMPORTER', columns: [{ id: 11, header: 'Job No', field: 'Job.jobNo' }, { id: 12, header: 'Importer', field: 'Job.importerName' }, { id: 13, header: 'Status', field: 'Job.status' }], colorRules: [] }]);
       }
     } catch(e) {
       console.error(e);
     }
  };

  useEffect(() => {
     fetchTemplates();
  }, []);

  const handleSaveTemplate = async () => {
     if (!activeTemplate) return;
     try {
       const res = await fetch('/api/dsr-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeTemplate)
       });
       const json = await res.json();
       if (json.success) {
          toast.success(json.message);
          // the saved one gets its real id and stays open; other unsaved templates are kept
          setTemplates(prev => prev.map(t => t.id === activeTemplate.id ? json.data : t));
          setActiveId(json.data.id);
       } else {
          toast.error('Failed to save: ' + json.message);
       }
     } catch (e) {
       toast.error('Error saving template');
     }
  };

  const [activeId, setActiveId] = useState(1);
  const activeTemplate = templates.find(t => t.id === activeId) || null;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const selectedFieldIds = activeTemplate ? activeTemplate.columns.map(c => c.field) : [];
  
  const handleToggleField = (fieldKey, defaultHeader) => {
    if (selectedFieldIds.includes(fieldKey)) {
      setTemplates(templates.map(t => t.id === activeId ? { ...t, columns: t.columns.filter(c => c.field !== fieldKey) } : t));
    } else {
      const newCol = { id: Date.now() + Math.random(), header: defaultHeader.split('.').pop().replace(/([A-Z])/g, ' $1').toUpperCase(), field: fieldKey };
      setTemplates(templates.map(t => t.id === activeId ? { ...t, columns: [...t.columns, newCol] } : t));
    }
  };

  const handleMoveCol = (index, dir) => {
    if (dir === -1 && index === 0) return;
    if (dir === 1 && index === activeTemplate.columns.length - 1) return;
    const cols = [...activeTemplate.columns];
    const temp = cols[index];
    cols[index] = cols[index + dir];
    cols[index + dir] = temp;
    setTemplates(templates.map(t => t.id === activeId ? { ...t, columns: cols } : t));
  };


  const handleAddTemplate = () => {
    const newId = 'new_' + Date.now();
    setTemplates([...templates, { id: newId, name: 'New Template', client: '', columns: [] }]);
    setActiveId(newId);
  };

  const handleUpdateActive = (key, value) => {
    setTemplates(templates.map(t => t.id === activeId ? { ...t, [key]: value } : t));
  };

  const handleAddColumn = () => {
    const newCol = { id: Date.now() + Math.random(), header: 'Custom Editable Field', field: 'custom_' + Date.now() };
    setTemplates(templates.map(t => t.id === activeId ? { ...t, columns: [...t.columns, newCol] } : t));
  };

  const handleUpdateColumn = (colId, key, value) => {
    setTemplates(templates.map(t => {
      if (t.id === activeId) {
        return { ...t, columns: t.columns.map(c => c.id === colId ? { ...c, [key]: value } : c) };
      }
      return t;
    }));
  };

  const handleRemoveColumn = (colId) => {
    setTemplates(templates.map(t => {
      if (t.id === activeId) {
        return { ...t, columns: t.columns.filter(c => c.id !== colId) };
      }
      return t;
    }));
  };
  const handleAddColorRule = () => {
    setTemplates(templates.map(t => {
      if (t.id === activeId) {
        return { ...t, colorRules: [...(t.colorRules || []), { status: 'PENDING', color: '#fef08a' }] };
      }
      return t;
    }));
  };

  const handleUpdateColorRule = (idx, key, value) => {
    setTemplates(templates.map(t => {
      if (t.id === activeId) {
        const rules = [...(t.colorRules || [])];
        rules[idx] = { ...rules[idx], [key]: value };
        return { ...t, colorRules: rules };
      }
      return t;
    }));
  };

  const handleRemoveColorRule = (idx) => {
    setTemplates(templates.map(t => {
      if (t.id === activeId) {
        const rules = [...(t.colorRules || [])];
        rules.splice(idx, 1);
        return { ...t, colorRules: rules };
      }
      return t;
    }));
  };
  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return;
    if (!window.confirm(`Delete DSR template "${activeTemplate.name}"?`)) return;
    if (!String(activeTemplate.id).startsWith('new_')) {
      const res = await fetch('/api/dsr-templates/' + activeTemplate.id, { method: 'DELETE' });
      if (!res.ok) return toast.error('Not deleted (HTTP ' + res.status + ')');
    }
    const rest = templates.filter(t => t.id !== activeTemplate.id);
    setTemplates(rest); setActiveId(rest.length ? rest[0].id : null);
    toast.success('Template deleted');
  };

  return { activeId, activeTemplate, fetchTemplates, handleDeleteTemplate, handleAddColorRule, handleAddColumn, handleAddTemplate, handleMoveCol, handleRemoveColorRule, handleRemoveColumn, handleSaveTemplate, handleToggleField, handleUpdateActive, handleUpdateColorRule, handleUpdateColumn, isModalOpen, searchQuery, selectedFieldIds, setActiveId, setIsModalOpen, setSearchQuery, setTemplates, templates };
}
