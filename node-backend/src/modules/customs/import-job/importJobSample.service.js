import { BadRequestError } from '../../../core/http/index.js';
import { buildBE_CACHI01 } from '../../../utils/customs/IcegateJsonBuilder.js';
import { writeBeFlat } from '../../../utils/customs/beFlatFile.js';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';

// a complete BE job with dummy data: a sample read back with "Read XML" / "Read Flat File" gives a complete job
function sampleBeJob() {
  const jobData = {
    jobNo: 'SAMPLE/0001/26',
    jobDate: new Date().toISOString().slice(0, 10),
    autoField_1: 'INDEL4',
    portCode: 'INDEL4',
    autoField_2: 'INDEL4',
    locationName: 'ACC NEW DELHI',
    autoField_3: 'CHA0000000001',
    autoField_4: 'SAMPLE IMPORTER PVT LTD',
    autoField_5: '0500000000',
    autoField_48: '1',
    autoField_6: 'PLOT 1, SAMPLE ROAD',
    autoField_7: 'INDUSTRIAL AREA',
    autoField_8: 'NEW DELHI',
    autoField_9: 'DELHI',
    autoField_10: '110001',
    autoField_11: 'DELHI',
    autoField_12: '07',
    autoField_13: '07AAAAA0000A1Z5',
    autoField_50: 'GSTIN',
    autoField_20: 'CN',
    autoField_21: 'CN',
    autoField_22: 'CNSHA',
    importerType: 'Private',
    paymentMethodCode: 'T',
    kachchaBE: 'N',
    greenChannel: 'N',
    _igmRows: [
      {
        igmNumber: '1234567',
        igmDate: '2026-10-20',
        inwardDate: '2026-10-21',
        mawbNo: '12345678901',
        mawbDate: '2026-10-18',
        hawbNo: 'HAWB001',
        hawbDate: '2026-10-18',
        totalPkg: '10',
        pkgCode: 'CTN',
        grossWt: '250.5',
        wtUnit: 'KGS',
        marks1: 'AS ADDRESSED',
      },
    ],
    _exchangeRates: [{ currencyCode: 'USD', rate: 88.5, unitInRs: 1 }],
  };
  const invoices = [
    {
      invNo: 'SAMPLE-INV-001',
      invDate: '2026-10-15',
      currency: 'USD',
      value: '1500',
      terms: 'FOB',
      freightValue: '100',
      freightCurrency: 'USD',
      insuranceRate: '1.125',
      supplierName: 'SAMPLE SUPPLIER CO LTD',
      supplierAddress1: 'NO 1 SAMPLE STREET',
      supplierCountry: 'CN',
      natureOfTransaction: 'S',
      paymentTerms: 'OTH',
      valuationMethod: 'RULE4 TRANSACTION VALUE',
    },
  ];
  const items = [
    {
      invSrNo: '1',
      itemSrNo: '1',
      ritc: '85171300',
      cth: '85171300',
      ceth: 'NOEXCISE',
      desc: 'MOBILE PHONE MODEL X',
      genericDesc: 'MOBILE PHONE',
      qty: '10',
      uqc: 'NOS',
      unit: 'NOS',
      price: '100',
      value: '1000',
      countryOfOrigin: 'CN',
      manufacturer: 'SAMPLE MANUFACTURER',
      brandName: 'BRAND',
      model: 'X-1',
      endUse: 'GNX200',
      bcdRate: '20',
      swsRate: '10',
      igstData: { notnNo: '009/2025', srNo: 'II506', rate: '18' },
    },
    {
      invSrNo: '1',
      itemSrNo: '2',
      ritc: '85176290',
      cth: '85176290',
      ceth: 'NOEXCISE',
      desc: 'WIFI ROUTER',
      genericDesc: 'ROUTER',
      qty: '5',
      uqc: 'NOS',
      unit: 'NOS',
      price: '100',
      value: '500',
      countryOfOrigin: 'CN',
      manufacturer: 'SAMPLE MANUFACTURER',
      brandName: 'BRAND',
      model: 'R-1',
      endUse: 'GNX200',
      bcdRate: '20',
      swsRate: '10',
      igstData: { notnNo: '009/2025', srNo: 'II506', rate: '18' },
    },
  ];
  return { jobData: { ...jobData, invoices }, items, invoices };
}

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function toXml(name, value, indent = '') {
  if (Array.isArray(value)) return value.map((entry) => toXml(name, entry, indent)).join('');
  if (value && typeof value === 'object') {
    const children = Object.entries(value)
      .map(([key, child]) => toXml(key, child, `${indent}  `))
      .join('');
    return `${indent}<${name}>\n${children}${indent}</${name}>\n`;
  }
  return `${indent}<${name}>${escapeXml(value)}</${name}>\n`;
}

const SAMPLE_FILES = {
  json: (cachi) => ({
    fileName: 'Sample_BE_CACHI01.json',
    contentType: 'application/json',
    content: JSON.stringify(cachi, null, 2),
  }),
  xml: (cachi) => ({
    fileName: 'Sample_BE_CACHI01.xml',
    contentType: 'application/xml',
    content: XML_DECLARATION + toXml('CACHI01', cachi),
  }),
  // the ICES 1.5 BE flat file layout
  flat: (cachi) => ({ fileName: 'SAMPLE01.be', contentType: 'text/plain', content: writeBeFlat(cachi) }),
};

/** Sample BE file (json | xml | flat) made by the same builder that makes the ICEGATE JSON. */
export async function buildSampleBeFile(kind) {
  const sample = sampleBeJob();
  const cachi = await buildBE_CACHI01(sample.jobData, sample.items, sample.invoices, {
    beType: 'H',
    transportMode: 'A',
  });
  const sampleKind = String(kind || '').toLowerCase();
  const makeFile = Object.hasOwn(SAMPLE_FILES, sampleKind) ? SAMPLE_FILES[sampleKind] : null;
  if (!makeFile) throw new BadRequestError('Sample kind must be json, xml or flat');
  return makeFile(cachi);
}
