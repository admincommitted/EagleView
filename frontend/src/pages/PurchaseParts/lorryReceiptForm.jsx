import { Compass, IndianRupee, Package, User } from 'lucide-react';

export const today = () => new Date().toISOString().split('T')[0];

export const blankLorryReceipt = () => ({
  lrNo: '', jobNo: '', transporterId: '', billingLedgerId: '', packagingType: 'Cartons', advanceMode: 'Bank Transfer (IMPS)',
  remarks: '', date: today(), consignor: '', consignee: '', billingParty: '',
  origin: '', destination: '', distance: '',
  vehicleNo: '', vehicleType: '32 FT Multi-Axle', driverName: '', driverPhone: '', dlNumber: '',
  ewayBill: '', invoiceValue: '', packages: '', actualWeight: '', chargedWeight: '', commodity: '',
  freightBasis: 'Per Ton', freightRate: '', advanceToDriver: '', paymentType: 'To Pay',
});

const toNumber = (text) => {
  const number = parseFloat(text);
  return Number.isFinite(number) ? number : 0;
};

/** The same arithmetic the server uses for the freight of a lorry receipt. */
export function freightOf(form) {
  const rate = toNumber(form.freightRate);
  if (!rate) return 0;
  if (form.freightBasis === 'Per Ton') return rate * (toNumber(form.chargedWeight) || toNumber(form.actualWeight));
  if (form.freightBasis === 'Per Km') return rate * toNumber(form.distance);
  return rate;
}

export function freightWarnings(form, freight) {
  const rate = toNumber(form.freightRate);
  return [
    form.freightBasis === 'Per Ton' && rate > 0 && !toNumber(form.chargedWeight) && !toNumber(form.actualWeight) && 'A per-ton rate needs the weight (Cargo tab)',
    form.freightBasis === 'Per Km' && rate > 0 && !toNumber(form.distance) && 'A per-km rate needs the distance (Routing tab)',
    toNumber(form.advanceToDriver) > freight && freight > 0 && 'The advance is more than the whole freight',
  ].filter(Boolean);
}

/** The server keeps packaging and advance mode inside the remarks. */
export const lorryReceiptToSave = (form) => ({
  ...form,
  distanceKm: form.distance,
  transporterId: form.transporterId || null,
  billingLedgerId: form.billingLedgerId || null,
  remarks: [form.remarks, form.packagingType && `Packaging: ${form.packagingType}`, form.advanceMode && `Advance mode: ${form.advanceMode}`].filter(Boolean).join(' | '),
});

const VEHICLE_TYPES = ['32 FT Multi-Axle', '20 FT Container', '40 FT Trailer', 'Open Body Truck', 'LCV (Tata Ace)', 'Reefer'];
const PACKAGING_TYPES = ['Cartons', 'Pallets', 'Drums', 'Bags', 'Loose'];
const ADVANCE_MODES = ['Cash', 'Bank Transfer (IMPS)', 'Fastag / Fuel Card'];
const PAYMENT_TYPES = [
  { value: 'Paid', label: 'Consignor (Paid)' },
  { value: 'To Pay', label: 'Consignee (To Pay)' },
  { value: 'TBB', label: 'Third Party (T.B.B.)' },
];
// Only these bases are computed by the freight arithmetic.
const FREIGHT_BASES = [
  { value: 'Per Ton', label: 'Per Ton (rate x charged weight)' },
  { value: 'Per Km', label: 'Per Km (rate x distance)' },
  { value: 'Per Trip', label: 'Per Trip' },
  { value: 'Flat', label: 'Flat' },
];

const TWO = 'tw:sm:grid-cols-2';
const THREE = 'tw:sm:grid-cols-3';
const WIDE = 'tw:sm:col-span-2';
const DANGER_LABEL = 'tw:text-destructive';

const transporterOptions = (transporters) =>
  transporters.map((transporter) => ({ value: transporter.id, label: `${transporter.name}${transporter.gstin ? ` (${transporter.gstin})` : ''}` }));

/**
 * The four tabs of the lorry receipt: each has sections { title, tone, grid, fields } for FormFields.
 * `freightTotal` is a read-only box filled by the screen.
 */
export function lorryReceiptTabs({ masters, warnings }) {
  const ledgerOptions = masters.ledgers.map((ledger) => ({ value: ledger.id, label: ledger.name }));
  return [
    {
      value: 'routing', label: 'Route & Vehicle', icon: Compass,
      sections: [
        {
          grid: TWO, fields: [
            { name: 'lrNo', label: 'LR Number (Auto)', readOnly: true },
            { name: 'date', label: 'Dispatch Date', kind: 'date' },
          ],
        },
        {
          title: 'Routing', grid: 'tw:sm:grid-cols-[2fr_2fr_1fr]', fields: [
            { name: 'origin', label: 'From (Origin City/Hub)', placeholder: 'e.g. Mumbai (Bhiwandi)' },
            { name: 'destination', label: 'To (Destination City)', placeholder: 'e.g. Delhi (Okhla)' },
            { name: 'distance', label: 'Est. Distance (KM)', kind: 'number', placeholder: 'KM' },
          ],
        },
        {
          title: 'Vehicle & Driver (Fleet Allocation)', grid: TWO, fields: [
            { name: 'vehicleNo', label: 'Vehicle Number (Reg No.)', placeholder: 'MH-04-XX-1234' },
            { name: 'vehicleType', label: 'Vehicle Type', kind: 'select', options: VEHICLE_TYPES },
            { name: 'driverName', label: 'Driver Name', placeholder: 'Name...' },
            { name: 'driverPhone', label: 'Driver Contact Number', placeholder: 'Mobile...' },
            { name: 'dlNumber', label: 'Driving License No.', placeholder: 'DL No...' },
          ],
        },
      ],
    },
    {
      value: 'parties', label: 'Parties & Docs', icon: User,
      sections: [
        {
          grid: TWO, fields: [
            { name: 'consignor', label: 'Consignor (Sender)', kind: 'textarea', placeholder: 'Name, Address & GSTIN...' },
            { name: 'consignee', label: 'Consignee (Receiver)', kind: 'textarea', placeholder: 'Name, Address & GSTIN...' },
            { name: 'transporterId', label: 'Transporter (from the Transporter master)', kind: 'select', clearLabel: '-- own vehicle / not from the master --', options: transporterOptions(masters.transporters) },
            { name: 'jobNo', label: 'Job No. (links the trip to a job)', placeholder: 'Optional' },
            { name: 'paymentType', label: 'Billing Party (Who will pay the freight?)', kind: 'select', options: PAYMENT_TYPES, className: WIDE },
            { name: 'billingLedgerId', label: 'Bill it to this ledger (so the freight can be invoiced)', kind: 'select', clearLabel: '-- not linked to a ledger --', options: ledgerOptions, className: WIDE },
          ],
        },
      ],
    },
    {
      value: 'cargo', label: 'Cargo Details', icon: Package,
      sections: [
        {
          grid: TWO, fields: [
            { name: 'ewayBill', label: 'E-Way Bill Number (Crucial)', placeholder: '12 Digit E-Way Bill', labelClassName: 'tw:text-primary', controlClassName: 'tw:border-primary' },
            { name: 'invoiceValue', label: 'Declared Invoice Value (₹)', kind: 'number', placeholder: 'Material Value for Transit Insurance' },
          ],
        },
        {
          title: 'Measurement & Commodity', grid: THREE, fields: [
            { name: 'commodity', label: 'Commodity / Cargo', placeholder: 'e.g. Auto Parts' },
            { name: 'packages', label: 'No. of Packages', kind: 'number', placeholder: 'Qty' },
            { name: 'packagingType', label: 'Packaging Type', kind: 'select', options: PACKAGING_TYPES },
            { name: 'actualWeight', label: 'Actual Weight (Kgs)', kind: 'number', placeholder: 'Scale Wt.' },
            { name: 'chargedWeight', label: 'Charged Weight (Kgs)', kind: 'number', placeholder: 'Volumetric or Higher Wt.', controlClassName: 'tw:font-bold' },
          ],
        },
      ],
    },
    {
      value: 'commercials', label: 'Trip Commercials', icon: IndianRupee,
      sections: [
        {
          title: 'Freight & Charges', grid: TWO, fields: [
            { name: 'freightBasis', label: 'Freight Basis', kind: 'select', options: FREIGHT_BASES },
            { name: 'freightRate', label: 'Freight Rate (₹)', kind: 'number', placeholder: 'Rate as per basis' },
            {
              name: 'freightTotal', label: 'Total Basic Freight (₹)', readOnly: true, placeholder: 'fill the rate and its basis', controlClassName: 'tw:font-bold',
              note: warnings.length ? <span className="tw:flex tw:flex-col tw:text-destructive">{warnings.map((warning) => <span key={warning}>{warning}</span>)}</span> : undefined,
            },
          ],
        },
        {
          title: 'Driver Advance (Trip Expense)', tone: 'danger', note: 'Cash or Fastag recharge given to driver for Tolls & Diesel during this trip.', grid: TWO, fields: [
            { name: 'advanceToDriver', label: 'Advance Amount (₹)', kind: 'number', placeholder: 'e.g. 15000', labelClassName: DANGER_LABEL },
            {
              name: 'advanceMode', label: 'Advance Mode', kind: 'select', options: ADVANCE_MODES, labelClassName: DANGER_LABEL,
              note: 'Saving the LR does not post the advance to the ledger. Use "Post advance" on the trip board - it asks which ledgers to use.',
            },
          ],
        },
      ],
    },
  ];
}
