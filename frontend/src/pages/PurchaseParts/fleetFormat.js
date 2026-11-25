export const TRIP_STATUS = {
  PENDING_DISPATCH: { label: 'Pending dispatch', variant: 'info' },
  IN_TRANSIT: { label: 'In transit', variant: 'warning' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

export const tripStatusLabel = (status) => TRIP_STATUS[status]?.label || status;

export const money = (amount) => `₹ ${(Number(amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
