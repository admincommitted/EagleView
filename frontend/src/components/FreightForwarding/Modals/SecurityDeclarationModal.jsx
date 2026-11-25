// Consignment security declaration (CSD), filled from the saved AWB; for a MAWB every live house is listed.
import DocumentModal from './DocumentModal';
import { Caption, DocCheck, DocInput, DocTextarea } from './docKit';
import { dmy, joinFilled, kg, routeText } from './docFormat';

const SECURITY_STATUS = [
  ['SPX', 'Secure for passenger, all-cargo and all-mail aircraft'],
  ['SCO', 'Secure for all-cargo and all-mail aircraft only'],
  ['SHR', 'Secure for passenger, all-cargo and all-mail aircraft - high risk requirements'],
];
const SCREENING_METHODS = [['XRY', 'X-ray'], ['EDS', 'Explosive detection system'], ['ETD', 'Explosive trace detection'], ['PHS', 'Physical search'], ['VCK', 'Visual check'], ['EDD', 'Explosive detection dogs'], ['AOM', 'Other means']];
const HOUSE_COLUMNS = ['HAWB', 'Shipper', 'Consignee', 'From - to', 'Pcs', 'Gross kg', 'Description of goods'].map((header) => ({ header }));

const timeNow = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

function RegulatedEntity({ doc }) {
  return (
    <>
      <DocTextarea name="raAddress" value={doc.company.address} lines={2} />
      <div className="tw:mt-[4px]">
        RA / KC code: <DocInput name="raCode" value="" className="tw:w-[160px]" />{' '}
        Valid till: <DocInput name="raValid" value="" className="tw:w-[110px]" />
      </div>
    </>
  );
}

function Screening() {
  return (
    <>
      <Caption className="tw:mt-[6px]">Screening method</Caption>
      {SCREENING_METHODS.map(([code, label]) => <DocCheck key={code} name={`m${code}`} checked={false} label={`${code} ${label}`} />)}
      <Caption className="tw:mt-[6px]">Grounds for exemption</Caption>
      <DocInput name="exempt" value="" />
    </>
  );
}

const houseRows = (doc) => ((doc.houses || []).length ? doc.houses : [{
  hawb: doc.hawbNo || '-', shipper: doc.shipper.name, consignee: doc.consignee.name, origin: doc.origin.code,
  destination: doc.destination.code, pieces: doc.pieces, gross: doc.gross, goods: doc.goods,
}]);

const CSD_SHEET = {
  title: 'Consignment Security Declaration',
  filePrefix: 'CSD',
  landscape: true,
  blocks: (doc, awbNumber) => [
    { kind: 'title', text: 'CONSIGNMENT SECURITY DECLARATION' },
    {
      kind: 'fields', className: 'tw:mt-[8px]', rows: [
        [
          {
            label: 'Regulated entity issuing the security status (regulated agent / known consignor)', rowSpan: 2, className: 'tw:w-[40%]',
            name: 'raName', value: doc.company.name, content: <RegulatedEntity doc={doc} />,
          },
          { label: 'Air Waybill No.', name: 'awb', value: doc.mawbNo || awbNumber },
          { label: 'Origin / destination', name: 'route', value: routeText(doc) },
          { label: 'Airline / flight', name: 'flight', value: joinFilled([doc.airline.code, ((doc.flights || [])[0] || {}).flight], ' ') },
        ],
        [
          { label: 'Total pieces', name: 'pcs', value: doc.pieces },
          { label: 'Gross weight (kg)', name: 'gw', value: kg(doc.gross) },
          { label: 'House waybills', name: 'hawbs', value: (doc.houses || []).length ? `${doc.houses.length} - ${doc.houses.map((house) => house.hawb).join(', ')}` : doc.hawbNo },
        ],
      ],
    },
    {
      kind: 'grid', className: 'tw:mt-[8px]', columns: HOUSE_COLUMNS,
      rows: houseRows(doc).map((house) => [
        { content: house.hawb },
        { content: house.shipper },
        { content: house.consignee },
        { content: joinFilled([house.origin, house.destination]) },
        { content: house.pieces, className: 'tw:text-right' },
        { content: kg(house.gross), className: 'tw:text-right' },
        { content: String(house.goods || '').split('\n').slice(0, 3).join('\n'), className: 'tw:whitespace-pre-line' },
      ]),
    },
    {
      kind: 'fields', className: 'tw:mt-[8px]', rows: [[
        {
          label: 'Security status', className: 'tw:w-[50%]',
          content: SECURITY_STATUS.map(([code, label]) => <div key={code}><DocCheck name={`st${code}`} checked={code === 'SPX'} label={`${code} - ${label}`} /></div>),
        },
        { label: 'Received from (code)', name: 'receivedFrom', value: '', content: <Screening /> },
      ]],
    },
    { kind: 'text', label: 'Additional security information', name: 'info', value: '', lines: 2, className: 'tw:mt-[8px]' },
    {
      kind: 'fields', className: 'tw:mt-[8px]', rows: [[
        { label: 'Name of the person issuing the security status', name: 'issuer', value: doc.user },
        { label: 'Date and time of issue', name: 'issued', value: `${dmy(doc.today)} ${timeNow()}` },
        { label: 'Signature', className: 'tw:w-[30%]', content: <div className="tw:h-[26px]" /> },
      ]],
    },
  ],
};

export default function SecurityDeclarationModal(props) {
  return <DocumentModal {...props} sheet={CSD_SHEET} />;
}
