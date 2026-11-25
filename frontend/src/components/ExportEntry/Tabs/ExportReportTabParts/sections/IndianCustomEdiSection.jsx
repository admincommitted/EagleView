// S/B checklist, first part: title, job / SB facts, exporter and consignee, shipment facts and one block per invoice.
import { Fragment } from 'react';
import { ReportBody, ReportRow, ReportTableHeader } from '../../../../JobEntry/Tabs/ReportTabParts/reportTable';
import { hidesInsurance } from '../checklistData';
import { CheckCell, CheckFieldTable, CheckHeadCell, CheckRule, CheckSectionTitle, CheckTable, KEEP_TOGETHER } from '../checklistParts';

const GSTIN_TYPE_CODES = { GSTIN: 'GSN' };
const ADD_FREIGHT_BY_CONTRACT = { CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' };
const CHARGE_HEADINGS = ['', 'RATE', 'CUR', 'AMOUNT'];

const LinesBelow = ({ lines }) => lines.map((line, index) => <Fragment key={index}><br />{line}</Fragment>);

function PartyBlock({ title, children }) {
  return (
    <div className="tw:w-[48%]">
      <div className="tw:mb-[4px] tw:font-bold">{title}</div>
      {children}
    </div>
  );
}

function InvoiceBlock({ invoiceRow, invoiceCount, job, dbkValue }) {
  const { invoice, index, no, date, valInr, fobInr, fobFc, contract, rate, buyer, buyerAddr, charges } = invoiceRow;
  const noInsurance = hidesInsurance(contract);
  const thirdPartyLines = [invoice.tpAddress1, invoice.tpAddress2, [invoice.tpCity, invoice.tpCntry].filter(Boolean).join(', ')].filter(Boolean);
  const boldValue = (value, colSpan) => ({ value, colSpan, look: 'line', className: 'tw:font-bold' });
  return (
    <div className={KEEP_TOGETHER}>
      <CheckSectionTitle className="tw:uppercase">INVOICE DETAILS &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; INVOICE NO. {index + 1} of {invoiceCount}</CheckSectionTitle>
      <CheckFieldTable
        rows={[
          ['Inv. Val', { value: valInr ? `${valInr} (INR)` : '', colSpan: 2 }, { value: `${invoice.value || invoice.invoiceValue || ''} ${invoice.currency ? `(${invoice.currency})` : ''}`, colSpan: 2 }],
          ['FOB Val (INR)', { value: fobInr, colSpan: 2 }, 'FOB FC', fobFc ? `${fobFc} (${invoice.currency || ''})` : ''],
          ['Add Freight', { value: invoice.addFreight || job.AddFreightInsurance || ADD_FREIGHT_BY_CONTRACT[contract] || '', colSpan: 2 }, 'DBK Val', dbkValue.toFixed(2)],
          ['INVOICE NO.', boldValue(no, 2), 'INVOICE DATE', boldValue(date)],
          ['Inv Curr', { value: invoice.currency || '', colSpan: 2 }, 'Nature Of Contract', contract],
          ['Exchange Rate', { value: rate, colSpan: 2 }, 'Contract No.', invoice.contractNo || ''],
        ]}
      />

      <CheckTable>
        <ReportTableHeader>
          <ReportRow className="tw:border-y tw:border-solid tw:border-black">
            {CHARGE_HEADINGS.map((heading, position) => (
              <CheckHeadCell key={position} look="line" align={position ? 'right' : 'left'}>{heading}</CheckHeadCell>
            ))}
          </ReportRow>
        </ReportTableHeader>
        <ReportBody>
          {charges.map((charge) => {
            const hide = charge.label === 'Insurance' && noInsurance;
            return (
              <ReportRow key={charge.label}>
                <CheckCell look="line" align="left" className="tw:font-bold">{charge.label}</CheckCell>
                <CheckCell look="line" align="right">{hide ? '' : charge.rate}</CheckCell>
                <CheckCell look="line" align="right">{hide ? '' : charge.currency}</CheckCell>
                <CheckCell look="line" align="right">{hide ? '' : charge.amount}</CheckCell>
              </ReportRow>
            );
          })}
        </ReportBody>
      </CheckTable>

      <CheckFieldTable
        rows={[
          ['Nature of Payment', String(invoice.pymtNature || '').split('||')[0].trim(), 'Payment Prd.', invoice.pymtPeriod ? invoice.pymtPeriod + ' DAYS' : ''],
          ["Buyer's Name & Address", {
            colSpan: 3,
            value: <>{buyer ? <strong>{buyer}</strong> : (buyerAddr.length ? null : ': Same as Consignee')}<LinesBelow lines={buyerAddr} /></>,
          }],
          ...(invoice.thirdParty === 'Y' && invoice.tpName
            ? [['Third Party', { colSpan: 3, value: <><strong>{invoice.tpName}</strong><LinesBelow lines={thirdPartyLines} /></> }]]
            : []),
        ]}
      />
    </div>
  );
}

export default function IndianCustomEdiSection({ ctx }) {
  const { checklist, chaDisplayName, containers, totals, exportData } = ctx;
  const job = exportData || {};
  const isSea = (job.shipmentMode || 'AIR') === 'SEA';
  const dbkOfInvoice = (index) => checklist.dbkRows
    .filter((row) => String(row.invNo || row.invSr || 1) === String(index + 1))
    .reduce((sum, row) => sum + (row.amt || 0), 0);
  const marks = (
    <>
      {job.autoField_16 || ''}
      {job.thisDisplayOnlyInChecklistNotInCustomFlatFile ? <><br />{job.thisDisplayOnlyInChecklistNotInCustomFlatFile}</> : ''}
    </>
  );

  return (
    <>
      <div className="tw:mb-[10px] tw:text-center">
        <div className="tw:mb-[15px] tw:text-center tw:text-[14px] tw:font-bold">
          <div>INDIAN CUSTOM EDI SYSTEM/EXPORT (ICES/E)</div>
          <div>Shipping bill for Export</div>
          {checklist.chaName && <div className="tw:mt-[5px]">{checklist.chaName}</div>}
          <div className={checklist.chaName ? undefined : 'tw:mt-[5px]'}>{checklist.cha || chaDisplayName}</div>
        </div>
        {(checklist.schemes.length > 0 || job.jobNo) && (
          <div className="tw:my-[5px] tw:font-bold">Scheme Desc : {checklist.schemes.length ? checklist.schemes.join(', ') : '—'}</div>
        )}
      </div>

      <CheckFieldTable
        rows={[
          ['Job No', job.jobNo || '', 'Job Dt', checklist.jobDate, 'User Job No', checklist.userJobNo],
          ['SB No', checklist.sbNo, 'SB Dt', checklist.sbDate, '', ''],
          ['Port of Loading', checklist.loadPort, '', '', 'CHA', `${checklist.cha}${checklist.chaName ? ' ' + checklist.chaName : ''}`],
          ['', '', '', '', 'State/Orig', job.stateOriginName || job.stateOriginCode || ''],
        ]}
      />

      <CheckRule />

      <div className="tw:mb-[10px] tw:flex tw:justify-between">
        <PartyBlock title="EXPORTER DETAILS">
          <div>{checklist.iec}</div>
          <div>Branch Code : {checklist.branch}</div>
          <div>GSTIN Type : {GSTIN_TYPE_CODES[String(checklist.gstinType || '').toUpperCase()] || checklist.gstinType}</div>
          <div>GSTIN Id : {checklist.gstinId}</div>
          <div>PAN No : {checklist.pan}</div>
          <div>Exp Type : {checklist.expType}</div>
          <div className="tw:font-bold">{job.shipperName || ''}</div>
          <div>{job.shipperAddress1 || ''} {job.shipperAddress2 || ''}</div>
          <div>{job.shipperCity || ''} {job.shipperState || ''} {job.shipperPin || ''}</div>
        </PartyBlock>
        <PartyBlock title="CONSIGNEE DETAILS">
          <div>{job.consigneeName || ''}</div>
          <div>{job.consigneeAddress1 || ''}</div>
          <div>{job.consigneeAddress2 || ''}</div>
          <div>{job.consigneeAddress3 || ''} {job.consigneeAddress4 || ''}</div>
          <div>{checklist.consigneeCountry}</div>
        </PartyBlock>
      </div>

      <CheckRule />

      <CheckFieldTable
        rows={[
          ['Port of Loading', { value: checklist.loadPort, colSpan: 3 }],
          ['Country of Final Dest.', checklist.destCountry, 'Port of Final Destination', checklist.destPort],
          ['Discharge Country', checklist.discCountry, 'Discharge Port', checklist.discPort],
          ['Gross Wt.', checklist.gross, 'Net Wt.', checklist.net],
          ['Total Pkgs.', checklist.pkgs, 'Loose Pkgs', checklist.loose],
          ['Nature Cargo.', checklist.natureCargo, 'No. Of Ctns.', (job.Containers || []).length || containers?.length || 0],
          [isSea ? 'Master BL No.' : 'Master AWB No.', checklist.mawb, isSea ? 'House BL No.' : 'House AWB No.', checklist.hawb],
          ['DBK Bank A/C No', job.drawbackAcNo || '', 'Forex Bank A/C No.', job.forexCode || ''],
          ['Service Tax Refund(Y/N)', job.serviceTaxRefund || 'N', 'Ad Code', job.adCode || ''],
          ['RBI Wai. No / RBI Wai. Date', [job.rbiWaiverNo, job.rbiWaiverDate].filter(Boolean).join(' / '), 'IFSC Code', job.ifscCd || ''],
          ['Marks & No.', { value: marks, colSpan: 3 }],
          ['Total Taxable Value', totals.taxable, 'Total IGST Amt', totals.igst],
        ]}
      />

      <CheckRule />

      {checklist.invoices.length === 0 && <div className="tw:p-[6px]">No invoice in this job</div>}
      {checklist.invoices.map((invoiceRow) => (
        <InvoiceBlock key={invoiceRow.index} invoiceRow={invoiceRow} invoiceCount={checklist.invoices.length} job={job} dbkValue={dbkOfInvoice(invoiceRow.index)} />
      ))}

      <div className="tw:my-[15px]" />
      <CheckRule thick />
    </>
  );
}
