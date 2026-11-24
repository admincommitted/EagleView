import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Landmark, Save, Send, RefreshCw, Loader2, CheckCircle, XCircle } from "lucide-react";

// 17-Nov-2026: new customs / trade updates by e-mail with the PDF (backend utils/cbicCustomsWatch.js,
// API /api/settings/cbic-watch). Sources: CBIC latest updates (every 10 minutes), CBIC circulars, ICEGATE advisories,
// ICEGATE latest updates, DGFT and pages added here (every hour). Each source can be switched off.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const when = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };

export default function CbicWatchCard() {
  const [to, setTo] = useState("");
  const [on, setOn] = useState(true);
  const [st, setSt] = useState(null);
  const [off, setOff] = useState([]);
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);
  const show = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 6000); };

  const load = async () => {
    try { const r = await axios.get("/api/settings/cbic-watch"); took(r.data); } catch (e) { /* not reachable */ }
  };
  const took = (d) => { setSt(d); setTo(d.to || ""); setOn(d.on !== false); setOff((d.sources || []).filter(x => !x.on).map(x => x.id)); setPages(d.pages || ""); };
  useEffect(() => { load(); }, []);

  const save = async (extra = {}) => {
    const list = to.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
    const bad = list.filter(x => !EMAIL_RE.test(x));
    if (!list.length) { show("Enter at least one e-mail id", "error"); return false; }
    if (bad.length) { show("Not an e-mail id: " + bad.join(", "), "error"); return false; }
    const bp = pages.split(/\r?\n/).map(l => l.trim()).filter(Boolean).filter(l => !/^(.*\|\s*)?https?:\/\/[^\s|]+$/i.test(l));
    if (bp.length) { show("Not a page address (http:// or https://): " + bp[0], "error"); return false; }
    setBusy("save");
    try { const r = await axios.post("/api/settings/cbic-watch", { to: list.join(", "), on, off, pages, ...extra }); took(r.data); show("Customs and trade updates saved ✅"); return true; }
    catch (e) { show(e?.response?.data?.error || "Could not save", "error"); return false; }
    finally { setBusy(""); }
  };
  const test = async () => {
    if (!(await save())) return;
    setBusy("test");
    try { const r = await axios.post("/api/settings/cbic-watch/test"); show(`Test mail sent to ${r.data.to.join(", ")}${r.data.pdf ? " with the PDF of " + r.data.number : " (PDF not attached: " + r.data.pdfError + ")"}`); }
    catch (e) { show(e?.response?.data?.error || "Test mail failed", "error"); }
    finally { setBusy(""); }
  };
  // 20-Nov-2026: a test mail of the newest CBIC exchange rates (the table that is mailed when they change)
  const testRates = async () => {
    if (!(await save())) return;
    setBusy("testRates");
    try { const r = await axios.post("/api/settings/cbic-watch/test", { source: "cbic_exrate" }); show(`Exchange-rate test mail sent to ${r.data.to.join(", ")} (notification ${r.data.number})`); }
    catch (e) { show(e?.response?.data?.error || "Test mail failed", "error"); }
    finally { setBusy(""); }
  };
  const check = async () => {
    if (!(await save())) return;
    setBusy("check");
    try {
      const r = await axios.post("/api/settings/cbic-watch/check");
      const d = r.data;
      if (d.busy) { show("A check is already running - try again in a minute.", "error"); return; }
      if (d.error) { show(d.error, "error"); return; }
      const parts = [];
      if (d.sent && d.sent.length) parts.push("Mailed: " + d.sent.join(", "));
      if (d.seeded && d.seeded.length) parts.push(`First look at ${d.seeded.length} page(s): what is there now is noted, new ones are mailed from now on`);
      if (d.failed && d.failed.length) parts.push("Not mailed: " + d.failed.map(f => f.number).join(", "));
      if (d.errors && d.errors.length) parts.push(`${d.errors.length} page(s) could not be read`);
      show(parts.length ? parts.join(". ") : "Nothing new.", (d.failed && d.failed.length) || (d.errors && d.errors.length && !(d.sent && d.sent.length)) ? "error" : "success");
    } catch (e) { show(e?.response?.data?.error || "Check failed", "error"); }
    finally { setBusy(""); load(); }
  };

  const card = { background: "var(--bg-panel,#fff)", border: "1px solid var(--border-color,#e2e8f0)", borderRadius: "10px", padding: "20px 24px", marginBottom: "16px" };
  const lab = { display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" };
  const inp = { width: "100%", padding: "8px 12px", border: "1px solid var(--border-color,#94a3b8)", borderRadius: "6px", fontSize: "0.875rem", color: "var(--text-main,#0f172a)", backgroundColor: "#fff", outline: "none", boxSizing: "border-box", textTransform: "none" };
  const hint = { fontSize: "0.72rem", color: "#64748b", marginTop: "4px", textTransform: "none" };
  const btn = (primary) => ({ padding: "8px 16px", background: primary ? "var(--primary-color-start,#3b82f6)" : "#fff", color: primary ? "white" : "#0f172a", border: primary ? "none" : "1px solid #cbd5e1", borderRadius: "6px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" });
  const spin = <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />;
  const last = st && st.last;

  return (
    <div style={card} className="ev-trade-watch">
      {/* e-mail ids and page addresses are case-sensitive to read - keep them as typed (index.css puts inputs in capitals) */}
      <style>{'.ev-trade-watch input, .ev-trade-watch textarea { text-transform: none !important; }'}</style>
      {toast && createPortal(
        <div style={{ position: "fixed", top: "80px", right: "16px", zIndex: 100000, maxWidth: 520, background: toast.type === "error" ? "#fef2f2" : "#f0fdf4", border: "1px solid " + (toast.type === "error" ? "#fca5a5" : "#86efac"), color: toast.type === "error" ? "#dc2626" : "#16a34a", padding: "12px 18px", borderRadius: "8px", fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          {toast.type === "error" ? <XCircle size={16} /> : <CheckCircle size={16} />} {toast.msg}
        </div>, document.body)}
      <h4 style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
        <Landmark size={14} /> Customs and trade updates
      </h4>
      <p style={{ ...hint, margin: "0 0 14px 0" }}>New notifications, circulars, advisories and public notices are mailed with their PDF. The first look at a source only notes what is there now; after that every new entry is mailed once.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "end", marginBottom: "12px" }}>
        <div>
          <label style={lab}>Send to</label>
          <input style={inp} value={to} onChange={e => setTo(e.target.value)} placeholder="admin@committedcargo.com, impops@committedcargo.com" />
          <div style={hint}>More than one: separate with a comma. Sent with the SMTP set up above.</div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 600, color: "#334155", paddingBottom: "22px", textTransform: "none" }}>
          <input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} /> Mail new ones
        </label>
      </div>
      <div style={{ marginBottom: "12px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", color: "#334155", textTransform: "none" }}>
          <thead><tr style={{ textAlign: "left", color: "#64748b" }}><th style={{ padding: "4px 8px 4px 0" }}>Source</th><th style={{ padding: 4 }}>Checked</th><th style={{ padding: 4 }}>Last result</th></tr></thead>
          <tbody>{(st && st.sources ? st.sources : []).map(x => {
            const s2 = x.state; const isOn = !off.includes(x.id);
            return (
              <tr key={x.id} style={{ borderTop: "1px solid #eef2f6", opacity: isOn ? 1 : 0.55 }}>
                <td style={{ padding: "5px 8px 5px 0" }}>
                  <label style={{ display: "flex", gap: "6px", alignItems: "flex-start", cursor: "pointer" }}>
                    <input type="checkbox" checked={isOn} onChange={e => setOff(o => e.target.checked ? o.filter(i => i !== x.id) : [...o, x.id])} style={{ marginTop: 2 }} />
                    <span><b style={{ fontWeight: 600 }}>{x.label}</b><br /><a href={x.site} target="_blank" rel="noreferrer" style={{ color: "#64748b" }}>{String(x.site).replace(/^https?:\/\//, "").slice(0, 60)}</a></span>
                  </label>
                </td>
                <td style={{ padding: 5, whiteSpace: "nowrap", verticalAlign: "top" }}>every {x.every}</td>
                <td style={{ padding: 5, verticalAlign: "top" }}>
                  {!s2 ? <span style={{ color: "#94a3b8" }}>not checked yet</span> : <>
                    <span style={{ color: s2.ok ? "#16a34a" : "#dc2626" }}>{when(s2.at)}{s2.ok ? ` - ${s2.count} entries read` : ` - ${s2.error}`}</span>
                    {s2.newest && <div>Newest: <a href={s2.newest.view} target="_blank" rel="noreferrer">{[s2.newest.number, s2.newest.title].filter(Boolean).join(" - ").slice(0, 120)}</a>{s2.newest.date ? ` (${s2.newest.dateLabel ? s2.newest.dateLabel.toLowerCase() + " " : ""}${s2.newest.date})` : ""}</div>}
                    {/* 19-Nov-2026: each page of the source (ICEGATE's 13 advisory categories, e.g. "Integrate with ICEGATE on API's"; DGFT's 4 lists) */}
                    {Array.isArray(s2.pages) && s2.pages.length > 1 && (
                      <details style={{ marginTop: 3 }}>
                        <summary style={{ cursor: "pointer", color: "#475569" }}>Each page ({s2.pages.length})</summary>
                        <table style={{ borderCollapse: "collapse", marginTop: 2 }}><tbody>{s2.pages.map((pg, i) => (
                          <tr key={i} style={{ borderTop: "1px dotted #e2e8f0" }}>
                            <td style={{ padding: "2px 8px 2px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>{String(pg.label || "").replace(/^(ICEGATE advisories|DGFT) - /, "")}</td>
                            {pg.error ? <td style={{ padding: 2, color: "#dc2626" }}>{pg.error}</td> : <>
                              <td style={{ padding: "2px 8px 2px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>{pg.count}</td>
                              <td style={{ padding: 2, verticalAlign: "top" }}>{pg.newest ? <><a href={pg.newest.view} target="_blank" rel="noreferrer">{[pg.newest.number, pg.newest.title].filter(Boolean).join(" - ").slice(0, 90)}</a>{pg.newest.date ? ` (${pg.newest.date})` : ""}</> : <span style={{ color: "#94a3b8" }}>empty</span>}</td>
                            </>}
                          </tr>))}</tbody></table>
                      </details>)}
                  </>}
                </td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      <div style={{ marginBottom: "12px" }}>
        <label style={lab}>Other pages to watch (for example a Custom House public notice page)</label>
        <textarea style={{ ...inp, minHeight: "64px", fontFamily: "inherit", resize: "vertical" }} value={pages} onChange={e => setPages(e.target.value)} placeholder={"ACC Delhi public notices | https://...\nMumbai Customs Zone-I public notices | https://..."} />
        <div style={hint}>One page per line: a name, a bar ( | ), then the page address. Every PDF link that newly appears on the page is mailed. Up to 20 pages.</div>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        <button style={btn(true)} disabled={!!busy} onClick={() => save()}>{busy === "save" ? spin : <Save size={14} />}Save</button>
        <button style={btn(false)} disabled={!!busy} onClick={test}>{busy === "test" ? spin : <Send size={14} />}Send a test mail</button>
        <button style={btn(false)} disabled={!!busy} onClick={testRates} title="Mails the newest CBIC exchange rates with the change from the notification before - the mail that comes when the rates change">{busy === "testRates" ? spin : <Send size={14} />}Exchange-rate test mail</button>
        <button style={btn(false)} disabled={!!busy} onClick={check}>{busy === "check" ? spin : <RefreshCw size={14} />}Check now</button>
      </div>
      <div style={{ fontSize: "0.78rem", color: "#475569", textTransform: "none" }}>
        {last ? <div style={{ marginBottom: 8 }}>Last check {when(last.at)}{last.by && last.by !== "Auto" ? ` (by ${last.by})` : ""}: {last.error ? <span style={{ color: "#dc2626" }}>{last.error}</span> : last.sent && last.sent.length ? <b>mailed {last.sent.join(", ")}</b> : last.seeded && last.seeded.length ? "present entries noted" : last.first ? "present notifications noted" : "nothing new"}{last.failed && last.failed.length ? <span style={{ color: "#dc2626" }}> - not mailed: {last.failed.map(f => f.number + " (" + f.error + ")").join("; ")}</span> : null}</div> : <div style={{ marginBottom: 8 }}>Not checked yet - the first check runs 2 minutes after EagleView starts.</div>}
      </div>
    </div>
  );
}
