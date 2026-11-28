import useReportTab from './ReportTabParts/useReportTab';
import { ReportNote } from './ReportTabParts/reportTable';
import { missingIgstNote } from './ReportTabParts/sections/reportFormat';
import BEChecklistSection from './ReportTabParts/sections/BEChecklistSection';
import BillOfEntrySection from './ReportTabParts/sections/BillOfEntrySection';
import Part3Section from './ReportTabParts/sections/Part3Section';
import EstimatedDutyCalculationSection from './ReportTabParts/sections/EstimatedDutyCalculationSection';
import ImportChecklistEAnnex from './ReportTabParts/sections/ImportChecklistEAnnex';
import GetReportPanel from './ReportTabParts/sections/GetReportPanel';
import { AdcSheetReport, StampDutySheetReport } from './ReportTabParts/sections/SheetReports';
import { ChaChecklistReport, DutySheetReport, AnnexureReport, SupportingDocsReport, InvoiceWiseChecklistReport, ClassificationReport, ExemptionReport, InvoiceParticularsReport, IgmDetailsReport, ContainerReport, BondReport } from './ReportTabParts/sections/SimpleReports';

// reports that add up the duty of the items (the Checklist takes a missing rate from the Tariff master itself)
const DUTY_REPORTS = ['chachecklist', 'invoicewise', 'dutysheet'];

const REPORT_VIEWS = {
  fields: (ctx) => <><BillOfEntrySection ctx={ctx} /><Part3Section ctx={ctx} /></>,
  eannex: ({ jobData, allItems, esanchitDocs, masters }) => <ImportChecklistEAnnex jobData={jobData} items={allItems} esanchitDocs={esanchitDocs} masters={masters} />,
  chachecklist: ({ jobData, allItems }) => <ChaChecklistReport jobData={jobData} items={allItems} />,
  invoicewise: ({ jobData, allItems }) => <InvoiceWiseChecklistReport jobData={jobData} items={allItems} />,
  dutysheet: ({ jobData, allItems }) => <DutySheetReport jobData={jobData} items={allItems} />,
  classification: ({ jobData, allItems }) => <ClassificationReport jobData={jobData} items={allItems} />,
  exemption: ({ jobData, allItems }) => <ExemptionReport jobData={jobData} items={allItems} />,
  invparticulars: ({ jobData }) => <InvoiceParticularsReport jobData={jobData} />,
  annexure: ({ jobData, allItems }) => <AnnexureReport jobData={jobData} items={allItems} />,
  igm: ({ jobData }) => <IgmDetailsReport jobData={jobData} />,
  containers: ({ jobData }) => <ContainerReport jobData={jobData} />,
  bond: ({ jobData }) => <BondReport jobData={jobData} />,
  docs: ({ jobData, esanchitDocs }) => <SupportingDocsReport jobData={jobData} docs={esanchitDocs} />,
  adc: ({ jobData, allItems }) => <AdcSheetReport jobData={jobData} items={allItems} />,
  stampduty: ({ jobData, allItems }) => <StampDutySheetReport jobData={jobData} items={allItems} />,
};

// The report shown is printed from #report-print-area in its own frame (printReport), so the screen panels around
// it (.no-print) stay out of the print.
// onDownloadBeFile: the CACHI01 file of the job, made as ACTIONS > Download BE File makes it (asks the ICEGATE ID)
export default function ReportTab({ onDownloadBeFile }) {
  const ctx = useReportTab();
  const { reportView, reportType, refreshKey } = ctx;
  const renderReport = REPORT_VIEWS[reportType];
  const igstNote = DUTY_REPORTS.includes(reportType) ? missingIgstNote(ctx.itemsWithoutIgst) : '';

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:gap-4">
      <div className="glass-panel no-print tw:flex tw:flex-1 tw:flex-col tw:overflow-hidden">
        <BEChecklistSection ctx={ctx} onDownloadBeFile={onDownloadBeFile} />
        <div className="tw:flex-1 tw:overflow-y-auto tw:bg-page tw:p-2 tw:md:p-4">
          {reportView === 'checklist' && (
            <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:flex-wrap tw:lg:items-start">
              <div className="tw:h-[420px] tw:w-full tw:lg:sticky tw:lg:top-0 tw:lg:h-[calc(100vh-230px)] tw:lg:min-h-[420px] tw:lg:w-auto tw:lg:max-w-full tw:lg:flex-[0_0_330px]">
                <GetReportPanel ctx={ctx} />
              </div>
              <div className="tw:w-full tw:min-w-0 tw:overflow-x-auto tw:rounded-[4px] tw:border tw:border-[#cbd5e1] tw:bg-white tw:p-3 tw:text-black tw:md:p-5 tw:lg:w-auto tw:lg:flex-[1_1_600px]">
                {igstNote && <ReportNote>{igstNote}</ReportNote>}
                <div id="report-print-area" key={`${reportType}:${refreshKey}`}>
                  {renderReport?.(ctx)}
                </div>
              </div>
            </div>
          )}

          <div id={reportView === 'duty' ? 'report-print-area' : undefined}>
            <EstimatedDutyCalculationSection ctx={ctx} />
          </div>
        </div>
      </div>
    </div>
  );
}
