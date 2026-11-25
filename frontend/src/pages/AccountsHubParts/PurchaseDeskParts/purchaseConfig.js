export const PURCHASE_DESKS = {
  trade: { title: 'Trade Invoice', rcm: false, needJob: true },
  nontrade: { title: 'Non Trade Invoice', rcm: false, needJob: false },
  tradercm: { title: 'Trade Invoice (RCM)', rcm: true, needJob: true },
  nontradercm: { title: 'Non Trade Invoice (RCM)', rcm: true, needJob: false },
};

export const GST_SLABS = ['0', '5', '12', '18', '28'];
export const GST_SLAB_OPTIONS = GST_SLABS.map((slab) => ({ value: slab, label: slab + '%' }));
export const PAY_REC_OPTIONS = [{ value: 'Pay', label: 'Pay (charge)' }, { value: 'Rec', label: 'Rec (less from bill)' }];
export const SUPPLY_OPTIONS = [{ value: 'intra', label: 'Same state (CGST + SGST)' }, { value: 'inter', label: 'Other state (IGST)' }];
export const SEZ_OPTIONS = [{ value: 'igst', label: 'With IGST' }, { value: 'lut', label: 'Without tax (LUT)' }];
export const TDS_BASE_OPTIONS = [{ value: 'taxable', label: 'Taxable' }, { value: 'bill', label: 'Bill value' }];

// the company's GST state; a vendor registered in another state is charged IGST
export const HOME_GST_STATE = '07';

export const addDays = (isoDate, days) => {
  const date = new Date(isoDate + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const flipSide = (dc) => (dc === 'Dr' ? 'Cr' : 'Dr');

export const blankCharge = () => ({ charge: '', ledgerId: '', sac: '', pr: 'Pay', currency: 'INR', roe: '1', qty: '1', rate: '', gstRate: '18', jobNo: '', remarks: '' });

export const blankTds = (on) => ({ on, natureId: '', rate: '', base: 'taxable' });

export const nearestSlab = (percent, start) => GST_SLABS.reduce((best, slab) => (Math.abs(Number(slab) - percent) < Math.abs(Number(best) - percent) ? slab : best), start);

export const tdsNatureOfSection = (natures, section) => (section ? natures.find((nature) => String(nature.section).toUpperCase() === String(section).toUpperCase()) : null);

export const ddmmyyyy = (isoDate) => isoDate.split('-').reverse().join('/');
