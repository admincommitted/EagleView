export const ENQUIRY_STATUS = { OPEN: 'info', QUOTED: 'warning', WON: 'success', LOST: 'danger', DROPPED: 'neutral' };
export const QUOTE_STATUS = { DRAFT: 'neutral', SENT: 'info', WON: 'success', LOST: 'danger', SUPERSEDED: 'neutral' };

// Grids that fill the width with as many columns as fit; a phone gets one.
export const FORM_GRID = {
  narrow: 'tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(130px,100%),1fr))] tw:gap-x-3 tw:gap-y-2',
  normal: 'tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(170px,100%),1fr))] tw:gap-x-3 tw:gap-y-2',
  wide: 'tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] tw:gap-x-3 tw:gap-y-2',
};
