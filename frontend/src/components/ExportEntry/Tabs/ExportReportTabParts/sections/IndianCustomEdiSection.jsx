// Screen section: INDIAN CUSTOM EDI SYSTEM/EXPORT (ICES/E)
// Split out of ExportReportTab.jsx (28-Oct-2026).
// 12-Nov-2026: values come from ctx.ck (useExportReportTab), read from the fields the screens use - Nature Cargo
// printed the User Job No, Exp Type was always MERCHANT, GSTIN / PAN / branch / job date / SB date / FOB were blank,
// the CHA code was printed twice; every invoice is printed (only the first one was, as "1 of 1").
import React from 'react';

const L = { border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' };
const V = { border: 'none', padding: '6px' };

export default function IndianCustomEdiSection({ ctx }) {
  const { ck, chaDisplayName, containers, displayTotalIgst, displayTotalTaxable, exportData, hrStyle, tdStyle, thStyle } = ctx;
  const d = exportData || {};
  const invs = ck.invoices;
  const dbkOfInv = (k) => ck.dbkRows.filter(r => String(r.invNo || r.invSr || 1) === String(k + 1)).reduce((a, r) => a + (r.amt || 0), 0);
  return (
    <>
    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '15px' }}>
        <div>INDIAN CUSTOM EDI SYSTEM/EXPORT (ICES/E)</div>
        <div>Shipping bill for Export</div>
        {ck.chaName && <div style={{ marginTop: '5px' }}>{ck.chaName}</div>}
        <div style={ck.chaName ? undefined : { marginTop: '5px' }}>{ck.cha || chaDisplayName}</div>
      </div>
      {(ck.schemes.length > 0 || d.jobNo) && (
        <div style={{ margin: '5px 0', fontWeight: 'bold' }}>Scheme Desc : {ck.schemes.length ? ck.schemes.join(', ') : '—'}</div>
      )}
    </div>

            {/* META INFO GRID */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <tbody>
                <tr>
                  <td style={L}>Job No</td><td style={V}>{d.jobNo || ''}</td>
                  <td style={L}>Job Dt</td><td style={V}>{ck.jobDate}</td>
                  <td style={L}>User Job No</td><td style={V}>{ck.userJobNo}</td>
                </tr>
                <tr>
                  <td style={L}>SB No</td><td style={V}>{ck.sbNo}</td>
                  <td style={L}>SB Dt</td><td style={V}>{ck.sbDate}</td>
                  <td style={L}></td><td style={V}></td>
                </tr>
                <tr>
                  <td style={L}>Port of Loading</td><td style={V}>{ck.loadPort}</td>
                  <td style={L}></td><td style={V}></td>
                  <td style={L}>CHA</td><td style={V}>{ck.cha}{ck.chaName ? ' ' + ck.chaName : ''}</td>
                </tr>
                <tr>
                  <td style={L}></td><td style={V}></td>
                  <td style={L}></td><td style={V}></td>
                  <td style={L}>State/Orig</td><td style={V}>{d.stateOriginName || d.stateOriginCode || ''}</td>
                </tr>
              </tbody>
            </table>

            <hr style={hrStyle} />

            {/* PARTIES */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ width: '48%' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>EXPORTER DETAILS</div>
                <div>{ck.iec}</div>
                <div>Branch Code : {ck.branch}</div>
                <div>GSTIN Type : {({ GSTIN: 'GSN' })[String(ck.gstinType || '').toUpperCase()] || ck.gstinType}</div>
                <div>GSTIN Id : {ck.gstinId}</div>
                <div>PAN No : {ck.pan}</div>
                <div>Exp Type : {ck.expType}</div>
                <div style={{ fontWeight: 'bold' }}>{d.shipperName || ''}</div>
                <div>{d.shipperAddress1 || ''} {d.shipperAddress2 || ''}</div>
                <div>{d.shipperCity || ''} {d.shipperState || ''} {d.shipperPin || ''}</div>
              </div>
              <div style={{ width: '48%' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>CONSIGNEE DETAILS</div>
                <div>{d.consigneeName || ''}</div>
                <div>{d.consigneeAddress1 || ''}</div>
                <div>{d.consigneeAddress2 || ''}</div>
                <div>{d.consigneeAddress3 || ''} {d.consigneeAddress4 || ''}</div>
                <div>{ck.consigneeCountry}</div>
              </div>
            </div>

            <hr style={hrStyle} />

            {/* GENERAL SHIPMENT */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <tbody>
                <tr><td style={L}>Port of Loading</td><td colSpan="3" style={V}>{ck.loadPort}</td></tr>
                <tr>
                  <td style={L}>Country of Final Dest.</td><td style={V}>{ck.destCountry}</td>
                  <td style={L}>Port of Final Destination</td><td style={V}>{ck.destPort}</td>
                </tr>
                <tr>
                  <td style={L}>Discharge Country</td><td style={V}>{ck.discCountry}</td>
                  <td style={L}>Discharge Port</td><td style={V}>{ck.discPort}</td>
                </tr>
                <tr>
                  <td style={L}>Gross Wt.</td><td style={V}>{ck.gross}</td>
                  <td style={L}>Net Wt.</td><td style={V}>{ck.net}</td>
                </tr>
                <tr>
                  <td style={L}>Total Pkgs.</td><td style={V}>{ck.pkgs}</td>
                  <td style={L}>Loose Pkgs</td><td style={V}>{ck.loose}</td>
                </tr>
                <tr>
                  <td style={L}>Nature Cargo.</td><td style={V}>{ck.natureCargo}</td>
                  <td style={L}>No. Of Ctns.</td><td style={V}>{(d.Containers || []).length || containers?.length || 0}</td>
                </tr>
                <tr>
                  <td style={L}>{(d.shipmentMode || 'AIR') === 'SEA' ? 'Master BL No.' : 'Master AWB No.'}</td><td style={V}>{ck.mawb}</td>
                  <td style={L}>{(d.shipmentMode || 'AIR') === 'SEA' ? 'House BL No.' : 'House AWB No.'}</td><td style={V}>{ck.hawb}</td>
                </tr>
                <tr>
                  <td style={L}>DBK Bank A/C No</td><td style={V}>{d.drawbackAcNo || ''}</td>
                  <td style={L}>Forex Bank A/C No.</td><td style={V}>{d.forexCode || ''}</td>
                </tr>
                <tr>
                  <td style={L}>Service Tax Refund(Y/N)</td><td style={V}>{d.serviceTaxRefund || 'N'}</td>
                  <td style={L}>Ad Code</td><td style={V}>{d.adCode || ''}</td>
                </tr>
                <tr>
                  <td style={L}>RBI Wai. No / RBI Wai. Date</td><td style={V}>{[d.rbiWaiverNo, d.rbiWaiverDate].filter(Boolean).join(' / ')}</td>
                  <td style={L}>IFSC Code</td><td style={V}>{d.ifscCd || ''}</td>
                </tr>
                <tr>
                  <td style={L}>Marks & No.</td>
                  <td colSpan="3" style={V}>
                    {d.autoField_16 || ''}
                    {d.thisDisplayOnlyInChecklistNotInCustomFlatFile ? <><br/>{d.thisDisplayOnlyInChecklistNotInCustomFlatFile}</> : ''}
                  </td>
                </tr>
                <tr>
                  <td style={L}>Total Taxable Value</td><td style={V}>{displayTotalTaxable}</td>
                  <td style={L}>Total IGST Amt</td><td style={V}>{displayTotalIgst}</td>
                </tr>
              </tbody>
            </table>

            <hr style={hrStyle} />

            {/* INVOICE DETAILS - one block per invoice */}
            {invs.length === 0 && <div style={{ padding: '6px' }}>No invoice in this job</div>}
            {invs.map(({ inv, k, no, date, valInr, fobInr, fobFc, contract, rate, buyer, buyerAddr, charges }) => {
              const noIns = ['CF', 'FOB', 'EXW'].includes(contract);
              return (
                <div key={k} className="section-avoid-break">
                  <div style={{ color: '#000', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '5px', marginTop: '15px', textTransform: 'uppercase' }}>INVOICE DETAILS &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; INVOICE NO. {k + 1} of {invs.length}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                    <tbody>
                      <tr>
                        <td style={L}>Inv. Val</td><td style={V} colSpan="2">{valInr ? `${valInr} (INR)` : ''}</td>
                        <td style={V} colSpan="2">{inv.value || inv.invoiceValue || ''} {inv.currency ? `(${inv.currency})` : ''}</td>
                      </tr>
                      <tr>
                        <td style={L}>FOB Val (INR)</td><td style={V} colSpan="2">{fobInr}</td>
                        <td style={L}>FOB FC</td><td style={V}>{fobFc ? `${fobFc} (${inv.currency || ''})` : ''}</td>
                      </tr>
                      <tr>
                        <td style={L}>Add Freight</td><td style={V} colSpan="2">{inv.addFreight || d.AddFreightInsurance || ({ CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' })[contract] || ''}</td>
                        <td style={L}>DBK Val</td><td style={V}>{dbkOfInv(k).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={L}>INVOICE NO.</td><td style={{ ...tdStyle, fontWeight: 'bold' }} colSpan="2">{no}</td>
                        <td style={L}>INVOICE DATE</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{date}</td>
                      </tr>
                      <tr>
                        <td style={L}>Inv Curr</td><td style={V} colSpan="2">{inv.currency || ''}</td>
                        <td style={L}>Nature Of Contract</td><td style={V}>{contract}</td>
                      </tr>
                      <tr>
                        <td style={L}>Exchange Rate</td><td style={V} colSpan="2">{rate}</td>
                        <td style={L}>Contract No.</td><td style={V}>{inv.contractNo || ''}</td>
                      </tr>
                    </tbody>
                  </table>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', textAlign: 'right' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: 'left', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}></th>
                        <th style={{ ...thStyle, textAlign: 'right', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>RATE</th>
                        <th style={{ ...thStyle, textAlign: 'right', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>CUR</th>
                        <th style={{ ...thStyle, textAlign: 'right', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map(c => {
                        const hide = c.l === 'Insurance' && noIns;
                        return (
                          <tr key={c.l}>
                            <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold' }}>{c.l}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{hide ? '' : c.r}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{hide ? '' : c.c}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{hide ? '' : c.a}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                    <tbody>
                      <tr>
                        <td style={L}>Nature of Payment</td><td style={V}>{String(inv.pymtNature || '').split('||')[0].trim()}</td>
                        <td style={L}>Payment Prd.</td><td style={V}>{inv.pymtPeriod ? inv.pymtPeriod + ' DAYS' : ''}</td>
                      </tr>
                      <tr>
                        <td style={L}>Buyer's Name & Address</td>
                        <td colSpan="3" style={V}>
                          {buyer ? <strong>{buyer}</strong> : (buyerAddr.length ? null : ': Same as Consignee')}
                          {buyerAddr.map((a, i) => <React.Fragment key={i}><br/>{a}</React.Fragment>)}
                        </td>
                      </tr>
                      {inv.thirdParty === 'Y' && inv.tpName && (
                        <tr>
                          <td style={L}>Third Party</td>
                          <td colSpan="3" style={V}>
                            <strong>{inv.tpName}</strong>
                            {[inv.tpAddress1, inv.tpAddress2, [inv.tpCity, inv.tpCntry].filter(Boolean).join(', ')].filter(Boolean).map((a, i) => <React.Fragment key={i}><br/>{a}</React.Fragment>)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div style={{ margin: '15px 0' }}></div>

            <hr style={{ ...hrStyle, borderTop: '4px solid #000' }} />
            {/* ITEM DETAILS heading: in the item table (ItemNoSection), so it is never left alone at the foot of a page */}
    </>
  );
}
