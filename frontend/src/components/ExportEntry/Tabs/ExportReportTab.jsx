import { cn } from '@/lib/utils';
import { ReportPage } from '../../JobEntry/Tabs/ReportTabParts/reportTable';
import useExportReportTab from './ExportReportTabParts/useExportReportTab';
import SBChecklistSection from './ExportReportTabParts/sections/SBChecklistSection';
import IndianCustomEdiSection from './ExportReportTabParts/sections/IndianCustomEdiSection';
import ItemNoSection from './ExportReportTabParts/sections/ItemNoSection';
import RodtepDetailsSection from './ExportReportTabParts/sections/RodtepDetailsSection';
import ExportReportPanel from './ExportReportTabParts/sections/ExportReportPanel';
import {
  InvoiceWiseReport, RodtepReport, DrawbackReport, LicenceReport, Ar4Report, ReExportReport, InvoiceParticularsReport, ShipmentReport, AnnexureReport,
  ContainerAnnexureReport, SwInfoReport, SupportingDocsReport,
} from './ExportReportTabParts/sections/ExportSimpleReports';

function SbChecklist({ ctx }) {
  return (
    <div ref={ctx.reportRef}>
      <ReportPage className="tw:mx-auto tw:box-border tw:max-w-[1000px] tw:text-[10px] tw:leading-[1.4] tw:[font-family:Arial,Helvetica,sans-serif] tw:print:max-w-none tw:print:text-[9.5px] tw:print:leading-[1.35]">
        <IndianCustomEdiSection ctx={ctx} />
        <ItemNoSection ctx={ctx} />
        <RodtepDetailsSection ctx={ctx} />
      </ReportPage>
    </div>
  );
}

const REPORT_VIEWS = {
  checklist: (ctx) => <SbChecklist ctx={ctx} />,
  invoicewise: ({ exportData, items }) => <InvoiceWiseReport d={exportData} items={items} />,
  rodtep: ({ exportData, items, rodteps }) => <RodtepReport d={exportData} items={items} rodteps={rodteps} />,
  dbk: ({ exportData, items, dbkItems }) => <DrawbackReport d={exportData} items={items} dbkItems={dbkItems} />,
  licence: ({ exportData, licenseItems }) => <LicenceReport d={exportData} licenseItems={licenseItems} />,
  ar4: ({ exportData, items }) => <Ar4Report d={exportData} items={items} />,
  reexport: ({ exportData, items }) => <ReExportReport d={exportData} items={items} />,
  invparticulars: ({ exportData }) => <InvoiceParticularsReport d={exportData} />,
  shipment: ({ exportData, containers }) => <ShipmentReport d={exportData} containers={containers} />,
  annexure: ({ exportData, items, dbkItems }) => <AnnexureReport d={exportData} items={items} dbkItems={dbkItems} />,
  contannex: ({ exportData, containers }) => <ContainerAnnexureReport d={exportData} containers={containers} />,
  swinfo: ({ exportData, singleWindow }) => <SwInfoReport d={exportData} singleWindow={singleWindow} />,
  docs: ({ exportData, items }) => <SupportingDocsReport d={exportData} items={items} />,
};

function SbJsonPreview({ sbJson }) {
  const issues = sbJson?.validation ? [...sbJson.validation.errors, ...sbJson.validation.warnings] : [];
  return (
    <div className="tw:flex-1 tw:overflow-auto tw:bg-page tw:p-2 tw:text-entry tw:md:p-4">
      {(!sbJson || sbJson.loading) && <div className="tw:text-muted-foreground">Building the CACHE01 JSON...</div>}
      {sbJson?.error && <div className="tw:font-semibold tw:text-destructive">Could not build the JSON: {sbJson.error}</div>}
      {issues.length > 0 && (
        <div className="tw:mb-2 tw:rounded-md tw:border tw:border-destructive/30 tw:bg-card tw:px-2.5 tw:py-2">
          <b className={sbJson.validation.errors.length ? 'tw:text-destructive' : 'tw:text-warning'}>
            {sbJson.validation.errors.length} error(s), {sbJson.validation.warnings.length} warning(s)
          </b>
          <ul className="tw:mt-1 tw:mb-0 tw:ml-4 tw:p-0">
            {issues.slice(0, 30).map((issue, index) => <li key={index}>{issue}</li>)}
          </ul>
        </div>
      )}
      {sbJson?.json && (
        <pre className="tw:m-0 tw:overflow-x-auto tw:rounded-md tw:bg-foreground tw:p-4 tw:font-mono tw:text-entry tw:text-background tw:normal-case">
          {JSON.stringify(sbJson.json, null, 2)}
        </pre>
      )}
    </div>
  );
}

// The report shown is printed from #report-print-area in its own frame (printReport), so the screen panels around it
// (.no-print) stay out of the print.
export default function ExportReportTab() {
  const ctx = useExportReportTab();
  const { viewMode, sbJson, reportType, refreshKey } = ctx;
  const renderReport = REPORT_VIEWS[reportType];

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:gap-4">
      <div className="glass-panel tw:flex tw:flex-1 tw:flex-col tw:overflow-hidden">
        <SBChecklistSection ctx={ctx} />

        {viewMode === 'JSON' ? <SbJsonPreview sbJson={sbJson} /> : (
          <div className="tw:flex-1 tw:overflow-y-auto tw:bg-page tw:p-2 tw:md:p-4">
            <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:flex-wrap tw:lg:items-start">
              <div className="tw:h-[420px] tw:w-full tw:lg:sticky tw:lg:top-0 tw:lg:h-[calc(100vh-230px)] tw:lg:min-h-[420px] tw:lg:w-auto tw:lg:max-w-full tw:lg:flex-[0_0_330px]">
                <ExportReportPanel ctx={ctx} />
              </div>
              <div className={cn(
                'tw:w-full tw:min-w-0 tw:overflow-x-auto tw:rounded-[4px] tw:border tw:border-[#cbd5e1] tw:bg-white tw:p-3 tw:text-black',
                'tw:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] tw:md:p-5 tw:lg:w-auto tw:lg:flex-[1_1_600px]',
              )}>
                <div id="report-print-area" key={`${reportType}:${refreshKey}`}>
                  {renderReport?.(ctx)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
