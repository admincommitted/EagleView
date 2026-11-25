export const num = (value) => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return isFinite(parsed) ? parsed : 0;
};

export const r2 = (value) => Math.round(value * 100) / 100;

export const sumOf = (list, amountOf) => list.reduce((total, item) => total + amountOf(item), 0);

export const plural = (count, word) => count + ' ' + word + (count === 1 ? '' : 's');

// "Read 3 lines from Excel - skipped row 4 (no amount), row 9 (...) and 2 more"
export const skippedNote = (bad) => (bad.length ? ' - skipped ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? ' and ' + (bad.length - 5) + ' more' : '') : '');
