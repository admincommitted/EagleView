import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import { requestReport } from './AdvancedReportsParts/reportRequest';
import PageHeader from './PurchaseParts/PageHeader';
import Gstr2bUploadCard from './GSTReconciliationParts/Gstr2bUploadCard';
import ReconciliationSummary from './GSTReconciliationParts/ReconciliationSummary';
import ReconciliationResults from './GSTReconciliationParts/ReconciliationResults';
import { exportReconciliation } from './GSTReconciliationParts/exportReconciliation';

const SEARCHED_FIELDS = ['vendor', 'invoice', 'gstin', 'id'];

// The GSTR-2B JSON from the portal is matched on the server against the Purchase vouchers in the books.
export default function GSTReconciliation() {
  const [fileUploaded, setFileUploaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState({ matched: 0, mismatched: 0, missingInBooks: 0, missingOnPortal: 0 });
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [tolerance, setTolerance] = useState('1');

  const runMatch = async (file) => {
    setAnalyzing(true);
    setError('');
    try {
      const result = await requestReport(() => accountsApi.matchGstr2b(file, tolerance || '1'));
      setRecords(result.records || []);
      setSummary(result.summary || {});
      setMeta(result);
      setFileUploaded(true);
      toast.success(`Matched ${result.summary ? result.summary.matched : 0} of ${result.summary ? result.summary.portalDocuments : 0} portal documents`);
    } catch (matchError) {
      setError(matchError.message);
      setFileUploaded(false);
      toast.error('Could not reconcile');
    }
    setAnalyzing(false);
  };

  const pickFile = (file) => {
    if (!/\.json$/i.test(file.name)) {
      toast.error('That is not a .json file. Download the GSTR-2B JSON from the GST portal, not the Excel.');
      return;
    }
    runMatch(file);
  };

  const query = search.toLowerCase();
  const shown = records.filter((record) => {
    if (exceptionsOnly && record.status === 'Matched') return false;
    return !search || SEARCHED_FIELDS.some((field) => String(record[field] || '').toLowerCase().includes(query));
  });

  const exportExcel = async () => {
    if (!shown.length) {
      toast.error('Nothing to export');
      return;
    }
    await exportReconciliation(shown, meta?.period);
  };

  const openVoucher = (record) => {
    if (!record.voucherId) {
      toast.error('This document is not in the books, so there is no voucher to open');
      return;
    }
    window.open(`/vouchers?id=${record.voucherId}`, '_blank');
  };

  const matchAnotherMonth = () => {
    setFileUploaded(false);
    setRecords([]);
    setMeta(null);
    setSearch('');
    setExceptionsOnly(false);
  };

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[1400px] tw:flex-col tw:gap-6 tw:p-3 tw:md:p-6">
      <PageHeader icon={CheckCircle} title="GSTR-2B Auto-Reconciliation"
        subtitle="Match portal JSON with Purchase Register to secure Input Tax Credit (ITC)" />

      {!fileUploaded ? (
        <Gstr2bUploadCard tolerance={tolerance} onToleranceChange={setTolerance} analyzing={analyzing} error={error} onFile={pickFile} />
      ) : (
        <>
          <ReconciliationSummary summary={summary} />
          <ReconciliationResults
            meta={meta}
            records={records}
            shown={shown}
            search={search}
            onSearchChange={setSearch}
            exceptionsOnly={exceptionsOnly}
            onToggleExceptions={() => setExceptionsOnly((current) => !current)}
            onExport={exportExcel}
            onOpenVoucher={openVoucher}
          />
          <div className="tw:flex tw:justify-end">
            <Button size="lg" onClick={matchAnotherMonth}>Match another month</Button>
          </div>
        </>
      )}
    </div>
  );
}
