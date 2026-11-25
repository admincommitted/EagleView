export const BLANK_VENDOR = { vendorName: '', gstNumber: '', contactEmail: '', phone: '', address: '' };

export const VENDOR_FIELDS = [
  { name: 'vendorName', label: 'Vendor Name', required: true, maxLength: 120 },
  { name: 'gstNumber', label: 'GST Number', maxLength: 15, placeholder: '15 characters', clean: (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, '') },
  { name: 'contactEmail', label: 'Email Address', kind: 'email', maxLength: 120, controlClassName: 'tw:normal-case' },
  { name: 'phone', label: 'Phone Number', maxLength: 30 },
  { name: 'address', label: 'Address', kind: 'textarea', maxLength: 400, rows: 3 },
];

export const vendorForm = (vendor) => Object.fromEntries(Object.keys(BLANK_VENDOR).map((key) => [key, vendor[key] || '']));

/** The server's own reason (a vendor used in a PO cannot be deleted, ...) when it sent one. */
export const serverError = (error, fallback) => error.response?.data?.error || fallback;
