import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '../switchRow';
import { masterRecordsApi } from '../masterKit/masterRecordsApi';

export const EMPTY_AIRLINE = { name: '', code3: '', code2: '', prefix: '', status: 'ACTIVE', customLogo: '' };
const LIST_PARAMS = { all: 1 };
const MAX_LOGO_BYTES = 500 * 1024;
const EMPTY_INSURANCE_RULE = { dateFrom: '', dateTo: '', percent: '' };

const upper = (value) => String(value || '').trim().toUpperCase();

// otherData (incentive / commission payable, insurance rules) is stored as a JSON string
const withOtherData = (airline) => {
  if (typeof airline.otherData !== 'string') return { ...airline, otherData: airline.otherData || {} };
  try {
    return { ...airline, otherData: JSON.parse(airline.otherData) || {} };
  } catch {
    return { ...airline, otherData: {} };
  }
};

const problemOf = (airline, airlines) => {
  if (!airline.name || !airline.code3 || !airline.code2 || !airline.prefix) return 'Error: Please fill in Airline Name, 3 Letter Code, 2 Letter Code, and 3-Digit Prefix!';
  if (!/^[A-Z]{3}$/.test(airline.code3)) return 'Error: 3 Letter Code must be 3 letters (e.g. UAE)';
  if (!/^[A-Z0-9]{2}$/.test(airline.code2)) return 'Error: 2 Letter Code must be 2 letters / digits (e.g. EK, 6E)';
  if (!/^\d{3}$/.test(airline.prefix)) return 'Error: AWB Prefix must be 3 digits (e.g. 176)';
  if (airline.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(airline.pan)) return 'Error: PAN must be like ABCDE1234F';
  if (airline.trackingUrl && !/^https?:\/\/\S+$/i.test(airline.trackingUrl)) return 'Error: Tracking link must start with http:// or https://';
  const clash = airlines.find((other) => other.id !== airline.id && (upper(other.code2) === airline.code2 || String(other.prefix || '') === airline.prefix || upper(other.code3) === airline.code3));
  if (clash) return `Duplicate: ${clash.name} already uses code ${clash.code2} / ${clash.code3} / prefix ${clash.prefix}`;
  return '';
};

const searchMatches = (airline, term) => Object.values(airline).some((value) => value && String(value).toLowerCase().includes(term));

// An airline is switched off / on (status INACTIVE / ACTIVE), not deleted. AWB screens list only airlines that are not INACTIVE.
export function useAirlineMaster() {
  const [airlines, setAirlines] = useState([]);
  const [form, setForm] = useState(EMPTY_AIRLINE);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await masterRecordsApi.list('airlines', LIST_PARAMS);
      const loaded = (Array.isArray(data) ? data : []).map(withOtherData);
      setAirlines(loaded);
      // keep the airline being edited; with nothing on the form the first airline is shown
      setForm((current) => {
        if (current.id) return loaded.find((airline) => airline.id === current.id) || current;
        return current.name || !loaded.length ? current : loaded[0];
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { load(); }, []);

  const setField = (name) => (value) => setForm((current) => ({ ...current, [name]: value }));
  const setOtherData = (name) => (value) => setForm((current) => ({ ...current, otherData: { ...(current.otherData || {}), [name]: value } }));

  const insuranceRules = form.otherData?.insuranceRules || [];
  const setInsuranceRules = setOtherData('insuranceRules');
  const addInsuranceRule = () => setInsuranceRules([...insuranceRules, EMPTY_INSURANCE_RULE]);
  const updateInsuranceRule = (index, name, value) => setInsuranceRules(insuranceRules.map((rule, position) => (position === index ? { ...rule, [name]: value } : rule)));
  const removeInsuranceRule = (index) => setInsuranceRules(insuranceRules.filter((_, position) => position !== index));

  const uploadLogo = ([file]) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) return toast.error('ERROR: Logo file size must be less than 500KB');
    const reader = new FileReader();
    reader.onloadend = () => setField('customLogo')(reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const airline = { ...form, name: upper(form.name), code3: upper(form.code3), code2: upper(form.code2), prefix: String(form.prefix || '').trim(), pan: upper(form.pan) };
    const problem = problemOf(airline, airlines);
    if (problem) return toast.error(problem);

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = airline;
    if (!payload.id) delete payload.id;
    if (typeof payload.otherData === 'object') payload.otherData = JSON.stringify(payload.otherData);

    setSaving(true);
    try {
      const data = airline.id ? await masterRecordsApi.update('airlines', airline.id, payload) : await masterRecordsApi.create('airlines', payload);
      if (data?.error) throw new Error(data.error);
      toast.success('Airline saved successfully!');
      const saved = data.data || data;
      setForm({ ...airline, id: airline.id || saved.id });
      load();
    } catch (error) {
      toast.error(`Error saving airline: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const switchStatus = async () => {
    if (!form.id) return toast.error('Error: select a saved airline first');
    const switchingOff = (form.status || 'ACTIVE') !== 'INACTIVE';
    if (switchingOff && !(await askConfirm({
      title: 'Switch off this airline?',
      message: `${form.name || ''} (${form.prefix || ''})`,
      note: 'It is not deleted. It stays in this master as INACTIVE, is not offered on AWB screens, and can be switched on again.',
      okLabel: 'Switch off',
      cancelLabel: 'Keep it on',
    }))) return;
    const status = switchingOff ? 'INACTIVE' : 'ACTIVE';
    try {
      await masterRecordsApi.update('airlines', form.id, { status });
      setForm((current) => ({ ...current, status }));
      load();
    } catch (error) {
      toast.error(`Error: ${errorMessage(error)}`);
    }
  };

  const term = search.toLowerCase();
  const filtered = term ? airlines.filter((airline) => searchMatches(airline, term)) : airlines;

  return {
    records: airlines, filtered, form, search, setSearch, saving,
    setField, setOtherData, editRecord: setForm, clearForm: () => setForm(EMPTY_AIRLINE), save, switchStatus, uploadLogo,
    insuranceRules, addInsuranceRule, updateInsuranceRule, removeInsuranceRule,
  };
}
