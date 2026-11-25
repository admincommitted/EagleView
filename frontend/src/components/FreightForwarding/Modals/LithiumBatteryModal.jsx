// Lithium battery declaration (Section II), filled from the saved AWB. The battery type is ticked from its special
// handling codes: ELI = lithium ion, ELM = lithium metal.
import DocumentModal from './DocumentModal';
import { DocInput } from './docKit';
import { dmy, firstLine, kg, routeText } from './docFormat';

const HANDLING_NOTES = [
  '- The packages are marked with the lithium battery mark.',
  '- Handle with care: a flammability hazard exists if a package is damaged.',
  '- If a package is damaged, inspect and repack it before it travels on.',
  '- The shipment complies with Section II of the applicable packing instruction.',
];

const LITHIUM_SHEET = {
  title: 'Lithium Battery Declaration',
  filePrefix: 'Lithium',
  blocks: (doc, awbNumber) => {
    const codes = new Set(doc.shc || []);
    return [
      { kind: 'letterhead', small: true },
      { kind: 'title', text: 'LITHIUM BATTERY DECLARATION' },
      { kind: 'subtitle', text: 'Lithium batteries shipped under Section II of the IATA Dangerous Goods Regulations (PI 965-970)' },
      {
        kind: 'fields', rows: [
          [
            { label: 'Air Waybill No.', name: 'awb', value: doc.mawbNo || awbNumber },
            { label: 'HAWB No.', name: 'hawb', value: doc.hawbNo },
            { label: 'Origin / destination', name: 'route', value: routeText(doc) },
          ],
          [
            { label: 'Shipper', name: 'shipper', value: doc.shipper.name, colSpan: 2 },
            { label: 'Pieces / gross kg', name: 'pcs', value: doc.pieces ? `${doc.pieces} / ${kg(doc.gross)}` : '' },
          ],
          [{ label: 'Goods', name: 'goods', value: firstLine(doc.goods), colSpan: 3 }],
        ],
      },
      {
        kind: 'checks', label: 'The packages contain', stacked: true, className: 'tw:mt-[8px] tw:leading-[2]',
        items: [
          { name: 'un3480', checked: false, label: 'UN 3480 - lithium ion batteries (PI 965)' },
          { name: 'un3481', checked: codes.has('ELI'), label: 'UN 3481 - lithium ion batteries packed with / contained in equipment (PI 966 / 967)' },
          { name: 'un3090', checked: false, label: 'UN 3090 - lithium metal batteries (PI 968)' },
          { name: 'un3091', checked: codes.has('ELM'), label: 'UN 3091 - lithium metal batteries packed with / contained in equipment (PI 969 / 970)' },
        ],
        after: (
          <div className="tw:mt-[4px]">
            Packing instruction: <DocInput name="pi" value="" className="tw:w-[80px]" />{' '}
            Watt-hour rating / lithium content per cell or battery: <DocInput name="wh" value="" className="tw:w-[120px]" />
          </div>
        ),
      },
      <div key="notes" className="tw:mt-[10px] tw:text-[10.5px] tw:leading-[1.5]">{HANDLING_NOTES.map((note) => <div key={note}>{note}</div>)}</div>,
      <div key="emergency" className="tw:mt-[10px]">Emergency contact (24 hours): <DocInput name="emergency" value="" className="tw:w-[60%]" /></div>,
      { kind: 'sign', left: `Name of shipper: ${doc.shipper.name || ''}`, right: `Signature and date ${dmy(doc.today)}` },
    ];
  },
};

export default function LithiumBatteryModal(props) {
  return <DocumentModal {...props} sheet={LITHIUM_SHEET} />;
}
