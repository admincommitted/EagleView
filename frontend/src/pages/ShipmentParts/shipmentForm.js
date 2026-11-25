export const DIVISION_BY_ROUTE = { ai: 'AI', si: 'SI', ae: 'AE', se: 'SE' };

export const toNumber = (value) => {
  const number = parseFloat(value);
  return Number.isNaN(number) ? 0 : number;
};

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const nowTime = () => new Date().toTimeString().slice(0, 5);
export const fyStartIso = () => {
  const today = new Date();
  return (today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear()) + '-04-01';
};

export const formatInr = (value) => (value === null || value === undefined || value === '' || Number.isNaN(Number(value))
  ? ''
  : Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export const stageVariant = (stage) => (stage === 'Cancelled' ? 'danger' : stage === 'Complete' ? 'success' : 'info');

// the labels that change with the division: importer / shipper, MAWB / MBL, IGM / EGM ...
export const divisionLabels = (isImport, isAir) => ({
  main: isImport ? 'Importer' : 'Shipper',
  other: isImport ? 'Supplier' : 'Consignee',
  master: isAir ? 'MAWB' : 'MBL',
  house: isAir ? 'HAWB' : 'HBL',
  carrier: isAir ? 'AirLine' : 'Shipping Line',
  flightVessel: isAir ? '1st Carrier (Flight)' : 'Vessel',
  manifest: isImport ? 'IGM' : 'EGM',
});

export const OPTIONS = {
  jobType: ['CC-FF', 'FF', 'CC', 'MISC', 'GTA'],
  shipmentType: ['Consol', 'Non Consol'],
  houseType: ['House', 'Master'],
  cargoType: ['General', 'Valuable', 'Hazardous', 'Perishable', 'Others'],
  freightTerm: ['Prepaid', 'Collect'],
  nomination: ['Direct', 'Nominated To Us', 'Nominated To Others'],
  shipmentTerm: ['EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'],
  oblType: ['Original', 'Seaway Bill', 'Telex Release', 'Express Release', 'Surrender'],
  goodsType: ['Active cool container', 'Envirotainer', 'Aircraft on ground', '15 to 25 Degree C', 'Charter', 'Dangerous goods', 'Exhibition & Promotion material', 'Garment on Hanger', 'High dense', 'Odd dimensions cargo', 'Pharmaceutical', 'Re-export', 'Personal effects', 'General'],
  containerSize: ['20', '40', '40HC', '45'],
  containerType: ['GP', 'HC', 'RF', 'OT', 'FR', 'TK', 'LCL'],
  dimensionUnit: [{ value: 'CM', label: 'Centimeter' }, { value: 'IN', label: 'Inch' }],
  searchStage: ['Hand Over To Carrier', 'Register', 'Cancelled', 'Complete'],
  payMode: ['Advance', 'DP', 'DA', 'LC', 'TT', 'FOC', 'Others'],
  docStatus: ['Received', 'Not Applicable'],
};

export const TABS = [
  { value: 'shipment', label: 'Shipment' },
  { value: 'search', label: 'Search' },
  { value: 'recv', label: 'Receiving Documents' },
  { value: 'status', label: 'Shipment Status' },
  { value: 'stage', label: 'Complete/Cancel' },
  { value: 'activity', label: 'Activity Details' },
  { value: 'cost', label: 'Provisional Cost Sheet' },
  { value: 'due', label: 'Due Dates' },
  { value: 'docs', label: 'Document List' },
];

export const emptyShipment = (division, branchCode) => ({
  division, branchCode: branchCode || '', docketNo: '', docketDate: todayIso(), clearanceDate: '', customsOnly: false, jobType: '',
  shipmentType: 'Consol', houseType: 'House', cargoType: 'General', freightTerm: 'Prepaid', nomination: '', shipmentTerm: '',
  mainParty: '', mainPartyId: null, mainAddress: '', otherParty: '', overseasAgent: '', subAgent: '', billingType: '', billingParty: '',
  billingAddress: '', notifyParty: '', cha: '', mawbNo: '', mawbDate: '', hawbNo: '', hawbDate: '', carrier: '', flightVessel: '',
  voyage: '', etd: '', eta: '', igmNo: '', igmDate: '', originPort: '', destinationPort: '', dischargePort: '', clearanceAt: '',
  pkgs: '', pkgUnit: 'PKG', grossWeight: '', chargeableWeight: '', volume: '', goodsDesc: '', stage: 'Register', currentStatus: '',
  docketOwner: '', referenceNo: '', remarks: '', marketingPerson: '', quotationNo: '', placeOfSupply: '', costCentre: '', ediJobNo: '',
  poNo: '', containers: [], dimensions: [], docs: {},
  data: {
    otherAddress: '', broker: '', subAgent2: '', subAgentAddress: '', overseasAddress: '', overseasAgent2: '', notifyAddress: '',
    notifySame: false, seller: '', sellerSame: false, billingSame: false, actualShipper: '', actualConsignee: '', routedBy: '',
    oblType: '', forwarder: '', doCollected: false, doNo: '', doDate: '', lrNo: '', lrDate: '', grnNo: '', segment: '',
    grossUnit: 'KGS', netWeight: '', goodsType: '', marks: '', carrier2: '', inwardDate: '', rotationNo: '', atd: '', ata: '',
    sobDate: '', destuffAt: '', stuffAt: '', cutOff: '', assValue: '', totalDuty: '', referenceNo2: '', bro: false, approvalVerified: false,
  },
});

// a record from the server on top of a blank form: empty (null) fields keep the blank form's value
export const shipmentFromRecord = (record, division, branchCode) => ({
  ...emptyShipment(division, branchCode),
  ...Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null && value !== undefined)),
  customsOnly: Boolean(record.customsOnly),
  data: { ...emptyShipment(division).data, ...(record.data || {}) },
});

// air: L x W x H / 6000 (cm) or / 366 (inch) per piece; CBM from the same sizes
export const volumeWeight = (dimensions) => Math.round(dimensions.reduce((total, size) => (
  total + toNumber(size.l) * toNumber(size.w) * toNumber(size.h) * toNumber(size.p) / (size.unit === 'IN' ? 366 : 6000)
), 0) * 100) / 100;

export const cubicMetres = (dimensions) => Math.round(dimensions.reduce((total, size) => (
  total + toNumber(size.l) * toNumber(size.w) * toNumber(size.h) * toNumber(size.p) / (size.unit === 'IN' ? 61023.7 : 1000000)
), 0) * 1000) / 1000;
