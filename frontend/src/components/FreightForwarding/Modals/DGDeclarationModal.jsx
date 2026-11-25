// Shipper's Declaration for Dangerous Goods (IATA DGR layout). Shipper, consignee, AWB and airports come from the saved
// AWB; the aircraft limitation is ticked from its special handling codes (CAO = cargo aircraft only, RRY / RRW / RRE =
// radioactive). The goods lines are typed.
import DocumentModal from './DocumentModal';
import { Caption, DocCheck, DocInput } from './docKit';
import { airportText, joinFilled, placeAndDate } from './docFormat';

const RADIOACTIVE_CODES = ['RRY', 'RRW', 'RRE'];
const GOODS_COLUMNS = [
  { header: 'UN or ID No.', className: 'tw:w-[9%]', field: 'un' },
  { header: 'Proper shipping name', className: 'tw:w-[27%]', field: 'psn', lines: 2 },
  { header: 'Class or division (subsidiary hazard)', className: 'tw:w-[12%]', field: 'cls' },
  { header: 'Packing group', className: 'tw:w-[8%]', field: 'pg' },
  { header: 'Quantity and type of packing', className: 'tw:w-[22%]', field: 'qty', lines: 2 },
  { header: 'Packing instruction', className: 'tw:w-[9%]', field: 'pi' },
  { header: 'Authorisation', className: 'tw:w-[13%]', field: 'auth' },
];
const GOODS_LINES = [0, 1, 2, 3, 4];

function PageLine() {
  return (
    <>
      <DocInput name="page" value="1" className="tw:w-[40px]" /> of <DocInput name="pages" value="1" className="tw:w-[40px]" /> pages{' '}
      <span className="tw:ml-[20px]">Shipper&apos;s reference No.</span> <DocInput name="ref" value="" className="tw:w-[140px]" />
    </>
  );
}

function TransportDetails({ doc, cargoOnly }) {
  return (
    <>
      <DocCheck name="pax" checked={!cargoOnly} label="PASSENGER AND CARGO AIRCRAFT" />
      <DocCheck name="cao" checked={cargoOnly} label="CARGO AIRCRAFT ONLY" />
      <div className="tw:mt-[6px] tw:flex tw:gap-[10px]">
        <div className="tw:flex-1"><Caption>Airport of departure (optional)</Caption><DocInput name="dep" value={airportText(doc.origin)} /></div>
      </div>
    </>
  );
}

const DGD_SHEET = {
  title: "Shipper's Declaration for Dangerous Goods",
  filePrefix: 'DGD',
  landscape: true,
  frameClassName: 'tw:border-4 tw:border-solid tw:border-[#b91c1c] tw:p-[8px]',
  blocks: (doc, awbNumber) => {
    const codes = new Set(doc.shc || []);
    const cargoOnly = codes.has('CAO');
    const radioactive = RADIOACTIVE_CODES.some((code) => codes.has(code));
    return [
      {
        kind: 'fields', rows: [
          [
            { label: 'Shipper', name: 'shipper', value: doc.shipperBlock, lines: 5, rowSpan: 2, className: 'tw:w-[50%]' },
            { label: 'Air Waybill No.', name: 'awb', value: joinFilled([doc.mawbNo || awbNumber, doc.hawbNo ? 'HAWB ' + doc.hawbNo : ''], ' / ') },
          ],
          [{ label: 'Page', content: <PageLine /> }],
          [
            { label: 'Consignee', name: 'consignee', value: doc.consigneeBlock, lines: 5 },
            {
              className: 'tw:text-[10px] tw:text-[#b91c1c]',
              content: <><b>WARNING</b><br />Failure to comply in all respects with the applicable Dangerous Goods Regulations may be in breach of the applicable law, subject to legal penalties.</>,
            },
          ],
          [
            { label: 'Transport details - this shipment is within the limitations prescribed for (delete non-applicable)', content: <TransportDetails doc={doc} cargoOnly={cargoOnly} /> },
            {
              label: 'Shipment type (delete non-applicable)',
              content: <><DocCheck name="nonRad" checked={!radioactive} label="NON-RADIOACTIVE" /><DocCheck name="rad" checked={radioactive} label="RADIOACTIVE" /></>,
            },
          ],
          [{ label: 'Airport of destination', name: 'dest', value: airportText(doc.destination), colSpan: 2 }],
        ],
      },
      <div key="goods-title" className="tw:mt-[8px] tw:mb-[4px] tw:text-[11px] tw:font-bold">NATURE AND QUANTITY OF DANGEROUS GOODS</div>,
      {
        kind: 'grid', headClassName: 'tw:bg-[#fee2e2] tw:text-left tw:text-[9.5px]', columns: GOODS_COLUMNS,
        rows: GOODS_LINES.map((line) => GOODS_COLUMNS.map((column) => ({ name: `${column.field}${line}`, value: '', lines: column.lines }))),
      },
      {
        kind: 'text', label: 'Additional handling information', name: 'handling', lines: 2, className: 'tw:mt-[8px]',
        value: joinFilled([doc.handling, (doc.shc || []).length ? 'SHC: ' + doc.shc.join(' ') : ''], '\n'),
      },
      <div key="emergency" className="tw:mt-[4px]">24-hour emergency contact: <DocInput name="emergency" value="" className="tw:w-[50%]" /></div>,
      {
        kind: 'fields', className: 'tw:mt-[8px]', rows: [[
          {
            className: 'tw:w-[60%] tw:text-[10px]',
            content: 'I hereby declare that the contents of this consignment are fully and accurately described above by the proper shipping name, and are classified, packaged, marked and labelled/placarded, and are in all respects in proper condition for transport according to applicable international and national governmental regulations. I declare that all of the applicable air transport requirements have been met.',
          },
          {
            label: 'Name / title of signatory', name: 'signatory', value: '',
            more: [{ label: 'Place and date', name: 'placeDate', value: placeAndDate(doc) }],
            content: <><Caption className="tw:mt-[6px]">Signature (see warning above)</Caption><div className="tw:h-[22px]" /></>,
          },
        ]],
      },
    ];
  },
};

export default function DGDeclarationModal(props) {
  return <DocumentModal {...props} sheet={DGD_SHEET} />;
}
