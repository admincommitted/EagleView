import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import askConfirm, { askText } from '../../common/askConfirm';
import { beAmendApi, downloadFile, ymd } from '../beAmendApi';

const EMPTY_FORM = { reqLetterNo: '', reqLetterDate: '', reason: '', codes: [], icegateProfileId: '' };

export default function useAmendment(id, onChanged) {
  const [amendment, setAmendment] = useState(null);
  const [codes, setCodes] = useState([]);
  const [changeReport, setChangeReport] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [answer, changes, settings] = await Promise.all([beAmendApi.amendment(id), beAmendApi.changes(id), beAmendApi.settings()]);
      const record = answer.data;
      const icegateProfiles = settings.profiles || [];
      setAmendment(record);
      setChangeReport(changes);
      setProfiles(icegateProfiles);
      setForm({
        reqLetterNo: record.reqLetterNo || '',
        reqLetterDate: ymd(record.reqLetterDate),
        reason: record.reason || '',
        codes: record.codes || [],
        icegateProfileId: record.icegateProfileId || icegateProfiles[0]?.id || '',
      });
      setDirty(false);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [id]);

  useEffect(() => {
    const loadCodes = async () => {
      try {
        const answer = await beAmendApi.codes();
        setCodes(answer.data || []);
      } catch {
        setCodes([]);
      }
    };
    loadCodes();
  }, []);

  useEffect(() => { if (id) load(); }, [id, load]);

  const setField = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setDirty(true); };
  const toggleCode = (code) => setField('codes', form.codes.includes(code) ? form.codes.filter((picked) => picked !== code) : [...form.codes, code]);

  const done = (answer, message) => {
    if (answer?.data) setAmendment(answer.data);
    if (message) toast.success(message);
    onChanged?.(answer?.data);
  };

  // resolves true when the step went through, false when it failed (the error is shown and toasted)
  const run = async (key, task) => {
    setBusy(key);
    setError('');
    try {
      await task();
      return true;
    } catch (runError) {
      setError(runError.message);
      toast.error(runError.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const save = () => run('save', async () => {
    const answer = await beAmendApi.save(id, form);
    setDirty(false);
    done(answer, `Amendment ${amendment.amendNo} saved`);
  });

  const makeFile = () => run('file', async () => {
    if (!form.codes.length) throw new Error('Tick what is amended (codes) first');
    if (dirty) await beAmendApi.save(id, form);
    const answer = await beAmendApi.makeFile(id, form.icegateProfileId || null);
    setDirty(false);
    done(answer, `File ${answer.fileName} made (${answer.lines} lines)`);
    if (answer.unconfirmedCodes?.length) {
      toast(`${answer.unconfirmedCodes.join(', ')}: not yet seen in an iCAFFE amendment - check the ICEGATE reply`, { icon: 'ℹ️', duration: 7000 });
    }
  });

  const download = (kind) => run('dl' + kind, async () => {
    const fileName = await downloadFile(id, kind);
    toast.success(fileName + ' downloaded');
  });

  const sign = (pin) => run('sign', async () => {
    if (!pin) throw new Error('Enter the DSC token PIN');
    const answer = await beAmendApi.sign(id, pin);
    done(answer, 'Signed' + (answer.signer ? ' by ' + answer.signer : ''));
  });

  const send = () => run('send', async () => {
    const goAhead = await askConfirm({ title: 'Send to ICEGATE', message: `Send the signed file ${amendment.fileName}.sig to ICEGATE by mail now?`, okLabel: 'Send' });
    if (!goAhead) return;
    const answer = await beAmendApi.send(id);
    done(answer, 'Sent to ' + answer.to);
  });

  const markSubmitted = (mode) => run('sub', async () => {
    const kind = mode === 'DOWNLOAD_UNSIGNED' ? 'unsigned' : 'signed';
    const goAhead = await askConfirm({ title: 'Uploaded on ICEGATE', message: `Mark amendment ${amendment.amendNo} as uploaded on ICEGATE (${kind} file)?`, okLabel: 'Mark as submitted' });
    if (!goAhead) return;
    const answer = await beAmendApi.markSubmitted(id, mode);
    done(answer, 'Marked as submitted');
  });

  const saveReply = (status, text) => run('reply', async () => {
    const answer = await beAmendApi.saveReply(id, status, text);
    done(answer, 'ICEGATE reply saved: ' + status);
  });

  const voidAmendment = () => run('void', async () => {
    const reason = await askText({
      title: 'Void amendment ' + amendment.amendNo,
      message: `Void amendment ${amendment.amendNo}? Its number stays used.`,
      label: 'Reason',
      okLabel: 'Void the amendment',
    });
    if (!reason?.trim()) return;
    const answer = await beAmendApi.voidAmendment(id, reason.trim());
    done(answer, `Amendment ${amendment.amendNo} voided`);
  });

  return {
    amendment, codes, changeReport, profiles, form, dirty, busy, error, load, setField, toggleCode,
    actions: { save, makeFile, download, sign, send, markSubmitted, saveReply, voidAmendment },
  };
}
