/**
 * Shipment Registration (iCAFFE Operation > Shipment Registration) - the freight docket. Four divisions, each
 * branch-wise: AI Import Air, SI Import Sea, AE Export Air, SE Export Sea.
 */
export const DIVISIONS = {
  AI: { label: 'Import Air', side: 'Import', mode: 'Air' },
  SI: { label: 'Import Sea', side: 'Import', mode: 'Sea' },
  AE: { label: 'Export Air', side: 'Export', mode: 'Air' },
  SE: { label: 'Export Sea', side: 'Export', mode: 'Sea' },
};

/** Milestones of the Shipment Status tab, per division. */
export const STATUS_LEVELS = {
  AI: [
    'Pre-alert received',
    'Flight arrived',
    'IGM filed',
    'Documents received',
    'BE filed',
    'Assessment',
    'Duty paid',
    'Examination',
    'Out of charge',
    'DO collected',
    'Cargo delivered',
    'Docket closed',
  ],
  SI: [
    'Pre-alert received',
    'Vessel arrived',
    'IGM filed',
    'Documents received',
    'BE filed',
    'Assessment',
    'Duty paid',
    'Examination',
    'Out of charge',
    'DO collected',
    'Container delivered',
    'Empty returned',
    'Docket closed',
  ],
  AE: [
    'Booking received',
    'Documents received',
    'Cargo received at terminal',
    'SB filed',
    'Examination',
    'Let export order',
    'Handed over to airline',
    'Flight departed',
    'Pre-alert sent',
    'Docket closed',
  ],
  SE: [
    'Booking confirmed',
    'Empty container picked',
    'Stuffing done',
    'Documents received',
    'SB filed',
    'Let export order',
    'Gated in at port',
    'Vessel sailed',
    'BL released',
    'Pre-alert sent',
    'Docket closed',
  ],
};

export const DOCUMENT_LIST = {
  Import: [
    'CWC RECEIPT',
    'TC RECEIPT',
    'BC RECEIPT',
    'AAI RECEIPT',
    'E.P. COPY',
    'EXPORTER COPY',
    'CERTIFICATE OF ORIGIN',
    'BOND BG',
    'D.O. RECEIPT',
    'IMPORT DUTY RECEIPT',
    'COMMERCIAL INVOICE',
    'PACKING LIST',
    'AWB / BL COPY',
    'INSURANCE COPY',
    'LICENCE / PERMIT',
  ],
  Export: [
    'COMMERCIAL INVOICE',
    'PACKING LIST',
    'SHIPPING BILL',
    'LEO COPY',
    'CERTIFICATE OF ORIGIN',
    'AWB / BL COPY',
    'GSP / PHYTO CERTIFICATE',
    'ARE-1 / LUT',
    'VGM',
    'CARTING ORDER',
    'MATE RECEIPT',
    'INSURANCE COPY',
  ],
};

export const DUE_DATE_TYPES = [
  'BOE Filing',
  'Duty Payment',
  'DO Validity',
  'Free Days (Detention)',
  'Warehouse Free Time',
  'SB Filing',
  'Cut-off (Cargo)',
  'Cut-off (Documents)',
  'Invoice',
  'Pre-alert',
  'Other',
];

export const STAGES = ['Register', 'Hand Over To Carrier', 'Complete', 'Cancelled'];

/** Kinds of ShipmentEvents rows: status, activities, received papers, due dates, sent mails. */
export const EVENT_KINDS = ['status', 'activity', 'recv_invoice', 'recv_boe', 'recv_doc', 'duedate', 'mail'];

/** Divisions AI / SI are import dockets. */
export const isImportDivision = (division) => /I$/.test(division);
