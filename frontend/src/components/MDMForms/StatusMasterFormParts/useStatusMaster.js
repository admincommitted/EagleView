import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { askDelete } from '../switchRow';
import { mastersFormApi } from '../masterKit/masterRecordsApi';
import { EMPTY_STATUS, codesOf } from './statusOptions';

const STATUS_CODE = /^[A-Z0-9_]{2,40}$/;

const failureText = (error, fallback) => (error.response ? error.response.data?.message || fallback : error.message);

// The status list keyed by code: editingCode is the status picked from the list (null = a new status). A new status
// whose code already exists is refused by the server instead of overwriting that status.
export function useStatusMaster() {
  const [statuses, setStatuses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_STATUS);
  const [editingCode, setEditingCode] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mastersFormApi.listStatuses();
      setStatuses(data.data || []);
    } catch (loadError) {
      console.error(loadError);
      setError(failureText(loadError, 'Failed to fetch statuses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setField = (name) => (value) => setForm((current) => ({
    ...current,
    [name]: name === 'code' ? value.toUpperCase() : value,
    ...(name === 'module' && { macroBucket: 'DRAFT' }),
  }));

  const toggleLinkedCode = (listKey, code, checked) => setForm((current) => {
    const codes = codesOf(current[listKey]);
    const next = checked ? [...codes, code] : codes.filter((linked) => linked !== code);
    return { ...current, [listKey]: next.join(', ') };
  });

  const pick = (status) => {
    setForm({ ...EMPTY_STATUS, ...status, disables: status.disables || '', enables: status.enables || '' });
    setEditingCode(status.code);
  };

  const clearForm = () => {
    setForm(EMPTY_STATUS);
    setEditingCode(null);
  };

  const save = async () => {
    if (!form.code) return toast.error('Code is required');
    const code = form.code.trim().toUpperCase();
    if (!STATUS_CODE.test(code)) return toast.error('Code: 2-40 letters, digits or _ (e.g. EXAM_SCHEDULED)');
    const body = {
      code,
      mode: editingCode ? 'update' : 'create',
      description: form.description,
      macroBucket: form.macroBucket,
      colorCode: form.colorCode,
      textColor: form.textColor,
      module: form.module,
      sequence: form.sequence || 0,
      disables: form.disables || '',
      enables: form.enables || '',
      bubbleStyle: form.bubbleStyle || 'LEFT_BORDER',
    };
    setLoading(true);
    try {
      const saved = editingCode ? await mastersFormApi.updateStatus(editingCode, body) : await mastersFormApi.createStatus(body);
      await load();
      setEditingCode(saved?.data ? saved.data.code : code);
      toast.success('Saved successfully!');
    } catch (saveError) {
      console.error(saveError);
      toast.error(failureText(saveError, 'Failed to save status'));
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!form.code) return;
    if (!(await askDelete(`Are you sure you want to delete status ${form.code}?`))) return;
    setLoading(true);
    try {
      await mastersFormApi.deleteStatus(form.code);
      await load();
      clearForm();
      toast.success('Deleted successfully!');
    } catch (deleteError) {
      console.error(deleteError);
      toast.error(deleteError.response ? 'Failed to delete status' : deleteError.message);
    } finally {
      setLoading(false);
    }
  };

  const query = search.toLowerCase();
  const filtered = statuses.filter((status) => status.code?.toLowerCase().includes(query) || status.description?.toLowerCase().includes(query));

  return { statuses, filtered, form, editingCode, loading, error, search, setSearch, setField, toggleLinkedCode, pick, clearForm, save, remove, reload: load };
}
