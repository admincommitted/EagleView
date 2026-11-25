const percentOf = (amount, rate) => amount * (parseFloat(rate || 0) / 100);

/** A vendor bill line: GST on the base amount, TDS also on the base amount (not on the GST). */
export function vendorLine(item) {
  const amount = parseFloat(item.amount || 0);
  const gst = percentOf(amount, item.taxRate);
  const tds = percentOf(amount, item.tdsRate);
  return { amount, gst, tds, net: amount + gst - tds };
}

export function vendorBillTotals(items) {
  const totals = items.map(vendorLine).reduce(
    (sum, line) => ({ subTotal: sum.subTotal + line.amount, taxTotal: sum.taxTotal + line.gst, tdsTotal: sum.tdsTotal + line.tds }),
    { subTotal: 0, taxTotal: 0, tdsTotal: 0 }
  );
  return { ...totals, netPayable: totals.subTotal + totals.taxTotal - totals.tdsTotal };
}

/** A job bill line in INR; under LUT the supply is zero rated. */
export function jobLine(item, lutEnabled) {
  const amount = parseFloat(item.amountINR || 0);
  const tax = lutEnabled ? 0 : percentOf(amount, item.taxRate);
  return { amount, tax, total: amount + tax };
}

/** GST is split half CGST, half SGST (intra-state is assumed). */
export function jobBillTotals(items, lutEnabled) {
  return items.map((item) => jobLine(item, lutEnabled)).reduce(
    (sum, line) => ({
      subTotal: sum.subTotal + line.amount,
      cgst: sum.cgst + line.tax / 2,
      sgst: sum.sgst + line.tax / 2,
      grandTotal: sum.grandTotal + line.total,
    }),
    { subTotal: 0, cgst: 0, sgst: 0, grandTotal: 0 }
  );
}
