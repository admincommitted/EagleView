import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle, Clipboard, FileText, FolderOpen, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, FileButton, Modal, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { askConfirm } from './askConfirm';
import { sharedWidgetsApi } from './sharedWidgetsApi';

const TABS = [
  { value: 'json', label: '{ } JSON Paste' },
  { value: 'file', label: '📂 File Upload' },
  { value: 'flat', label: '📄 Flat File' },
];

const SAMPLE_BE = {
  importerName: 'TATA MOTORS LTD', iecCode: '0301234567', address1: '123 Main Road', city: 'Mumbai', state: 'Maharashtra', pin: '400001',
  igmNo: 'NSA0012345', blNo: 'MAEU1234567', countryOfOrigin: 'CN', portOfShipment: 'SGSIN',
  invoices: [{ invoiceNo: 'INV-001', invoiceDate: '2026-08-01', currency: 'USD', value: 50000 }],
  items: [{ hsnCode: '84073200', description: 'AUTO PARTS', quantity: 100, unit: 'NOS', assessableValue: 50000 }],
};
const SAMPLE_SB = {
  shipperName: 'TATA EXPORTS LTD', iecCode: '0300123456', address1: '456 Export Zone', city: 'Mumbai', shipmentMode: 'SEA',
  countryOfDestination: 'US', portOfDestination: 'USLAX', portOfLoading: 'INNSAV1', vesselOrFlightNo: 'MAERSK-001',
  invoices: [{ invoiceNo: 'EXP-001', invoiceDate: '2026-08-01', currency: 'USD', value: 25000 }],
  items: [{ hsnCode: '62041900', description: 'GARMENTS', quantity: 500, unit: 'PCS', fobValue: 25000 }],
};

const JSON_PLACEHOLDER = '{\n  "importerName": "...",\n  "iecCode": "...",\n  "invoices": [...],\n  "items": [...]\n}';
const CODE_BOX = 'tw:min-h-[300px] tw:flex-1 tw:resize-none tw:rounded-md tw:bg-page tw:p-2.5 tw:font-mono tw:text-[11px] tw:normal-case';

// XML -> the same JSON shape (repeated tags become lists; *Model, invoices and items tags are always lists)
function xmlToJsonText(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This is not a valid XML file');
  const convert = (element) => {
    const children = Array.from(element.children);
    if (!children.length) return (element.textContent || '').trim();
    const result = {};
    for (const child of children) {
      const name = child.localName || child.nodeName;
      const value = convert(child);
      if (result[name] !== undefined) {
        if (!Array.isArray(result[name])) result[name] = [result[name]];
        result[name].push(value);
      } else {
        result[name] = /Model$|^invoices$|^items$/i.test(name) ? [value] : value;
      }
    }
    return result;
  };
  return JSON.stringify(convert(doc.documentElement));
}

const isFlatFileName = (name) => name.endsWith('.be') || name.endsWith('.sb') || name.endsWith('.txt');

function DropZone({ accept, hint, loading, onFile }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <FileButton
      accept={accept}
      onFiles={(files) => onFile(files[0])}
      size="block"
      onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => { event.preventDefault(); setDragOver(false); onFile(event.dataTransfer.files[0]); }}
      className={cn(
        'tw:min-h-[250px] tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:rounded-lg tw:border-2 tw:border-dashed tw:p-10 tw:text-center',
        dragOver ? 'tw:border-primary tw:bg-primary/10' : 'tw:border-input tw:bg-page'
      )}
    >
      <Upload className={cn('tw:size-9', dragOver ? 'tw:text-primary' : 'tw:text-muted-foreground')} />
      <span className="tw:font-semibold tw:text-foreground">Drag a file here or click to browse</span>
      <span className="tw:text-[11px] tw:text-muted-foreground">{hint}</span>
      {loading && <span className="tw:text-entry tw:font-semibold tw:text-primary">Parsing...</span>}
    </FileButton>
  );
}

function ParseButton({ loading, disabled, label, onClick, className }) {
  return (
    <Button variant="default" size="lg" className={cn('tw:justify-center', className)} disabled={loading || disabled} onClick={onClick}>
      {loading ? 'Parsing...' : label}
    </Button>
  );
}

/**
 * Import BE / SB data from a JSON, XML or flat file.
 * type: 'be' | 'sb'; onImport(result) gets { directSavedJobId } when the server saved the job, else the server answer.
 * initialTab 'xml' / 'flat' (the job list's "Read XML" / "Read Flat File") opens the upload tab for that kind of file.
 */
export default function ImportFileModal({ type, onImport, onClose, initialTab }) {
  const fileKind = initialTab === 'xml' || initialTab === 'flat' ? initialTab : null;
  const [activeTab, setActiveTab] = useState(fileKind ? 'file' : (initialTab || 'json'));
  const [jsonText, setJsonText] = useState('');
  const [flatText, setFlatText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isBe = type === 'be';
  const acceptedFiles = fileKind === 'xml' ? '.xml,.json' : fileKind === 'flat' ? '.be,.sb,.txt' : '.json,.xml,.be,.sb,.txt';

  const sendToServer = (request) => (isBe ? sharedWidgetsApi.importBeFile(request) : sharedWidgetsApi.importSbFile(request));

  async function handleParse(text, format, duplicateOk) {
    if (!text?.trim()) { setError('Please paste a file or JSON first'); return; }
    setLoading(true);
    setError('');
    try {
      const answer = await sendToServer({ jsonText: text, format, ...(duplicateOk ? { _dupOk: true } : {}) });
      // the file repeats the invoice / HAWB of a job that is already there - ask before a second job is made
      if (!answer.success && answer.duplicate && isBe) {
        setLoading(false);
        const makeAnyway = await askConfirm({
          title: 'Shipment already on a job',
          message: answer.error || 'This shipment is already on another job.',
          note: 'Make a new draft job from this file anyway?',
          okLabel: 'Make new job',
          tone: 'warn',
        });
        if (makeAnyway) { await handleParse(text, format, true); return; }
        const jobNos = (answer.matches || []).map((match) => match.jobNo).filter(Boolean).join(', ');
        setError(`Not imported - this shipment is already on job ${jobNos || 'another job'}. Open that job from 1. Job Query.`);
        return;
      }
      if (answer.success) {
        toast.success(answer.message || `Successfully saved direct to DB! Job No: ${answer.data ? answer.data.jobNo : ''}`);
        onImport(answer.data?.id ? { directSavedJobId: answer.data.id } : answer);
        onClose();
      } else {
        setError(answer.error || 'Parse failed');
      }
    } catch (requestError) {
      setError(`Network error: ${errorMessage(requestError)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;
    setLoading(true);
    setError('');
    let text = await file.text();
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xml') || /^\s*<\?xml|^\s*<[A-Za-z]/.test(text)) {
      try {
        text = xmlToJsonText(text);
      } catch (xmlError) {
        setLoading(false);
        setError(xmlError.message);
        return;
      }
    }
    const format = isFlatFileName(fileName) && !text.trim().startsWith('{') ? 'flat' : 'json';
    if (format === 'flat') setFlatText(text); else setJsonText(text);
    handleParse(text, format);
  }

  const pasteFromClipboard = async () => {
    try {
      setJsonText(await navigator.clipboard.readText());
    } catch {
      toast.error('The browser did not allow reading the clipboard');
    }
  };

  const editText = (setText) => (event) => { setText(event.target.value); setError(''); };

  const fileHint = fileKind === 'xml' ? 'BE in XML (CACHI01 tags) - sample: Job Query > Download Sample > BE XML'
    : fileKind === 'flat' ? 'ICEGATE ICES 1.5 BE flat file (.be) - sample: Job Query > Download Sample > BE Flat File'
      : 'Supported: .json, .xml, .be, .sb, .txt (max 5MB)';

  const title = (
    <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      <FolderOpen className="tw:size-[18px] tw:text-primary" />
      <span className="tw:text-sm tw:font-bold">Import {isBe ? 'BE' : 'SB'} Data from ERP File</span>
      <Badge variant="info">{fileKind === 'xml' ? 'XML' : fileKind === 'flat' ? 'Flat File (.be)' : 'JSON / XML / Flat File'}</Badge>
    </span>
  );

  return (
    <Modal open onClose={onClose} title={title} width={1100} closeOnOutside={false} bodyClassName="tw:gap-0 tw:p-0 tw:lg:flex-row tw:lg:overflow-hidden">
      <div className="tw:flex tw:w-full tw:flex-col tw:border-b tw:border-border tw:lg:w-[350px] tw:lg:border-r tw:lg:border-b-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="tw:min-h-0 tw:flex-1">
          <TabsList variant="line" className="tw:w-full tw:justify-start tw:border-b tw:border-border tw:bg-page">
            {TABS.map((tab) => <TabsTrigger key={tab.value} value={tab.value} className="tw:text-[11px]">{tab.label}</TabsTrigger>)}
          </TabsList>

          <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-y-auto tw:p-3.5">
            <TabsContent value="json" className="tw:flex tw:flex-col tw:gap-2.5">
              <div className="tw:flex tw:items-center tw:justify-between">
                <span className="tw:text-[11px] tw:font-semibold tw:text-muted-foreground">Paste JSON (from any ERP)</span>
                <Button size="sm" onClick={() => setJsonText(JSON.stringify(isBe ? SAMPLE_BE : SAMPLE_SB, null, 2))}>Sample Load</Button>
              </div>
              <Textarea value={jsonText} onChange={editText(setJsonText)} placeholder={JSON_PLACEHOLDER} className={CODE_BOX} data-allow-text="" />
              <div className="tw:flex tw:gap-2">
                <ParseButton loading={loading} disabled={!jsonText.trim()} label="🔍 Parse JSON" onClick={() => handleParse(jsonText, 'json')} className="tw:flex-1" />
                <Button size="lg" title="Paste from the clipboard" onClick={pasteFromClipboard}><Clipboard /></Button>
              </div>
            </TabsContent>

            <TabsContent value="file">
              <DropZone accept={acceptedFiles} hint={fileHint} loading={loading} onFile={handleFileUpload} />
            </TabsContent>

            <TabsContent value="flat" className="tw:flex tw:flex-col tw:gap-2.5">
              <span className="tw:text-[11px] tw:font-semibold tw:text-muted-foreground">
                Paste an ICEGATE ICES 1.5 flat file (.be): fields separated by the GS character (ASCII 29), sections &lt;TABLE&gt;BE / INVOICE / ITEMS
              </span>
              <div className="tw:rounded-md tw:border tw:border-success/40 tw:bg-success/10 tw:p-2 tw:font-mono tw:text-[10px] tw:text-success tw:normal-case">
                Layout (␝ = GS):<br />
                HREC␝ZZ␝&lt;sender&gt;␝ZZ␝INDEL4␝ICES1_5␝P␝␝CACHI01␝&lt;seq&gt;␝&lt;yyyymmdd&gt;<br />
                &lt;TABLE&gt;BE<br />
                F␝␝&lt;job no&gt;␝&lt;job date&gt;␝␝␝H␝&lt;IEC&gt;␝&lt;branch&gt;␝&lt;importer&gt;␝...<br />
                &lt;TABLE&gt;INVOICE ... &lt;TABLE&gt;ITEMS ...<br />
                TREC␝&lt;seq&gt;<br />
                Easiest: upload the .be file in File Upload (sample: Job Query &gt; Download Sample &gt; BE Flat File).
              </div>
              <Textarea value={flatText} onChange={editText(setFlatText)} placeholder="Paste the flat file content here..." className={cn(CODE_BOX, 'tw:min-h-[200px]')} data-allow-text="" />
              <ParseButton loading={loading} disabled={!flatText.trim()} label="🔍 Parse Flat File" onClick={() => handleParse(flatText, 'flat')} />
            </TabsContent>

            {error && (
              <div className="tw:mt-2.5 tw:flex tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-destructive tw:bg-destructive/10 tw:p-2.5 tw:text-[11px] tw:text-destructive">
                <AlertCircle className="tw:size-3.5 tw:shrink-0" /> {error}
              </div>
            )}
          </div>
        </Tabs>
      </div>

      <div className="tw:flex tw:min-h-[200px] tw:flex-1 tw:flex-col tw:bg-page">
        <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-border tw:px-4 tw:py-3 tw:font-bold tw:text-foreground">
          <FileText className="tw:size-3.5 tw:text-primary" /> Parsed Fields Preview
        </div>
        <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:p-5 tw:text-center tw:text-muted-foreground">
          Parse JSON or upload a file - fields will appear here
        </div>
        <div className="tw:border-t tw:border-border tw:px-4 tw:py-3">
          <Button variant="success" size="lg" className="tw:w-full tw:justify-center" disabled>
            <CheckCircle /> Apply to Form
          </Button>
        </div>
      </div>
    </Modal>
  );
}
