import React from 'react';
import useReportTab from './ReportTabParts/useReportTab';
import BEChecklistSection from './ReportTabParts/sections/BEChecklistSection';
import BillOfEntrySection from './ReportTabParts/sections/BillOfEntrySection';
import Part3Section from './ReportTabParts/sections/Part3Section';
import EstimatedDutyCalculationSection from './ReportTabParts/sections/EstimatedDutyCalculationSection';
import ImportChecklistEAnnex from './ReportTabParts/sections/ImportChecklistEAnnex';
import GetReportPanel from './ReportTabParts/sections/GetReportPanel';
import { AdcSheetReport, StampDutySheetReport } from './ReportTabParts/sections/SheetReports'; // 14-Nov-2026
import { ChaChecklistReport, DutySheetReport, AnnexureReport, SupportingDocsReport, InvoiceWiseChecklistReport, ClassificationReport, ExemptionReport, InvoiceParticularsReport, IgmDetailsReport, ContainerReport, BondReport } from './ReportTabParts/sections/SimpleReports';

// ReportTab: state/logic in ./ReportTabParts/use*.jsx, screen sections in ./ReportTabParts/sections/.
export default function ReportTab() {
  const ctx = {};
  Object.assign(ctx, useReportTab(ctx));
  const { reportView } = ctx;
  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
      {/* Top Half: Report Dashboard */}
      <div className="glass-panel no-print" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <BEChecklistSection ctx={ctx} />
        <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: 'var(--primary-bg-light, var(--primary-bg-light))' }}>
          
          {reportView === 'checklist' && (<>
              {/* Get Report (28-Oct-2026): pick the report; it is printed from #report-print-area in its own frame
                  (window.print() of the whole page printed a blank sheet: the report sat inside a .no-print panel) */}
              {/* report list on the left, the chosen report on the right (stacks on a narrow screen) */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 330px', maxWidth: '100%', position: 'sticky', top: 0, height: 'calc(100vh - 230px)', minHeight: '420px' }}>
                  <GetReportPanel ctx={ctx} />
                </div>
                <div style={{ flex: '1 1 600px', minWidth: 0, background: '#fff', padding: '1.25rem', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', color: '#000', overflowX: 'auto' }}>
                  <div id="report-print-area" key={ctx.reportType + ':' + ctx.refreshKey}>
                    {ctx.reportType === 'fields' && (<><BillOfEntrySection ctx={ctx} /><Part3Section ctx={ctx} /></>)}
                    {ctx.reportType === 'eannex' && <ImportChecklistEAnnex jobData={ctx.jobData} items={ctx.allItems} esanchitDocs={ctx.esanchitDocs} masters={ctx.masters} />}
                    {ctx.reportType === 'chachecklist' && <ChaChecklistReport jobData={ctx.jobData} items={ctx.allItems} />}
                    {ctx.reportType === 'invoicewise' && <InvoiceWiseChecklistReport jobData={ctx.jobData} items={ctx.allItems} />}
                    {ctx.reportType === 'dutysheet' && <DutySheetReport jobData={ctx.jobData} items={ctx.allItems} />}
                    {ctx.reportType === 'classification' && <ClassificationReport jobData={ctx.jobData} items={ctx.allItems} />}
                    {ctx.reportType === 'exemption' && <ExemptionReport jobData={ctx.jobData} items={ctx.allItems} />}
                    {ctx.reportType === 'invparticulars' && <InvoiceParticularsReport jobData={ctx.jobData} />}
                    {ctx.reportType === 'annexure' && <AnnexureReport jobData={ctx.jobData} items={ctx.allItems} />}
                    {ctx.reportType === 'igm' && <IgmDetailsReport jobData={ctx.jobData} />}
                    {ctx.reportType === 'containers' && <ContainerReport jobData={ctx.jobData} />}
                    {ctx.reportType === 'bond' && <BondReport jobData={ctx.jobData} />}
                    {ctx.reportType === 'docs' && <SupportingDocsReport jobData={ctx.jobData} docs={ctx.esanchitDocs} />}
                    {ctx.reportType === 'adc' && <AdcSheetReport jobData={ctx.jobData} items={ctx.allItems} />}
                    {ctx.reportType === 'stampduty' && <StampDutySheetReport jobData={ctx.jobData} items={ctx.allItems} />}
                  </div>
                </div>
              </div>
            </>)}

          <div id={reportView === 'duty' ? 'report-print-area' : undefined}>
            <EstimatedDutyCalculationSection ctx={ctx} />
          </div>

        </div>
      </div>
    </div>;
}
