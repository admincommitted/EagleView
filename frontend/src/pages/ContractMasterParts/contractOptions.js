export const SERVICE_TYPES = [
  { value: 'General', label: 'General Cargo' },
  { value: 'Valuable', label: 'Valuable (VAL)' },
  { value: 'Perishable', label: 'Perishable (PER)' },
  { value: 'DGR', label: 'Dangerous Goods' },
  { value: 'Re-Import', label: 'Re-Import' },
  { value: 'Re-Export', label: 'Re-Export' },
];

export const APPLIES_TO = [
  { value: 'ALL', label: 'All jobs' },
  { value: 'AE', label: 'Air Export' },
  { value: 'AI', label: 'Air Import' },
  { value: 'SE', label: 'Sea Export' },
  { value: 'SI', label: 'Sea Import' },
];

export const BASIS_GROUPS = [
  {
    label: 'General / Air',
    options: [
      { value: 'Flat', label: 'Flat / Fixed' },
      { value: 'Per KG (ChW)', label: 'Per KG (Chargeable Wt)' },
      { value: 'Per KG (GrW)', label: 'Per KG (Gross Wt)' },
      { value: 'Per HAWB', label: 'Per HAWB / HBL' },
      { value: 'Per Pkg', label: 'Per Package' },
    ],
  },
  {
    label: 'Sea Freight',
    options: [
      { value: 'Per CBM (LCL)', label: 'Per CBM (LCL)' },
      { value: "FCL 20'", label: "Per 20' Container (FCL)" },
      { value: "FCL 40'", label: "Per 40' Container (FCL)" },
    ],
  },
  {
    label: 'Customs / Value',
    options: [
      { value: '% of Ass. Value', label: '% of Assessable Value' },
      { value: '% of Duty', label: '% of Total Duty' },
      { value: 'Actuals', label: 'At Actuals' },
    ],
  },
];

// A flat or at-actuals charge has no per-unit amount to cap.
export const hasLimits = (basis) => basis !== 'Flat' && basis !== 'Actuals';

export const CHARGE_CURRENCIES = ['INR', 'USD', 'EUR'];

export const TRANSPORT_CURRENCIES = ['INR', 'USD'];

export const CHARGE_TYPES = [
  { value: 'Taxable', label: 'Taxable (GST)' },
  { value: 'Reimbursement', label: 'Reimbursement (Pure Agent) - billed at actual cost' },
];

export const VEHICLES = [
  { value: 'Tata Ace', label: 'Tata Ace / Chota Hathi' },
  { value: 'Tata 407', label: 'Tata 407' },
  { value: 'Eicher 14ft', label: 'Eicher 14ft' },
  { value: 'Eicher 17ft', label: 'Eicher 17ft' },
  { value: '22-Tyre Trailer', label: '22-Tyre Trailer' },
  { value: 'Per KG', label: 'Per KG (Loose Cargo)' },
];
