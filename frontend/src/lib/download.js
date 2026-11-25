export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function downloadCsv(fileName, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), fileName);
}

// A failed blob request still carries the server's JSON error inside the blob.
export async function blobErrorMessage(error) {
  const blob = error.response?.data;
  if (!(blob instanceof Blob)) return error.message;
  try {
    const body = JSON.parse(await blob.text());
    return body.error || body.message || error.message;
  } catch {
    return error.message;
  }
}
