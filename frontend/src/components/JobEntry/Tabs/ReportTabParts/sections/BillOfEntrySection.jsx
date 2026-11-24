// Screen section: BILL OF ENTRY CHECKLIST
// Split out of ReportTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';

export default function BillOfEntrySection({ ctx }) {
  const { Row, SectionHeader, jobData } = ctx;
  return (
    <>
    <h2 style={{ textAlign: 'center', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>BILL OF ENTRY CHECKLIST</h2>
                  <p style={{ textAlign: 'center', fontSize: '12px', marginBottom: '2rem' }}>Generated on: {new Date().toLocaleDateString('en-GB')} | Job No: {jobData?.jobNo || 'NEW'}</p>
                  
                  {/* SECTION 1 */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                    <tbody>
                      <SectionHeader title="1. Job Header & General Details" />
                      <Row label="Job No" value={jobData?.jobNo} />
                      <Row label="Job Date" value={jobData?.jobDate} />
                      <Row label="BE Type" value={jobData?.boeType} />
                      <Row label="Branch / Port Code" value={jobData?.branchCode} />
                      <Row label="Shipment Mode" value={jobData?.shipmentMode} />
                      <Row label="Port Code" value={jobData?.portCode || jobData?.autoField_2} />
                      <Row label="CHA Code" value={jobData?.chaCode || jobData?.autoField_3} />
                      <Row label="Kaccha BE" value={jobData?.kachchaBE || jobData?.kachaBe} />
                      <Row label="Branch Sr No" value={jobData?.branchSrNo || jobData?.autoField_48} />
                      {/* 30-Oct-2026: printed as "AEO Code", but this box is the importer's Authorised Dealer (bank)
                          code - it is filed as the BE header's authorizedEconomicDealerCode. The invoice-level AEO
                          code below is the separate Authorised Economic Operator field. */}
                      <Row label="AD Code (bank)" value={jobData?.aeoCode || jobData?.autoField_49} />
                      <Row label="Commercial Tax Type" value={jobData?.autoField_50 || jobData?.commercialTaxType} />
                      <Row label="Importer Type" value={jobData?.importerType} />
                      <Row label="Payment Method" value={jobData?.paymentMethodCode || jobData?.autoField_52} />
                    </tbody>
                  </table>

                  {/* SECTION 2 */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                    <tbody>
                      <SectionHeader title="2. Importer Details" />
                      <Row label="Importer Name" value={jobData?.nameOfImporter || jobData?.autoField_4} />
                      <Row label="IEC Code" value={jobData?.iecCode || jobData?.autoField_5} />
                      <Row label="Address Line 1" value={jobData?.address1 || jobData?.autoField_6} />
                      <Row label="Address Line 2" value={jobData?.address2 || jobData?.autoField_7} />
                      <Row label="City" value={jobData?.city || jobData?.autoField_8} />
                      <Row label="State" value={jobData?.state || jobData?.autoField_9} />
                      <Row label="Pin Code" value={jobData?.pin || jobData?.autoField_10} />
                      <Row label="State Code" value={jobData?.autoField_12} />
                      <Row label="Commercial Tax Reg No" value={jobData?.autoField_13} />
                    </tbody>
                  </table>

                  {/* SECTION 3 */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                    <tbody>
                      <SectionHeader title="3. Shipment / Transport Details" />
                      <Row label="MAWB / BL No" value={jobData?.mawbNo || jobData?.mawbblNo} />
                      <Row label="MAWB Date" value={jobData?.mawbDate || jobData?.autoField_15} />
                      <Row label="HAWB / HBL No" value={jobData?.hawbNo || jobData?.hawbhblNo} />
                      <Row label="HAWB Date" value={jobData?.hawbDate || jobData?.autoField_16} />
                      <Row label="IGM Number" value={jobData?.igmNumber || jobData?.igmNo} />
                      <Row label="IGM Date" value={jobData?.igmDate || jobData?.autoField_14} />
                      <Row label="Inward Date" value={jobData?.inwardDate || jobData?.autoField_17} />
                      <Row label="Country of Origin" value={jobData?.countryOfOrigin} />
                      <Row label="Port of Origin" value={jobData?.portOfOrigin || jobData?.origin} />
                      <Row label="Marks & Numbers" value={jobData?.marksAndNumbers1 || jobData?.marks1} />
                    </tbody>
                  </table>

                  {/* SECTION 4 */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                    <tbody>
                      <SectionHeader title="4. Bond & Certificate Details" />
                      <Row label="Bond Type" value={jobData?.bondType} />
                      <Row label="Bond No" value={jobData?.bondNo} />
                      <Row label="Bond Date" value={jobData?.bondDate} />
                      <Row label="Bond Amount" value={jobData?.bondAmount} />
                      <Row label="Certificate Type" value={jobData?.certificateType} />
                      <Row label="Certificate No" value={jobData?.certificateNo} />
                      <Row label="Certificate Date" value={jobData?.certificateDate} />
                      <Row label="Certificate Amount" value={jobData?.certificateAmount} />
                    </tbody>
                  </table>

                  {/* SECTION 5 */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <tbody>
                        <SectionHeader title="5. Invoice Details" />
                      </tbody>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                      <thead style={{ background: '#f8fafc', color: '#334155' }}>
                        <tr>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Sr No</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Invoice No</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Invoice Date</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Value</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Currency</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Terms</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Terms Place</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Freight</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Insurance</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Misc</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>HSS Load</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobData?.invoices?.length > 0 ? jobData.invoices.map((inv, i) => (
                          <React.Fragment key={i}>
                            <tr>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.invoiceSrNo}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.invNo || inv.invoiceNo}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.invDate}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.value || inv.invValue}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.currency}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.terms}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.termsPlace}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.freight}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.insurance}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.misc || inv.miscCharges}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{inv.hss || inv.hssLoadAmount}</td>
                            </tr>
                            <tr>
                              <td colSpan="11" style={{ border: '1px solid #cbd5e1', padding: '0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <tbody>
                                    <Row label="SVB Reference Number" value={inv.svbReferenceNumber} />
                                    <Row label="Whether Buyer/Seller Related" value={inv.whetherBuyerAndSellerAreRelated} />
                                    <Row label="Nature of Transaction" value={inv.natureOfTransaction} />
                                    <Row label="Valuation Method" value={inv.valuationMethod} />
                                    <Row label="Third Party Flag" value={inv.thirdPartyFlag} />
                                    {inv.thirdPartyFlag === 'Y' && (
                                      <>
                                        <Row label="Third Party Name" value={inv.thirdPartyName} />
                                        <Row label="Third Party Addr1" value={inv.thirdPartyAddress1} />
                                        <Row label="Third Party Addr2" value={inv.thirdPartyAddress2} />
                                        <Row label="Third Party City" value={inv.thirdPartyCity} />
                                        <Row label="Third Party SubDiv" value={inv.thirdPartyCntrySubDvsn} />
                                        <Row label="Third Party Country" value={inv.thirdPartyCountryName} />
                                      </>
                                    )}
                                    <Row label="AEO Flag" value={inv.aeoFlag} />
                                    {inv.aeoFlag === 'Y' && (
                                      <>
                                        <Row label="AEO Code" value={inv.aeoCode} />
                                        <Row label="AEO Role" value={inv.aeoRole} />
                                        <Row label="AEO Country" value={inv.aeoCountry} />
                                      </>
                                    )}
                                    <Row label="Additional Details Flag" value={inv.additionalDetailsFlag} />
                                    {inv.additionalDetailsFlag === 'Y' && (
                                      <>
                                        <Row label="Revenue Percent" value={inv.revenuePercent} />
                                        <Row label="Revenue Deposit On" value={inv.revenueDepositOn} />
                                        <Row label="Additional Desc" value={inv.additionalDescription} />
                                        <Row label="Buyer Seller Rel" value={inv.buyerSellerRelationship} />
                                        <Row label="Hand Carriage" value={inv.handCarriage} />
                                      </>
                                    )}
                                    <Row label="Misc Charges Included" value={inv.miscChargesIncluded} />
                                    <Row label="Misc Charges Not Included" value={inv.miscChargesNotIncluded} />
                                    <Row label="SVB Ref No (Invoice)" value={inv.svbRefNoInvoice} />
                                    <Row label="SVB Custom House Code 2" value={inv.svbCustomHouseCode2} />
                                    <Row label="SVB Load Type" value={inv.svbLoadType} />
                                    <Row label="Other Relevant Info" value={inv.otherRelevantInform} />
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

                  {/* SECTION 6 */}
    </>
  );
}
