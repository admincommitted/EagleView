import { useEffect, useState } from 'react';
import { Download, Filter, Printer, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, DateInput, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import { dayFirst } from './AdvancedReportsParts/reportFormat';
import PageHeader from './PurchaseParts/PageHeader';
import GstRegisterTable from './GSTReportsParts/GstRegisterTable';
import Gstr3bSummary from './GSTReportsParts/Gstr3bSummary';

const RETURNS = [
  { type: 'GSTR1', tab: 'GSTR-1 (Outward Supplies)', title: 'GSTR-1 : Sales Register' },
  { type: 'GSTR2', tab: 'GSTR-2 (Inward Supplies)', title: 'GSTR-2 : Purchase Register' },
  { type: 'GSTR3B', tab: 'GSTR-3B (Summary & ITC)', title: 'GSTR-3B : Return Summary' },
];

// Printing shows only the return itself, not the menus around the page.
const PRINT_ONLY_RETURN_CSS = `@media print {
  body * { visibility: hidden; }
  .gst-return-print, .gst-return-print * { visibility: visible; }
  .gst-return-print { position: absolute; left: 0; top: 0; width: 100%; }
}`;

const isoDay = (date) => date.toISOString().split('T')[0];
const firstOfThisMonth = () => isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

export default function GSTReports() {
  const [activeTab, setActiveTab] = useState('GSTR1');
  const [startDate, setStartDate] = useState(firstOfThisMonth);
  const [endDate, setEndDate] = useState(() => isoDay(new Date()));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await accountsApi.gstReturnRegister({ type: activeTab, startDate, endDate });
        setData(response.data);
      } catch (error) {
        console.error('Error fetching GST data', error);
      }
      setLoading(false);
    };
    load();
  }, [activeTab, startDate, endDate]);

  const activeReturn = RETURNS.find((item) => item.type === activeTab);

  return (
    <div className="tw:mx-auto tw:flex tw:w-full tw:max-w-[1600px] tw:flex-col tw:gap-4 tw:p-2 tw:md:p-4">
      <style>{PRINT_ONLY_RETURN_CSS}</style>

      <PageHeader
        className="tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-4 tw:py-3 tw:print:hidden"
        icon={Receipt}
        title="GST Returns Dashboard"
        subtitle="GSTR-1, GSTR-2, and GSTR-3B Reconciliation"
        actions={(
          <>
            <Button onClick={() => window.print()}><Printer /> Print</Button>
            <Button variant="default" onClick={() => toast('Exporting Return (JSON/Excel) for Portal Upload...')}>
              <Download /> Export for GST Portal
            </Button>
          </>
        )}
      />

      <div className="tw:overflow-hidden tw:rounded-md tw:border tw:border-input tw:bg-card tw:shadow-md">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="tw:print:hidden">
          <TabsList variant="line" className="tw:w-full tw:justify-start tw:overflow-x-auto tw:border-b tw:border-border tw:bg-page">
            {RETURNS.map((item) => (
              <TabsTrigger key={item.type} value={item.type} className="tw:px-4 tw:text-sm tw:data-[state=active]:font-bold tw:md:px-6">{item.tab}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-warning/30 tw:bg-warning/10 tw:px-4 tw:py-3 tw:sm:flex-row tw:sm:items-center tw:sm:gap-6 tw:print:hidden">
          <span className="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:font-bold tw:uppercase tw:text-warning">
            <Filter className="tw:size-3.5" /> Filing Period :
          </span>
          <div className="tw:flex tw:items-center tw:gap-2">
            <DateInput wrapperClassName="tw:w-32" value={startDate} onValueChange={setStartDate} />
            <span className="tw:text-muted-foreground">-</span>
            <DateInput wrapperClassName="tw:w-32" value={endDate} onValueChange={setEndDate} />
          </div>
        </div>

        <div className="gst-return-print tw:min-h-[500px] tw:bg-page tw:p-2 tw:md:p-4">
          {loading ? (
            <div className="tw:p-10 tw:text-center tw:text-sm tw:font-bold tw:text-primary">Compiling GST Data...</div>
          ) : (
            <div className="tw:overflow-hidden tw:rounded-sm tw:border tw:border-border tw:bg-card">
              <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b-2 tw:border-foreground tw:px-5 tw:py-4 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between">
                <div>
                  <h1 className="tw:m-0 tw:text-xl tw:font-bold tw:normal-case tw:text-foreground">{activeReturn.title}</h1>
                  <div className="tw:mt-1 tw:text-xs tw:text-muted-foreground">GSTIN: 07AADCC1234E1Z5 (Demo)</div>
                </div>
                <div className="tw:text-xs tw:sm:text-right">
                  <div className="tw:font-bold tw:text-foreground">Period</div>
                  <div className="tw:text-muted-foreground">{dayFirst(startDate)} to {dayFirst(endDate)}</div>
                </div>
              </div>

              {activeTab === 'GSTR3B'
                ? data && <Gstr3bSummary data={data} />
                : <GstRegisterTable vouchers={Array.isArray(data) ? data : []} returnType={activeTab} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
