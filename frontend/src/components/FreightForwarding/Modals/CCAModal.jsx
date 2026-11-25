// Cargo Charges Correction Advice: after the flight has left, corrections to a sent AWB go to the airline this way.
// The "as issued" side comes from the saved AWB; the revised side is typed.
import DocumentModal from './DocumentModal';
import { dmy, flightText, kg, money, routeText } from './docFormat';

function chargeRows(doc) {
  const charges = doc.charges || {};
  const rateLine = (doc.lines || [])[0] || {};
  const prepaid = /^P/i.test(doc.chargeCode || 'P');
  const side = (prepaidValue, collectValue) => money(prepaid ? prepaidValue : collectValue);
  return [
    ['Pieces', doc.pieces], ['Gross weight (kg)', kg(doc.gross)], ['Chargeable weight (kg)', kg(doc.chargeable)], ['Rate class', rateLine.rateClass],
    ['Rate / charge', rateLine.rate ? money(rateLine.rate) : ''], ['Weight charge', side(charges.weightPP, charges.weightCC)],
    ['Valuation charge', side(charges.valPP, charges.valCC)], ['Tax', side(charges.taxPP, charges.taxCC)],
    ['Other charges due agent', side(charges.agentPP, charges.agentCC)], ['Other charges due carrier', side(charges.carrierPP, charges.carrierCC)],
    [`Total ${prepaid ? 'prepaid' : 'collect'}`, side(charges.totalPP, charges.totalCC)], ['Currency', doc.currency], ['Prepaid / collect', doc.chargeCode],
  ];
}

const CCA_SHEET = {
  title: 'Cargo Charges Correction Advice',
  filePrefix: 'CCA',
  blocks: (doc, awbNumber) => [
    { kind: 'letterhead', small: true },
    { kind: 'title', text: 'CARGO CHARGES CORRECTION ADVICE (CCA)' },
    {
      kind: 'fields', className: 'tw:mt-[8px]', rows: [
        [
          { label: 'Air Waybill No.', name: 'awb', value: doc.mawbNo || awbNumber },
          { label: 'HAWB No.', name: 'hawb', value: doc.hawbNo },
          { label: 'CCA No.', name: 'ccaNo', value: '' },
          { label: 'CCA date', name: 'ccaDate', value: dmy(doc.today) },
        ],
        [
          { label: 'Issuing carrier', name: 'carrier', value: doc.airline.name },
          { label: 'Origin / destination', name: 'route', value: routeText(doc) },
          { label: 'Flight / date', name: 'flight', value: flightText(doc) },
          { label: 'AWB date', name: 'awbDate', value: dmy(doc.executed.date || doc.date) },
        ],
        [{ label: 'To (station / office)', name: 'to', colSpan: 4, value: doc.destination.code ? `${doc.airline.name || 'AIRLINE'} - ${doc.destination.code}` : '' }],
      ],
    },
    {
      kind: 'grid', className: 'tw:mt-[10px]',
      columns: [{ header: 'Item' }, { header: 'As issued (from the AWB)' }, { header: 'Revised' }],
      rows: chargeRows(doc).map(([item, value], index) => [
        { content: item, className: 'tw:w-[34%]' },
        { name: `old${index}`, value },
        { name: `new${index}`, value: '' },
      ]),
    },
    { kind: 'text', label: 'Reason for correction', name: 'reason', value: '', lines: 3, className: 'tw:mt-[10px]' },
    { kind: 'text', label: 'Other changes (parties, routing, goods)', name: 'other', value: '', lines: 2, className: 'tw:mt-[6px]' },
    { kind: 'sign', left: `Issued by ${doc.company.name || ''}${doc.user ? ' - ' + doc.user : ''}`, right: 'Authorised signature and stamp' },
  ],
};

export default function CCAModal(props) {
  return <DocumentModal {...props} sheet={CCA_SHEET} />;
}
