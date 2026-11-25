// Shipper's Letter of Instruction, filled from the saved AWB.
import DocumentModal from './DocumentModal';
import { Caption, DocCheck, DocInput } from './docKit';
import { airportText, dmy, flightText, isPrepaid, joinFilled, kg } from './docFormat';

function FreightTerms({ doc }) {
  return (
    <>
      <DocCheck name="pp" checked={isPrepaid(doc)} label="Prepaid" />
      <DocCheck name="cc" checked={!isPrepaid(doc)} label="Collect" />
      <Caption className="tw:mt-[6px]">Currency</Caption>
      <DocInput name="cur" value={doc.currency} className="tw:w-[80px]" />
    </>
  );
}

function Insurance({ doc }) {
  const insurance = doc.declared.insurance;
  const insured = Boolean(insurance) && insurance !== 'XXX';
  return (
    <>
      <DocCheck name="insY" checked={insured} label="Yes" />
      <DocCheck name="insN" checked={!insured} label="No" /> Amount <DocInput name="ins" value={insured ? insurance : ''} className="tw:w-[120px]" />
    </>
  );
}

const SLI_SHEET = {
  title: "Shipper's Letter of Instruction",
  filePrefix: 'SLI',
  blocks: (doc, awbNumber) => [
    { kind: 'letterhead', small: true },
    { kind: 'title', text: "SHIPPER'S LETTER OF INSTRUCTION" },
    <div key="date" className="tw:mb-[6px] tw:text-right tw:text-[11px]">Date: <DocInput name="date" value={dmy(doc.today)} className="tw:w-[110px]" /></div>,
    {
      kind: 'fields', rows: [
        [
          { label: '1. Shipper (name and address)', name: 'shipper', value: doc.shipperBlock, lines: 5, className: 'tw:w-[50%]' },
          {
            label: 'Air Waybill No.', name: 'awb', value: doc.mawbNo || awbNumber,
            more: [{ label: 'House Waybill No.', name: 'hawb', value: doc.hawbNo }, { label: "Shipper's reference / invoice No.", name: 'ref', value: '' }],
          },
        ],
        [
          { label: '2. Consignee (name and address)', name: 'consignee', value: doc.consigneeBlock, lines: 5 },
          { label: '3. Notify party', name: 'notify', value: doc.notifyBlock || 'SAME AS CONSIGNEE', lines: 5 },
        ],
        [
          { label: 'Airport of departure', name: 'dep', value: airportText(doc.origin) },
          { label: 'Airport of destination', name: 'dest', value: airportText(doc.destination) },
        ],
        [
          { label: 'Airline / flight requested', name: 'flight', value: joinFilled([doc.airline.name, flightText(doc)], '  ') },
          { label: 'Freight', content: <FreightTerms doc={doc} /> },
        ],
        [
          { label: 'Declared value for carriage / for customs', name: 'dvc', value: `${doc.declared.carriage || 'NVD'} / ${doc.declared.customs || 'NCV'}` },
          { label: 'Insurance', content: <Insurance doc={doc} /> },
        ],
        [{ label: 'Handling information / special handling codes', name: 'handling', value: joinFilled([doc.handling, (doc.shc || []).join(' ')], '  '), colSpan: 2 }],
      ],
    },
    {
      kind: 'grid', className: 'tw:mt-[8px]',
      columns: ['Marks & numbers', 'No. of pcs', 'Gross wt (kg)', 'Dimensions (L x W x H)', 'Nature and quantity of goods'].map((header) => ({ header })),
      rows: [[
        { name: 'marks', value: doc.hawbNo || doc.awbNo, lines: 6, className: 'tw:w-[15%]' },
        { name: 'pcs', value: doc.pieces, lines: 6, className: 'tw:w-[10%]' },
        { name: 'gw', value: kg(doc.gross), lines: 6, className: 'tw:w-[12%]' },
        { name: 'dims', value: doc.dimsText || (doc.volume ? `Volume ${doc.volume} CBM` : ''), lines: 6, className: 'tw:w-[22%]' },
        { name: 'goods', value: joinFilled([doc.goods, (doc.hsCodes || []).length ? 'HS: ' + doc.hsCodes.join(', ') : ''], '\n'), lines: 6 },
      ]],
    },
    {
      kind: 'note', className: 'tw:leading-[1.45]',
      text: `I/We hereby authorise ${doc.company.name || 'the forwarding agent'} to prepare and sign the Air Waybill and all other documents needed for this shipment on my/our behalf. I/We certify that the particulars above are correct and that, unless declared on a Shipper's Declaration for Dangerous Goods, the consignment contains no dangerous goods as defined by the IATA Dangerous Goods Regulations.`,
    },
    { kind: 'sign', left: 'Name of shipper / company stamp', right: 'Signature and date' },
  ],
};

export default function SLIModal(props) {
  return <DocumentModal {...props} sheet={SLI_SHEET} />;
}
