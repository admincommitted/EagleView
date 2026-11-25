// Some report endpoints answer 200 with { success: false, error } instead of an error status.
export function assertSuccess(body) {
  if (body?.success === false) throw new Error(body.error || 'The server could not build this report');
  return body;
}

// For a side request whose failure must not stop the screen (lists for a picker, a ledger's e-mail).
export async function emptyOnFailure(request) {
  try {
    return await request;
  } catch {
    return {};
  }
}

export function flattenLedgers(nodes, ledgers = []) {
  nodes.forEach((node) => {
    if (node.type === 'ledger') ledgers.push(node);
    if (node.children) flattenLedgers(node.children, ledgers);
  });
  return ledgers;
}

export async function exportSheet({ rows, sheetName, fileName, columnWidths }) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  if (columnWidths) sheet['!cols'] = columnWidths.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}
