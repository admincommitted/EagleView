import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '../../common/askConfirm';
import { freightApi } from '../freightApi';

const STORE_KEY = 'ecsd_data';
const AWB_LIST_LIMIT = 200;

const SAMPLE_CONSIGNMENT = { awbPrefix: '001', awbSuffix: '34835161', dep: 'NRT-NARITA', dest: 'MIA-MIAMI', nature: 'MACHINE PARTS' };

export const EMPTY_DECLARATION = {
  fromDate: '',
  toDate: '',
  docType: 'AIR WAYBILL',
  consolidation: false,
  securityStatus: 'SELECT',
  securityMethod: 'SCREENING',
  screeningMethods: [],
  otherScreeningMethods: '',
  issuerName: '',
  issuedOn: '',
  additionalInfo: '',
};

export const awbNumberOf = (awb) => String(awb.awbNumber || [awb.awbPrefix, awb.awbSuffix].filter(Boolean).join('-') || '').trim();

const splitAwbNumber = (number) => (number.includes('-') ? number.split('-') : [number.slice(0, 3), number.slice(3)]);

const readStoredConsignment = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch {
    return null;
  }
};

const storeConsignment = (consignment) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(consignment));
  } catch {
    // private window: the next visit just starts empty
  }
};

// The AWB screens put the consignment here before opening e-CSD, so it starts filled in.
const storedMawbNumber = (stored) => (stored.awbPrefix && stored.awbSuffix ? `${stored.awbPrefix}-${stored.awbSuffix}` : stored.awbNumber || '');

export function useEcsd() {
  const [consignment, setConsignment] = useState(() => readStoredConsignment() || SAMPLE_CONSIGNMENT);
  const [declaration, setDeclaration] = useState(EMPTY_DECLARATION);
  const [awbs, setAwbs] = useState([]);
  const [awbId, setAwbId] = useState(null);
  const [pickedAwb, setPickedAwb] = useState('');
  const [linkedHawbs, setLinkedHawbs] = useState([]);
  const [hawbLoading, setHawbLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedNote, setSavedNote] = useState('');

  const setField = (key) => (value) => setDeclaration((current) => ({ ...current, [key]: value }));

  const loadAwbs = async () => {
    try {
      const data = await freightApi.awbList(AWB_LIST_LIMIT);
      setAwbs(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
    } catch {
      setAwbs([]);
    }
  };

  const loadHawbs = async (mawbNo) => {
    if (!mawbNo) {
      setLinkedHawbs([]);
      return;
    }
    setHawbLoading(true);
    try {
      const data = await freightApi.linkedHawbs(mawbNo);
      setLinkedHawbs(Array.isArray(data) ? data : []);
    } catch {
      setLinkedHawbs([]);
    } finally {
      setHawbLoading(false);
    }
  };

  useEffect(() => {
    loadAwbs();
    const stored = readStoredConsignment();
    if (stored) loadHawbs(storedMawbNumber(stored));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addAwb = () => {
    const awb = awbs.find((entry) => awbNumberOf(entry) === pickedAwb);
    if (!awb) {
      toast.error('Choose an AWB from the list first');
      return;
    }
    const number = awbNumberOf(awb);
    const [prefix, suffix] = splitAwbNumber(number);
    setAwbId(awb.id || null);
    setConsignment((current) => ({
      ...current,
      awbPrefix: prefix || '',
      awbSuffix: suffix || '',
      awbNumber: number,
      dep: awb.origin || awb.departure || current.dep,
      dest: awb.destination || current.dest,
      nature: awb.natureOfGoods || current.nature,
    }));
    loadHawbs(number);
  };

  const saveExtraDoc = async (data) => freightApi.saveAwbExtraDoc('AWB', awbId, 'ECSD', data);

  const save = async () => {
    if (!awbId) {
      toast.error('Choose the AWB (Add) before saving - the declaration is kept with its AWB');
      return;
    }
    setBusy(true);
    try {
      await saveExtraDoc({ fields: declaration, ecsdData: consignment, savedAt: new Date().toISOString() });
      storeConsignment(consignment);
      setSavedNote(`e-CSD saved with AWB ${consignment.awbNumber || ''}`);
      toast.success(`e-CSD saved with AWB ${consignment.awbNumber || ''}`);
    } catch (error) {
      toast.error(`Could not save: ${errorMessage(error)}`);
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!awbId) {
      toast.error('Choose the AWB first');
      return;
    }
    const confirmed = await askConfirm({ title: 'Void e-CSD', message: `Remove the e-CSD saved against AWB ${consignment.awbNumber || ''}?`, okLabel: 'Remove', tone: 'danger' });
    if (!confirmed) return;
    setBusy(true);
    try {
      await saveExtraDoc(null);
      setSavedNote('');
      toast.success('e-CSD removed');
    } catch (error) {
      toast.error(`Could not remove: ${errorMessage(error)}`);
    }
    setBusy(false);
  };

  return {
    consignment, setNature: (nature) => setConsignment((current) => ({ ...current, nature })), declaration, setField,
    clearDeclaration: () => setDeclaration(EMPTY_DECLARATION), awbs, loadAwbs, awbId, pickedAwb, setPickedAwb, addAwb, linkedHawbs,
    hawbLoading, busy, save, remove, savedNote, hideSavedNote: () => setSavedNote(''),
  };
}
