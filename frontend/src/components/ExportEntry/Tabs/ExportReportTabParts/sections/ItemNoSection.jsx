// Screen section: Item No
// Split out of ExportReportTab.jsx (28-Oct-2026).
// 12-Nov-2026: items print their own invoice no / date, FOB (FC) and FOB (INR) (the item value was printed in all three
// places), the scheme with its description, the reward / RoDTEP flags of the item (RoDTEP was always Y); RoSCTL rows
// for scheme 60; drawback rows with the rates / amounts worked out (they printed 0 while the total used DBK Rs).
import React from 'react';

const f2 = (v) => (v === null || v === undefined || v === '' ? '' : (parseFloat(v) || 0).toFixed(2));

export default function ItemNoSection({ ctx }) {
  const { ck, allSuppDocs, allSwInfos, allSwStatements, exportData, tdStyle } = ctx;
  const codeText = ctx.infoCodeText || ((r) => r.code || '');
  const docText = ctx.docTypeText || ((c) => c || '');
  const dmy = (v) => { const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(v || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || ''); };
  const items = ck.itemRows;
  // licence rows of the screen (the saved copy in exportData was printed: changes made since the last save were missing)
  const licList = (ctx.licenseItems && ctx.licenseItems.length ? ctx.licenseItems : (exportData?.licenseItems || []));
  return (
    <>
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                {/* 12-Nov-2026: the heading is part of the table, so it is never left alone at the foot of a page */}
                <tr><th colSpan="7" style={{ border: 'none', padding: '2px 0', textAlign: 'left', background: 'transparent', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px dashed #000' }}>ITEM DETAILS</th></tr>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Item No<br/>Quantity<br/>SQC/PCN No.<br/>SION Grp Code</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}> <br/>Unit<br/>Cp. Cd<br/>SION Sr. No.</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>RITC Code<br/>Rate Per Unit<br/>Item Cd.<br/>SION ID NORM3</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}> <br/>Total Value<br/>SION Quantity</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Description<br/>FOB(FC)<br/>FOB(INR)<br/>SION Unit</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}> <br/>Scheme<br/>FILE No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>REWARD<br/>RoDTEP<br/>License No<br/>STR</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((r) => { const item = r.it; return (
                  <React.Fragment key={item.id ?? r.idx}>
                    <tr>
                      <td colSpan="7" style={{...tdStyle, fontWeight: 'bold'}}>
                        INV SR. NO. {r.invSr} &nbsp;&nbsp;&nbsp;&nbsp; INV. NO. {r.invNo} &nbsp;&nbsp;&nbsp;&nbsp; INV. DT. {r.invDate}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '6px' }}>{r.itemSr}<br/>{item.qty}</td>
                      <td style={{ border: 'none', padding: '6px' }}><br/>{r.unit}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{item.ritc}<br/>{r.rate}</td>
                      <td style={{ border: 'none', padding: '6px' }}><br/>{r.total} {r.cur}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{item.desc || item.description}<br/>{r.fobFc}{r.fobFc ? ' (' + r.cur + ')' : ''}<br/>{r.fobInr}{r.fobInr ? ' (INR)' : ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}><br/>{String(r.scheme).split(' - ')[0]}</td>
                      <td style={{ border: 'none', padding: '6px' }}>REWARD({r.reward})<br/>{r.rosctl === 'Y' ? 'RoSCTL(Y)' : `RoDTEP(${r.rodtep})`}</td>
                    </tr>
                    <tr>
                      <td colSpan="7" style={{ border: 'none', padding: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span><strong>PMV IS RS.:</strong> {r.unitPmv}</span>
                          <span><strong>TOTAL PMV IS RS.:</strong> {r.totalPmv}</span>
                          <span><strong>STR(N)</strong></span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span><strong>SCHEME DESC .:</strong> {r.scheme}</span>
                          <span><strong>END USE OF ITEM:</strong> {item?.endUse || ''}</span>
                          <span><strong>IGST PAY STATUS:</strong> {parseFloat(item?.igstAmt || 0) > 0 ? 'PAYMENT' : (item?.igstPayStatus && item?.igstPayStatus !== 'Select' ? item.igstPayStatus : 'LUT')}</span>
                          <span><strong>TAXABLE VALUE:</strong> {parseFloat(item?.taxableValue || 0).toFixed(2)}{r.igstRate ? ` (${r.igstRate}%)` : ''}</span>
                          <span><strong>IGST AMT:</strong> {parseFloat(item?.igstAmt || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span><strong>MNF/PRO CODE TYPE:</strong> {r.mfgType}</span>
                          <span><strong>MNF/PRO/GRO CODE:</strong> {r.mfgCode}</span>
                          <span><strong>ACCESSORY STATUS:</strong> {r.accessory}</span>
                          <span><strong>TOTAL PKG:</strong> {r.totalPkg}</span>
                        </div>
                        {r.mfgAddr && <div style={{ padding: '2px 0' }}><strong>MNF/PRO ADDRESS:</strong> {r.mfgAddr}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span><strong>SOURCE STATE:</strong> {r.sourceState}</span>
                          <span><strong>TRANSIT COUNTRY:</strong> {r.transitCountry}</span>
                          <span><strong>HAWB NO:</strong> {r.hawb}</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="7">
                        <hr style={{ borderTop: '1px dotted #000', margin: '4px 0' }} />
                      </td>
                    </tr>
                  </React.Fragment>
                ); }) : (
                  <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No items found</td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* ROSCTL DETAILS (Wrapped to keep heading with table) */}
          <div className="section-avoid-break">
            <div style={{ color: '#000', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '5px', marginTop: '15px', textTransform: 'capitalize' }}>ROSCTL Details</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Inv No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Item No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>ROSCTL Sl. No.</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Central Levy Cap (Rs/unit)</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Central Levy Rate</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>State Levy Cap (Rs/unit)</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>State Levy Rate</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>ROSCTL Qty.</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>ROSCTL Amt.(Rs)</th>
                </tr>
              </thead>
              <tbody>
                {ck.rosctlRows.length === 0 && <tr><td colSpan="9" style={{...tdStyle, textAlign: 'center'}}>NO ROSCTL ITEMS</td></tr>}
                {ck.rosctlRows.map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ border: 'none', padding: '6px' }}>{r.inv}</td>
                    <td style={{ border: 'none', padding: '6px' }}>{r.itm}</td>
                    <td style={{ border: 'none', padding: '6px' }}>{r.slNo || 'NOT IN SCHEDULE'}</td>
                    <td style={{ border: 'none', padding: '6px' }}>{r.split && r.split.centralCap ? r.split.centralCap : ''}</td>
                    <td style={{ border: 'none', padding: '6px' }}>{r.split ? r.split.centralRate + '%' : ''}</td>
                    <td style={{ border: 'none', padding: '6px' }}>{r.split && r.split.stateCap ? r.split.stateCap : ''}</td>
                    <td style={{ border: 'none', padding: '6px' }}>{r.split ? r.split.stateRate + '%' : (r.m ? r.rate + '%' : '')}</td>
                    <td style={{ border: 'none', padding: '6px' }}>{r.qty} {r.unit}</td>
                    <td style={{ border: 'none', padding: '6px' }}>{r.noRow ? '' : (r.amt === null ? 'QTY?' : f2(r.amt))}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="9" style={{ textAlign: 'right', fontWeight: 'bold', padding: '1px 10px', borderTop: '1px solid #000' }}>TOTAL ROSCTL AMOUNT (INR): {f2(ck.rosctlTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* LICENCE DETAILS (Wrapped) - 12-Nov-2026: only when the job has licence rows (an empty table was printed) */}
          {licList.length > 0 && <div className="section-avoid-break">
            <div style={{ color: '#000', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '5px', marginTop: '15px', textTransform: 'capitalize' }}>Licence Details</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Lic Type</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Reg No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Reg Dt</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Inv Sno</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Itm Sno</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>SlNo in C</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>SlNo in E</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Export Item Details</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Exp. Qty</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Import Item Details</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Qty</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Unit</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Imp/Ind</th>
                </tr>
              </thead>
              <tbody>
                {(
                  licList.map((lic, idx) => (
                    <tr key={idx}>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.licType || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.regNo || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{dmy(lic.regDate)}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.invNo || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.itemNo || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.snC || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.snE || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.expDesc || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.expQty || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.impDesc || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.qty || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.uqc || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{lic.indImp || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>}

                    {/* SINGLE WINDOW STATEMENT (Wrapped) */}
          <div className="section-avoid-break">
            <div style={{ color: '#000', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '5px', marginTop: '15px', textTransform: 'capitalize' }}>Single Window Statement</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000' }}>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Inv No/Item No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Statement For</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Statement Type</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Statement Code</th>
                </tr>
              </thead>
              <tbody>
                {allSwStatements.length > 0 ? (
                  allSwStatements.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ border: 'none', padding: '6px' }}>{row.invItemNo}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.statementFor || row.stmtFor || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.statementType || row.stmtType || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.statementCode || row.stmtCode || row.statementText || ''}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" style={{...tdStyle, textAlign: "center"}}>NO SINGLE WINDOW STATEMENTS FOUND</td></tr>
                )}
              </tbody>
            </table>
          </div>

                    {/* SINGLE WINDOW INFO (Wrapped) */}
          <div className="section-avoid-break">
            <div style={{ color: '#000', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '5px', marginTop: '15px', textTransform: 'capitalize' }}>Single Window Info</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000' }}>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Inv No/Item No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Type</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Qualifier</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Code</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Text</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Measurement</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {allSwInfos.length > 0 ? (
                  allSwInfos.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ border: 'none', padding: '6px' }}>{row.invItemNo}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.type || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.qualifier || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{codeText(row)}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.text || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.measurement || (row.measurement === 0 ? '0' : '')}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.unit || ''}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" style={{...tdStyle, textAlign: "center"}}>NO SINGLE WINDOW INFO FOUND</td></tr>
                )}
              </tbody>
            </table>
          </div>

                    {/* SINGLE WINDOW SUPPORTING DOCUMENT (Wrapped) */}
          <div className="section-avoid-break">
            <div style={{ color: '#000', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '5px', marginTop: '15px', textTransform: 'capitalize' }}>Single Window Supporting Document</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000' }}>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Inv No/Item No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Statement For</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Irn No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Doc Type</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Issued Party</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Ref No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Place</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Issue Dt</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Exp Dt</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Bnf Party</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>File Name</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>E-Sanchit/Cega Id</th>
                </tr>
              </thead>
              <tbody>
                {allSuppDocs.length > 0 ? (
                  allSuppDocs.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ border: 'none', padding: '6px' }}>{row.invItemNo}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.statementFor || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.irnNo || row.irn || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{docText(row.docType || row.documentType || '')}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.issuedParty || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.refNo || row.referenceNo || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.place || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.issueDt || row.issueDate || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.expDt || row.expiryDate || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.bnfParty || row.beneficiaryParty || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.fileName || row.file || ''}</td>
                      <td style={{ border: 'none', padding: '6px' }}>{row.ceSanchitId || row.sanchitId || ''}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="12" style={{...tdStyle, textAlign: "center"}}>NO SUPPORTING DOCUMENTS FOUND</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* DRAWBACK DETAILS (Wrapped) */}
          <div className="section-avoid-break">
            <div style={{ color: '#000', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '5px', marginTop: '15px', textTransform: 'capitalize' }}>DRAWBACK DETAILS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Inv No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Item No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Main DBK Sr No<br/>DBK Sr No</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}><br/>DBK Cap (Rs/unit)</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>Total DBK Amt. For Item(INR)<br/>DBK Adv.<br/>DBK Rate Spec.</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>DBK Qty</th>
                  <th style={{ border: 'none', padding: '6px', textAlign: 'left', background: 'transparent' }}>DBK Unit</th>
                </tr>
              </thead>
              <tbody>
                {ck.dbkRows.length > 0 ? (
                  ck.dbkRows.map((dbk, idx) => (
                    <tr key={idx} style={{ borderBottom: 'none' }}>
                      <td style={{...tdStyle, verticalAlign: 'top', textAlign: 'center'}}>{dbk.invNo || 1}</td>
                      <td style={{...tdStyle, verticalAlign: 'top', textAlign: 'center'}}>{dbk.itemNo || 1}</td>
                      <td style={{...tdStyle, verticalAlign: 'top', textAlign: 'center'}}>
                        <br/>{dbk.dbkNo || ''}
                      </td>
                      <td style={{...tdStyle, verticalAlign: 'top', textAlign: 'center'}}>
                        <br/>{parseFloat(dbk.dbkCap || 0) ? 'CAP ' + parseFloat(dbk.dbkCap).toFixed(2) + '/UNIT' : ''}<br/>
                      </td>
                      <td style={{...tdStyle, verticalAlign: 'top', textAlign: 'center'}}>
                        {dbk.amt === null ? (String(dbk.dbkWhy || '').trim() ? 'QTY?' : '') : dbk.amt.toFixed(2)}<br/>{parseFloat(dbk.dbkRtAdv || 0).toFixed(5)}<br/>{parseFloat(dbk.dbkRtSpe || 0).toFixed(5)}
                      </td>
                      <td style={{...tdStyle, verticalAlign: 'top', textAlign: 'center'}}>
                        <br/>{parseFloat(dbk.dbkQty || 0).toFixed(5)}
                      </td>
                      <td style={{...tdStyle, verticalAlign: 'top', textAlign: 'center'}}>
                        <br/>{dbk.accUnit || ''}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" style={{...tdStyle, textAlign: "center"}}>NO DRAWBACK DETAILS FOUND</td></tr>
                )}
                <tr>
                  <td colSpan="7" style={{ textAlign: "right", fontWeight: "bold", padding: "1px 10px", borderTop: "1px solid #000" }}>TOTAL DRAWBACK (INR): {ck.dbkTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          

          {/* RODTEP DETAILS (Wrapped) */}
    </>
  );
}
