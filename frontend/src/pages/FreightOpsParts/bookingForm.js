export const emptyBooking = () => ({
  jobNo: '',
  bookingNo: 'BKG-' + new Date().getFullYear() + '-',
  mblNo: '',
  hblNo: '',
  vessel: '',
  voyage: '',
  pol: '',
  pod: '',
  finalDest: '',
  etd: '',
  eta: '',
  shipper: '',
  consignee: '',
  notifyParty: '',
  cha: '',
  freightTerms: 'Prepaid',
  blType: 'Original',
  movementType: 'CY/CY',
});

export const newContainer = (id) => ({ id, containerNo: '', sealNo: '', sizeType: '20GP', weight: '', volume: '', pkgs: '' });

export const BOOKING_OPTIONS = {
  freightTerms: ['Prepaid', 'Collect'],
  blType: ['Original', 'Seaway Bill (Express Release)', 'Telex Release'],
  movementType: ['CY/CY (FCL/FCL)', 'CFS/CFS (LCL/LCL)', 'CY/CFS (FCL/LCL)'],
};

const containerText = (container) => [
  container.containerNo,
  container.sizeType,
  container.sealNo && 'seal ' + container.sealNo,
  container.weight && container.weight + ' kg',
  container.volume && container.volume + ' cbm',
  container.pkgs && container.pkgs + ' pkgs',
].filter(Boolean).join(' / ');

// the one line kept on the export job's BOOKING event: vessel, route, dates, terms and the filled container lines
export function bookingDetail(booking, filledContainers) {
  return [
    booking.vessel ? 'Vessel ' + booking.vessel + (booking.voyage ? ' voy ' + booking.voyage : '') : '',
    booking.pol || booking.pod ? (booking.pol || '?') + ' to ' + (booking.pod || '?') : '',
    booking.etd ? 'ETD ' + booking.etd : '',
    booking.eta ? 'ETA ' + booking.eta : '',
    booking.freightTerms ? 'Freight ' + booking.freightTerms : '',
    booking.movementType ? 'Movement ' + booking.movementType : '',
    filledContainers.length ? 'Containers: ' + filledContainers.map(containerText).join(' | ') : 'No container line filled',
  ].filter(Boolean).join(' · ');
}
