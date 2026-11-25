import { CheckCircle } from 'lucide-react';
import { Modal } from '@/components/ui';

export default function ValidationModals({ ctx }) {
  const { validationErrors, setValidationErrors, validationSuccess, setValidationSuccess } = ctx;
  return (
    <>
      <Modal open={validationErrors.length > 0} onClose={() => setValidationErrors([])} title="ICEGATE Pre-Validation Failed">
        <div className="tw:rounded-sm tw:border tw:border-destructive/60 tw:bg-destructive/5 tw:p-3 tw:text-[13px] tw:text-destructive">
          <strong className="tw:mb-2 tw:block">Please fix the following errors:</strong>
          <ul className="tw:m-0 tw:pl-5">
            {validationErrors.map((error, index) => <li key={index} className="tw:mb-1">{error}</li>)}
          </ul>
        </div>
      </Modal>
      <Modal open={validationSuccess} onClose={() => setValidationSuccess(false)} title="Validation Successful">
        <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-sm tw:border tw:border-success/60 tw:bg-success/10 tw:p-3 tw:text-[13px] tw:text-success">
          <CheckCircle className="tw:size-[18px]" />
          <strong>Job Validation Successful! No errors found.</strong>
        </div>
      </Modal>
    </>
  );
}
