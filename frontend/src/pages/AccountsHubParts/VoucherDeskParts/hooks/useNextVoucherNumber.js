import { useEffect } from 'react';

// Asks the number series for the next voucher no whenever one of `deps` changes. An iCAFFE series gives the number on
// Save, so the box shows the preview (or "on Save") read-only; otherwise the number stays editable.
export function useNextVoucherNumber({ enabled, fetchNumber, setHeader, keepTyped, deps }) {
  useEffect(() => {
    if (!enabled) return;
    const load = async () => {
      try {
        const result = await fetchNumber();
        setHeader((header) => ({
          ...header,
          icaffe: !!result.icaffe,
          voucherNumber: result.icaffe ? (result.nextNumber || result.note || 'on Save') : (result.nextNumber || (keepTyped ? header.voucherNumber : '')),
        }));
      } catch {
        // no series for this type: the voucher no is typed by hand
      }
    };
    load();
  }, deps);
}
