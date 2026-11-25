import { useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm, askText } from '../../common/askConfirm';
import { freightApi } from '../freightApi';
import { awbRowKey, numberOf } from './searchConfig';

const BULK = 'bulk';

const succeeded = (data) => {
  if (data?.success === false) throw new Error(data.error || data.message || 'Failed');
  return data;
};

const sentText = (kind, data) => `${kind} sent${data.fileName ? ` · ${data.fileName}` : ''}`;

export function useAwbActions(afterChange) {
  const [busy, setBusy] = useState('');
  const [results, setResults] = useState(null);

  const runOnRow = async (row, action, failurePrefix) => {
    setBusy(awbRowKey(row));
    try {
      await action();
      await afterChange();
    } catch (error) {
      toast.error(`${failurePrefix}: ${errorMessage(error)}`);
    } finally {
      setBusy('');
    }
  };

  const duplicateRow = async (row) => {
    const number = numberOf(row);
    let newAwbNumber;
    if (row.type === 'HAWB') {
      newAwbNumber = await askText({ title: 'Duplicate HAWB', message: `New HAWB number for the copy of ${number}:`, label: 'New HAWB number', okLabel: 'Copy' });
      if (!newAwbNumber) return;
    } else if (!(await askConfirm({ title: 'Duplicate AWB', message: `Make a copy of ${number} with the next free AWB number of this airline?`, okLabel: 'Copy' }))) {
      return;
    }
    await runOnRow(row, async () => {
      const copy = succeeded(await freightApi.duplicateAwb(row.id, { type: row.type, newAwbNumber: newAwbNumber ? newAwbNumber.trim() : undefined }));
      toast.success(`Copied as ${copy.newAwbNumber}`);
    }, 'Duplicate failed');
  };

  const voidRow = async (row) => {
    const number = numberOf(row);
    const confirmed = await askConfirm({
      title: `Void ${row.type}`,
      message: `VOID ${row.type} ${number}? It will no longer show in lists and its number can be used again.`,
      okLabel: 'Void',
      tone: 'danger',
    });
    if (!confirmed) return;
    await runOnRow(row, async () => {
      succeeded(await freightApi.voidAwb(row.id, row.type === 'HAWB' ? 'HAWB' : 'MAWB'));
      toast.success(`${number} voided`);
    }, 'Void failed');
  };

  const sendEach = async (targets, kind, send, initial = []) => {
    setBusy(BULK);
    const outcome = [...initial];
    for (const target of targets) {
      try {
        outcome.push({ no: target.no, ok: true, text: sentText(kind, succeeded(await send(target.id))) });
      } catch (error) {
        outcome.push({ no: target.no, ok: false, text: errorMessage(error) });
      }
    }
    setResults(outcome);
    setBusy('');
    await afterChange();
  };

  const sendFwb = async (pickedRows) => {
    const targets = pickedRows.filter((row) => row.type !== 'HAWB').map((row) => ({ id: row.id, no: row.awbNo }));
    if (!targets.length) {
      toast.error('Tick AWB / MAWB rows to send their FWB');
      return;
    }
    const confirmed = await askConfirm({ title: 'Send FWB', message: `Send FWB to the airline for ${targets.length} AWB(s)?`, note: targets.map((target) => target.no).join(', '), okLabel: 'Send' });
    if (confirmed) await sendEach(targets, 'FWB', freightApi.sendXfwb);
  };

  const sendFhl = async (pickedRows) => {
    const masters = new Map();
    const skipped = [];
    pickedRows.forEach((row) => {
      if (row.type === 'MAWB') masters.set(row.id, row.awbNo);
      else if (row.type === 'HAWB' && row.masterId) masters.set(row.masterId, row.awbNo);
      else if (row.type === 'HAWB') skipped.push({ no: row.hawbNo, ok: false, text: 'MAWB not saved - link the HAWB first' });
    });
    if (!masters.size) {
      toast.error(skipped.length ? 'The ticked HAWBs have no saved MAWB' : 'Tick MAWB or HAWB rows to send FHL');
      return;
    }
    const confirmed = await askConfirm({ title: 'Send FHL', message: `Send FHL (all houses) for ${masters.size} MAWB(s)?`, note: [...masters.values()].join(', '), okLabel: 'Send' });
    if (!confirmed) return;
    const targets = [...masters].map(([id, no]) => ({ id, no }));
    await sendEach(targets, 'FHL', freightApi.sendXfhl, skipped);
  };

  return { busy, isBulkBusy: busy === BULK, results, clearResults: () => setResults(null), duplicateRow, voidRow, sendFwb, sendFhl };
}
