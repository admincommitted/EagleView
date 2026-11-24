// DSC signing from the browser (16-Nov-2026)
// EagleView Signer (signer_tool, EagleViewSigner.exe) runs on each user's own PC at 127.0.0.1:5050 with that PC's DSC
// token. When it runs, PDFs are signed there and the token PIN is asked in the tool's own window - it never goes
// through the browser or the server. When it does not run, the old way stays: the server's Local Signer with the PIN
// typed in EagleView.
const LOCAL = 'http://127.0.0.1:5050';
let cache = { at: 0, st: undefined };

// status of the tool on this PC, or null when it does not run (cached 10 s)
export async function localSigner(force = false) {
  if (!force && cache.st !== undefined && Date.now() - cache.at < 10000) return cache.st;
  let st = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(LOCAL + '/status', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    const j = await r.json();
    st = j && j.tool ? j : null;
  } catch (e) { st = null; }
  cache = { at: Date.now(), st };
  return st;
}

// one-line text + colour for a signer status (tool or server signer)
export function signerLabel(st, viaTool) {
  if (st === undefined) return { text: '● checking DSC Signer...', color: '#64748b' };
  if (!st) return { text: '● DSC Signer app not running (start EagleView Signer)', color: '#b91c1c' };
  if (st.dll_found === false) return { text: '● DSC Signer running - token driver not found', color: '#b45309' };
  if (st.token_present === false) return { text: '● Plug in the DSC token', color: '#b45309' };
  const who = (st.certificate && st.certificate.name) || (Array.isArray(st.token_labels) ? st.token_labels.join(', ') : '');
  return { text: (viaTool ? '● EagleView Signer ready' : '● DSC Signer ready') + (who ? ' - ' + who : ''), color: '#15803d' };
}

// sign one PDF: through the tool on this PC (PIN asked by the tool when pin is empty), else through the server signer.
// Returns { blob, signer, via }. A cancelled PIN window throws an Error with .cancelled = true.
export async function signPdf(file, pin, purpose) {
  const tool = await localSigner();
  if (tool) {
    const fd = new FormData();
    fd.append('pdf', file, file.name || 'document.pdf');
    if (pin) fd.append('pin', pin);
    if (purpose) fd.append('purpose', purpose);
    let r;
    try { r = await fetch(LOCAL + '/sign-pdf', { method: 'POST', body: fd }); }
    catch (e) { cache = { at: 0, st: undefined }; throw new Error('EagleView Signer on this PC did not answer - is it still running?'); }
    if (!r.ok) {
      let j = {};
      try { j = await r.json(); } catch (e) { /* not JSON */ }
      const err = new Error(j.error || ('EagleView Signer: ' + r.status));
      if (j.cancelled) err.cancelled = true;
      throw err;
    }
    return { blob: await r.blob(), signer: r.headers.get('X-Signer-CN') || '', via: 'tool' };
  }
  const sf = new FormData();
  sf.append('pdf', file);
  sf.append('pin', pin || '');
  const sr = await fetch('/api/icegate/sign-pdf', { method: 'POST', body: sf });
  if (!sr.ok) throw new Error('DSC signer (' + (file.name || 'PDF') + '): ' + await sr.text());
  return { blob: await sr.blob(), signer: '', via: 'server' };
}
