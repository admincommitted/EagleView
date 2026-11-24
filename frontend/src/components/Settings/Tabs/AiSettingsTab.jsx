import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Save, Play, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const DEFAULT_IMPORT_PROMPT = `You are an expert Indian Customs Clearance AI. 
Extract data from the provided IMPORT Commercial Invoice or Packing List.
Return ONLY a valid JSON object matching this structure:
{
  "invoiceNo": "Invoice Number",
  "invoiceDate": "YYYY-MM-DD",
  "supplierName": "Name of the Supplier/Shipper",
  "currency": "3-letter Currency Code (e.g., USD, EUR, JPY)",
  "items": [
    {
      "desc": "Detailed Item Description",
      "ritc": "8-digit HSN/RITC Code if available",
      "qty": 100,
      "unit": "UOM (KGS, NOS, PCS)",
      "unitPrice": 50.00,
      "amount": 5000.00
    }
  ]
}
Rule: Do not include markdown blocks like \`\`\`json. Return raw JSON.`;

const DEFAULT_EXPORT_PROMPT = `You are an expert Indian Customs Clearance AI. 
Extract data from the provided EXPORT Commercial Invoice or Packing List.
Return ONLY a valid JSON object matching this structure:
{
  "invoiceNo": "Export Invoice Number",
  "invoiceDate": "YYYY-MM-DD",
  "buyerName": "Name of the Buyer/Consignee",
  "currency": "3-letter Currency Code (e.g., USD, EUR, INR)",
  "items": [
    {
      "desc": "Detailed Item Description",
      "ritc": "8-digit HSN/RITC Code if available",
      "qty": 100,
      "unit": "UOM (KGS, NOS, PCS)",
      "unitPrice": 50.00,
      "amount": 5000.00
    }
  ]
}
Rule: Do not include markdown blocks like \`\`\`json. Return raw JSON.`;

export default function AiSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  
  const [activeModule, setActiveModule] = useState('IMPORT');
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [settings, setSettings] = useState({
    GEMINI_API_KEY: '',
    AI_MODEL_IMPORT: 'gemini-3.8-flash',
    AI_PROMPT_IMPORT: DEFAULT_IMPORT_PROMPT,
    AI_MODEL_EXPORT: 'gemini-3.8-flash',
    AI_PROMPT_EXPORT: DEFAULT_EXPORT_PROMPT
  });

  // Gemini API model codes (ai.google.dev/models, Oct-2026). 1.5 / 2.0 / 3.0 codes were shut down by Google; any other
  // code can still be typed in the box. 28-Oct-2026
  const availableModels = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get('/api/settings');
      setSettings(prev => ({
        ...prev,
        GEMINI_API_KEY: data.GEMINI_API_KEY || prev.GEMINI_API_KEY,
        AI_MODEL_IMPORT: data.AI_MODEL_IMPORT || prev.AI_MODEL_IMPORT,
        AI_PROMPT_IMPORT: data.AI_PROMPT_IMPORT || prev.AI_PROMPT_IMPORT,
        AI_MODEL_EXPORT: data.AI_MODEL_EXPORT || prev.AI_MODEL_EXPORT,
        AI_PROMPT_EXPORT: data.AI_PROMPT_EXPORT || prev.AI_PROMPT_EXPORT,
      }));
    } catch (err) {
      console.error("Failed to fetch settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/settings/bulk', {
        settings: {
          GEMINI_API_KEY: settings.GEMINI_API_KEY,
          AI_MODEL_IMPORT: settings.AI_MODEL_IMPORT,
          AI_PROMPT_IMPORT: settings.AI_PROMPT_IMPORT,
          AI_MODEL_EXPORT: settings.AI_MODEL_EXPORT,
          AI_PROMPT_EXPORT: settings.AI_PROMPT_EXPORT,
        }
      });
      toast.success('AI Configuration saved');
    } catch (err) {
      console.error(err);
      toast.error('Not saved: ' + ((err.response && err.response.data && err.response.data.error) || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedFile) {
      toast.error("Select a PDF file to test");
      return;
    }
    setTesting(true);
    setTestResult('');
    
    const formData = new FormData();
    formData.append('pdf', selectedFile);
    formData.append('model', settings[`AI_MODEL_${activeModule}`]);
    formData.append('prompt', settings[`AI_PROMPT_${activeModule}`]);

    try {
      const res = await axios.post('/api/ai-extractor/test', formData);
      setTestResult(JSON.stringify(res.data.data, null, 2));
    } catch (err) {
      setTestResult("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading AI settings...</div>;

  const currentModelKey = `AI_MODEL_${activeModule}`;
  const currentPromptKey = `AI_PROMPT_${activeModule}`;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
        <Cpu size={24} color="#0369a1" />
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Module-Wise AI Configuration</h2>
      </div>

      
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#334155' }}>Global Gemini API Key</label>
          <input 
            type="password"
            value={settings.GEMINI_API_KEY}
            onChange={e => setSettings(p => ({ ...p, GEMINI_API_KEY: e.target.value }))}
            placeholder={settings.GEMINI_API_KEY === '***' ? '*** (Hidden for security)' : 'Enter your Google Gemini API Key...'}
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
          <small style={{ color: '#64748b', display: 'block', marginTop: '6px' }}>Leave as *** to keep the existing key. If empty, the system will fallback to the .env file.</small>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => { setActiveModule('IMPORT'); setTestResult(''); }}
          style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #cbd5e1', background: activeModule === 'IMPORT' ? '#0369a1' : '#fff', color: activeModule === 'IMPORT' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 600 }}
        >
          Customs Clearance - IMPORT
        </button>
        <button 
          onClick={() => { setActiveModule('EXPORT'); setTestResult(''); }}
          style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #cbd5e1', background: activeModule === 'EXPORT' ? '#0369a1' : '#fff', color: activeModule === 'EXPORT' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 600 }}
        >
          Customs Clearance - EXPORT
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#334155' }}>Select AI Model for {activeModule}</label>
          <input 
            type="text"
            list="geminiModelsList"
            value={settings[currentModelKey]}
            onChange={e => setSettings(p => ({ ...p, [currentModelKey]: e.target.value }))}
            placeholder="Select or type a custom model name..."
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
          <datalist id="geminiModelsList">
            {availableModels.map(m => <option key={m} value={m} />)}
          </datalist>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#334155' }}>System Prompt (Instructions)</label>
          <textarea 
            value={settings[currentPromptKey]}
            onChange={e => setSettings(p => ({ ...p, [currentPromptKey]: e.target.value }))}
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '200px', fontFamily: 'monospace', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#0f172a' }}>Test Configuration</h3>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input type="file" accept=".pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={e => setSelectedFile(e.target.files[0])} />
          <button onClick={() => fileInputRef.current.click()} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
            {selectedFile ? selectedFile.name : 'Choose PDF File'}
          </button>
          
          <button 
            onClick={handleTest}
            disabled={testing || !selectedFile}
            style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: (testing || !selectedFile) ? 'not-allowed' : 'pointer' }}
          >
            {testing ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
            Test Extraction
          </button>
        </div>

        {testResult && (
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#334155' }}>Test Result:</label>
            <pre style={{ background: '#1e293b', color: '#a5b4fc', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontSize: '13px' }}>
              {testResult}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
}
