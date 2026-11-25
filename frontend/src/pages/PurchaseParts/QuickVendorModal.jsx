import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Modal } from '@/components/ui';
import { purchaseApi } from './purchaseApi';
import FormFields from './FormFields';
import { BLANK_VENDOR, serverError, VENDOR_FIELDS } from './vendorFields';

/** Adds a vendor without leaving the PO; the full form is in Vendor Master. */
export default function QuickVendorModal({ open, onClose, onAdded }) {
  const [vendor, setVendor] = useState(BLANK_VENDOR);

  const saveVendor = async () => {
    if (!vendor.vendorName) return;
    try {
      await purchaseApi.addVendor(vendor);
      setVendor(BLANK_VENDOR);
      onAdded();
    } catch (error) {
      toast.error(serverError(error, 'The vendor could not be added'));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick Vendor Add" width={350} closeOnOutside={false}
      footer={<Button variant="default" className="tw:w-full" onClick={saveVendor}>Save Vendor</Button>}>
      <FormFields fields={VENDOR_FIELDS} values={vendor} onChange={(name, value) => setVendor((current) => ({ ...current, [name]: value }))} />
    </Modal>
  );
}
