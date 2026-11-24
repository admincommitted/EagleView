import React from 'react';
import toast from 'react-hot-toast';

// Keeps a printable AWB document (Delivery Order, SLI, Consignment Security Declaration) with its AWB.
//
// 30-Oct-2026: those three windows were print-only templates. Every box in them was unbound, so the
// screen-audit flagged their radio groups (cst, frt, csd_status) as boxes nothing reads - and it was
// right: you typed a Delivery Order, printed it, and tomorrow you typed the whole thing again.
// The backend already had a generic place for exactly this (/api/awb/extra/:type/:id/:docType, which
// the e-CSD window uses), so these windows now load and save there too.
//
// The fields are walked out of the DOM rather than lifted into React state: these templates are
// printed as they stand and have dozens of unnamed boxes, so a DOM walk keeps the markup untouched
// and cannot miss one. It is the same approach EcsdForm already used.
export default function useAwbExtraDoc(awbNumber, docType, formRef) {
    const [awbId, setAwbId] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [savedAt, setSavedAt] = React.useState(null);
    const [lookupDone, setLookupDone] = React.useState(false);

    const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
    const key = (el, i) => i + '|' + el.tagName + '|' + (el.type || '') + '|' + (el.name || el.placeholder || '');

    // find the AWB this document belongs to
    React.useEffect(() => {
        const no = String(awbNumber || '').trim();
        if (!no) { setLookupDone(true); return; }
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch('/api/awb/list?limit=500', { headers: auth() });
                const j = await r.json().catch(() => []);
                const list = Array.isArray(j) ? j : (j.data || []);
                const plain = (x) => String(x || '').replace(/[^0-9A-Za-z]/g, '');
                const hit = list.find(a => plain(a.awbNumber || a.fullAwbNumber || a.awbNo) === plain(no));
                if (!cancelled) setAwbId(hit ? hit.id : null);
            } catch (err) { /* without the id the window still prints, it just cannot save */ }
            if (!cancelled) setLookupDone(true);
        })();
        return () => { cancelled = true; };
    }, [awbNumber]);

    // put a previously saved copy back on screen
    React.useEffect(() => {
        if (!awbId || !formRef.current) return;
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch('/api/awb/extra/AWB/' + awbId + '/' + docType, { headers: auth() });
                const j = await r.json().catch(() => ({}));
                const fields = j && j.data && Array.isArray(j.data.fields) ? j.data.fields : null;
                if (!fields || cancelled || !formRef.current) return;
                const by = new Map(fields.map(f => [f.k, f.v]));
                formRef.current.querySelectorAll('input, select, textarea').forEach((el, i) => {
                    if (['button', 'submit', 'file'].includes(String(el.type || ''))) return;
                    const v = by.get(key(el, i));
                    if (v === undefined) return;
                    if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!v;
                    else el.value = v == null ? '' : v;
                });
                if (j.updatedAt) setSavedAt(j.updatedAt);
            } catch (err) { /* nothing saved before is the normal case */ }
        })();
        return () => { cancelled = true; };
    }, [awbId, docType, formRef]);

    const save = async () => {
        if (!String(awbNumber || '').trim()) { toast.error('Open this from an AWB - the document is kept with its AWB'); return; }
        if (!awbId) {
            toast.error(lookupDone
                ? 'AWB ' + awbNumber + ' is not saved yet, so there is nothing to keep this with. Save the AWB first.'
                : 'Still looking up the AWB, try again in a moment');
            return;
        }
        if (!formRef.current) return;
        setBusy(true);
        try {
            const fields = [];
            formRef.current.querySelectorAll('input, select, textarea').forEach((el, i) => {
                if (['button', 'submit', 'file'].includes(String(el.type || ''))) return;
                fields.push({ k: key(el, i), v: el.type === 'checkbox' || el.type === 'radio' ? !!el.checked : el.value });
            });
            const r = await fetch('/api/awb/extra/AWB/' + awbId + '/' + docType, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ data: { fields, savedAt: new Date().toISOString() } }),
            });
            if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error(j.error || ('HTTP ' + r.status));
            }
            setSavedAt(new Date().toISOString());
            toast.success('Kept with AWB ' + awbNumber + ' - it comes back filled in next time');
        } catch (err) {
            toast.error('Could not save: ' + err.message);
        }
        setBusy(false);
    };

    return { awbId, busy, save, savedAt, canSave: !!awbId };
}
