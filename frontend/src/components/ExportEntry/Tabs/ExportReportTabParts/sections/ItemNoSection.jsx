// S/B checklist, second part: the items, then RoSCTL, licence, single window rows and drawback.
import { Fragment } from 'react';
import { ReportBody, ReportRow, ReportTableHeader } from '../../../../JobEntry/Tabs/ReportTabParts/reportTable';
import { igstPayStatusOf, toDashDate } from '../checklistData';
import { CheckCell, CheckFactLine, CheckHeadCell, CheckListSection, CheckTable, DASHED_HEAD } from '../checklistParts';

const amountText = (value) => (value === null || value === undefined || value === '' ? '' : (parseFloat(value) || 0).toFixed(2));
const fixed5 = (value) => parseFloat(value || 0).toFixed(5);
const MultiLine = ({ lines }) => lines.map((line, index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>);

const ITEM_HEADINGS = [
  ['Item No', 'Quantity', 'SQC/PCN No.', 'SION Grp Code'],
  [' ', 'Unit', 'Cp. Cd', 'SION Sr. No.'],
  ['RITC Code', 'Rate Per Unit', 'Item Cd.', 'SION ID NORM3'],
  [' ', 'Total Value', 'SION Quantity'],
  ['Description', 'FOB(FC)', 'FOB(INR)', 'SION Unit'],
  [' ', 'Scheme', 'FILE No'],
  ['REWARD', 'RoDTEP', 'License No', 'STR'],
];

function ItemBlock({ row }) {
  const { item } = row;
  const taxable = parseFloat(item?.taxableValue || 0).toFixed(2) + (row.igstRate ? ` (${row.igstRate}%)` : '');
  const cells = [
    [row.itemSr, item.qty],
    ['', row.unit],
    [item.ritc, row.rate],
    ['', `${row.total} ${row.currency}`],
    [item.desc || item.description, `${row.fobFc}${row.fobFc ? ' (' + row.currency + ')' : ''}`, `${row.fobInr}${row.fobInr ? ' (INR)' : ''}`],
    ['', String(row.scheme).split(' - ')[0]],
    [`REWARD(${row.reward})`, row.rosctl === 'Y' ? 'RoSCTL(Y)' : `RoDTEP(${row.rodtep})`],
  ];
  return (
    <>
      <ReportRow>
        <CheckCell look="line" colSpan={7} className="tw:font-bold">
          INV SR. NO. {row.invSr} &nbsp;&nbsp;&nbsp;&nbsp; INV. NO. {row.invNo} &nbsp;&nbsp;&nbsp;&nbsp; INV. DT. {row.invDate}
        </CheckCell>
      </ReportRow>
      <ReportRow>
        {cells.map((lines, index) => <CheckCell key={index}><MultiLine lines={lines} /></CheckCell>)}
      </ReportRow>
      <ReportRow>
        <CheckCell colSpan={7}>
          <CheckFactLine facts={[['PMV IS RS.:', row.unitPmv], ['TOTAL PMV IS RS.:', row.totalPmv], ['STR(N)']]} />
          <CheckFactLine
            facts={[
              ['SCHEME DESC .:', row.scheme], ['END USE OF ITEM:', item?.endUse || ''], ['IGST PAY STATUS:', igstPayStatusOf(item)],
              ['TAXABLE VALUE:', taxable], ['IGST AMT:', parseFloat(item?.igstAmt || 0).toFixed(2)],
            ]}
          />
          <CheckFactLine facts={[['MNF/PRO CODE TYPE:', row.mfgType], ['MNF/PRO/GRO CODE:', row.mfgCode], ['ACCESSORY STATUS:', row.accessory], ['TOTAL PKG:', row.totalPkg]]} />
          {row.mfgAddr && <div className="tw:py-[2px]"><strong>MNF/PRO ADDRESS:</strong> {row.mfgAddr}</div>}
          <CheckFactLine facts={[['SOURCE STATE:', row.sourceState], ['TRANSIT COUNTRY:', row.transitCountry], ['HAWB NO:', row.hawb]]} />
        </CheckCell>
      </ReportRow>
      <ReportRow>
        <CheckCell colSpan={7}>
          <hr className="tw:my-[4px] tw:border-0 tw:border-t tw:border-dotted tw:border-black" />
        </CheckCell>
      </ReportRow>
    </>
  );
}

// the heading is part of the table, so it is never left alone at the foot of a page
function ItemTable({ rows }) {
  return (
    <CheckTable>
      <ReportTableHeader>
        <ReportRow>
          <CheckHeadCell colSpan={7} className="tw:border-b tw:border-dashed tw:border-black">ITEM DETAILS</CheckHeadCell>
        </ReportRow>
        <ReportRow className="tw:border-b tw:border-solid tw:border-black">
          {ITEM_HEADINGS.map((lines, index) => <CheckHeadCell key={index}><MultiLine lines={lines} /></CheckHeadCell>)}
        </ReportRow>
      </ReportTableHeader>
      <ReportBody>
        {rows.map((row) => <ItemBlock key={row.item.id ?? row.index} row={row} />)}
        {rows.length === 0 && (
          <ReportRow>
            <CheckCell colSpan={7} align="center">No items found</CheckCell>
          </ReportRow>
        )}
      </ReportBody>
    </CheckTable>
  );
}

const rosctlCells = (row) => [
  row.inv, row.itm, row.slNo || 'NOT IN SCHEDULE',
  row.split && row.split.centralCap ? row.split.centralCap : '',
  row.split ? row.split.centralRate + '%' : '',
  row.split && row.split.stateCap ? row.split.stateCap : '',
  row.split ? row.split.stateRate + '%' : (row.scheduleRow ? row.rate + '%' : ''),
  `${row.qty} ${row.unit}`,
  row.noRow ? '' : (row.amt === null ? 'QTY?' : amountText(row.amt)),
];

const licenceCells = (licence) => [
  licence.licType || '', licence.regNo || '', toDashDate(licence.regDate), licence.invNo || '', licence.itemNo || '', licence.snC || '', licence.snE || '',
  licence.expDesc || '', licence.expQty || '', licence.impDesc || '', licence.qty || '', licence.uqc || '', licence.indImp || '',
];

const drawbackCells = (dbk) => {
  const amount = dbk.amt === null ? (String(dbk.dbkWhy || '').trim() ? 'QTY?' : '') : dbk.amt.toFixed(2);
  const cap = parseFloat(dbk.dbkCap || 0) ? 'CAP ' + parseFloat(dbk.dbkCap).toFixed(2) + '/UNIT' : '';
  return [
    dbk.invNo || 1,
    dbk.itemNo || 1,
    <MultiLine key="dbkNo" lines={['', dbk.dbkNo || '']} />,
    <MultiLine key="cap" lines={['', cap, '']} />,
    <MultiLine key="amount" lines={[amount, fixed5(dbk.dbkRtAdv), fixed5(dbk.dbkRtSpe)]} />,
    <MultiLine key="qty" lines={['', fixed5(dbk.dbkQty)]} />,
    <MultiLine key="unit" lines={['', dbk.accUnit || '']} />,
  ];
};

export default function ItemNoSection({ ctx }) {
  const { checklist, singleWindow, exportData, licenseItems, infoCodeText, docTypeText } = ctx;
  // the licence rows of the screen (the saved copy in exportData misses changes made since the last save)
  const licences = licenseItems?.length ? licenseItems : (exportData?.licenseItems || []);

  return (
    <>
      <ItemTable rows={checklist.itemRows} />

      <CheckListSection
        title="ROSCTL Details"
        headings={['Inv No', 'Item No', 'ROSCTL Sl. No.', 'Central Levy Cap (Rs/unit)', 'Central Levy Rate', 'State Levy Cap (Rs/unit)', 'State Levy Rate', 'ROSCTL Qty.', 'ROSCTL Amt.(Rs)']}
        rows={checklist.rosctlRows.map(rosctlCells)}
        emptyText="NO ROSCTL ITEMS"
        totalText={`TOTAL ROSCTL AMOUNT (INR): ${amountText(checklist.rosctlTotal)}`}
      />

      {licences.length > 0 && (
        <CheckListSection
          title="Licence Details"
          headings={['Lic Type', 'Reg No', 'Reg Dt', 'Inv Sno', 'Itm Sno', 'SlNo in C', 'SlNo in E', 'Export Item Details', 'Exp. Qty', 'Import Item Details', 'Qty', 'Unit', 'Imp/Ind']}
          rows={licences.map(licenceCells)}
        />
      )}

      <CheckListSection
        title="Single Window Statement"
        headings={['Inv No/Item No', 'Statement For', 'Statement Type', 'Statement Code']}
        headClassName={DASHED_HEAD}
        rows={singleWindow.statements.map((row) => [
          row.invItemNo, row.statementFor || row.stmtFor || '', row.statementType || row.stmtType || '', row.statementCode || row.stmtCode || row.statementText || '',
        ])}
        emptyText="NO SINGLE WINDOW STATEMENTS FOUND"
      />

      <CheckListSection
        title="Single Window Info"
        headings={['Inv No/Item No', 'Type', 'Qualifier', 'Code', 'Text', 'Measurement', 'Unit']}
        headClassName={DASHED_HEAD}
        rows={singleWindow.infos.map((row) => [
          row.invItemNo, row.type || '', row.qualifier || '', infoCodeText(row), row.text || '', row.measurement || (row.measurement === 0 ? '0' : ''), row.unit || '',
        ])}
        emptyText="NO SINGLE WINDOW INFO FOUND"
      />

      <CheckListSection
        title="Single Window Supporting Document"
        headings={['Inv No/Item No', 'Statement For', 'Irn No', 'Doc Type', 'Issued Party', 'Ref No', 'Place', 'Issue Dt', 'Exp Dt', 'Bnf Party', 'File Name', 'E-Sanchit/Cega Id']}
        headClassName={DASHED_HEAD}
        rows={singleWindow.docs.map((row) => [
          row.invItemNo, row.statementFor || '', row.irnNo || row.irn || '', docTypeText(row.docType || row.documentType || ''), row.issuedParty || '',
          row.refNo || row.referenceNo || '', row.place || '', row.issueDt || row.issueDate || '', row.expDt || row.expiryDate || '',
          row.bnfParty || row.beneficiaryParty || '', row.fileName || row.file || '', row.ceSanchitId || row.sanchitId || '',
        ])}
        emptyText="NO SUPPORTING DOCUMENTS FOUND"
      />

      <CheckListSection
        title="DRAWBACK DETAILS"
        headings={['Inv No', 'Item No', <MultiLine key="no" lines={['Main DBK Sr No', 'DBK Sr No']} />, <MultiLine key="cap" lines={['', 'DBK Cap (Rs/unit)']} />,
          <MultiLine key="amount" lines={['Total DBK Amt. For Item(INR)', 'DBK Adv.', 'DBK Rate Spec.']} />, 'DBK Qty', 'DBK Unit']}
        rows={checklist.dbkRows.map(drawbackCells)}
        cellLook="line"
        cellClassName="tw:text-center"
        emptyText="NO DRAWBACK DETAILS FOUND"
        totalText={`TOTAL DRAWBACK (INR): ${checklist.dbkTotal.toFixed(2)}`}
      />
    </>
  );
}
