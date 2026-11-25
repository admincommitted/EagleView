import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, Modal, Separator } from '@/components/ui';

// in the order the copies are printed; the neutral copy has no footer text
const COPIES = [
  { name: 'shipper', footer: 'ORIGINAL 3 (FOR SHIPPER)', label: 'Original 3 (For Shipper)', colour: 'Blue', colourClass: 'tw:text-[#3b82f6]' },
  { name: 'consignee', footer: 'ORIGINAL 2 (FOR CONSIGNEE)', label: 'Original 2 (For Consignee)', colour: 'Pink', colourClass: 'tw:text-[#ec4899]' },
  { name: 'carrier', footer: 'ORIGINAL 1 (FOR ISSUING CARRIER)', label: 'Original 1 (For Issuing Carrier)', colour: 'Green', colourClass: 'tw:text-[#22c55e]' },
  { name: 'delivery', footer: 'COPY 4 (DELIVERY RECEIPT)', label: 'Copy 4 (Delivery Receipt)', colour: 'Yellow', colourClass: 'tw:text-[#eab308]' },
  { name: 'extra', footer: 'EXTRA COPY', label: 'EXTRA COPY (WHITE)' },
  { name: 'neutral', footer: '', label: 'BLANK / NEUTRAL COPY (NO FOOTER)' },
];
const SHOWN_ORDER = ['neutral', 'shipper', 'consignee', 'carrier', 'delivery', 'extra'].map((name) => COPIES.find((copy) => copy.name === name));
const INITIAL_COPIES = { neutral: true, shipper: false, consignee: false, carrier: false, delivery: false, extra: false };

function OptionRow({ checked, onCheckedChange, className, children }) {
  return (
    <label className={cn('tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:text-[13px]', className)}>
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="tw:size-4" />
      <span>{children}</span>
    </label>
  );
}

export default function PrintOptionsModal({ isOpen, onClose, onPrint }) {
  const [copies, setCopies] = useState(INITIAL_COPIES);
  const [includeTerms, setIncludeTerms] = useState(true);

  const handleProceed = (actionType) => {
    const selectedCopies = COPIES.filter((copy) => copies[copy.name]).map((copy) => copy.footer);
    if (selectedCopies.length === 0) {
      toast.error('Please select at least one copy to print.');
      return;
    }
    onPrint({ selectedCopies, includeTerms, actionType });
    onClose();
  };

  const footer = (
    <>
      <Button variant="default" onClick={() => handleProceed('print')}><Printer /> PRINT</Button>
      <Button variant="warning" onClick={() => handleProceed('pdf')}><Download /> DOWNLOAD PDF</Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title="AWB PRINT OPTIONS" width={400} footer={footer}>
      <div className="tw:text-[13px] tw:font-bold">Select Copies to Generate:</div>
      <div className="tw:flex tw:flex-col tw:gap-2.5 tw:pl-2.5">
        {SHOWN_ORDER.map((copy) => (
          <OptionRow key={copy.name} checked={copies[copy.name]} onCheckedChange={(checked) => setCopies((current) => ({ ...current, [copy.name]: checked }))}>
            {copy.colour ? <>{copy.label} - <b className={copy.colourClass}>{copy.colour}</b></> : copy.label}
          </OptionRow>
        ))}
      </div>
      <Separator />
      <OptionRow checked={includeTerms} onCheckedChange={setIncludeTerms} className="tw:font-bold">Print Terms &amp; Conditions (Back Side)</OptionRow>
    </Modal>
  );
}
