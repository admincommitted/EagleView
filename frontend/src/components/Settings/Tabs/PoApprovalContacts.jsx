import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { ShoppingCart, Save, Loader2, CheckCircle, XCircle } from "lucide-react";

// 09-Nov-2026: who gets the Purchase Order approval request. Before, the e-mail went to an address written in the
// code (hr1@committedgroup.com) and the WhatsApp number had no place on any screen, so no WhatsApp went out.
// Saved as App Settings PO_DIRECTOR_EMAIL / PO_DIRECTOR_PHONE / PO_APPROVAL_LINK_BASE (read by routes/poRoutes.js).
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export default function PoApprovalContacts() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkBase, setLinkBase] = useState("");
  const [modulePhone, setModulePhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const show = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4500); };

  useEffect(() => {
    axios.get("/api/settings").then(r => {
      const s = r.data || {};
      setEmail(s.PO_DIRECTOR_EMAIL || "");
      setPhone(s.PO_DIRECTOR_PHONE || "");
      setLinkBase(s.PO_APPROVAL_LINK_BASE || "");
    }).catch(() => {});
    axios.get("/api/whatsapp/module-numbers").then(r => {
      const m = (r.data || []).find(x => /purchase/i.test(x.moduleName || ""));
      if (m) setModulePhone(m.phoneNumber);
    }).catch(() => {});
  }, []);

  const save = async () => {
    const emails = email.split(/[,;]/).map(x => x.trim()).filter(Boolean);
    const bad = emails.filter(x => !EMAIL_RE.test(x));
    if (!emails.length) { show("Enter the director's e-mail id", "error"); return; }
    if (bad.length) { show("Not an e-mail id: " + bad.join(", "), "error"); return; }
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && (digits.length < 10 || digits.length > 15)) { show("WhatsApp number: 10 digits, or with country code", "error"); return; }
    const base = linkBase.trim().replace(/\/+$/, "");
    if (base && !/^https?:\/\/[^\s/]+(:\d+)?$/.test(base)) { show("Link address like http://192.168.1.20:5001", "error"); return; }
    setSaving(true);
    try {
      await axios.post("/api/settings/bulk", { settings: { PO_DIRECTOR_EMAIL: emails.join(", "), PO_DIRECTOR_PHONE: phone.trim(), PO_APPROVAL_LINK_BASE: base } });
      setEmail(emails.join(", ")); setLinkBase(base);
      show("Purchase Order approval contacts saved ✅");
    } catch (e) { show(e?.response?.data?.error || "Could not save", "error"); }
    finally { setSaving(false); }
  };

  const card = { background: "var(--bg-panel,#fff)", border: "1px solid var(--border-color,#e2e8f0)", borderRadius: "10px", padding: "20px 24px", marginBottom: "16px" };
  const lab = { display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" };
  const inp = { width: "100%", padding: "8px 12px", border: "1px solid var(--border-color,#94a3b8)", borderRadius: "6px", fontSize: "0.875rem", color: "var(--text-main,#0f172a)", backgroundColor: "#fff", outline: "none", boxSizing: "border-box", textTransform: "none" };
  const hint = { fontSize: "0.72rem", color: "#64748b", marginTop: "4px", textTransform: "none" };

  return (
    <div style={card}>
      {toast && createPortal(
        <div style={{ position: "fixed", top: "80px", right: "16px", zIndex: 100000, background: toast.type === "error" ? "#fef2f2" : "#f0fdf4", border: "1px solid " + (toast.type === "error" ? "#fca5a5" : "#86efac"), color: toast.type === "error" ? "#dc2626" : "#16a34a", padding: "12px 18px", borderRadius: "8px", fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          {toast.type === "error" ? <XCircle size={16} /> : <CheckCircle size={16} />} {toast.msg}
        </div>, document.body)}
      <h4 style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
        <ShoppingCart size={14} /> Purchase Order approval
      </h4>
      <p style={{ ...hint, margin: "0 0 14px 0" }}>Who gets the approval request (with Approve / Reject / Hold links) when a PO is sent for approval.</p>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div>
          <label style={lab}>Director e-mail id(s)</label>
          <input style={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="director@committedcargo.com" />
          <div style={hint}>More than one: separate with a comma.</div>
        </div>
        <div>
          <label style={lab}>Director WhatsApp number</label>
          <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder={modulePhone || "98XXXXXXXX"} />
          <div style={hint}>{modulePhone ? `Blank = ${modulePhone} ("Purchase" number in Settings > WhatsApp).` : "Sent through the WhatsApp connected in Settings > WhatsApp."}</div>
        </div>
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={lab}>Approval link address (optional)</label>
        <input style={inp} value={linkBase} onChange={e => setLinkBase(e.target.value)} placeholder="Blank = this PC's network address, e.g. http://192.168.1.20:5001" />
        <div style={hint}>The Approve / Reject links open this address. Blank works inside the office network; give a public address only if the director approves from outside.</div>
      </div>
      <button onClick={save} disabled={saving} style={{ padding: "8px 20px", background: "var(--primary-color-start,#3b82f6)", color: "white", border: "none", borderRadius: "6px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
        {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}{saving ? "Saving..." : "Save PO approval contacts"}
      </button>
    </div>
  );
}
