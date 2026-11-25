import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { lookup } from '../../ui';
import { claimDocs, newDraftKey } from '../../extras';
import { DESKS } from '../voucherConfig';

// the entry / search tabs of one voucher desk; ?voucher=<id> in the address opens a saved voucher
export function useVoucherDesk(desk) {
  const cfg = DESKS[desk];
  const [params, setParams] = useSearchParams();
  const openId = params.get('voucher');
  const [tab, setTab] = useState('entry');
  const [typeId, setTypeId] = useState(null);
  const [formKey, setFormKey] = useState(1);
  const [edit, setEdit] = useState(null); // { voucher, mode: 'modify' | 'copy' }
  const [draftKey, setDraftKey] = useState(newDraftKey); // attachments of a voucher not saved yet
  const [finder, setFinder] = useState(null); // 'modify' | 'delete' | 'print'

  useEffect(() => {
    const loadType = async () => {
      const types = await lookup('voucher-types');
      setTypeId((types || []).find((type) => type.baseType === cfg.base)?.id ?? null);
    };
    loadType();
  }, [desk]);
  useEffect(() => { if (openId) setTab('entry'); }, [openId]);

  const setVoucherParam = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('voucher', id); else next.delete('voucher');
    setParams(next);
  };
  const remountForm = () => setFormKey((key) => key + 1);

  const openVoucher = (id) => {
    setEdit(null);
    setVoucherParam(id);
    setTab('entry');
    remountForm();
  };
  const startNew = () => {
    setDraftKey(newDraftKey());
    setEdit(null);
    setVoucherParam(null);
    remountForm();
    setTab('entry');
  };
  const saved = async (id) => {
    if (!id) { startNew(); return; }
    await claimDocs(draftKey, id);
    setDraftKey(newDraftKey());
    openVoucher(id);
  };
  const modify = (voucher) => {
    setEdit({ voucher, mode: 'modify' });
    setTab('entry');
    remountForm();
  };
  const modifyFound = (voucher) => {
    setFinder(null);
    setVoucherParam(null);
    modify(voucher);
  };
  const copy = (voucher) => {
    setDraftKey(newDraftKey());
    setEdit({ voucher, mode: 'copy' });
    setVoucherParam(null);
    setTab('entry');
    remountForm();
  };

  return { cfg, openId, tab, setTab, typeId, formKey, edit, draftKey, finder, setFinder, openVoucher, startNew, saved, modify, modifyFound, copy };
}
