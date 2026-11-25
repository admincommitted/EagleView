import { useState } from 'react';
import { PauseCircle } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Input } from '@/components/ui';
import { accountsApi } from '../../accountsApi';
import { Badge, Box, Btn, fmtDate, inr } from '../../ui';

const InfoCell = ({ label, value }) => (value ? (
  <div className="tw:min-w-0">
    <div className="tw:text-[10px] tw:font-bold tw:text-muted-foreground">{label}</div>
    <div className="tw:truncate tw:text-entry tw:font-bold tw:text-foreground">{value}</div>
  </div>
) : null);

const sezText = (info) => (Number(info.isSez) ? (info.sezType === 'lut' ? 'Yes, without tax (LUT)' : 'Yes, with IGST') : '');
const tdsText = (section, amount) => (amount ? (section || 'TDS') + ' - ' + inr(amount) : '');

// bill details shown when a saved purchase bill or credit note is opened, with Hold / Release
export function PurchaseInfoBox({ v: voucher, onChanged }) {
  const info = voucher.purchase;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  if (!info && voucher.baseType !== 'Purchase') return null;
  const held = info && Number(info.holdPayment) === 1;
  const isBill = voucher.baseType === 'Purchase';

  const setHold = async (on) => {
    setMessage('');
    if (on && !reason.trim()) return setMessage('Give the reason');
    try {
      await accountsApi.purchaseDeskHold(voucher.id, { hold: on ? 1 : 0, reason: reason.trim() });
      setOpen(false);
      setReason('');
      onChanged();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const holdControls = held
    ? <><Badge tone="warn">Payment on hold</Badge><Btn small kind="clear" onClick={() => setHold(false)}>Release payment</Btn></>
    : <Btn small kind="ghost" onClick={() => setOpen((shown) => !shown)}><PauseCircle size={11} /> Hold payment</Btn>;
  const cells = info ? [
    [info.kind === 'cn' ? 'Credit Note No' : 'Invoice No', info.billNo], ['Date', fmtDate(info.billDate)], ['Due Date', fmtDate(info.dueDate)],
    ['HBL / HAWB', info.hblNo], ['Master No', info.mblNo], ['SEZ', sezText(info)],
    ['1st TDS', tdsText(info.tds1Section, info.tds1Amount)], ['2nd TDS', tdsText(info.tds2Section, info.tds2Amount)],
    ['Against Bill', info.againstNo ? info.againstNo + ' / ' + fmtDate(info.againstDate) : ''], ['Reason', info.cnReason],
    ['Held', held ? info.holdReason + (info.holdBy ? ' - ' + info.holdBy : '') + (info.holdAt ? ', ' + fmtDate(info.holdAt) : '') : ''],
  ] : [];

  return (
    <Box title={info?.kind === 'cn' ? 'Credit Note Details' : 'Bill Details'} right={isBill ? holdControls : null}>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(130px,1fr))] tw:gap-2.5">
        {cells.map(([label, value]) => <InfoCell key={label} label={label} value={value} />)}
        {!info && <div className="tw:text-[11.5px] tw:text-muted-foreground">No bill details were saved with this voucher.</div>}
      </div>
      {open && !held && (
        <div className="tw:mt-2.5 tw:flex tw:items-center tw:gap-2">
          <Input data-allow-text autoFocus className="tw:flex-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is the payment held?"
            onKeyDown={(event) => event.key === 'Enter' && setHold(true)} />
          <Btn small kind="primary" onClick={() => setHold(true)}>Hold</Btn>
        </div>
      )}
      {message && <div className="tw:mt-1.5 tw:text-[11.5px] tw:text-destructive">{message}</div>}
      {voucher.creditNotes?.length > 0 && (
        <div className="tw:mt-2.5 tw:text-[11.5px]">
          <b className="tw:text-head">Credit notes against this bill: </b>
          {voucher.creditNotes.map((note) => <span key={note.id} className="tw:mr-3">{note.billNo || note.voucherNumber} ({fmtDate(note.date)}, {inr(note.totalAmount)})</span>)}
        </div>
      )}
    </Box>
  );
}
