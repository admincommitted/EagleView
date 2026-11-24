// BE amendment (iCAFFE way) - 10-Nov-2026. Calls to /api/be-amendments.
// fetch carries the login token (main.jsx patches window.fetch).
export async function api(path, opts = {}) {
  const o = { ...opts };
  if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) }; }
  const res = await fetch('/api/be-amendments' + path, o);
  let d = {};
  try { d = await res.json(); } catch (e) { d = { success: false, error: 'Server answered ' + res.status }; }
  if (!res.ok || d.success === false) throw new Error(d.error || ('Server answered ' + res.status));
  return d;
}

// kind: 'unsigned' | 'signed'
export async function downloadFile(id, kind) {
  const res = await fetch(`/api/be-amendments/${id}/file?kind=${kind === 'signed' ? 'signed' : 'unsigned'}`);
  if (!res.ok) { let m = 'Could not download'; try { m = (await res.json()).error || m; } catch (e) { /* binary */ } throw new Error(m); }
  const cd = res.headers.get('Content-Disposition') || '';
  const name = (/filename="([^"]+)"/.exec(cd) || [])[1] || 'amendment.be';
  const blob = await res.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return name;
}

export const STATUS_STYLE = {
  Draft: { bg: '#f1f5f9', fg: '#475569', bd: '#cbd5e1' },
  Ready: { bg: '#e0f2fe', fg: '#075985', bd: '#7dd3fc' },
  Submitted: { bg: '#fef3c7', fg: '#92400e', bd: '#fcd34d' },
  Accepted: { bg: '#dcfce7', fg: '#166534', bd: '#86efac' },
  Rejected: { bg: '#fee2e2', fg: '#991b1b', bd: '#fca5a5' },
  Void: { bg: '#f8fafc', fg: '#94a3b8', bd: '#e2e8f0' },
};

export const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : (v || ''); };
export const ymd = (v) => { const s = String(v || '').trim(); const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`; const d = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); return d ? `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}` : ''; };
export const MODE_LABEL = { MAIL: 'Sent to ICEGATE by mail', DOWNLOAD: 'Signed file uploaded on ICEGATE', DOWNLOAD_UNSIGNED: 'Unsigned file uploaded on ICEGATE' };
