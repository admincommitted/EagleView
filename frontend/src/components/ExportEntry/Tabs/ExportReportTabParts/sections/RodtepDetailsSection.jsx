// Screen section: RODTEP DETAILS
// Split out of ExportReportTab.jsx (28-Oct-2026).
// 12-Nov-2026: only the items that claim RoDTEP, with the rate / cap of the RoDTEP master and the amount (every item
// was listed with rate 0 and the item value as FOB); totals labelled (an unlabelled "Total" was the first invoice's
// value); the RoDTEP declaration only when RoDTEP is claimed, the RoSCTL declaration for scheme 60.
import React from 'react';

const f2 = (v) => (parseFloat(v) || 0).toFixed(2);

export default function RodtepDetailsSection({ ctx }) {
  const { ck, displayTotalIgst, displayTotalPmv, displayTotalTaxable, exportData, hrStyle, tdStyle } = ctx;
  return (
    <>
    <div className="section-avoid-break">
            <div style={{ color: '#000', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '5px', marginTop: '15px', textTransform: 'capitalize' }}>RODTEP DETAILS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Inv Sr No.</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Item Sr No.</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>FOB Value(INR)</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Quantity</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Unit</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Rate %</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Amount(Cap)</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>RODTEP Amount In(INR)</th>
                </tr>
              </thead>
              <tbody>
                {ck.rodtepRows.length > 0 ? (
                  ck.rodtepRows.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ border: 'none', padding: '6px' }}>{r.invSr}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{r.itemSr}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{f2(r.fob)}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{r.qty}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{r.unit}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{r.noRate ? 'NOT IN MASTER' : (r.rsPerUqc && !r.rate ? `RS ${r.rsPerUqc}/${r.unit}` : r.rate.toFixed(3))}{r.appendix === '4RE' ? ' (4RE)' : ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{r.cap ? r.cap.toFixed(3) : ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{r.amt === null || r.noQty ? 'QTY?' : f2(r.amt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="8" style={{...tdStyle, textAlign: 'center', padding: '8px', color: '#64748b'}}>NO RODTEP CLAIM</td></tr>
                )}
                <tr>
                  <td colSpan="8" style={{ textAlign: 'right', fontWeight: 'bold', padding: '1px 10px', borderTop: '1px solid #000' }}>
                    TOTAL RODTEP (INR) : {f2(ck.rodtepTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

            <div style={{ display: 'flex', marginTop: '16px', marginBottom: '16px' }}>
              <div style={{ width: '150px' }}></div>
              <div style={{ width: '400px' }}>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold', width: '200px' }}>Factory Stuffed</td>
                      <td style={{ ...tdStyle, textAlign: 'center', width: '20px' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{/^Y/i.test(String(exportData?.factoryStuffed || '')) ? 'YES' : 'NO'}</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total Inv. Value (FC)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{ck.invTotal}</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total FOB (INR)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{ck.fobTotal}</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total DBK(INR)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{f2(ck.dbkTotal)}</td>
                    </tr>
                    {ck.hasRosctl && <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total RoSCTL(INR)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{f2(ck.rosctlTotal)}</td>
                    </tr>}
                    {ck.hasRodtep && <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total RoDTEP(INR)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{f2(ck.rodtepTotal)}</td>
                    </tr>}
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total CESS(INR)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{exportData?.cessAmount || '0.00'}</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total PMV(INR)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{displayTotalPmv}</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total Taxable Amt (INR)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{displayTotalTaxable}</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total IGST Amt (INR)</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>:</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{displayTotalIgst}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <hr style={hrStyle} />
            <div className="section-avoid-break" style={{ padding: '8px', marginBottom: '8px' }}>
            {(ck.hasRodtep || ck.hasRosctl) && (<>
              <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '8px' }}>DECLARATION</div>
              {[ck.hasRodtep && 'RoDTEP', ck.hasRosctl && 'RoSCTL'].filter(Boolean).map((sch, n) => (
                <React.Fragment key={sch}>
                  <p style={{ margin: '4px 0' }}>{n + 1}. I / We, in regard to my/our claim under {sch} scheme made in this Shipping Bill or Bill of Export, hereby declare that:</p>
                  <p style={{ margin: '4px 0' }}>I. I / We undertake to abide by the provisions, including conditions, restrictions, exclusions and time-limits as provided under {sch} scheme, and relevant notifications, regulations, etc., as amended from time to time.</p>
                  <p style={{ margin: '4px 0' }}>II. Any claim made in this shipping bill or bill of export is not with respect to any duties or taxes or levies which are exempted or remitted or credited under any other mechanism outside {sch}.</p>
                  <p style={{ margin: '4px 0' }}>III. I / We undertake to preserve and make available relevant documents relating to the exported goods for the purposes of audit in the manner and for the time period prescribed in the Customs Audit Regulations, 2018.</p>
                </React.Fragment>
              ))}
            </>)}
              {/* 12-Nov-2026: the exporter's declaration printed on every iCAFFE checklist */}
              <p style={{ margin: '10px 0 4px 0' }}>I / We declare that the particulars given herein are true and are correct. I / We undertake to abide by the provisions of Foreign Exchange Management Act, 1999, as amended from time to time, including realisation / repatriation of foreign exchange to / from India.</p>
              <p style={{ margin: '16px 0 4px 0', textAlign: 'right' }}>Signature of Exporter/CHA With Date</p>
            </div>

            
            <div style={{ marginTop: '20px', fontSize: '11px', fontWeight: 'bold' }}>
              Prepared By : {String(ck.preparedBy || '').toUpperCase()}
            </div>
    </>
  );
}
