const findColumn = (headings, words) => headings.find((heading) => words.some((word) => String(heading).toLowerCase().includes(word)));

export const isPdf = (file) => /\.pdf$/i.test(file.name);

export const isLedgerSheet = (file) => /\.(xlsx|xls|csv|txt)$/i.test(file.name);

// The browser reads the customer's Excel / CSV; the server matches the rows against our open items.
export async function readClientLedger(file) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
  if (!sheetRows.length) throw new Error('That sheet has no rows');

  // each customer names the columns differently, so they are found by the words in the heading
  const headings = Object.keys(sheetRows[0]);
  const refKey = findColumn(headings, ['invoice', 'bill', 'ref', 'doc', 'particular', 'narration']);
  const creditKey = findColumn(headings, ['credit', 'cr']);
  const debitKey = findColumn(headings, ['debit', 'dr']);
  const amountKey = findColumn(headings, ['amount', 'balance', 'value']);
  const dateKey = findColumn(headings, ['date']);
  if (!refKey && !amountKey && !creditKey && !debitKey) {
    throw new Error(`Could not find a reference or amount column. Headings seen: ${headings.slice(0, 8).join(', ')}`);
  }

  const column = (row, key) => (key ? row[key] : '');
  return sheetRows.map((row) => ({
    ref: column(row, refKey),
    date: column(row, dateKey),
    credit: column(row, creditKey),
    debit: column(row, debitKey),
    amount: column(row, amountKey),
  }));
}
