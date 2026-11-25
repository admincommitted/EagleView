import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Cpu, Loader, Play, Save } from 'lucide-react';
import { Button, FileButton, Label } from '@/components/ui';
import { settingsApi } from '../settingsApi';
import { SettingsCard, SettingsHeading } from './SettingsParts/SettingsCard';
import { SettingsFields } from './SettingsParts/SettingsFields';

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

const DEFAULT_SETTINGS = {
  GEMINI_API_KEY: '',
  AI_MODEL_IMPORT: 'gemini-3.8-flash',
  AI_PROMPT_IMPORT: DEFAULT_IMPORT_PROMPT,
  AI_MODEL_EXPORT: 'gemini-3.8-flash',
  AI_PROMPT_EXPORT: DEFAULT_EXPORT_PROMPT,
};
const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

// Gemini API model codes (ai.google.dev/models); any other code can still be typed in the box.
const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const MODULES = [
  { id: 'IMPORT', label: 'Customs Clearance - IMPORT' },
  { id: 'EXPORT', label: 'Customs Clearance - EXPORT' },
];

const KEY_FIELDS = [
  {
    name: 'GEMINI_API_KEY', label: 'Global Gemini API Key', kind: 'password', controlClassName: 'tw:normal-case',
    placeholder: ({ GEMINI_API_KEY }) => (GEMINI_API_KEY === '***' ? '*** (Hidden for security)' : 'Enter your Google Gemini API Key...'),
    note: 'Leave as *** to keep the existing key. If empty, the system will fallback to the .env file.',
  },
];

const moduleFields = (module) => [
  {
    name: `AI_MODEL_${module}`, label: `Select AI Model for ${module}`, kind: 'combo', options: GEMINI_MODELS,
    placeholder: 'Select or type a custom model name...', controlClassName: 'tw:normal-case',
  },
  {
    name: `AI_PROMPT_${module}`, label: 'System Prompt (Instructions)', kind: 'textarea',
    controlClassName: 'tw:h-[200px] tw:font-mono tw:text-[13px] tw:normal-case',
  },
];

export default function AiSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [activeModule, setActiveModule] = useState('IMPORT');
  const [selectedFile, setSelectedFile] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await settingsApi.settings();
        setSettings((current) => Object.fromEntries(SETTING_KEYS.map((key) => [key, saved[key] || current[key]])));
      } catch (error) {
        console.error('Failed to fetch settings', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const changeSetting = (name, value) => setSettings((current) => ({ ...current, [name]: value }));

  const pickModule = (module) => {
    setActiveModule(module);
    setTestResult('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.saveSettings(Object.fromEntries(SETTING_KEYS.map((key) => [key, settings[key]])));
      toast.success('AI Configuration saved');
    } catch (error) {
      console.error(error);
      toast.error(`Not saved: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const testExtraction = async () => {
    if (!selectedFile) {
      toast.error('Select a PDF file to test');
      return;
    }
    setTesting(true);
    setTestResult('');
    const formData = new FormData();
    formData.append('pdf', selectedFile);
    formData.append('model', settings[`AI_MODEL_${activeModule}`]);
    formData.append('prompt', settings[`AI_PROMPT_${activeModule}`]);
    try {
      const result = await settingsApi.testAiExtraction(formData);
      setTestResult(JSON.stringify(result.data, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="tw:p-8">Loading AI settings...</div>;

  return (
    <div className="tw:flex tw:max-w-[800px] tw:flex-col tw:gap-6 tw:p-4 tw:md:p-8">
      <SettingsHeading icon={Cpu} title="Module-Wise AI Configuration" />

      <SettingsCard bodyClassName="tw:pt-3">
        <SettingsFields fields={KEY_FIELDS} values={settings} onChange={changeSetting} />
      </SettingsCard>

      <div className="tw:flex tw:flex-wrap tw:gap-4">
        {MODULES.map((module) => (
          <Button key={module.id} size="lg" variant={activeModule === module.id ? 'default' : 'outline'} onClick={() => pickModule(module.id)}>
            {module.label}
          </Button>
        ))}
      </div>

      <SettingsCard bodyClassName="tw:pt-3"
        footer={(
          <Button variant="default" size="lg" onClick={save} disabled={saving}>
            {saving ? <Loader className="tw:animate-spin" /> : <Save />}{saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        )}>
        <SettingsFields fields={moduleFields(activeModule)} values={settings} onChange={changeSetting} className="tw:gap-6" />
      </SettingsCard>

      <SettingsCard title="Test Configuration" className="tw:border-dashed tw:bg-page">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-4">
          <FileButton accept=".pdf" size="lg" onFiles={(files) => setSelectedFile(files[0])}>
            {selectedFile ? selectedFile.name : 'Choose PDF File'}
          </FileButton>
          <Button variant="default" size="lg" onClick={testExtraction} disabled={testing || !selectedFile}>
            {testing ? <Loader className="tw:animate-spin" /> : <Play />} Test Extraction
          </Button>
        </div>
        {testResult && (
          <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-2">
            <Label className="tw:font-semibold">Test Result:</Label>
            <pre className="tw:overflow-x-auto tw:rounded-md tw:bg-slate-800 tw:p-4 tw:text-[13px] tw:text-indigo-300 tw:normal-case">{testResult}</pre>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
