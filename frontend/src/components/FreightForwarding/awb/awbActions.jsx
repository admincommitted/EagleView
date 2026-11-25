// Action bar buttons shared by the AWB, MAWB and HAWB screens: DUPLICATE copies the saved AWB under a new number and
// opens the copy, templates are kept on the server per screen (AWB / MAWB / HAWB) and show in the TEMPLATE list, and
// SEND XFWB / XFZB saves the screen first so the message carries what is on screen.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import askConfirm, { askText } from '@/components/common/askConfirm';
import { errorMessage } from '@/services/axiosInstance';
import {
  Button, DataTable, Modal, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui';
import { freightApi } from '../freightApi';
import { showSuccessToast, showValidationErrorsModal } from '../printLogic';
import { validateAwbForm, showEdiCheck } from './awbValidate';

// --- AWB number check (11 digits, 8th..10th serial digits mod 7 = last digit) ---
export function awbNoError(awbNumber) {
  const digits = String(awbNumber || '').replace(/\D/g, '');
  if (digits.length !== 11) return 'An AWB number has 11 digits (3 prefix + 8 serial), e.g. 176-12345675';
  const checkDigit = Number(digits.slice(3, 10)) % 7;
  if (checkDigit !== Number(digits[10])) return `Wrong check digit: ${digits.slice(0, 3)}-${digits.slice(3, 10)}${digits[10]} should end in ${checkDigit}`;
  return '';
}
export const fmtAwbNo = (awbNumber) => {
  const digits = String(awbNumber || '').replace(/\D/g, '');
  return digits.length === 11 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : String(awbNumber || '').trim();
};
const serverError = (error, fallback) => errorMessage(error) || fallback;
const masterNumberOf = (ctx) => (ctx.awbPrefix && ctx.awbSuffix ? `${ctx.awbPrefix}-${ctx.awbSuffix}` : '');

async function askCopyNumber(ctx, screenType) {
  if (screenType === 'HAWB') {
    const typed = await askText({ title: 'Duplicate HAWB', label: 'New HAWB number for the copy', required: false, upper: true });
    if (typed === null) return null;
    const hawbNumber = typed.trim().toUpperCase();
    if (!hawbNumber) { showValidationErrorsModal(['Give the new HAWB number for the copy.']); return null; }
    if (hawbNumber === String(ctx.hawbNumber || '').trim().toUpperCase()) { showValidationErrorsModal(['The copy needs a different HAWB number.']); return null; }
    return hawbNumber;
  }
  const typed = await askText({
    title: 'Duplicate AWB',
    label: 'New AWB number for the copy (e.g. 176-12345675)',
    note: 'Leave it blank to take the next free number after this AWB.',
    required: false,
  });
  if (typed === null) return null;
  if (!typed.trim()) return '';
  const problem = awbNoError(typed);
  if (problem) { showValidationErrorsModal([problem]); return null; }
  return fmtAwbNo(typed);
}

// --- DUPLICATE AWB ---
export async function duplicateAwb(ctx, type) {
  const { currentAwbId, handleModifyAWB } = ctx;
  if (!currentAwbId) { showValidationErrorsModal(['Save the AWB (or open it with MODIFY) before duplicating it.']); return; }
  const screenType = String(type).toUpperCase();
  const newNumber = await askCopyNumber(ctx, screenType);
  if (newNumber === null) return;
  const copy = { type: screenType };
  if (newNumber) copy.newAwbNumber = newNumber;
  const master = masterNumberOf(ctx);
  if (screenType === 'HAWB' && master) {
    copy.keepMaster = await askConfirm({
      title: 'Keep the copy on the master?',
      message: `Keep the copy on master ${master}?`,
      note: 'Keep on master: its weight is added to the master.\nCopy without master: the copy has no master.',
      okLabel: 'Keep on master',
      cancelLabel: 'Copy without master',
    });
  }
  try {
    const answer = await freightApi.duplicateAwb(currentAwbId, copy);
    const copyNumber = answer?.newAwbNumber;
    showSuccessToast('Success', `Copied as ${copyNumber}. The copy is open now.`);
    if (typeof handleModifyAWB === 'function' && copyNumber) await handleModifyAWB(copyNumber);
  } catch (error) {
    showValidationErrorsModal([`Duplicate failed: ${serverError(error, 'server error')}`]);
  }
}

async function confirmSend(ctx, kind, type) {
  const awbLabel = masterNumberOf(ctx) || 'this AWB';
  // EDI check first: errors stop the send, warnings ask
  const check = validateAwbForm(ctx, type);
  if (check.errors.length) { await showEdiCheck(check, { title: `${kind} NOT SENT - fix the errors first` }); return false; }
  if (check.warnings.length) return showEdiCheck(check, { title: `Save and send ${kind} for ${awbLabel}?`, goLabel: `SAVE & SEND ${kind}` });
  return askConfirm({ title: `Send ${kind}?`, message: `Save and send ${kind} for ${awbLabel} to the airline now?`, okLabel: `Save & send ${kind}` });
}

// --- SEND XFWB / XFZB: save the screen first, then send that saved copy ---
export async function sendAwbMessage(ctx, kind, button, type = 'AWB') {
  const messageKind = String(kind).toUpperCase();
  if (!(await confirmSend(ctx, messageKind, type))) return;
  const buttonLabel = button ? button.innerText : '';
  const showOnButton = (label) => { if (button) button.innerText = label; };
  if (button) button.disabled = true;
  showOnButton('SAVING...');
  try {
    const savedId = typeof ctx.handleSaveToSQL === 'function' ? await ctx.handleSaveToSQL() : ctx.currentAwbId;
    if (!savedId) return; // save stopped (its own message is shown)
    showOnButton('SENDING...');
    const answer = await freightApi.sendAwbMessage(savedId, kind);
    if (answer?.success) {
      showSuccessToast('Success', `${messageKind} sent. File: ${answer.fileName}`);
      if (messageKind === 'XFWB' && typeof ctx.setXfwbSent === 'function') ctx.setXfwbSent(true);
    } else {
      showValidationErrorsModal([`${messageKind} send failed: ${answer?.error || answer?.message || 'OK'}`]);
    }
  } catch (error) {
    if (error.response) {
      const answer = error.response.data || {};
      showValidationErrorsModal([`${messageKind} send failed: ${answer.error || answer.message || error.response.statusText}`]);
    } else {
      showValidationErrorsModal([`Network error: ${error.message}`]);
    }
  } finally {
    if (button) button.disabled = false;
    showOnButton(buttonLabel);
  }
}

// --- templates ---
// the reusable part of an AWB; never the AWB / HAWB number, pieces, weights, dimensions or flight dates
const TEMPLATE_KEYS = ['depAirport', 'destAirport', 'destAirportName', 'by1', 'by2', 'by3', 'to1', 'to2', 'to3',
  'agentDetails', 'agentCity', 'agentCountry', 'agentLocationCode', 'parties', 'shipperEmail', 'consigneeEmail',
  'currencyCode', 'chargeCode', 'wtValPC', 'otherPC', 'carriageValue', 'customsValue', 'insuranceValue', 'destinationCurrency',
  'natureOfGoods', 'sphCodes', 'ssrText', 'osiText', 'sci', 'ociRows', 'otherCharges', 'accountingInfo', 'productId',
  'executedPlace', 'densityGroup', 'mcUnit', 'signatureShipper', 'signatureCarrier'];
const setterOf = (key) => 'set' + key.charAt(0).toUpperCase() + key.slice(1);
const deepCopy = (value) => (value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value);

export function templateSnapshot(ctx) {
  const snapshot = {};
  for (const key of TEMPLATE_KEYS) {
    if (ctx[key] !== undefined && typeof ctx[setterOf(key)] === 'function') snapshot[key] = deepCopy(ctx[key]);
  }
  return snapshot;
}
export function applyTemplateData(ctx, data) {
  let appliedCount = 0;
  for (const key of TEMPLATE_KEYS) {
    if (!(data && key in data)) continue;
    const setValue = ctx[setterOf(key)];
    if (typeof setValue === 'function') { setValue(deepCopy(data[key])); appliedCount++; }
  }
  return appliedCount;
}

const TEMPLATES_CHANGED_EVENT = 'awb-templates-changed';
const USER_PREFIX = 'USER:';
const templateListOf = (answer) => (Array.isArray(answer?.data) ? answer.data : []);

export function useAwbTemplates(type) {
  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        const answer = await freightApi.awbTemplates(type);
        if (isCurrent) setTemplates(templateListOf(answer));
      } catch {
        // the list keeps what it had
      }
    };
    load();
    window.addEventListener(TEMPLATES_CHANGED_EVENT, load);
    return () => { isCurrent = false; window.removeEventListener(TEMPLATES_CHANGED_EVENT, load); };
  }, [type]);
  return templates;
}

const savedTemplateNames = async (type) => {
  try {
    return (await freightApi.awbTemplates(type))?.data || [];
  } catch {
    return [];
  }
};

export async function saveAsTemplate(ctx, type) {
  const selected = String(ctx.selectedTemplate || '');
  const firstGoodsLine = String(ctx.natureOfGoods || '').split('\n')[0].trim();
  const shipper = ctx.parties?.Shipper?.name || '';
  const suggestion = selected.startsWith(USER_PREFIX) ? selected.slice(USER_PREFIX.length) : [shipper, ctx.destAirport].filter(Boolean).join(' - ') || firstGoodsLine;
  const typed = await askText({ title: 'Save as template', label: 'Template name', value: String(suggestion).toUpperCase().slice(0, 60), required: false, upper: true });
  if (typed === null) return;
  const name = typed.trim().toUpperCase();
  if (!name) { showValidationErrorsModal(['Give the template a name.']); return; }
  const data = templateSnapshot(ctx);
  try {
    const existing = await savedTemplateNames(type);
    if (existing.some((template) => template.name === name)) {
      const replace = await askConfirm({ title: 'Replace template?', message: `Template "${name}" already exists. Replace it?`, okLabel: 'Replace', tone: 'danger' });
      if (!replace) return;
    }
    const answer = await freightApi.saveAwbTemplate(type, name, data);
    window.dispatchEvent(new Event(TEMPLATES_CHANGED_EVENT));
    const savedName = answer?.name || name;
    if (typeof ctx.setSelectedTemplate === 'function') ctx.setSelectedTemplate(USER_PREFIX + savedName);
    showSuccessToast('Success', `Template "${savedName}" saved.`);
  } catch (error) {
    showValidationErrorsModal([`Template not saved: ${serverError(error, 'server error')}`]);
  }
}

// A standard template only ADDS its handling codes to the free boxes (the screen writes the SSR / OSI lines of each
// code itself); the goods description is never touched. Dangerous goods has no single code (it depends on the class),
// so it adds the SSR line.
export const STANDARD_TEMPLATES = {
  'GENERAL CARGO': { sph: ['GEN'], ssr: '' },
  'PERISHABLE GOODS': { sph: ['PER', 'COL'], ssr: '' },
  'DANGEROUS GOODS': { sph: [], ssr: 'DANGEROUS GOODS AS PER ATTACHED SHIPPERS DECLARATION', note: 'Add the DG handling code of the class (RFL, RCL, RNG ...) and fill DOCUMENTS > DGD FORM.' },
  'PHARMACEUTICALS': { sph: ['PIL', 'CRT'], ssr: '' },
  'LIVE ANIMALS': { sph: ['AVI'], ssr: '', note: 'Fill DOCUMENTS > AVI CERT.' },
  'VALUABLE CARGO': { sph: ['VAL'], ssr: '' },
};
const SPH_BOXES = 9;

export function applyStandardTemplate(ctx, name) {
  const template = STANDARD_TEMPLATES[name];
  if (!template) return null;
  const codes = Array.isArray(ctx.sphCodes) ? ctx.sphCodes.map((code) => String(code || '').toUpperCase()) : [];
  while (codes.length < SPH_BOXES) codes.push('');
  const added = [];
  const noRoom = [];
  for (const code of template.sph) {
    if (codes.includes(code)) continue;
    const freeBox = codes.indexOf('');
    if (freeBox < 0) { noRoom.push(code); continue; }
    codes[freeBox] = code;
    added.push(code);
  }
  if (typeof ctx.setSphCodes === 'function') ctx.setSphCodes(codes);
  if (template.ssr && typeof ctx.setSsrText === 'function') {
    const ssr = String(ctx.ssrText || '');
    if (!ssr.toUpperCase().includes(template.ssr)) ctx.setSsrText(ssr.trim() ? `${ssr.replace(/\s+$/, '')}\n${template.ssr}` : template.ssr);
  }
  return { added, full: noRoom, note: template.note || '' };
}

const formHasData = (ctx) => !!(ctx.currentAwbId || ctx.parties?.Shipper?.name || ctx.depAirport || ctx.destAirport);

// TEMPLATE box of the screen header: standard templates + the saved templates, LOAD and delete
export function TemplatePicker({ ctx, type }) {
  const { selectedTemplate, setSelectedTemplate } = ctx;
  const templates = useAwbTemplates(type);
  const selected = String(selectedTemplate || 'SELECT');
  const userTemplateName = selected.startsWith(USER_PREFIX) ? selected.slice(USER_PREFIX.length) : '';

  const loadUserTemplate = async () => {
    const template = templates.find((candidate) => candidate.name === userTemplateName);
    if (!template) { showValidationErrorsModal([`Template "${userTemplateName}" is not on the server any more.`]); return; }
    if (formHasData(ctx)) {
      const goAhead = await askConfirm({
        title: 'Load template?',
        message: `Template "${userTemplateName}" replaces the routing, parties, agent, charges and handling on screen (not the AWB number, pieces or weights). Continue?`,
        okLabel: 'Load template',
      });
      if (!goAhead) return;
    }
    const appliedCount = applyTemplateData(ctx, template.data || {});
    showSuccessToast('Success', `Template "${userTemplateName}" loaded (${appliedCount} fields).`);
  };

  const loadStandardTemplate = () => {
    const result = applyStandardTemplate(ctx, selected);
    if (!result) { showValidationErrorsModal([`Unknown template "${selected}".`]); return; }
    const parts = [result.added.length ? `Handling codes added: ${result.added.join(', ')}.` : 'Handling codes already there.'];
    if (result.full.length) parts.push(`No free handling box for ${result.full.join(', ')}.`);
    if (result.note) parts.push(result.note);
    showSuccessToast(result.full.length ? 'Check' : 'Success', `${selected}: ${parts.join(' ')}`, !!result.full.length);
  };

  const loadTemplate = () => {
    if (selected === 'SELECT') { showValidationErrorsModal(['Pick a template first.']); return; }
    if (userTemplateName) loadUserTemplate();
    else loadStandardTemplate();
  };

  const removeTemplate = async () => {
    if (!userTemplateName) return;
    if (!(await askConfirm({ title: 'Delete template?', message: `Delete template "${userTemplateName}"?`, okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await freightApi.deleteAwbTemplate(type, userTemplateName);
      setSelectedTemplate('SELECT');
      window.dispatchEvent(new Event(TEMPLATES_CHANGED_EVENT));
      showSuccessToast('Success', `Template "${userTemplateName}" deleted.`);
    } catch (error) {
      showValidationErrorsModal([`Not deleted: ${serverError(error, 'server error')}`]);
    }
  };

  const selectedIsMissing = userTemplateName && !templates.some((template) => template.name === userTemplateName);
  return (
    <div className="tw:flex tw:w-full tw:min-w-0 tw:items-center tw:gap-1 tw:rounded-sm tw:border tw:border-input tw:bg-background tw:p-0.5 tw:pl-2 tw:sm:w-auto">
      <span className="tw:mr-1 tw:text-[11px] tw:font-bold tw:text-foreground">TEMPLATE</span>
      <Select value={selected} onValueChange={setSelectedTemplate}>
        <SelectTrigger className="tw:min-w-0 tw:flex-1 tw:border-0 tw:font-bold tw:sm:w-[170px] tw:sm:flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SELECT">SELECT</SelectItem>
          <SelectGroup>
            <SelectLabel>Standard</SelectLabel>
            {Object.keys(STANDARD_TEMPLATES).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectGroup>
          {templates.length > 0 && (
            <SelectGroup>
              <SelectLabel>Saved</SelectLabel>
              {templates.map((template) => <SelectItem key={template.name} value={USER_PREFIX + template.name}>{template.name}</SelectItem>)}
            </SelectGroup>
          )}
          {selectedIsMissing && <SelectItem value={selected}>{userTemplateName}</SelectItem>}
        </SelectContent>
      </Select>
      <Button variant="default" className="tw:font-bold" onClick={loadTemplate}>LOAD</Button>
      {userTemplateName && (
        <Button variant="destructive" size="icon" title="Delete this saved template" aria-label="Delete this saved template" onClick={removeTemplate}><X /></Button>
      )}
    </div>
  );
}

const LOG_COLUMNS = [
  { key: 'createdAt', header: 'Date', cell: (log) => new Date(log.createdAt).toLocaleString('en-IN') },
  { key: 'action', header: 'Action', className: 'tw:font-bold', cell: (log) => log.action },
  { key: 'user', header: 'User', cell: (log) => log.user },
  { key: 'details', header: 'Details', cell: (log) => log.details },
];

// AWB log window
export function AwbLogsModal({ open, logs, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="AWB Logs" width={600} bodyClassName="tw:max-h-[70vh]">
      <DataTable columns={LOG_COLUMNS} rows={logs || []} rowKey={(log, index) => log.id ?? index} emptyText="No logs found." className="tw:text-entry" />
    </Modal>
  );
}
