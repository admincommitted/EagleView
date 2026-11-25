import { ScanText } from 'lucide-react';
import { Button, FileButton } from '@/components/ui';
import { BalanceStrip, PostingTable } from '../../ui';
import { FormActions } from '../../VoucherDeskParts/sections/FormActions';
import { Notice } from '../../VoucherDeskParts/sections/Notice';
import { usePurchaseForm } from '../hooks/usePurchaseForm';
import { AgainstBillBox } from './AgainstBillBox';
import { BillFooter } from './BillFooter';
import { ChargeEntryBox } from './ChargeEntryBox';
import { ChargesGrid } from './ChargesGrid';
import { PurchaseHeaderBox } from './PurchaseHeaderBox';

const MODES = [['bill', 'Invoice'], ['cn', 'Credit Note']];

function ModeBar({ form }) {
  const reading = !!form.ocr?.busy;
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
      <div className="tw:inline-flex tw:overflow-hidden tw:rounded-md tw:border tw:border-border tw:bg-background">
        {MODES.map(([mode, label]) => (
          <Button key={mode} variant={form.mode === mode ? 'default' : 'ghost'} className="tw:rounded-none tw:font-extrabold" onClick={() => form.switchMode(mode)}>{label}</Button>
        ))}
      </div>
      {form.creditNote && (
        <span className="tw:text-[11.5px] tw:text-foreground/80 tw:normal-case">
          Vendor&apos;s credit note against one of its bills - booked as a Debit Note, every line of the bill reversed.
        </span>
      )}
      <FileButton variant="default" className="tw:ml-auto" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={reading} onFiles={(files) => form.readBill(files[0])}
        title="Read the vendor's bill (PDF or photo) and fill this form">
        <ScanText /> {reading ? 'Reading bill' : 'Read bill (OCR)'}
      </FileButton>
    </div>
  );
}

function OcrNotice({ ocr }) {
  if (!ocr) return null;
  if (ocr.busy) return <Notice tone="info">Reading {ocr.file} - this can take up to a minute</Notice>;
  const warned = ocr.warnings.length > 0;
  return (
    <Notice tone={warned ? 'warn' : 'ok'} className="tw:text-[11.5px] tw:font-normal tw:text-foreground/80">
      <b className={warned ? 'tw:text-warning' : 'tw:text-success'}>Filled from {ocr.file}{ocr.source === 'gemini' ? ' (read by AI)' : ' (from the bill text)'}</b>
      {ocr.summary ? ' - ' + ocr.summary : ''}. Check every field before Save; the bill is attached to the voucher.
      {ocr.warnings.map((warning, index) => <div key={index} className="tw:mt-0.5 tw:text-warning">- {warning}</div>)}
    </Notice>
  );
}

// vendor bill screen laid out like iCAFFE's Trade Invoice: Trade (against a job), Non trade, and both under reverse charge.
// Charges pick up SAC / GST % / ledger from GST Charges; GST splits IGST or CGST + SGST by the place of supply.
// Bill details (bill no / dates, HBL, SEZ, TDS sections, hold) are saved to accounts-hub/purchase-info/:voucherId.
export function PurchaseForm({ desk, typeId, onSaved, onClear, draftKey, initial, editId, actions }) {
  const form = usePurchaseForm({ desk, typeId, initial, editId, draftKey, onSaved });
  const { creditNote } = form;
  return (
    <>
      <ModeBar form={form} />
      <OcrNotice ocr={form.ocr} />
      {form.cfg.rcm && <Notice className="tw:text-[11.5px] tw:font-bold">Reverse charge - the GST on this bill is paid by you, not the vendor.</Notice>}
      <PurchaseHeaderBox form={form} editId={editId} />
      {creditNote && <AgainstBillBox form={form} />}
      <ChargeEntryBox form={form} />
      <ChargesGrid form={form} />
      <BillFooter form={form} />
      {form.posting.length > 0 && <PostingTable title="This will post" lines={form.posting.map((line) => ({ ...line, ledgerName: form.nameOf(line.ledgerId) }))} />}
      <BalanceStrip dr={form.dr} cr={form.cr} />
      {editId && (
        <Notice>
          Modifying {creditNote ? 'credit note' : 'bill'} {initial.voucherNumber}. Charges, GST and TDS are read back from the saved voucher - check them before Save changes; after saving the voucher goes back for approval.
        </Notice>
      )}
      <FormActions editId={editId} saving={form.saving} onSave={form.save} onClear={onClear} actions={actions} message={form.message} saveLabel={creditNote ? 'Save credit note' : 'Save'} />
    </>
  );
}
