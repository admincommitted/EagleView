export const money = (amount) => {
  const value = Number(amount) || 0;
  if (Math.abs(value) >= 10000000) return `₹ ${(value / 10000000).toFixed(2)} Cr`;
  if (Math.abs(value) >= 100000) return `₹ ${(value / 100000).toFixed(2)} L`;
  return `₹ ${value.toLocaleString('en-IN')}`;
};

export const rupees = (amount) => `₹ ${Number(amount).toLocaleString('en-IN')}`;
