export const EMPTY_PARTY_FORM = {
  name: '', panNumber: '', taxId: '', address: '', city: '', state: '', country: '', zip: '',
  mobile: '', email: '',
  isShipper: false, isConsignee: false, isNotifyParty: false, isBuyer: false, isSubAgent: false, isOverseasAgent: false, isShipline: false, isIataAgent: false, isBank: false,
  kycApproved: false, extendedName: '', mercManuf: 'Manufacturer', rbiNumber: '',
  marketingPerson1: '', marketingPerson2: '', marketingPerson3: '',
  sezWarehouseCode: '', iecNoReqd: true, classType: 'Private', paymentDeferred: false,
  blackList: false, insuranceRate: '', remarks: '',
  aiImportRules: '', aiExportRules: '',
};

export const EMPTY_AD_CODE = { portCode: '', adCode: '', bankName: '', branchName: '', serialNo: '', forexCode: '', bankAddress: '', loadingPort: '' };
export const EMPTY_DRAWBACK = { adCode: '', bankName: '', ifscCode: '', accountNo: '', bankAddress: '' };

export const PARTY_FLAGS = [
  { key: 'isShipper', label: 'Exporter / Importer' },
  { key: 'isConsignee', label: 'Consignee / Supplier' },
  { key: 'isNotifyParty', label: 'Notify' },
  { key: 'isBuyer', label: 'Buyer' },
  { key: 'isSubAgent', label: 'Sub Agent' },
  { key: 'isOverseasAgent', label: 'Overseas Agnt' },
  { key: 'isShipline', label: 'Shipline' },
  { key: 'isBank', label: 'Bank BRO' },
];

// the list filter; the directory search (/masters/parties/find) takes the same type names
export const TYPE_FILTERS = [
  { value: 'EXPORTER', label: 'EXPORTER / IMPORTER', flag: 'isShipper' },
  { value: 'CONSIGNEE', label: 'CONSIGNEE / SUPPLIER', flag: 'isConsignee' },
  { value: 'SUBAGENT', label: 'SUB AGENT', flag: 'isSubAgent' },
  { value: 'OVERSEAS_AGENT', label: 'OVERSEAS AGENT', flag: 'isOverseasAgent' },
  { value: 'SHIPLINE', label: 'SHIPLINE', flag: 'isShipline' },
  { value: 'BANK', label: 'BANK BRO', flag: 'isBank' },
];

export const partyTypeText = (party) => TYPE_FILTERS.filter((type) => party[type.flag]).map((type) => type.label).join(', ');

export const MERC_OPTIONS = ['Manufacturer', 'Merchant', 'Merchant Exporter Courier [C]', 'Manufacturer Exporter Courier [D]'];
export const CLASS_OPTIONS = ['Private', 'Government', 'Undertaking', 'Others', 'Warehouse Shipping Bill [W]'];
export const CTX_TYPES = ['Select', 'GSTIN', 'Aadhar', 'Passport', 'Income Tax PAN', 'TIN No', 'VAT', 'CST', 'Sales Tax Registration No', 'GST Government', 'GST Diplomat'];

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// the server keeps a branch as PartyBranches (branchName, pinCode, email1, isDefault, regNo); the grid works with these names too
const branchToAddress = (party) => (branch, index) => ({
  ...branch,
  branchSrNo: branch.branchSrNo || (index + 1).toString(),
  branch: branch.branchName || branch.branch,
  country: branch.country || party.countryCode,
  zip: branch.pinCode || branch.zip,
  pinCode: branch.pinCode || branch.zip || '',
  email: branch.email1 || branch.email || '',
  default: branch.isDefault !== undefined ? !!branch.isDefault : !!branch.default,
  gstin: branch.regNo || branch.gstin || '',
});

export const partyFromServer = (party) => ({ ...party, addresses: party.branches ? party.branches.map(branchToAddress(party)) : [] });

export const formFromParty = (party) => {
  const firstAddress = party.addresses?.[0];
  return {
    name: party.name || '',
    panNumber: party.panNumber || '',
    taxId: party.taxId || '',
    address: party.address || firstAddress?.street || '',
    city: party.city || firstAddress?.city || '',
    state: party.state || firstAddress?.state || '',
    country: party.country || party.countryCode || firstAddress?.country || '',
    zip: party.zip || party.pinCode || firstAddress?.zip || '',
    mobile: party.mobile || party.phone || '',
    email: party.email || '',
    isShipper: !!party.isShipper,
    isConsignee: !!party.isConsignee,
    isNotifyParty: !!party.isNotifyParty,
    isBuyer: !!party.isBuyer,
    isSubAgent: !!party.isSubAgent,
    isOverseasAgent: !!party.isOverseasAgent,
    isShipline: !!party.isShipline,
    isIataAgent: !!party.isIataAgent,
    isBank: !!party.isBank,
    kycApproved: !!party.kycApproved,
    extendedName: party.extendedName || '',
    mercManuf: party.mercManuf || 'Manufacturer',
    rbiNumber: party.rbiNumber || '',
    marketingPerson1: party.marketingPerson1 || '',
    marketingPerson2: party.marketingPerson2 || '',
    marketingPerson3: party.marketingPerson3 || '',
    sezWarehouseCode: party.sezWarehouseCode || '',
    iecNoReqd: party.iecNoReqd !== false,
    classType: party.classType || 'Private',
    paymentDeferred: !!party.paymentDeferred,
    blackList: !!party.blackList,
    insuranceRate: party.insuranceRate || '',
    remarks: party.remarks || '',
    aiImportRules: party.aiImportRules || '',
    aiExportRules: party.aiExportRules || '',
  };
};

// a party needs one default address: when none is marked, the preferred one (the first) becomes it
export const withOneDefault = (addresses, preferredIndex = 0) => {
  if (addresses.some((address) => address.default)) return addresses;
  const next = [...addresses];
  next[preferredIndex] = { ...next[preferredIndex], default: true, isDefault: true };
  return next;
};
