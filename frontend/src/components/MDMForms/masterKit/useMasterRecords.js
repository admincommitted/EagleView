import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import switchRow from '../switchRow';
import { masterRecordsApi } from './masterRecordsApi';

const textOf = (value) => String(value ?? '').toLowerCase();
const asList = (data) => (Array.isArray(data) ? data : []);
const keepAsItIs = (value) => value;

/**
 * State and calls of a plain master screen (list on the left, form on the right).
 *   resource       - the /masters/<resource> path (list, save, switch)
 *   emptyRecord    - the blank form
 *   listParams     - query for the list (e.g. { all: 1 } to also get switched-off rows)
 *   searchFields   - record keys the search box looks in
 *   validate       - (form) => '' or the message that stops the save
 *   describe       - (record) => text shown when switching the row off
 *   prepareSave    - (form) => the body sent on save (default: the form)
 *   loadRecords    - async () => rows, when the list does not come from /masters/<resource>
 *   toFormRecord   - (record) => the form values for a picked record (e.g. parse a JSON column)
 *   recordKey      - the record's key (default 'id')
 *   keepAfterSave  - leave the saved record on the form instead of clearing it
 *   savedMessage   - toast shown after a save ('' = none)
 * Pass emptyRecord / listParams / searchFields as module-level constants: they are effect and memo dependencies.
 */
export function useMasterRecords({
  resource, emptyRecord, listParams, searchFields, validate = () => '', describe = () => '', prepareSave = keepAsItIs,
  loadRecords, toFormRecord = keepAsItIs, recordKey = 'id', keepAfterSave = false, savedMessage = '',
}) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyRecord);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRecords(asList(loadRecords ? await loadRecords() : await masterRecordsApi.list(resource, listParams)));
    } catch (error) {
      console.error(error);
    }
  }, [resource, listParams, loadRecords]);

  useEffect(() => { load(); }, [load]);

  const keyOf = (record) => record?.[recordKey];
  const clearForm = () => setForm(emptyRecord);
  const editRecord = (record) => setForm({ ...emptyRecord, ...toFormRecord(record) });
  const setField = (name) => (value) => setForm((current) => ({ ...current, [name]: value }));

  const save = async () => {
    const problem = validate(form);
    if (problem) {
      toast.error(problem);
      return false;
    }
    setSaving(true);
    try {
      const body = prepareSave(form);
      const saved = keyOf(form)
        ? await masterRecordsApi.update(resource, keyOf(form), body)
        : await masterRecordsApi.create(resource, body);
      if (savedMessage) toast.success(savedMessage);
      if (keepAfterSave) setForm((current) => ({ ...current, ...toFormRecord(saved?.data ?? saved ?? {}) }));
      else clearForm();
      await load();
      return true;
    } catch (error) {
      toast.error(`Not saved: ${errorMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const switchActive = async (record) => {
    const changed = await switchRow(resource, { ...record, id: keyOf(record) }, describe(record));
    if (!changed) return;
    if (String(keyOf(form)) === String(keyOf(record))) clearForm();
    load();
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => searchFields.some((key) => textOf(record[key]).includes(query)));
  }, [records, search, searchFields]);

  return {
    records, filtered, form, setForm, setField, editRecord, clearForm, save, saving, switchActive, search, setSearch, reload: load,
    recordKey, selectedKey: keyOf(form),
  };
}
