// Booking confirmation to the shipper, filled from the saved AWB.
import DocumentModal from './DocumentModal';
import { DocInput } from './docKit';
import { airportText, dmy, joinFilled, kg, routeText } from './docFormat';

const SECTION_ROW = 'tw:bg-[#eef2f7] tw:font-bold';

const routingText = (doc) => {
  const stops = [doc.origin.code, ...(doc.routing || []).map((leg) => leg.to)];
  return stops.filter((stop, index) => stop && stops.indexOf(stop) === index).join(' - ') || routeText(doc);
};

function BookingHeader({ doc }) {
  return (
    <div className="tw:mt-[6px] tw:mb-[10px] tw:flex tw:justify-between tw:text-[11px]">
      <span>Ref: <DocInput name="ref" value={doc.hawbNo || doc.awbNo} className="tw:w-[160px]" /></span>
      <span>Date: <DocInput name="date" value={dmy(doc.today)} className="tw:w-[110px]" /></span>
    </div>
  );
}

const BOOKING_SHEET = {
  title: 'Booking Confirmation',
  filePrefix: 'Booking',
  blocks: (doc, awbNumber) => {
    const [firstFlight = {}, secondFlight = {}] = doc.flights || [];
    const destination = doc.destination.name ? `${doc.destination.name} (${doc.destination.code})` : doc.destination.code;
    return [
      { kind: 'letterhead' },
      { kind: 'title', text: 'BOOKING CONFIRMATION' },
      <BookingHeader key="header" doc={doc} />,
      {
        kind: 'fields', rows: [[
          { label: 'To (shipper)', name: 'to', value: doc.shipperBlock, lines: 4, className: 'tw:w-[50%]' },
          { label: 'Consignee / destination', name: 'cnee', value: joinFilled([doc.consignee.name, destination], '\n'), lines: 4 },
        ]],
      },
      {
        kind: 'note', className: 'tw:my-[10px] tw:text-[11px]',
        text: <>Dear Sir / Madam,<br />We confirm the space booked for your shipment as below. Please deliver the cargo and documents before the cut-off times.</>,
      },
      {
        kind: 'fields', rows: [
          [{ content: 'FLIGHT AND ROUTING', colSpan: 4, className: SECTION_ROW }],
          [
            { label: 'Airline', name: 'airline', value: doc.airline.name ? `${doc.airline.name}${doc.airline.code ? ' (' + doc.airline.code + ')' : ''}` : '' },
            { label: 'MAWB No.', name: 'mawb', value: doc.mawbNo || awbNumber },
            { label: 'HAWB No.', name: 'hawb', value: doc.hawbNo },
            { label: 'From / to', name: 'route', value: routingText(doc) },
          ],
          [
            { label: 'Flight 1 / date', name: 'f1', value: firstFlight.flight ? `${firstFlight.flight} / ${dmy(firstFlight.date)}${firstFlight.time ? ' ' + firstFlight.time : ''}` : '' },
            { label: 'Flight 2 / date', name: 'f2', value: secondFlight.flight ? `${secondFlight.flight} / ${dmy(secondFlight.date)}` : '' },
            { label: 'Cargo cut-off', name: 'cargoCut', value: '' },
            { label: 'Documents cut-off', name: 'docCut', value: '' },
          ],
          [
            { label: 'Airport of departure', name: 'dep', value: airportText(doc.origin), colSpan: 2 },
            { label: 'Deliver cargo at (terminal / warehouse)', name: 'terminal', value: '', colSpan: 2 },
          ],
          [{ content: 'CARGO', colSpan: 4, className: SECTION_ROW }],
          [
            { label: 'Pieces', name: 'pcs', value: doc.pieces },
            { label: 'Gross weight (kg)', name: 'gw', value: kg(doc.gross) },
            { label: 'Chargeable weight (kg)', name: 'cw', value: kg(doc.chargeable) },
            { label: 'Volume (CBM)', name: 'vol', value: doc.volume || '' },
          ],
          [
            { label: 'Commodity', name: 'goods', value: doc.goods, lines: 2, colSpan: 3 },
            { label: 'Special handling', name: 'shc', value: (doc.shc || []).join(' ') },
          ],
          [{ label: 'Dimensions', name: 'dims', value: doc.dimsText, lines: 2, colSpan: 4 }],
        ],
      },
      { kind: 'note', text: "The booking is subject to the airline's confirmation and conditions of carriage. Dangerous goods, temperature-controlled or oversized cargo must be declared before acceptance." },
      { kind: 'sign', left: doc.user ? `Prepared by ${doc.user}` : 'Prepared by', right: `For ${doc.company.name || 'the agent'} - authorised signatory` },
    ];
  },
};

export default function BookingConfirmationModal(props) {
  return <DocumentModal {...props} sheet={BOOKING_SHEET} />;
}
