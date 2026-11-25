// Time and temperature sensitive cargo instruction, filled from the saved AWB. The range is ticked from its special
// handling codes (COL / CRT / ERT / FRO, ICE for dry ice).
import DocumentModal from './DocumentModal';
import { Caption, DocInput } from './docKit';
import { dmy, firstLine, flightText, kg } from './docFormat';

const TEMPERATURE_RANGES = [['col', 'COL', 'COL  +2 to +8 °C'], ['crt', 'CRT', 'CRT  +15 to +25 °C'], ['ert', 'ERT', 'ERT  +2 to +25 °C'], ['fro', 'FRO', 'FRO  -20 °C or below']];

const TEMPERATURE_SHEET = {
  title: 'Temperature Control Instructions',
  filePrefix: 'Temperature',
  blocks: (doc, awbNumber) => {
    const codes = new Set(doc.shc || []);
    return [
      { kind: 'letterhead', small: true },
      { kind: 'title', text: 'TIME AND TEMPERATURE SENSITIVE CARGO' },
      { kind: 'subtitle', text: "Shipper's instructions (IATA TCR chapter 17)", className: 'tw:mb-[8px]' },
      {
        kind: 'fields', rows: [
          [
            { label: 'Air Waybill No.', name: 'awb', value: doc.mawbNo || awbNumber },
            { label: 'HAWB No.', name: 'hawb', value: doc.hawbNo },
            { label: 'Origin', name: 'org', value: doc.origin.code },
            { label: 'Destination', name: 'dst', value: doc.destination.code },
          ],
          [
            { label: 'Shipper', name: 'shipper', value: doc.shipper.name, colSpan: 2 },
            { label: 'Consignee', name: 'consignee', value: doc.consignee.name, colSpan: 2 },
          ],
          [
            { label: 'Pieces', name: 'pcs', value: doc.pieces },
            { label: 'Gross weight (kg)', name: 'gw', value: kg(doc.gross) },
            { label: 'Flight / date', name: 'flight', value: flightText(doc), colSpan: 2 },
          ],
          [{ label: 'Goods', name: 'goods', value: firstLine(doc.goods), colSpan: 4 }],
        ],
      },
      {
        kind: 'checks', label: 'Temperature range required', className: 'tw:mt-[8px]',
        items: TEMPERATURE_RANGES.map(([name, code, label]) => ({ name, checked: codes.has(code), label })),
        after: <div className="tw:mt-[6px]">Other range: <DocInput name="range" value="" className="tw:w-[200px]" /></div>,
      },
      {
        kind: 'checks', label: 'Packaging and cooling', className: 'tw:mt-[8px]',
        items: [
          { name: 'ice', checked: codes.has('ICE'), label: 'Dry ice (UN 1845)' },
          { name: 'gel', checked: false, label: 'Gel packs' },
          { name: 'active', checked: false, label: 'Active container' },
          { name: 'passive', checked: false, label: 'Passive / insulated box' },
        ],
        after: (
          <div className="tw:mt-[6px]">
            Dry ice per package (kg): <DocInput name="iceKg" value="" className="tw:w-[90px]" />{' '}
            Data logger No.: <DocInput name="logger" value="" className="tw:w-[140px]" />
          </div>
        ),
      },
      { kind: 'text', label: 'Instructions during transit / on delay', name: 'instr', value: '', lines: 3, className: 'tw:mt-[8px]' },
      <div key="emergency" className="tw:mt-[6px]"><Caption>24 x 7 emergency contact (name and phone)</Caption><DocInput name="emergency" value="" /></div>,
      { kind: 'sign', left: `Shipper: ${doc.shipper.name || ''}`, right: `Signature and date ${dmy(doc.today)}` },
    ];
  },
};

export default function TemperatureControlModal(props) {
  return <DocumentModal {...props} sheet={TEMPERATURE_SHEET} />;
}
