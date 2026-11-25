import { useState } from 'react';
import toast from 'react-hot-toast';
import { useJobContext } from '../../../JobContext';
import { certificateDisplayDate, upsertRow } from './jobHeaderData';
import useJobRows from './useJobRows';

const CERTIFICATE_FORM_BLANK = { autoField_30: '', autoField_31: '', autoField_32: '', autoField_33: '', autoField_34: '', autoField_35: '' };

export default function useCertificateRows() {
  const { jobData, setJobData } = useJobContext();
  const { rows: certRows, editIndex: certEditIdx, setEditIndex, saveRows, removeRow, cancelEdit } = useJobRows('_certRows');
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isCertTypeSearchOpen, setIsCertTypeSearchOpen] = useState(false);

  const handleCertAdd = () => {
    const certNo = String(jobData.autoField_30 || '').trim();
    if (!certNo) { toast.error('Enter the Cert. No'); return; }
    if (!String(jobData.autoField_32 || '').trim()) { toast.error('Enter the Cert. Type'); return; }
    if (certRows.some((row, index) => index !== certEditIdx && String(row.certNo).toUpperCase() === certNo.toUpperCase())) { toast.error(`Certificate ${certNo} is already added`); return; }
    const certDate = certificateDisplayDate(jobData.autoField_31);
    if (certDate === null) { toast.error('Cert. Date: type a real date as DD/MM/YYYY'); return; }
    const certificate = {
      id: certEditIdx === null ? Date.now() : certRows[certEditIdx].id,
      certNo,
      certDate,
      certType: String(jobData.autoField_32 || '').trim().toUpperCase(),
      commissionerate: jobData.autoField_33 || '',
      division: jobData.autoField_34 || '',
      range: jobData.autoField_35 || '',
    };
    saveRows(upsertRow(certRows, certEditIdx, certificate), { ...CERTIFICATE_FORM_BLANK, certificate: 'Y' });
  };

  const handleCertEdit = (index) => {
    const certificate = certRows[index];
    setJobData((previous) => ({
      ...previous,
      autoField_30: certificate.certNo || '', autoField_31: certificate.certDate || '', autoField_32: certificate.certType || '',
      autoField_33: certificate.commissionerate || '', autoField_34: certificate.division || '', autoField_35: certificate.range || '',
    }));
    setEditIndex(index);
  };

  const handleCertRemove = (index) => removeRow(index, { title: 'Remove this certificate?', message: 'The certificate row is taken off this job.' });

  return {
    certRows, certEditIdx, handleCertAdd, handleCertEdit, handleCertRemove, cancelCertEdit: cancelEdit,
    isCertModalOpen, setIsCertModalOpen, isCertTypeSearchOpen, setIsCertTypeSearchOpen,
  };
}
