import React, { useState, useEffect } from "react";
import {
  Mail, Save, Send, Eye, EyeOff, CheckCircle, XCircle, Loader2,
  Bell, Clock, Zap, TestTube2, ChevronDown, ChevronRight, Settings2,
  FileText, Shield, User, Package, CreditCard, AlertTriangle
} from "lucide-react";
import axios from "axios";
import { createPortal } from "react-dom";
import PoApprovalContacts from "./PoApprovalContacts";
import CbicWatchCard from "./CbicWatchCard";

/* ── Email notification types ─────────────────────────────────── */
const EMAIL_TYPES = [
  {
    id: "password_reset",
    icon: <Shield size={15} color="#ef4444"/>,
    label: "Password Reset",
    desc: "Sent when a user requests a new password",
    defaultSubject: "Your Password Has Been Reset — Committed Cargo ERP",
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>Your ERP account password has been reset.</p>
<table style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>User ID:</b></td><td>{userId}</td></tr>
  <tr><td><b>New Password:</b></td><td style="font-family:monospace;color:#dc2626;">{password}</td></tr>
</table>
<p>Please log in and change your password immediately.</p>
<p style="color:#64748b;font-size:12px;">This is an automated message. Do not reply.</p>`,
  },
  {
    id: "kyc_notification",
    icon: <User size={15} color="#7c3aed"/>,
    label: "KYC Notification",
    desc: "Sent when KYC documents are submitted or require action",
    defaultSubject: "KYC Update — {partyName} — Committed Cargo",
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>This is to inform you regarding the KYC status for <b>{partyName}</b>.</p>
<table style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>Party Name:</b></td><td>{partyName}</td></tr>
  <tr><td><b>KYC Status:</b></td><td style="color:#7c3aed;font-weight:bold;">{kycStatus}</td></tr>
  <tr><td><b>Remarks:</b></td><td>{remarks}</td></tr>
</table>
<p>Please take the necessary action at the earliest.</p>`,
  },
  {
    id: "shipment_status",
    icon: <Package size={15} color="#2563eb"/>,
    label: "Shipment Status",
    desc: "Sent to client when shipment status changes",
    defaultSubject: "Shipment Status Update — AWB {awb} — Committed Cargo",
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>We would like to inform you of the latest status update for your consignment.</p>
<table style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>AWB Number:</b></td><td style="font-weight:bold;">{awb}</td></tr>
  <tr><td><b>Current Status:</b></td><td style="color:#2563eb;font-weight:bold;">{status}</td></tr>
  <tr><td><b>Updated On:</b></td><td>{date}</td></tr>
</table>
<p>For any queries, please contact us at <a href="mailto:info@committedcargo.com">info@committedcargo.com</a>.</p>
<p style="color:#64748b;font-size:12px;">This is an automated status notification.</p>`,
  },
  {
    id: "invoice",
    icon: <CreditCard size={15} color="#16a34a"/>,
    label: "Invoice / Billing",
    desc: "Sent when an invoice is generated for a party",
    defaultSubject: "Invoice #{invoiceNo} — Committed Cargo Care Ltd.",
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>Please find below the details of your invoice.</p>
<table style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>Invoice No:</b></td><td style="font-weight:bold;">#{invoiceNo}</td></tr>
  <tr><td><b>Date:</b></td><td>{date}</td></tr>
  <tr><td><b>Amount:</b></td><td style="color:#16a34a;font-weight:bold;">₹{amount}</td></tr>
  <tr><td><b>Due Date:</b></td><td>{dueDate}</td></tr>
</table>
<p>Please process the payment by the due date to avoid any inconvenience.</p>
<p>For queries, contact our accounts team.</p>`,
  },
  {
    id: "account_alert",
    icon: <AlertTriangle size={15} color="#f59e0b"/>,
    label: "Account Alert",
    desc: "Sent for account lock, unlock, or activation events",
    defaultSubject: "Account Alert — {alertType} — Committed Cargo ERP",
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>This is an automated security alert regarding your ERP account.</p>
<table style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>User ID:</b></td><td>{userId}</td></tr>
  <tr><td><b>Alert Type:</b></td><td style="color:#b45309;font-weight:bold;">{alertType}</td></tr>
  <tr><td><b>Date & Time:</b></td><td>{datetime}</td></tr>
</table>
<p>If this was not you, please contact your system administrator immediately.</p>`,
  },
  {
    id: "customs_update",
    icon: <FileText size={15} color="#0891b2"/>,
    label: "Customs / Clearance Update",
    desc: "Sent when customs clearance status changes",
    defaultSubject: "Customs Clearance Update — {jobNo} — Committed Cargo",
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>There is an update on the customs clearance for your shipment.</p>
<table style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>Job No:</b></td><td style="font-weight:bold;">{jobNo}</td></tr>
  <tr><td><b>AWB / BL No:</b></td><td>{awb}</td></tr>
  <tr><td><b>Status:</b></td><td style="color:#0891b2;font-weight:bold;">{status}</td></tr>
  <tr><td><b>Remarks:</b></td><td>{remarks}</td></tr>
</table>
<p>Please take the necessary action if required.</p>
<p style="color:#64748b;font-size:12px;">Committed Cargo Care Ltd. | <a href="mailto:info@committedcargo.com">info@committedcargo.com</a></p>`,
  },
];

/* ── Sample data for preview ────────────────────────────────────── */
const SAMPLE_DATA = {
  name: "Rahul Sharma", userId: "ADMIN01", password: "Xk9#mP2q",
  partyName: "ABC Exports Pvt. Ltd.", kycStatus: "Pending Verification", remarks: "PAN card required",
  awb: "020-12345678", status: "Shipment Arrived at Delhi Airport", date: new Date().toLocaleDateString("en-IN"),
  invoiceNo: "INV-2024-0891", amount: "12,500.00", dueDate: "30 Sep 2026",
  alertType: "Account Locked", datetime: new Date().toLocaleString("en-IN"),
  jobNo: "IMP-2024-1203", status2: "Examination Ordered",
};

function fillTemplate(tpl, data) {
  return tpl
    .replace(/{name}/g, data.name)
    .replace(/{userId}/g, data.userId)
    .replace(/{password}/g, data.password)
    .replace(/{partyName}/g, data.partyName)
    .replace(/{kycStatus}/g, data.kycStatus)
    .replace(/{remarks}/g, data.remarks)
    .replace(/{awb}/g, data.awb)
    .replace(/{status}/g, data.status)
    .replace(/{date}/g, data.date)
    .replace(/{invoiceNo}/g, data.invoiceNo)
    .replace(/{amount}/g, data.amount)
    .replace(/{dueDate}/g, data.dueDate)
    .replace(/{alertType}/g, data.alertType)
    .replace(/{datetime}/g, data.datetime)
    .replace(/{jobNo}/g, data.jobNo);
}

export default function EmailSettingsTab() {
  /* ── SMTP state ─────────────────────────────────────── */
  const [smtp, setSmtp] = useState({
    SMTP_HOST: "", SMTP_PORT: "587", SMTP_USER: "",
    SMTP_PASS: "", SMTP_SECURE: "false", SMTP_FROM_NAME: "Committed Cargo ERP",
  });
  const [showPass, setShowPass]       = useState(false);
  const [testEmail, setTestEmail]     = useState("");
  const [testingSmtp, setTestingSmtp] = useState(false);

  /* ── Per-type config state ──────────────────────────── */
  const [typeConfig, setTypeConfig] = useState(() => {
    const cfg = {};
    EMAIL_TYPES.forEach(t => {
      cfg[t.id] = {
        enabled:      true,
        subject:      t.defaultSubject,
        body:         t.defaultBody,
        notifyMode:   "instant",
        notifyTime:   "09:00",
      };
    });
    return cfg;
  });

  /* ── UI state ───────────────────────────────────────── */
  const [activeType,  setActiveType]  = useState("password_reset");
  const [showPreview, setShowPreview] = useState(true);
  const [savingAll,   setSavingAll]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Load settings ──────────────────────────────────── */
  useEffect(() => {
    axios.get("/api/settings").then(r => {
      const s = r.data;
      setSmtp(p => ({
        SMTP_HOST:      s.SMTP_HOST      || p.SMTP_HOST,
        SMTP_PORT:      s.SMTP_PORT      || p.SMTP_PORT,
        SMTP_USER:      s.SMTP_USER      || p.SMTP_USER,
        SMTP_PASS:      (s.SMTP_PASS === "***" ? "" : s.SMTP_PASS) || "",
        SMTP_SECURE:    s.SMTP_SECURE    || p.SMTP_SECURE,
        SMTP_FROM_NAME: s.SMTP_FROM_NAME || p.SMTP_FROM_NAME,
      }));
      // Load per-type configs
      EMAIL_TYPES.forEach(t => {
        const key = "email_tpl_" + t.id;
        if (s[key]) {
          try {
            const parsed = JSON.parse(s[key]);
            setTypeConfig(p => ({ ...p, [t.id]: { ...p[t.id], ...parsed } }));
          } catch {}
        }
      });
    }).catch(() => {});
  }, []);

  const setSmtpField = (k, v) => setSmtp(p => ({ ...p, [k]: v }));
  const setTypeCfg   = (id, k, v) => setTypeConfig(p => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const currentType  = EMAIL_TYPES.find(t => t.id === activeType);
  const currentCfg   = typeConfig[activeType] || {};

  /* ── Test SMTP ──────────────────────────────────────── */
  const handleTestSmtp = async () => {
    if (!testEmail) { showToast("Enter a test email address", "error"); return; }
    setTestingSmtp(true);
    try {
      await axios.post("/api/email/test", { to: testEmail, smtp });
      showToast("Test email sent to " + testEmail + "! Check inbox.");
    } catch (err) { showToast(err?.response?.data?.error || "SMTP test failed. Check credentials.", "error"); }
    finally { setTestingSmtp(false); }
  };

  /* ── Save All ───────────────────────────────────────── */
  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const settings = { ...smtp };
      EMAIL_TYPES.forEach(t => {
        settings["email_tpl_" + t.id] = JSON.stringify(typeConfig[t.id]);
      });
      await axios.post("/api/settings/bulk", { settings });
      showToast("All email settings saved!");
    } catch (err) { showToast(err?.response?.data?.error || "Failed to save", "error"); }
    finally { setSavingAll(false); }
  };

  /* ── Save current type template ─────────────────────── */
  const handleSaveType = async () => {
    setSaving(true);
    try {
      const key = "email_tpl_" + activeType;
      await axios.post("/api/settings/bulk", { settings: { [key]: JSON.stringify(currentCfg) } });
      showToast(currentType?.label + " template saved!");
    } catch (err) { showToast(err?.response?.data?.error || "Failed to save", "error"); }
    finally { setSaving(false); }
  };

  /* ── Styles ─────────────────────────────────────────── */
  const card  = { background:"var(--bg-panel)", border:"1px solid var(--border-color,#e2e8f0)", borderRadius:"10px", padding:"20px 24px", marginBottom:"16px" };
  const inp   = { width:"100%", padding:"8px 12px", border:"1px solid var(--border-color,#94a3b8)", borderRadius:"6px", fontSize:"0.875rem", color:"var(--text-main,#0f172a)", backgroundColor:"#ffffff", outline:"none", boxSizing:"border-box" };
  const label = { fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" };

  const PREVIEW_HEADER = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background:#1e3a5f;padding:20px 24px;display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:#25D366;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">📧</div>
        <div>
          <div style="color:white;font-weight:700;font-size:16px;">Committed Cargo Care Ltd.</div>
          <div style="color:#94a3b8;font-size:12px;">info@committedcargo.com</div>
        </div>
      </div>
      <div style="padding:24px;">
        <div style="font-size:13px;color:#374151;line-height:1.7;">
  `;
  const PREVIEW_FOOTER = `
        </div>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8;">
        Committed Cargo Care Ltd. &nbsp;|&nbsp; This is an automated notification &nbsp;|&nbsp; Do not reply
      </div>
    </div>
  `;

  return (
    <div style={{ width: "100%" }}>
      {/* Toast */}
      {/* 09-Nov-2026: on <body>, so the top bar does not hide it */}
      {toast && createPortal((
        <div style={{ position:"fixed", top:"80px", right:"16px", zIndex:100000, background:toast.type==="error"?"#fef2f2":"#f0fdf4", border:"1px solid "+(toast.type==="error"?"#fca5a5":"#86efac"), color:toast.type==="error"?"#dc2626":"#16a34a", padding:"12px 18px", borderRadius:"8px", fontWeight:600, fontSize:"0.875rem", display:"flex", alignItems:"center", gap:"8px", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }}>
          {toast.type==="error"?<XCircle size={16}/>:<CheckCircle size={16}/>} {toast.msg}
        </div>
      ), document.body)}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px" }}>
        <div style={{ width:"38px", height:"38px", background:"#1e3a5f", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Mail size={20} color="white"/>
        </div>
        <div>
          <h3 style={{ margin:0, fontSize:"1.05rem", fontWeight:700, color:"var(--text-main,#0f172a)" }}>Email Notification Settings</h3>
          <p style={{ margin:0, fontSize:"0.78rem", color:"var(--text-muted,#64748b)" }}>Configure SMTP, templates and schedules for each notification type</p>
        </div>
      </div>

      {/* 09-Nov-2026: PO approval e-mail / WhatsApp */}
      <PoApprovalContacts />
      <CbicWatchCard />

      {/* ── SMTP Configuration ── */}
      <div style={card}>
        <h4 style={{ margin:"0 0 16px 0", fontSize:"0.85rem", fontWeight:700, color:"#0f172a", display:"flex", alignItems:"center", gap:"6px" }}>
          <Settings2 size={14}/> SMTP Configuration
        </h4>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:"12px", marginBottom:"12px" }}>
          <div>
            <span style={label}>SMTP Host</span>
            <input style={inp} value={smtp.SMTP_HOST} onChange={e=>setSmtpField("SMTP_HOST",e.target.value)} placeholder="smtp.gmail.com"/>
          </div>
          <div>
            <span style={label}>Port</span>
            <input style={inp} value={smtp.SMTP_PORT} onChange={e=>setSmtpField("SMTP_PORT",e.target.value)} placeholder="587"/>
          </div>
          <div>
            <span style={label}>Encryption</span>
            <select style={{...inp,cursor:"pointer"}} value={smtp.SMTP_SECURE} onChange={e=>setSmtpField("SMTP_SECURE",e.target.value)}>
              <option value="false">STARTTLS (Port 587)</option>
              <option value="true">SSL/TLS (Port 465)</option>
            </select>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", marginBottom:"16px" }}>
          <div>
            <span style={label}>Email (Username)</span>
            <input style={inp} value={smtp.SMTP_USER} onChange={e=>setSmtpField("SMTP_USER",e.target.value)} placeholder="noreply@committedcargo.com" type="email"/>
          </div>
          <div>
            <span style={label}>Password / App Password</span>
            <div style={{ position:"relative" }}>
              <input type={showPass?"text":"password"} style={{...inp,paddingRight:"38px"}} value={smtp.SMTP_PASS} onChange={e=>setSmtpField("SMTP_PASS",e.target.value)} placeholder="App password"/>
              <span onClick={()=>setShowPass(!showPass)} style={{ position:"absolute", right:"10px", top:"50%", transform:"translateY(-50%)", cursor:"pointer", color:"#94a3b8" }}>
                {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
              </span>
            </div>
          </div>
          <div>
            <span style={label}>From Name (Display)</span>
            <input style={inp} value={smtp.SMTP_FROM_NAME} onChange={e=>setSmtpField("SMTP_FROM_NAME",e.target.value)} placeholder="Committed Cargo ERP"/>
          </div>
        </div>
        {/* Test */}
        <div style={{ display:"flex", gap:"10px", alignItems:"center", padding:"12px 14px", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"8px" }}>
          <TestTube2 size={15} color="#92400e"/>
          <input style={{...inp,flex:1}} type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="Send test email to..."/>
          <button onClick={handleTestSmtp} disabled={testingSmtp} style={{ padding:"8px 16px", background:"#f59e0b", color:"white", border:"none", borderRadius:"6px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", whiteSpace:"nowrap" }}>
            {testingSmtp?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Send size={14}/>}
            {testingSmtp?"Sending...":"Send Test"}
          </button>
        </div>
      </div>

      {/* ── Email Type Editor ── */}
      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:"16px", alignItems:"start" }}>

        {/* Left: Type list */}
        <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
          {EMAIL_TYPES.map(t => (
            <button key={t.id} onClick={()=>setActiveType(t.id)} style={{
              display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px",
              border:"1.5px solid "+(activeType===t.id?"var(--primary-color-start,#3b82f6)":"var(--border-color,#e2e8f0)"),
              borderRadius:"8px", cursor:"pointer", textAlign:"left",
              background: activeType===t.id?"var(--bg-app,#eff6ff)":"var(--bg-panel,#ffffff)",
              borderLeft: activeType===t.id?"4px solid var(--primary-color-start,#3b82f6)":"4px solid transparent",
              transition:"all 0.15s"
            }}>
              <div style={{ flexShrink:0 }}>{t.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:"0.8rem", color: activeType===t.id?"var(--primary-color-start,#3b82f6)":"var(--text-main,#0f172a)", marginBottom:"2px" }}>{t.label}</div>
                <div style={{ fontSize:"0.68rem", color:"#94a3b8", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.desc}</div>
              </div>
              {/* Enabled indicator */}
              <div style={{ width:"8px", height:"8px", borderRadius:"50%", background: typeConfig[t.id]?.enabled?"#22c55e":"#e2e8f0", flexShrink:0 }}/>
            </button>
          ))}
        </div>

        {/* Right: Editor panel */}
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>

          {/* Type header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"var(--bg-panel)", border:"1px solid var(--border-color,#e2e8f0)", borderRadius:"10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              {currentType?.icon}
              <div>
                <div style={{ fontWeight:700, fontSize:"0.9rem", color:"var(--text-main,#0f172a)" }}>{currentType?.label}</div>
                <div style={{ fontSize:"0.72rem", color:"#64748b" }}>{currentType?.desc}</div>
              </div>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
              <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#64748b" }}>Enabled</span>
              <div style={{ position:"relative", width:"40px", height:"22px" }}>
                <input type="checkbox" checked={!!currentCfg.enabled} onChange={e=>setTypeCfg(activeType,"enabled",e.target.checked)} style={{ opacity:0, width:0, height:0 }}/>
                <span onClick={()=>setTypeCfg(activeType,"enabled",!currentCfg.enabled)} style={{ position:"absolute", top:0, left:0, right:0, bottom:0, borderRadius:"34px", backgroundColor:currentCfg.enabled?"#22c55e":"#cbd5e1", cursor:"pointer", transition:".3s" }}>
                  <span style={{ position:"absolute", height:"16px", width:"16px", left:currentCfg.enabled?"21px":"3px", bottom:"3px", backgroundColor:"white", borderRadius:"50%", transition:".3s" }}/>
                </span>
              </div>
            </label>
          </div>

          {/* Subject */}
          <div style={{ padding:"14px 16px", background:"var(--bg-panel)", border:"1px solid var(--border-color,#e2e8f0)", borderRadius:"10px" }}>
            <span style={label}>Email Subject</span>
            <input style={inp} value={currentCfg.subject||""} onChange={e=>setTypeCfg(activeType,"subject",e.target.value)} placeholder="Email subject..."/>
            <p style={{ margin:"4px 0 0", fontSize:"0.7rem", color:"#94a3b8" }}>Variables: {["{name}","{awb}","{userId}","{partyName}","{invoiceNo}","{jobNo}","{alertType}"].map(v=><code key={v} style={{background:"#f1f5f9",padding:"1px 4px",borderRadius:"3px",marginRight:"4px",fontSize:"0.68rem"}}>{v}</code>)}</p>
          </div>

          {/* Notification Mode */}
          <div style={{ padding:"14px 16px", background:"var(--bg-panel)", border:"1px solid var(--border-color,#e2e8f0)", borderRadius:"10px" }}>
            <span style={{...label, marginBottom:"10px"}}>Notification Mode</span>
            <div style={{ display:"flex", gap:"10px" }}>
              {[{id:"instant",icon:<Zap size={13}/>,label:"Instant",desc:"Send immediately"},{id:"scheduled",icon:<Clock size={13}/>,label:"Scheduled",desc:"Send at a set time"}].map(m=>(
                <label key={m.id} style={{ flex:1, display:"flex", gap:"8px", alignItems:"center", padding:"10px 12px", border:"1.5px solid "+(currentCfg.notifyMode===m.id?"var(--primary-color-start,#3b82f6)":"var(--border-color,#e2e8f0)"), borderRadius:"8px", cursor:"pointer", background:currentCfg.notifyMode===m.id?"#eff6ff":"var(--bg-app,#f8fafc)", transition:"all 0.15s" }}>
                  <input type="radio" name={"notifyMode_"+activeType} checked={currentCfg.notifyMode===m.id} onChange={()=>setTypeCfg(activeType,"notifyMode",m.id)} style={{ accentColor:"var(--primary-color-start,#3b82f6)" }}/>
                  <div style={{ display:"flex", alignItems:"center", gap:"5px", fontWeight:700, fontSize:"0.78rem", color:currentCfg.notifyMode===m.id?"var(--primary-color-start,#3b82f6)":"var(--text-main,#0f172a)" }}>{m.icon} {m.label}</div>
                  <span style={{ fontSize:"0.68rem", color:"#94a3b8" }}>{m.desc}</span>
                </label>
              ))}
              {currentCfg.notifyMode==="scheduled" && (
                <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 12px", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"8px" }}>
                  <Clock size={14} color="#92400e"/>
                  <input type="time" value={currentCfg.notifyTime||"09:00"} onChange={e=>setTypeCfg(activeType,"notifyTime",e.target.value)} style={{...inp, width:"120px", fontWeight:700, fontSize:"0.95rem", color:"#92400e", background:"white", border:"1px solid #fde68a"}}/>
                  <span style={{ fontSize:"0.7rem", color:"#92400e" }}>IST</span>
                </div>
              )}
            </div>
          </div>

          {/* Body + Preview */}
          <div style={{ padding:"14px 16px", background:"var(--bg-panel)", border:"1px solid var(--border-color,#e2e8f0)", borderRadius:"10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
              <span style={label}>Email Body (HTML)</span>
              <button onClick={()=>setShowPreview(!showPreview)} style={{ display:"flex", alignItems:"center", gap:"5px", padding:"4px 10px", border:"1px solid var(--border-color,#e2e8f0)", borderRadius:"6px", background:"var(--bg-app)", cursor:"pointer", fontSize:"0.72rem", fontWeight:600, color:"#64748b" }}>
                <Eye size={12}/> {showPreview?"Hide":"Show"} Preview
              </button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns: showPreview?"1fr 1fr":"1fr", gap:"12px" }}>
              <div>
                <div style={{ fontSize:"0.68rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:"5px" }}>✏️ HTML Editor</div>
                <textarea
                  value={currentCfg.body||""}
                  onChange={e=>setTypeCfg(activeType,"body",e.target.value)}
                  rows={14}
                  style={{...inp, resize:"vertical", fontFamily:"'Courier New',monospace", fontSize:"0.75rem", lineHeight:"1.6"}}
                />
              </div>
              {showPreview && (
                <div>
                  <div style={{ fontSize:"0.68rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:"5px" }}>📧 Email Preview</div>
                  <div style={{ border:"1px solid #e2e8f0", borderRadius:"8px", overflow:"hidden", background:"white" }}>
                    {/* Subject bar */}
                    <div style={{ padding:"8px 12px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:"0.75rem" }}>
                      <span style={{ color:"#94a3b8", fontWeight:600 }}>Subject: </span>
                      <span style={{ color:"#0f172a", fontWeight:700 }}>{fillTemplate(currentCfg.subject||"", SAMPLE_DATA)}</span>
                    </div>
                    {/* Body preview */}
                    <div style={{ padding:"10px", maxHeight:"320px", overflowY:"auto" }}>
                      <div
                        style={{ fontSize:"13px", lineHeight:"1.6" }}
                        dangerouslySetInnerHTML={{ __html: PREVIEW_HEADER + fillTemplate(currentCfg.body||"", SAMPLE_DATA) + PREVIEW_FOOTER }}
                      />
                    </div>
                    <div style={{ padding:"6px 12px", background:"#f8fafc", borderTop:"1px solid #e2e8f0", fontSize:"0.65rem", color:"#94a3b8", textAlign:"center" }}>
                      Sample preview with dummy data
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reset to default */}
            <div style={{ marginTop:"10px", display:"flex", gap:"8px" }}>
              <button onClick={handleSaveType} disabled={saving} style={{ padding:"7px 16px", background:"var(--primary-color-start,#3b82f6)", color:"white", border:"none", borderRadius:"6px", fontWeight:700, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}>
                {saving?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Save size={13}/>}
                {saving?"Saving...":"Save This Template"}
              </button>
              <button onClick={()=>setTypeCfg(activeType,"body",currentType?.defaultBody||"")} style={{ padding:"7px 14px", background:"transparent", color:"#64748b", border:"1px solid var(--border-color,#e2e8f0)", borderRadius:"6px", fontSize:"0.78rem", cursor:"pointer" }}>
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Save All ── */}
      <div style={{ position:"sticky", bottom:0, zIndex:10, background:"linear-gradient(to top, var(--bg-app,#f8fafc) 80%, transparent)", padding:"16px 0 4px", marginTop:"8px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
        <div style={{ fontSize:"0.75rem", color:"var(--text-muted,#64748b)" }}>
          💾 Click <b>Save All Settings</b> to save SMTP config + all email templates and schedules
        </div>
        <button onClick={handleSaveAll} disabled={savingAll} style={{ padding:"7px 18px", background:savingAll?"#94a3b8":"linear-gradient(135deg,#1e3a5f,#2563eb)", color:"white", border:"none", borderRadius:"6px", fontWeight:600, fontSize:"0.82rem", cursor:savingAll?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:"6px", boxShadow:savingAll?"none":"0 2px 8px rgba(37,99,235,0.3)", transition:"all 0.2s", whiteSpace:"nowrap" }}>
          {savingAll?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}
          {savingAll?"Saving...":"Save All Settings"}
        </button>
      </div>
    </div>
  );
}

