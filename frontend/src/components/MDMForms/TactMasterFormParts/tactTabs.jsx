import { Activity, AlertTriangle, FileText, Globe, Plane, Shield } from 'lucide-react';
import { Button } from '@/components/ui';
import { generateLabelPdf, getChargeName } from './helpers';
import { DgrLabel, MakerBadge } from './tactBadges';

const BOLD = 'tw:font-bold';
const DANGER = 'tw:font-bold tw:text-destructive';
const WARN = 'tw:font-bold tw:text-warning';
const GOOD = 'tw:font-bold tw:text-success';
const INFO = 'tw:font-bold tw:text-primary';
const HEAD = 'tw:font-bold tw:text-head';
const VIOLET = 'tw:font-bold tw:text-violet-600';

// a grid column; tone is a class string or (row) => class string, show(row) the cell text (default row[key])
const column = (key, header, { tone, show, align } = {}) => ({
  key,
  header,
  align,
  cell: (row) => <span className={typeof tone === 'function' ? tone(row) : tone}>{show ? show(row) : row[key]}</span>,
});

const otherThanAllTone = (row) => (row.carrierCode !== 'ALL' ? DANGER : undefined);
const blockingTone = (row) => (row.isBlocking ? DANGER : WARN);
const orNotAvailable = (value, unit = '') => (value ? `${value}${unit}` : 'N/A');

const rateOf = (sector, rateClass, weightBreak = 0) => {
  const rate = sector.rateDetails?.find((detail) => detail.rateClassCode === rateClass && detail.weightBreak === weightBreak);
  return rate ? rate.rateAmount.toFixed(2) : '-';
};
const commodityRates = (sector) => {
  const rates = sector.rateDetails?.filter((detail) => detail.rateClassCode === 'C' || detail.rateClassCode === 'S') ?? [];
  if (rates.length === 0) return '-';
  return rates.map((rate) => `${rate.rateClassCode} (${rate.commodityItemNo}): ${rate.rateAmount.toFixed(2)}`).join(' | ');
};
const QUANTITY_BREAKS = [45, 100, 300, 500, 1000];

const dgrLabelColumn = {
  key: 'classDivision',
  header: 'Class / Label',
  cell: (item) => (
    <div className="tw:flex tw:items-center tw:gap-4">
      <Button variant="ghost" title="Click to print HD PDF Label" onClick={() => generateLabelPdf(item)}
        className="tw:h-auto tw:border-0 tw:p-0 tw:transition-transform tw:duration-200 tw:hover:scale-120 tw:hover:bg-transparent">
        <DgrLabel classCode={item.classDivision} unNumber={item.unNumber} properName={item.properShippingName} />
      </Button>
      <span className="tw:font-bold tw:text-slate-700">{item.classDivision}</span>
    </div>
  ),
};

/**
 * The TACT / IATA tables, one tab each.
 *   source   - the /tact/<source> list   csvName - the downloaded file   searchText(row) - what the search box looks in
 *   opensAircraft - a row click opens the aircraft command center
 */
export const TACT_TABS = [
  {
    id: 'country',
    label: 'Sec 7: Country Rules',
    icon: Globe,
    source: 'country-rules',
    title: 'Section 7: Country Rules (Import/Export/Transit)',
    csvName: 'TACT_Country_Rules.csv',
    columns: [
      column('countryCode', 'Country', { tone: BOLD }),
      column('ruleType', 'Type'),
      column('category', 'Category'),
      column('description', 'Description'),
      column('isBlocking', 'Blocking', { tone: blockingTone, show: (rule) => (rule.isBlocking ? 'Yes' : 'Warning') }),
    ],
  },
  {
    id: 'carrier',
    label: 'Sec 8: Carrier Rules',
    icon: Plane,
    source: 'carrier-rules',
    title: 'Section 8: Carrier Embargoes',
    csvName: 'TACT_Carrier_Embargoes.csv',
    columns: [
      column('carrierCode', 'Carrier', { tone: BOLD }),
      column('shcCode', 'SHC', { tone: VIOLET }),
      column('description', 'Description'),
      column('isBlocking', 'Status', { tone: blockingTone, show: (rule) => (rule.isBlocking ? 'Active Block' : 'Warning') }),
    ],
  },
  {
    id: 'rates',
    label: 'TACT Surcharges',
    icon: Activity,
    source: 'surcharges',
    title: 'TACT Rates, FSC, and SSC Surcharges',
    csvName: 'TACT_Surcharges.csv',
    columns: [
      column('chargeCode', 'Charge Code', { tone: INFO }),
      column('chargeName', 'Charge Name / Description', { tone: 'tw:font-semibold tw:text-slate-700', show: (charge) => getChargeName(charge.chargeCode) }),
      column('carrierCode', 'Carrier', { tone: otherThanAllTone, align: 'center' }),
      column('chargeBasis', 'Basis'),
      column('amount', 'Amount', { tone: GOOD }),
      column('minimumAmount', 'Min Amount'),
    ],
  },
  {
    id: 'gcr',
    label: 'IATA GCR Rates',
    icon: FileText,
    source: 'rates',
    title: 'IATA General Cargo Rates (GCR) & Specific Commodity (SCR)',
    countLabel: 'Total Sectors',
    csvName: 'IATA_GCR_Rates.csv',
    searchText: (sector) => `${sector.originCode} ${sector.destinationCode} ${sector.carrierCode} ${sector.currencyCode}`,
    columns: [
      column('originCode', 'Origin', { tone: HEAD }),
      column('destinationCode', 'Dest', { tone: HEAD }),
      column('carrierCode', 'Carrier', { tone: otherThanAllTone, align: 'center' }),
      column('currencyCode', 'Curr', { tone: 'tw:text-muted-foreground', align: 'center' }),
      column('minimum', 'MIN (M)', { tone: BOLD, align: 'center', show: (sector) => rateOf(sector, 'M') }),
      column('normal', 'NORM (N)', { tone: BOLD, align: 'center', show: (sector) => rateOf(sector, 'N') }),
      ...QUANTITY_BREAKS.map((weight) => column(`q${weight}`, `+${weight} KG`, { tone: GOOD, align: 'center', show: (sector) => rateOf(sector, 'Q', weight) })),
      column('commodity', 'SCR / Class', { tone: WARN, align: 'center', show: commodityRates }),
    ],
  },
  {
    id: 'dgr',
    label: 'DGR & UN Masters',
    icon: AlertTriangle,
    source: 'dgr',
    title: 'IATA DGR Master Database',
    csvName: 'IATA_DGR_Master.csv',
    columns: [
      column('unNumber', 'UN Number', { tone: DANGER }),
      column('properShippingName', 'Proper Shipping Name', { tone: HEAD }),
      dgrLabelColumn,
      column('labelSize', 'Label Size', { tone: 'tw:text-[13px] tw:font-bold tw:text-muted-foreground', align: 'center', show: () => '100x100 mm' }),
      column('packingGroup', 'Packing Group', {
        align: 'center',
        tone: (item) => (item.packingGroup.includes('YES') || item.packingGroup.includes('FORBIDDEN') ? DANGER : BOLD),
      }),
      column('caoOnly', 'CAO Only (Cargo Aircraft)', { align: 'center', tone: (item) => (item.caoOnly.startsWith('Yes') ? DANGER : 'tw:font-semibold') }),
    ],
  },
  {
    id: 'equipment',
    label: 'Aircraft Equipment',
    icon: Shield,
    source: 'equipment',
    title: 'Aircraft Equipment & Dimensions Limit',
    csvName: 'Aircraft_Equipment_Limits.csv',
    opensAircraft: true,
    columns: [
      { key: 'manufacturer', header: 'Make', cell: (aircraft) => <MakerBadge make={aircraft.manufacturer} /> },
      column('aircraftType', 'Aircraft Type', { tone: 'tw:font-bold tw:text-blue-900' }),
      column('iataCode', 'IATA Code', { tone: GOOD, show: (aircraft) => aircraft.iataCode || 'TBA' }),
      column('bodyType', 'Body Type', {
        tone: (aircraft) => ((aircraft.bodyType || '').includes('Freighter') ? VIOLET : 'tw:font-bold tw:text-blue-900'),
        show: (aircraft) => aircraft.bodyType || 'N/A',
      }),
      column('deckType', 'Deck Type', {
        tone: (aircraft) => ((aircraft.deckType || '').includes('Main Deck') ? DANGER : 'tw:font-semibold'),
        show: (aircraft) => aircraft.deckType || 'N/A',
      }),
      column('maxPayloadTons', 'Max Payload (Tons)', { tone: INFO, show: (aircraft) => orNotAvailable(aircraft.maxPayloadTons, ' TON') }),
      column('maxVolumeCbm', 'Max Volume (CBM)', { tone: VIOLET, show: (aircraft) => orNotAvailable(aircraft.maxVolumeCbm, ' CBM') }),
      column('compatibleUlds', 'ULD Compatibility', { tone: 'tw:text-[12.5px]', show: (aircraft) => aircraft.compatibleUlds || 'N/A' }),
      column('doorSize', 'Door Size', { tone: BOLD }),
      column('maxLengthCm', 'Max Length (cm)', { show: (aircraft) => `${aircraft.maxLengthCm} cm` }),
      column('maxWidthCm', 'Max Width (cm)', { show: (aircraft) => `${aircraft.maxWidthCm} cm` }),
      column('maxHeightCm', 'Max Height (cm)', { show: (aircraft) => `${aircraft.maxHeightCm} cm` }),
      column('maxKgsPerPiece', 'Max Kgs / Piece', { show: (aircraft) => `${aircraft.maxKgsPerPiece} kg` }),
    ],
  },
  {
    id: 'icer',
    label: 'IATA Exchange Rates',
    icon: Activity,
    source: 'exchange-rates',
    title: 'IATA Currency Exchange Rates (ICER)',
    csvName: 'IATA_Exchange_Rates.csv',
    columns: [
      column('billingMonth', 'Billing Month', { tone: 'tw:font-bold tw:text-blue-900' }),
      column('currencyCode', 'Currency Code', { tone: INFO }),
      column('iataRoe', 'IATA ROE (Rate of Exchange)', { tone: GOOD, show: (rate) => rate.iataRoe.toFixed(4) }),
      column('sdrValue', 'SDR Value', { show: (rate) => (rate.sdrValue ? rate.sdrValue.toFixed(4) : '-') }),
    ],
  },
  {
    id: 'shc',
    label: 'SHC Conflicts',
    icon: AlertTriangle,
    source: 'shc-conflicts',
    title: 'Special Handling Code (SHC) Conflicts',
    csvName: 'IATA_SHC_Conflicts.csv',
    columns: [
      column('shcCode1', 'Primary SHC', { tone: DANGER }),
      column('shcCode2', 'Conflicting SHC', { tone: DANGER }),
      column('isProhibited', 'Conflict Type', { tone: WARN, show: (conflict) => (conflict.isProhibited ? 'PROHIBITED' : 'WARNING') }),
      column('conflictReason', 'Remarks', { show: (conflict) => conflict.conflictReason || conflict.reason || '-' }),
    ],
  },
  {
    id: 'addons',
    label: 'TACT Add-on Rates',
    icon: Activity,
    source: 'proportional-rates',
    title: 'TACT Proportional (Add-on) Rates',
    csvName: 'TACT_Addon_Rates.csv',
    columns: [
      column('gatewayAirport', 'Gateway Airport (Hub)', { tone: 'tw:font-bold tw:text-blue-800' }),
      column('localAirport', 'Local Airport (Spoke)', { tone: 'tw:font-bold tw:text-teal-700' }),
      column('addonAmount', 'Add-on Amount', { tone: WARN, show: (addon) => addon.addonAmount.toFixed(2) }),
      column('currencyCode', 'Currency', { tone: BOLD }),
    ],
  },
];
