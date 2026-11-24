import React from 'react';
import useExportReportTab from './ExportReportTabParts/useExportReportTab';
import SBChecklistSection from './ExportReportTabParts/sections/SBChecklistSection';
import IndianCustomEdiSection from './ExportReportTabParts/sections/IndianCustomEdiSection';
import ItemNoSection from './ExportReportTabParts/sections/ItemNoSection';
import RodtepDetailsSection from './ExportReportTabParts/sections/RodtepDetailsSection';
import ExportReportPanel from './ExportReportTabParts/sections/ExportReportPanel';
import { InvoiceWiseReport, RodtepReport, DrawbackReport, LicenceReport, Ar4Report, ReExportReport, InvoiceParticularsReport, ShipmentReport, AnnexureReport, ContainerAnnexureReport, SwInfoReport, SupportingDocsReport } from './ExportReportTabParts/sections/ExportSimpleReports';

// ExportReportTab: state/logic in ./ExportReportTabParts/use*.jsx, screen sections in ./ExportReportTabParts/sections/.
// 29-Oct-2026: laid out like Import > Report - report list on the left, the chosen report on the right.
export default function ExportReportTab() {
  const ctx = {};
  Object.assign(ctx, useExportReportTab(ctx));
  const { reportRef, viewMode, sbJson, reportType, exportData: d, items, dbkItems, licenseItems, containers, rodteps } = ctx;
  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <SBChecklistSection ctx={ctx} />

          {viewMode === 'JSON' ? (
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem', background: 'var(--primary-bg-light)' }}>
              {(!sbJson || sbJson.loading) && <div style={{ fontSize: '12px', color: '#64748b' }}>Building the CACHE01 JSON...</div>}
              {sbJson && sbJson.error && <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>Could not build the JSON: {sbJson.error}</div>}
              {sbJson && sbJson.validation && (sbJson.validation.errors.length > 0 || sbJson.validation.warnings.length > 0) && (
                <div style={{ marginBottom: '8px', fontSize: '12px', background: '#fff', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 10px' }}>
                  <b style={{ color: sbJson.validation.errors.length ? '#b91c1c' : '#b45309' }}>{sbJson.validation.errors.length} error(s), {sbJson.validation.warnings.length} warning(s)</b>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{[...sbJson.validation.errors, ...sbJson.validation.warnings].slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              {sbJson && sbJson.json && (
                <pre style={{ margin: 0, background: '#0f172a', color: '#e2e8f0', padding: '1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', overflowX: 'auto', textTransform: 'none' }}>{JSON.stringify(sbJson.json, null, 2)}</pre>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: 'var(--primary-bg-light)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 330px', maxWidth: '100%', position: 'sticky', top: 0, height: 'calc(100vh - 230px)', minHeight: '420px' }}>
                  <ExportReportPanel ctx={ctx} />
                </div>
                <div style={{ flex: '1 1 600px', minWidth: 0, background: '#fff', padding: '1.25rem', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', color: '#000', overflowX: 'auto' }}>
                  <div id="report-print-area" key={reportType + ':' + ctx.refreshKey}>
                    {reportType === 'checklist' && (
                      <div ref={reportRef} className="printable-checklist" style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', margin: '0 auto', maxWidth: '1000px', fontSize: '10px', lineHeight: '1.4', boxSizing: 'border-box' }}>
                        <IndianCustomEdiSection ctx={ctx} />
                        <ItemNoSection ctx={ctx} />
                        <RodtepDetailsSection ctx={ctx} />
                      </div>
                    )}
                    {reportType === 'invoicewise' && <InvoiceWiseReport d={d} items={items} />}
                    {reportType === 'rodtep' && <RodtepReport d={d} items={items} rodteps={rodteps} />}
                    {reportType === 'dbk' && <DrawbackReport d={d} items={items} dbkItems={dbkItems} />}
                    {reportType === 'licence' && <LicenceReport d={d} licenseItems={licenseItems} />}
                    {reportType === 'ar4' && <Ar4Report d={d} items={items} />}
                    {reportType === 'reexport' && <ReExportReport d={d} items={items} />}
                    {reportType === 'invparticulars' && <InvoiceParticularsReport d={d} />}
                    {reportType === 'shipment' && <ShipmentReport d={d} containers={containers} />}
                    {reportType === 'annexure' && <AnnexureReport d={d} items={items} dbkItems={dbkItems} />}
                    {reportType === 'contannex' && <ContainerAnnexureReport d={d} containers={containers} />}
                    {reportType === 'swinfo' && <SwInfoReport d={d} items={items} />}
                    {reportType === 'docs' && <SupportingDocsReport d={d} items={items} />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
  </div>;
}
