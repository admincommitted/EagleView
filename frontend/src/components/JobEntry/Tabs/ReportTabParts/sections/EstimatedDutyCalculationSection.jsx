import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { jobEntryApi } from '../../../jobEntryApi';
import { ReportBody, ReportCell, ReportRow, ReportTable } from '../reportTable';

const LINE_CELL = 'tw:border-0 tw:border-b tw:px-[8px] tw:py-[12px]';
const TOTAL_CELL = 'tw:border-0 tw:px-[8px] tw:py-[12px] tw:text-[14px] tw:font-bold tw:text-[#065f46]';

function DutyLine({ label, amount, amountClassName }) {
  return (
    <ReportRow>
      <ReportCell look="ruled"className={`${LINE_CELL} tw:text-[#475569]`}>{label}</ReportCell>
      <ReportCell look="ruled"className={`${LINE_CELL} tw:text-right tw:font-semibold ${amountClassName || ''}`}>{amount}</ReportCell>
    </ReportRow>
  );
}

function EstimatedDuty({ ctx }) {
  const { fmt } = ctx;
  const lines = [
    ['Total Assessable Value (INR)', ctx.totalAssessableValue],
    ['Basic Customs Duty (BCD)', ctx.totalBCD],
    ['Social Welfare Surcharge (SWS)', ctx.totalSWS],
    ['IGST', ctx.totalIGST, 'tw:text-[#047857]'],
    ['CVD', ctx.totalCVD],
    ['Adl CVD', ctx.totalAdlCVD],
    ['Health Cess', ctx.totalHealthCess],
    ['SAPTA', ctx.totalSAPTA],
  ];
  return (
    <div className="tw:mx-auto tw:max-w-[600px] tw:rounded-[4px] tw:border tw:border-[#cbd5e1] tw:bg-white tw:p-8 tw:text-black tw:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
      <h2 className="tw:m-0 tw:mb-6 tw:text-center">Estimated Duty Calculation</h2>
      <ReportTable className="tw:text-[13px]">
        <ReportBody>
          {lines.map(([label, amount, amountClassName]) => <DutyLine key={label} label={label} amount={fmt(amount)} amountClassName={amountClassName} />)}
          <ReportRow className="tw:bg-[#f0fdf4] tw:even:bg-[#f0fdf4] tw:hover:bg-[#f0fdf4]">
            <ReportCell look="ruled"className={TOTAL_CELL}>Total Estimated Duty Payable</ReportCell>
            <ReportCell look="ruled"className={`${TOTAL_CELL} tw:text-right`}>{fmt(ctx.grandTotal)}</ReportCell>
          </ReportRow>
        </ReportBody>
      </ReportTable>
      <div className="tw:mt-4 tw:text-center tw:text-[11px] tw:text-[#94a3b8]">
        *Note: This is an estimated duty. Final duty will be determined by ICEGATE system.
      </div>
    </div>
  );
}

const SHOW_MAX = 200000;
const CODE_BOX = 'tw:max-h-[500px] tw:overflow-auto tw:rounded-[4px] tw:bg-[#1e293b] tw:p-4 tw:font-mono tw:text-[12px] tw:normal-case tw:text-[#cbd5e1]';

const previewRequest = (jobData, items, esanchitDocs) => ({
  jobData: { ...(jobData || {}), esanchitDocs: esanchitDocs || [] },
  items: items || [],
  invoices: jobData?.invoices || [],
  beType: jobData?.autoField_51 || 'H',
  transportMode: jobData?.autoField_52 || 'S',
  forFiling: true,
});

const recordCounts = (master) => Object.entries(master)
  .filter(([, records]) => Array.isArray(records) && records.length)
  .map(([name, records]) => `${name.replace(/Model$/, '')} ${records.length}`)
  .join(' · ');

function buildError(error) {
  if (!error.response) return `The file could not be built: ${error.message}`;
  return error.response.data?.error || `The file could not be built (HTTP ${error.response.status})`;
}

// The real CACHI01 file (nothing is sent to ICEGATE), asked from the server once when the view opens.
function CachiPreview({ jobData, items, esanchitDocs }) {
  const [preview, setPreview] = useState({ loading: true });
  const [showWhole, setShowWhole] = useState(false);

  const load = async () => {
    setPreview({ loading: true });
    setShowWhole(false);
    try {
      const result = await jobEntryApi.previewBe(previewRequest(jobData, items, esanchitDocs));
      if (!result.success) {
        setPreview({ error: result.error || 'The file could not be built' });
        return;
      }
      setPreview({
        text: JSON.stringify(result.cachi01, null, 2),
        errors: result.validation?.errors || [],
        warnings: result.validation?.warnings || [],
        counts: recordCounts(result.cachi01?.master || {}),
      });
    } catch (error) {
      setPreview({ error: buildError(error) });
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- built once when the view opens; "Build again" re-reads
  useEffect(() => { load(); }, []);

  if (preview.loading) return <div className={CODE_BOX}>Building the CACHI01 file...</div>;
  if (preview.error) {
    return (
      <div className={`${CODE_BOX} tw:text-[#fecaca]`}>
        {preview.error} <Button size="sm" className="tw:ml-2.5" onClick={load}>Try again</Button>
      </div>
    );
  }
  const isLong = preview.text.length > SHOW_MAX;
  const { errors, warnings } = preview;
  return (
    <div>
      <div className="tw:mb-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:text-entry tw:normal-case">
        <b className={errors.length ? 'tw:text-destructive' : 'tw:text-success'}>{errors.length} error(s)</b>
        <b className={warnings.length ? 'tw:text-warning' : 'tw:text-success'}>{warnings.length} warning(s)</b>
        <span className="tw:text-muted-foreground">{preview.counts}</span>
        <span className="tw:text-muted-foreground">{Math.round(preview.text.length / 1024).toLocaleString('en-IN')} KB</span>
        <Button size="sm" onClick={load} title="Build the file again from what is on the screen now">Build again</Button>
      </div>
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="tw:mb-1.5 tw:max-h-[110px] tw:overflow-y-auto tw:rounded-[4px] tw:border tw:border-border tw:px-2 tw:py-1 tw:text-entry tw:normal-case">
          {errors.slice(0, 50).map((message, index) => <div key={`error-${index}`} className="tw:text-destructive">{message}</div>)}
          {warnings.slice(0, 50).map((message, index) => <div key={`warning-${index}`} className="tw:text-warning">{message}</div>)}
        </div>
      )}
      <div className={CODE_BOX}>
        <pre className="tw:m-0">{isLong && !showWhole ? preview.text.slice(0, SHOW_MAX) : preview.text}</pre>
        {isLong && !showWhole && (
          <div className="tw:mt-2 tw:text-[#fde68a]">
            First {Math.round(SHOW_MAX / 1024)} KB shown. <Button size="sm" onClick={() => setShowWhole(true)}>Show the whole file</Button> (Export JSON gives the file itself)
          </div>
        )}
      </div>
    </div>
  );
}

export default function EstimatedDutyCalculationSection({ ctx }) {
  const { allItems, esanchitDocs, jobData, reportView } = ctx;
  return (
    <>
      {reportView === 'duty' && <EstimatedDuty ctx={ctx} />}
      {reportView === 'json' && <CachiPreview jobData={jobData} items={allItems} esanchitDocs={esanchitDocs} />}
    </>
  );
}
