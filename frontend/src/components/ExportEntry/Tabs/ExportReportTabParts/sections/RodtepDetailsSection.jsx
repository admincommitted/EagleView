// S/B checklist, last part: RoDTEP claims, the totals, the declarations and "Prepared By".
import { ReportBody, ReportRow } from '../../../../JobEntry/Tabs/ReportTabParts/reportTable';
import { CheckCell, CheckListSection, CheckRule, CheckTable, KEEP_TOGETHER } from '../checklistParts';

const amountText = (value) => (parseFloat(value) || 0).toFixed(2);

const rodtepRateText = (row) => {
  const rate = row.noRate ? 'NOT IN MASTER' : (row.rsPerUqc && !row.rate ? `RS ${row.rsPerUqc}/${row.unit}` : row.rate.toFixed(3));
  return rate + (row.appendix === '4RE' ? ' (4RE)' : '');
};

const rodtepCells = (row) => [
  row.invSr, row.itemSr, amountText(row.fob), row.qty, row.unit, rodtepRateText(row), row.cap ? row.cap.toFixed(3) : '',
  row.amt === null || row.noQty ? 'QTY?' : amountText(row.amt),
];

function Declaration({ number, scheme }) {
  return (
    <>
      <p className="tw:my-[4px]">{number}. I / We, in regard to my/our claim under {scheme} scheme made in this Shipping Bill or Bill of Export, hereby declare that:</p>
      <p className="tw:my-[4px]">I. I / We undertake to abide by the provisions, including conditions, restrictions, exclusions and time-limits as provided under {scheme} scheme, and relevant notifications, regulations, etc., as amended from time to time.</p>
      <p className="tw:my-[4px]">II. Any claim made in this shipping bill or bill of export is not with respect to any duties or taxes or levies which are exempted or remitted or credited under any other mechanism outside {scheme}.</p>
      <p className="tw:my-[4px]">III. I / We undertake to preserve and make available relevant documents relating to the exported goods for the purposes of audit in the manner and for the time period prescribed in the Customs Audit Regulations, 2018.</p>
    </>
  );
}

export default function RodtepDetailsSection({ ctx }) {
  const { checklist, totals, exportData } = ctx;
  const claimedSchemes = [checklist.hasRodtep && 'RoDTEP', checklist.hasRosctl && 'RoSCTL'].filter(Boolean);
  const totalLines = [
    ['Factory Stuffed', /^Y/i.test(String(exportData?.factoryStuffed || '')) ? 'YES' : 'NO'],
    ['Total Inv. Value (FC)', checklist.invTotal],
    ['Total FOB (INR)', checklist.fobTotal],
    ['Total DBK(INR)', amountText(checklist.dbkTotal)],
    checklist.hasRosctl && ['Total RoSCTL(INR)', amountText(checklist.rosctlTotal)],
    checklist.hasRodtep && ['Total RoDTEP(INR)', amountText(checklist.rodtepTotal)],
    ['Total CESS(INR)', exportData?.cessAmount || '0.00'],
    ['Total PMV(INR)', totals.pmv],
    ['Total Taxable Amt (INR)', totals.taxable],
    ['Total IGST Amt (INR)', totals.igst],
  ].filter(Boolean);

  return (
    <>
      <CheckListSection
        title="RODTEP DETAILS"
        headings={['Inv Sr No.', 'Item Sr No.', 'FOB Value(INR)', 'Quantity', 'Unit', 'Rate %', 'Amount(Cap)', 'RODTEP Amount In(INR)']}
        rows={checklist.rodtepRows.map(rodtepCells)}
        emptyText="NO RODTEP CLAIM"
        totalText={`TOTAL RODTEP (INR) : ${amountText(checklist.rodtepTotal)}`}
      />

      <div className="tw:my-[16px] tw:flex">
        <div className="tw:w-[150px]" />
        <div className="tw:w-[400px]">
          <CheckTable className="tw:mb-0">
            <ReportBody>
              {totalLines.map(([label, value], index) => (
                <ReportRow key={label}>
                  <CheckCell look="line" className={index === 0 ? 'tw:w-[200px] tw:font-bold' : 'tw:font-bold'}>{label}</CheckCell>
                  <CheckCell look="line" align="center" className={index === 0 ? 'tw:w-[20px]' : undefined}>:</CheckCell>
                  <CheckCell look="line" align="right">{value}</CheckCell>
                </ReportRow>
              ))}
            </ReportBody>
          </CheckTable>
        </div>
      </div>

      <CheckRule />
      <div className={`${KEEP_TOGETHER} tw:mb-[8px] tw:p-[8px]`}>
        {claimedSchemes.length > 0 && (
          <>
            <div className="tw:mb-[8px] tw:font-bold tw:underline">DECLARATION</div>
            {claimedSchemes.map((scheme, index) => <Declaration key={scheme} number={index + 1} scheme={scheme} />)}
          </>
        )}
        <p className="tw:mt-[10px] tw:mb-[4px]">I / We declare that the particulars given herein are true and are correct. I / We undertake to abide by the provisions of Foreign Exchange Management Act, 1999, as amended from time to time, including realisation / repatriation of foreign exchange to / from India.</p>
        <p className="tw:mt-[16px] tw:mb-[4px] tw:text-right">Signature of Exporter/CHA With Date</p>
      </div>

      <div className="tw:mt-[20px] tw:text-[11px] tw:font-bold">
        Prepared By : {String(checklist.preparedBy || '').toUpperCase()}
      </div>
    </>
  );
}
