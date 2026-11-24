// Screen section: 6. Item Details
// Split out of ReportTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';

export default function Part3Section({ ctx }) {
  const { Row, SectionHeader, allItems, esanchitDocs, fmt, grandTotal, jobData, totalAdlCVD, totalAssessableValue, totalBCD, totalCVD, totalHealthCess, totalIGST, totalSAPTA, totalSWS } = ctx;
  return (
    <>
    <div style={{ marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <tbody>
                        <SectionHeader title="6. Item Details" />
                      </tbody>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                      <thead style={{ background: '#f8fafc', color: '#334155' }}>
                        <tr>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Sr No</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Inv Sr</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Description</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>HS Code</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>CTH</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>CETH</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Qty</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>UQC</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Unit Price</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Ass. Value</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Product Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allItems?.length > 0 ? allItems.map((item, i) => (
                          <React.Fragment key={i}>
                            <tr>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.itemSrNo || item.itemNo}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.invoiceSrNo}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.desc || item.productDescription}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.ritc || item.hsCode}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.cth}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.ceth}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.qty || item.quantity}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.unit || item.uqc}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.price || item.unitPrice}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.value || item.assessableValue}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.productCode}</td>
                            </tr>
                            <tr>
                              <td colSpan="11" style={{ border: '1px solid #cbd5e1', padding: '6px', background: '#f8fafc', color: '#475569' }}>
                                Rate Type Flag: {item.rateTypeFlag} | IGST Duty Flag: {item.igstDutyFlag} | SVB Flag: {item.svbFlag} | FOC: {item.foc} <br/>
                                SchemeCode: {item.schemeCodCategoryFlag} | Licence: {item.licenceFlag} | ReImport: {item.reImportFlag} | RSP Duty: {item.rspDutyFlag} | NCD: {item.ncdCustomDutyFlag} | AntiDumping: {item.antiDumpingDutyFlag} | OtherDuty: {item.otherDutyFlag}
                              </td>
                            </tr>
                            <tr>
                              <td colSpan="11" style={{ border: '1px solid #cbd5e1', padding: '0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead style={{ background: '#f1f5f9', color: '#334155' }}>
                                    <tr>
                                      <th style={{ border: '1px solid #cbd5e1', padding: '4px' }}>Duty Type</th>
                                      <th style={{ border: '1px solid #cbd5e1', padding: '4px' }}>Notif No</th>
                                      <th style={{ border: '1px solid #cbd5e1', padding: '4px' }}>Sr No</th>
                                      <th style={{ border: '1px solid #cbd5e1', padding: '4px' }}>Rate</th>
                                      <th style={{ border: '1px solid #cbd5e1', padding: '4px' }}>Flag</th>
                                      <th style={{ border: '1px solid #cbd5e1', padding: '4px' }}>Amount</th>
                                      <th style={{ border: '1px solid #cbd5e1', padding: '4px' }}>Unit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold' }}>BCD</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.bcdNotificationNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.bcdSrNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.bcdRate}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.bcdFlag}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.bcdAmount}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.bcdUnit}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold' }}>CVD</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.cvdNotificationNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.cvdSrNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.cvdRate}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.cvdFlag}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.cvdAmount}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.cvdUnit}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold' }}>Adl CVD</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.adlCvdNotificationNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.adlCvdSrNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.adlCvdRate}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.adlCvdFlag}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.adlCvdAmount}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.adlCvdUnit}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold' }}>SWS</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.swsNotificationNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.swsSrNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.swsRate}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.swsFlag}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.swsAmount}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.swsUnit}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold' }}>SAPTA</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.saptaNotificationNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.saptaSrNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.saptaRate}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.saptaFlag}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.saptaAmount}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.saptaUnit}</td>
                                    </tr>
                                    <tr>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px', fontWeight: 'bold' }}>Health Cess</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.healthCessNotificationNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.healthCessSrNo}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.healthCessRate}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.healthCessFlag}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.healthCessAmount}</td>
                                      <td style={{ border: '1px solid #cbd5e1', padding: '4px' }}>{item.healthCessUnit}</td>
                                    </tr>
                                    {item.igstData && (
                                      <tr>
                                        <td colSpan="7" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#fffae6' }}>
                                          <strong>IGST Data:</strong> Notif No: {item.igstData?.notnNo} | Sr No: {item.igstData?.srNo} | Rate: {item.igstData?.rate}% | Flag: {item.igstData?.flag} | Amount: {item.igstData?.amount}
                                        </td>
                                      </tr>
                                    )}
                                    {item.addData && (
                                      <tr>
                                        <td colSpan="7" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#fffae6' }}>
                                          <strong>Anti Dumping:</strong> Notif No: {item.addData?.notnNo} | Rate: {item.addData?.rate} | Amount: {item.addData?.amount} | CTH: {item.addData?.cth}
                                        </td>
                                      </tr>
                                    )}
                                    {item.otherDutyData && (
                                      <tr>
                                        <td colSpan="7" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#fffae6' }}>
                                          <strong>Other Duty:</strong> Code: {item.otherDutyData?.dutyCode} | Rate: {item.otherDutyData?.rate} | Amount: {item.otherDutyData?.amount}
                                        </td>
                                      </tr>
                                    )}
                                    {item.svbData && (
                                      <tr>
                                        <td colSpan="7" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#fffae6' }}>
                                          <strong>SVB Item:</strong> Ref No: {item.svbData?.refNo} | Date: {item.svbData?.date} | Load Duty: {item.svbData?.loadDuty} | Load Value: {item.svbData?.loadValue}
                                        </td>
                                      </tr>
                                    )}
                                    {item.policyParaData && (
                                      <tr>
                                        <td colSpan="7" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#fffae6' }}>
                                          <strong>Policy Para:</strong> Para No: {item.policyParaData?.paraNo} | Year: {item.policyParaData?.year}
                                        </td>
                                      </tr>
                                    )}
                                    {item.prevBeData && (
                                      <tr>
                                        <td colSpan="7" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#fffae6' }}>
                                          <strong>Previous BE:</strong> BE No: {item.prevBeData?.beNo} | Date: {item.prevBeData?.beDate} | Qty: {item.prevBeData?.qty} {item.prevBeData?.uqc}
                                        </td>
                                      </tr>
                                    )}
                                    {item.schemeCatData && Array.isArray(item.schemeCatData) && item.schemeCatData.length > 0 && (
                                      <tr>
                                        <td colSpan="7" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#fffae6' }}>
                                          <strong>Scheme Category:</strong>
                                          {item.schemeCatData.map((s,i) => <span key={i}> [{s.schemeCode} | Lic: {s.licenseNo} | Date: {s.date}]</span>)}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </React.Fragment>
                        )) : (
                          <tr><td colSpan="11" style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>No records</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SECTION 7 */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <tbody>
                        <SectionHeader title="7. Supporting Documents" />
                      </tbody>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                      <thead style={{ background: '#f8fafc', color: '#334155' }}>
                        <tr>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Sr No</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Doc Code</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>IRN</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>DRN</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>File Name</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>File Type</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Doc For</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Issuer Code</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Issuer Name</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Issue Date</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Expiry Date</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Applicable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {esanchitDocs?.length > 0 ? esanchitDocs.map((doc, i) => (
                          <React.Fragment key={i}>
                            <tr>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.srNo}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.docCode}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.irn}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.drn}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.fileName}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.fileType}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.docFor}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.issuerCode}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.issuerName}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.issueDate}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.expiryDate}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{doc.isApplicable}</td>
                            </tr>
                            <tr>
                              <td colSpan="12" style={{ border: '1px solid #cbd5e1', padding: '6px', background: '#f8fafc', color: '#475569' }}>
                                Issuer Address: {doc.issuerAddr1} {doc.issuerAddr2}, {doc.issuerCity} - {doc.issuerPin} <br/>
                                Bene Code: {doc.beneCode} | Bene Name: {doc.beneName} <br/>
                                Bene Address: {doc.beneAddr1} {doc.beneAddr2}, {doc.beneCity} - {doc.benePin} <br/>
                                Place of Issue: {doc.placeOfIssue} | Is Different ID: {doc.isDiffId}
                              </td>
                            </tr>
                          </React.Fragment>
                        )) : (
                          <tr><td colSpan="12" style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>No records</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SECTION 8 */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <tbody>
                        <SectionHeader title="8. Container Details" />
                      </tbody>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                      <thead style={{ background: '#f8fafc', color: '#334155' }}>
                        <tr>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Sr No</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Container No</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Seal No</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>LCL/FCL</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Size</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Type</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Truck No</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>IGM No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobData?.containers?.length > 0 ? jobData.containers.map((c, i) => (
                          <tr key={i}>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.srNo || c.containerSrNo}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.contNo || c.containerNo}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.sealNo}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.lclFcl}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.contSize || c.containerSize}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.contType || c.containerType}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.truckNo}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.igmNumber}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan="8" style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>No records</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SECTION 9 */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                    <tbody>
                      <SectionHeader title="9. Duty Summary" />
                      <Row label="Total Assessable Value" value={fmt(totalAssessableValue)} />
                      <Row label="Total BCD" value={fmt(totalBCD)} />
                      <Row label="Total SWS" value={fmt(totalSWS)} />
                      <Row label="Total IGST" value={fmt(totalIGST)} />
                      <Row label="Total CVD" value={fmt(totalCVD)} />
                      <Row label="Total Adl CVD" value={fmt(totalAdlCVD)} />
                      <Row label="Total Health Cess" value={fmt(totalHealthCess)} />
                      <Row label="Total SAPTA" value={fmt(totalSAPTA)} />
                      <tr>
                        <td style={{ border:'1px solid #cbd5e1', padding:'8px', width:'35%', background:'#1e3a5f', fontWeight:700, fontSize:'12px', color:'white' }}>GRAND TOTAL DUTY</td>
                        <td style={{ border:'1px solid #cbd5e1', padding:'8px', fontWeight:700, fontSize:'12px', color:'#1e3a5f' }}>{fmt(grandTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
    </>
  );
}
