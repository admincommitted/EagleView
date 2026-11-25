import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import askConfirm from '@/components/common/askConfirm';
import { useTimedNotice } from './useTimedNotice';

const SAVED_NOTICE_MS = 3000;

/**
 * The list + add / edit form of a small settings master (branches, CHA, financial years).
 *   api            - { list, create, update, remove } (module-level constant)
 *   emptyRecord    - the blank form (module-level constant)
 *   requiredFields - keys that must be filled before a save
 *   savedMessage   - the green line shown for 3 seconds after a save
 *   deleteQuestion - asked before a delete
 *   onChanged      - called when the tab opens and after every save / delete (module-level function)
 */
export function useSettingsRecords({ api, emptyRecord, requiredFields, savedMessage, deleteQuestion, onChanged }) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyRecord);
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [notice, showNotice] = useTimedNotice(SAVED_NOTICE_MS);

  const load = useCallback(async () => {
    try {
      const result = await api.list();
      if (result.success) setRecords(result.data);
    } catch (error) {
      console.error(error);
    }
  }, [api]);

  useEffect(() => {
    load();
    onChanged?.();
  }, [load, onChanged]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setForm(emptyRecord);
  };

  const startEdit = (record) => {
    setForm({ ...record });
    setEditingId(record.id);
    setIsAdding(true);
  };

  const cancel = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const save = async () => {
    if (requiredFields.some((name) => !form[name])) {
      toast.error('Fill all the required fields (*)');
      return;
    }
    try {
      if (editingId) await api.update(editingId, form);
      else await api.create(form);
      load();
      onChanged?.();
      setIsAdding(false);
      showNotice(savedMessage);
      setEditingId(null);
      setForm(emptyRecord);
    } catch (error) {
      toast.error(`Not saved: ${errorMessage(error)}`);
    }
  };

  const remove = async (id) => {
    if (!(await askConfirm({ title: deleteQuestion, okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await api.remove(id);
      load();
      onChanged?.();
    } catch (error) {
      toast.error(`Not deleted: ${errorMessage(error)}`);
    }
  };

  return { records, form, setForm, setField, editingId, isAdding, notice, startAdd, startEdit, cancel, save, remove };
}
