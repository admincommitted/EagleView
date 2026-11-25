import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/services/axiosInstance';
import { settingsApi } from '../../settingsApi';
import { DEFAULT_API_SETTINGS, DEFAULT_TEMPLATE, STARTING_STATUSES } from './whatsappOptions';

const TOAST_MS = 4500;
const MODULE_MESSAGE_MS = 4000;
const QUEUE_REFRESH_MS = 30000;
const STATE_POLL_MS = 4000;
const MASKED = '***';
const DISCONNECTED = { status: 'disconnected', qr: null, number: null };
const STATUSES_WITHOUT_QR = ['connected', 'disconnected', 'starting'];

const failText = (error, fallback = 'Failed') => error?.response?.data?.error || fallback;

const showToast = (message, type = 'success') => {
  if (type === 'error') toast.error(message, { duration: TOAST_MS });
  else toast.success(message, { duration: TOAST_MS });
};

const ignoreFailure = async (request) => {
  try {
    await request();
  } catch {
    // the screen keeps what it already shows
  }
};

const parseEvent = (event) => {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
};

const apiSettingsFrom = (saved) => ({
  ...Object.fromEntries(Object.keys(DEFAULT_API_SETTINGS).map((key) => [key, saved[key] || DEFAULT_API_SETTINGS[key]])),
  whatsapp_api_key: (saved.whatsapp_api_key === MASKED ? '' : saved.whatsapp_api_key) || '',
});

export default function useWhatsappSettingsTab() {
  const [qrState, setQrState] = useState(DISCONNECTED);
  const [connecting, setConnecting] = useState(false);
  const eventSourceRef = useRef(null);

  const [apiSettings, setApiSettings] = useState(DEFAULT_API_SETTINGS);
  const [savingApi, setSavingApi] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestNumber, setApiTestNumber] = useState('');

  const [notifyMode, setNotifyMode] = useState('instant');
  const [notifyTime, setNotifyTime] = useState('09:00');
  const [savingNotify, setSavingNotify] = useState(false);
  const [queueStats, setQueueStats] = useState({ pending: 0, sentToday: 0 });
  const [flushing, setFlushing] = useState(false);

  const [activeMode, setActiveMode] = useState('qr');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testingQr, setTestingQr] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const [moduleNumbers, setModuleNumbers] = useState([]);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModulePhone, setNewModulePhone] = useState('');
  const [moduleMessage, setModuleMessage] = useState('');

  const handleEvent = (event) => {
    const update = parseEvent(event);
    if (!update) return;
    if (update.type === 'qr') {
      setQrState((prev) => ({ ...prev, qr: update.qr, status: 'qr_ready' }));
      setConnecting(false);
    } else if (update.type === 'status' || update.type === 'state') {
      setQrState((prev) => ({
        ...prev,
        status: update.status,
        number: update.number || prev.number,
        error: update.error !== undefined ? update.error : prev.error,
        qr: STATUSES_WITHOUT_QR.includes(update.status) ? null : (update.qr || prev.qr),
      }));
      if (update.status === 'connected') showToast('WhatsApp connected! ✅');
      if (update.status === 'disconnected' && update.type === 'status') showToast(update.error || 'WhatsApp disconnected.', 'error');
      if (['connected', 'disconnected', 'qr_ready'].includes(update.status)) setConnecting(false);
    }
  };

  const subscribeToEvents = () => {
    eventSourceRef.current?.close();
    const events = new EventSource(`${API_BASE_URL}/whatsapp/events`);
    eventSourceRef.current = events;
    events.onmessage = handleEvent;
  };

  const loadQueueStats = () => ignoreFailure(async () => setQueueStats(await settingsApi.whatsappQueueStats()));
  const loadModuleNumbers = async () => setModuleNumbers(await settingsApi.whatsappModuleNumbers());

  useEffect(() => {
    ignoreFailure(async () => setQrState(await settingsApi.whatsappState()));
    ignoreFailure(loadModuleNumbers);
    ignoreFailure(async () => {
      const saved = await settingsApi.settings();
      setApiSettings((prev) => ({ ...prev, ...apiSettingsFrom(saved) }));
      if (saved.whatsapp_status_template) setTemplate(saved.whatsapp_status_template);
      if (saved.whatsapp_mode) setActiveMode(saved.whatsapp_mode);
      if (saved.whatsapp_notify_mode) setNotifyMode(saved.whatsapp_notify_mode);
      if (saved.whatsapp_notify_time) setNotifyTime(saved.whatsapp_notify_time);
    });
    subscribeToEvents();
    loadQueueStats();
    const queueTimer = setInterval(loadQueueStats, QUEUE_REFRESH_MS);
    return () => {
      eventSourceRef.current?.close();
      clearInterval(queueTimer);
    };
  }, []);

  // the live updates (EventSource) can be cut by the dev proxy, so the state is also asked for while a start is going on
  useEffect(() => {
    if (!STARTING_STATUSES.includes(qrState.status)) return undefined;
    const pollTimer = setInterval(() => ignoreFailure(async () => {
      const state = await settingsApi.whatsappState();
      setQrState((prev) => ({ ...prev, ...state }));
      if (state.status !== 'starting') setConnecting(false);
    }), STATE_POLL_MS);
    return () => clearInterval(pollTimer);
  }, [qrState.status]);

  const handleConnect = async () => {
    setConnecting(true);
    setQrState((prev) => ({ ...prev, status: 'starting', error: null, qr: null }));
    try {
      subscribeToEvents();
      await settingsApi.whatsappConnect();
    } catch (error) {
      showToast(failText(error), 'error');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await settingsApi.whatsappDisconnect();
      setQrState(DISCONNECTED);
    } catch (error) {
      showToast(failText(error), 'error');
    }
  };

  const handleQrTest = async () => {
    if (!testNumber) { showToast('Enter a number', 'error'); return; }
    setTestingQr(true);
    try {
      await settingsApi.whatsappTest(testNumber, testMessage || undefined);
      showToast('Sent! ✅');
    } catch (error) {
      showToast(failText(error), 'error');
    } finally {
      setTestingQr(false);
    }
  };

  const setApi = (key) => (value) => setApiSettings((prev) => ({ ...prev, [key]: value }));

  const handleSaveApi = async () => {
    setSavingApi(true);
    try {
      const settings = { ...apiSettings, whatsapp_mode: 'api' };
      if (!settings.whatsapp_api_key) delete settings.whatsapp_api_key;
      await settingsApi.saveSettings(settings);
      showToast('API settings saved! ✅');
    } catch (error) {
      showToast(failText(error), 'error');
    } finally {
      setSavingApi(false);
    }
  };

  const handleApiTest = async () => {
    if (!apiTestNumber) { showToast('Enter a number', 'error'); return; }
    setTestingApi(true);
    try {
      await settingsApi.whatsappApiTest(apiTestNumber);
      showToast('Test sent via API! ✅');
    } catch (error) {
      showToast(failText(error), 'error');
    } finally {
      setTestingApi(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      await settingsApi.saveSettings({ whatsapp_status_template: template });
      showToast('Template saved!');
    } catch (error) {
      showToast(failText(error), 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleModeSwitch = (mode) => {
    setActiveMode(mode);
    ignoreFailure(() => settingsApi.saveSettings({ whatsapp_mode: mode }));
  };

  const handleSaveNotify = async () => {
    setSavingNotify(true);
    try {
      await settingsApi.saveSettings({ whatsapp_notify_mode: notifyMode, whatsapp_notify_time: notifyTime });
      await settingsApi.whatsappRestartScheduler();
      showToast('Notification schedule saved! ✅');
    } catch (error) {
      showToast(failText(error, 'Failed to save'), 'error');
    } finally {
      setSavingNotify(false);
    }
  };

  const flashModuleMessage = (text) => {
    setModuleMessage(text);
    setTimeout(() => setModuleMessage(''), MODULE_MESSAGE_MS);
  };

  const handleAddModuleNumber = async () => {
    if (!newModuleName || !newModulePhone) { showToast('Name and Number required', 'error'); return; }
    try {
      await settingsApi.addWhatsappModuleNumber(newModuleName, newModulePhone);
      showToast('Saved module number');
      flashModuleMessage('✅ Number added and saved successfully!');
      await loadModuleNumbers();
      setNewModuleName('');
      setNewModulePhone('');
    } catch (error) {
      showToast(failText(error, 'Failed to save'), 'error');
    }
  };

  const handleDeleteModuleNumber = async (moduleName) => {
    try {
      await settingsApi.deleteWhatsappModuleNumber(moduleName);
      showToast('Deleted');
      flashModuleMessage('🗑️ Number deleted successfully!');
      await loadModuleNumbers();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const apiPart = activeMode === 'api' ? {
        whatsapp_provider: apiSettings.whatsapp_provider,
        whatsapp_sender_id: apiSettings.whatsapp_sender_id,
        whatsapp_from_number: apiSettings.whatsapp_from_number,
        whatsapp_enabled: apiSettings.whatsapp_enabled,
        whatsapp_template_name: apiSettings.whatsapp_template_name,
        whatsapp_template_lang: apiSettings.whatsapp_template_lang,
        whatsapp_template_namespace: apiSettings.whatsapp_template_namespace,
        whatsapp_api_version: apiSettings.whatsapp_api_version,
        ...(apiSettings.whatsapp_api_key && { whatsapp_api_key: apiSettings.whatsapp_api_key }),
      } : {};
      await settingsApi.saveSettings({
        whatsapp_mode: activeMode,
        whatsapp_notify_mode: notifyMode,
        whatsapp_notify_time: notifyTime,
        whatsapp_status_template: template,
        ...apiPart,
      });
      await settingsApi.whatsappRestartScheduler();
      showToast('All WhatsApp settings saved! ✅');
    } catch (error) {
      showToast(failText(error, 'Failed to save'), 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const handleFlushNow = async () => {
    setFlushing(true);
    try {
      const result = await settingsApi.whatsappFlushQueue();
      if (result.failed) showToast('Sent to ' + (result.sent || 0) + ' parties, ' + result.failed + ' failed: ' + ((result.errors || [])[0] || ''), 'error');
      else showToast('Sent ' + (result.sent || 0) + ' parties, ' + (result.total || 0) + ' notifications. ✅');
      loadQueueStats();
    } catch (error) {
      showToast(failText(error), 'error');
    } finally {
      setFlushing(false);
    }
  };

  return {
    activeMode, apiSettings, apiTestNumber, connecting, flushing, handleAddModuleNumber, handleApiTest, handleConnect,
    handleDeleteModuleNumber, handleDisconnect, handleFlushNow, handleModeSwitch, handleQrTest, handleSaveAll, handleSaveApi,
    handleSaveNotify, handleSaveTemplate, moduleMessage, moduleNumbers, newModuleName, newModulePhone, notifyMode, notifyTime,
    qrState, queueStats, savingAll, savingApi, savingNotify, savingTemplate, setApi, setApiTestNumber, setNewModuleName,
    setNewModulePhone, setNotifyMode, setNotifyTime, setTemplate, setTestMessage, setTestNumber, template, testMessage,
    testNumber, testingApi, testingQr,
  };
}
