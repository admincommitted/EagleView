// Delivery Order (release letter to the airline / warehouse), filled from the saved AWB.
import DocumentModal from './DocumentModal';
import { Caption, DocCheck, DocInput } from './docKit';
import { dmy, flightText, joinFilled, kg, routeText } from './docFormat';

function BeforeRelease({ doc }) {
  const prepaid = /^P/i.test(doc.chargeCode || 'P');
  return (
    <>
      <Caption>Before release</Caption>
      <DocCheck name="cleared" checked={false} label="Customs cleared (BE / OOC)" />
      <DocCheck name="freight" checked={prepaid} label={prepaid ? 'Freight prepaid' : 'Freight collect received'} />
      <DocCheck name="doPaid" checked={false} label="D.O. charges paid" />
      <Caption className="tw:mt-[6px]">BE No. / date</Caption>
      <DocInput name="be" value="" className="tw:w-[50%]" />
    </>
  );
}

const DO_SHEET = {
  title: 'Delivery Order',
  filePrefix: 'DO',
  blocks: (doc, awbNumber) => [
    { kind: 'letterhead' },
    { kind: 'title', text: 'DELIVERY ORDER' },
    { kind: 'subtitle', text: 'AUTHORISATION TO RELEASE CARGO', className: 'tw:text-[10.5px]' },
    {
      kind: 'fields', rows: [[
        {
          label: 'To (airline / cargo terminal / warehouse in-charge)', name: 'to', lines: 4, className: 'tw:w-[55%]',
          value: joinFilled([doc.airline.name ? `${doc.airline.name} - CARGO` : '', doc.destination.name ? `${doc.destination.name} (${doc.destination.code})` : ''], '\n'),
        },
        {
          label: 'D.O. No.', name: 'doNo', value: `DO/${doc.hawbNo || String(doc.awbNo || '').replace(/\D/g, '').slice(-8)}`,
          more: [{ label: 'D.O. date', name: 'doDate', value: dmy(doc.today) }, { label: 'Valid till', name: 'valid', value: '' }],
        },
      ]],
    },
    {
      kind: 'note', className: 'tw:my-[10px] tw:text-[11px]',
      text: 'Please deliver the consignment below, arrived by the flight mentioned, to the consignee or their authorised customs broker on proof of identity and payment of your charges.',
    },
    {
      kind: 'fields', rows: [
        [
          { label: 'MAWB No.', name: 'mawb', value: doc.mawbNo || awbNumber, className: 'tw:w-[33%]' },
          { label: 'HAWB No.', name: 'hawb', value: doc.hawbNo, className: 'tw:w-[33%]' },
          { label: 'Flight / date', name: 'flight', value: flightText(doc) },
        ],
        [
          { label: 'From / to', name: 'route', value: routeText(doc) },
          { label: 'Pieces', name: 'pcs', value: doc.pieces },
          { label: 'Gross weight (kg)', name: 'gw', value: kg(doc.gross) },
        ],
        [{ label: 'Description of goods / marks and numbers', name: 'goods', value: doc.goods, lines: 3, colSpan: 3 }],
        [
          { label: 'Consignee (name and address)', name: 'consignee', value: doc.consigneeBlock, lines: 4, colSpan: 2 },
          { label: 'Customs broker / authorised person', name: 'cha', value: '', lines: 4 },
        ],
        [{ colSpan: 3, content: <BeforeRelease doc={doc} /> }],
      ],
    },
    { kind: 'sign', left: `For ${doc.company.name || 'the agent'} - authorised signatory and stamp`, right: 'Received by (consignee / broker) - name, signature, date' },
  ],
};

export default function DeliveryOrderModal(props) {
  return <DocumentModal {...props} sheet={DO_SHEET} />;
}
