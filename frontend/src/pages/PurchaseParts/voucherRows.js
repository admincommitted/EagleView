const DAY_MS = 86400000;

/** action -> the status saved on the voucher; Reject and Return need the manager's remarks. */
export const VOUCHER_ACTIONS = {
  Approve: { status: 'Approved', needsRemarks: false },
  Return: { status: 'Returned', needsRemarks: true },
  Reject: { status: 'Rejected', needsRemarks: true },
};

export const toVoucherRow = (voucher) => ({
  id: voucher.id,
  date: voucher.date,
  voucherNumber: voucher.voucherNumber,
  type: voucher.voucherType?.name || voucher.voucherType?.baseType || '',
  amount: parseFloat(voucher.totalAmount) || 0,
  narration: voucher.narration || '',
  requestedBy: voucher.createdByName || (voucher.createdBy ? `User #${voucher.createdBy}` : ''),
  ledgers: (voucher.details || []).map((detail) => detail.ledger?.name || '').filter(Boolean),
});

export const daysWaiting = (voucher) => (voucher.date ? Math.floor((Date.now() - new Date(voucher.date)) / DAY_MS) : 0);

export const voucherMatches = (voucher, searchTerm) => !searchTerm
  || [voucher.voucherNumber, voucher.narration, voucher.requestedBy, voucher.type].some((text) => String(text || '').toLowerCase().includes(searchTerm.toLowerCase()));
