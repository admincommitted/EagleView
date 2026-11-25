// Certificate of origin (draft for the chamber of commerce / export council), filled from the saved AWB.
import DocumentModal from './DocumentModal';
import { DocInput } from './docKit';
import { flightText, joinFilled, kg, placeAndDate } from './docFormat';

const COUNTRY = { IN: 'INDIA', GB: 'UNITED KINGDOM', US: 'UNITED STATES', AE: 'UNITED ARAB EMIRATES', DE: 'GERMANY', FR: 'FRANCE', NL: 'NETHERLANDS', SG: 'SINGAPORE', HK: 'HONG KONG', CN: 'CHINA', JP: 'JAPAN' };

function ExporterDeclaration({ doc, country }) {
  return (
    <>
      <div className="tw:text-[10px]">The undersigned declares that the details and statements above are correct and that all the goods were produced in {country}.</div>
      <div className="tw:mt-[40px] tw:text-[10px]">Place and date: <DocInput name="expPlace" value={placeAndDate(doc)} className="tw:w-[60%]" /></div>
      <div className="tw:mt-[6px] tw:text-[10px]">Signature and stamp of the exporter</div>
    </>
  );
}

function Certification() {
  return (
    <>
      <div className="tw:text-[10px]">It is certified, on the basis of the documents produced, that the declaration by the exporter is correct.</div>
      <div className="tw:mt-[58px] tw:text-[10px]">Place, date, signature and stamp of the certifying authority</div>
    </>
  );
}

const COO_SHEET = {
  title: 'Certificate of Origin',
  filePrefix: 'COO',
  blocks: (doc) => {
    const countryCode = doc.origin.country || 'IN';
    const country = COUNTRY[countryCode] || countryCode;
    const transport = joinFilled(['BY AIR', doc.airline.name, flightText(doc), doc.mawbNo ? 'AWB ' + doc.mawbNo : '', doc.hawbNo ? 'HAWB ' + doc.hawbNo : ''], '  ');
    return [
      { kind: 'title', text: 'CERTIFICATE OF ORIGIN', className: 'tw:mb-[10px]' },
      {
        kind: 'fields', rows: [
          [
            { label: '1. Exporter / consignor (name, address, country)', name: 'exporter', value: doc.shipperBlock, lines: 5, className: 'tw:w-[55%]' },
            { label: 'Certificate No.', name: 'certNo', value: '', moreGap: 'tw:mt-[8px]', more: [{ label: 'Issued in', name: 'issuedIn', value: country }] },
          ],
          [
            { label: '2. Consignee (name, address, country)', name: 'consignee', value: doc.consigneeBlock, lines: 5 },
            { label: 'Invoice No. and date', name: 'invoice', value: '', moreGap: 'tw:mt-[8px]', more: [{ label: 'Country of origin of the goods', name: 'coo', value: country }] },
          ],
          [
            { label: '3. Means of transport and route', name: 'transport', value: transport },
            { label: 'Port of loading / discharge', name: 'ports', value: joinFilled([doc.origin.name || doc.origin.code, doc.destination.name || doc.destination.code], ' / ') },
          ],
        ],
      },
      {
        kind: 'grid', className: 'tw:mt-[8px]',
        columns: [{ header: 'Marks and numbers' }, { header: 'Number and kind of packages; description of goods' }, { header: 'HS code' }, { header: 'Gross weight / quantity' }],
        rows: [[
          { name: 'marks', value: doc.hawbNo || doc.awbNo, lines: 7, className: 'tw:w-[17%]' },
          { name: 'goods', value: `${doc.pieces || ''} PACKAGES\n${doc.goods || ''}`, lines: 7 },
          { name: 'hs', value: (doc.hsCodes || []).join('\n'), lines: 7, className: 'tw:w-[13%]' },
          { name: 'qty', value: doc.gross ? `${kg(doc.gross)} KGS` : '', lines: 7, className: 'tw:w-[16%]' },
        ]],
      },
      {
        kind: 'fields', className: 'tw:mt-[8px]', rows: [[
          { label: 'Declaration by the exporter', className: 'tw:h-[130px] tw:w-[50%]', content: <ExporterDeclaration doc={doc} country={country} /> },
          { label: 'Certification', content: <Certification /> },
        ]],
      },
    ];
  },
};

export default function CertificateOfOriginModal(props) {
  return <DocumentModal {...props} sheet={COO_SHEET} />;
}
