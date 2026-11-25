// Shipper's certification for live animals, filled from the saved AWB.
import DocumentModal from './DocumentModal';
import { DocInput } from './docKit';
import { airportText, dMonY, firstLine, flightText } from './docFormat';

const ANIMAL_LINES = [0, 1, 2, 3];

const AVI_SHEET = {
  title: "Live Animals - Shipper's Certification",
  filePrefix: 'AVI',
  blocks: (doc, awbNumber) => [
    { kind: 'title', text: "SHIPPER'S CERTIFICATION FOR LIVE ANIMALS" },
    { kind: 'subtitle', text: 'To be completed in duplicate - one copy stays with the airline, one goes with the animals (IATA Live Animals Regulations)' },
    {
      kind: 'fields', rows: [
        [
          { label: 'Air Waybill No.', name: 'awb', value: doc.mawbNo || awbNumber },
          { label: 'HAWB No.', name: 'hawb', value: doc.hawbNo },
          { label: 'Flight / date', name: 'flight', value: flightText(doc) },
        ],
        [
          { label: 'Airport of departure', name: 'dep', value: airportText(doc.origin) },
          { label: 'Airport of destination', name: 'dest', value: airportText(doc.destination), colSpan: 2 },
        ],
        [
          { label: 'Shipper', name: 'shipper', value: doc.shipperBlock, lines: 3, colSpan: 2 },
          { label: 'Consignee', name: 'consignee', value: doc.consigneeBlock, lines: 3 },
        ],
      ],
    },
    {
      kind: 'grid', className: 'tw:mt-[8px]',
      columns: [{ header: 'Number of animals' }, { header: 'Common name' }, { header: 'Scientific name' }, { header: 'Container (LAR No.)' }],
      rows: ANIMAL_LINES.map((line) => [
        { name: `qty${line}`, value: line === 0 ? doc.pieces : '', className: 'tw:w-[15%]' },
        { name: `common${line}`, value: line === 0 ? firstLine(doc.goods) : '' },
        { name: `sci${line}`, value: '' },
        { name: `cont${line}`, value: '', className: 'tw:w-[20%]' },
      ]),
    },
    { kind: 'text', label: 'Special feeding and watering instructions', name: 'feeding', value: '', lines: 3, className: 'tw:mt-[8px]' },
    {
      kind: 'checks', label: 'CITES', className: 'tw:mt-[8px]',
      items: [{ name: 'citesY', checked: false, label: 'Species covered by CITES' }, { name: 'citesN', checked: false, label: 'Not covered' }],
      after: (
        <>
          {' '}Permit No.: <DocInput name="permit" value="" className="tw:w-[160px]" />{' '}
          Health certificate No.: <DocInput name="health" value="" className="tw:w-[160px]" />
        </>
      ),
    },
    {
      kind: 'note', className: 'tw:leading-[1.45]',
      text: 'I certify that the animals above are in good health and fit to travel, that they are properly described, packed in containers that meet the IATA Live Animals Regulations, and that all export, transit and import requirements have been met.',
    },
    { kind: 'sign', left: `Name of shipper: ${doc.shipper.name || ''}`, right: `Signature and date ${dMonY(doc.today)}` },
  ],
};

export default function LiveAnimalCertModal(props) {
  return <DocumentModal {...props} sheet={AVI_SHEET} />;
}
