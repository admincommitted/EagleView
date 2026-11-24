import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle, Wifi, RefreshCw, Send, CheckCircle, XCircle,
  Loader2, Smartphone, Users, Unplug, Key, Eye, EyeOff, Save,
  TestTube2, Shield, Zap, Clock, Bell, BellOff, PlayCircle, Inbox
} from "lucide-react";
import axios from "axios";

const PROVIDERS = [
  { value: "msg91",   label: "MSG91",                              desc: "Indian provider. API Key = MSG91 authkey. From Number = your integrated WhatsApp number. Set the approved template below." },
  { value: "meta",    label: "Meta (Official WhatsApp Business API)", desc: "API Key = permanent Access Token. Phone Number ID = the numeric ID from Meta > WhatsApp > API Setup (not the phone number)." },
  { value: "twilio",  label: "Twilio",                             desc: "International. API Key = AccountSID:AuthToken. From Number = your Twilio WhatsApp sender (+...)." },
  { value: "2factor", label: "2Factor.in (SMS only)",              desc: "Sends a normal SMS, NOT WhatsApp. API Key from 2factor.in, Sender ID = 6-letter DLT header." },
];

export default function WhatsappSettingsTab() {
  const [qrState, setQrState]       = useState({ status: "disconnected", qr: null, number: null });
  const [connecting, setConnecting] = useState(false);
  const eventSourceRef              = useRef(null);

  const [apiSettings, setApiSettings] = useState({
    whatsapp_provider:    "msg91",
    whatsapp_api_key:     "",
    whatsapp_sender_id:   "",
    whatsapp_from_number: "",
    whatsapp_enabled:     "true",
    whatsapp_template_name: "",
    whatsapp_template_lang: "en",
    whatsapp_template_namespace: "",
    whatsapp_api_version: "v21.0",
  });
  const [showKey, setShowKey]       = useState(false);
  const [savingApi, setSavingApi]   = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestNum, setApiTestNum] = useState("");

  // Notification mode
  const [notifyMode, setNotifyMode]     = useState("instant");   // instant | scheduled
  const [notifyTime, setNotifyTime]     = useState("09:00");
  const [savingNotify, setSavingNotify] = useState(false);
  const [queueStats, setQueueStats]     = useState({ pending: 0, sentToday: 0 });
  const [flushing, setFlushing]         = useState(false);

  const [activeMode, setActiveMode] = useState("qr");
  const [template, setTemplate]     = useState("Dear {name},\n\nYour consignment *{awb}* status:\n\n📦 {status}\n\n_Committed Cargo Care Ltd._");
  const [testNumber, setTestNumber] = useState("");
  const [testMsg, setTestMsg]       = useState("");
  const [testingQr, setTestingQr]   = useState(false);
  const [savingTpl, setSavingTpl]   = useState(false);
  const [savingAll, setSavingAll]   = useState(false);
  const [toast, setToast]           = useState(null);
  const [moduleNumbers, setModuleNumbers] = useState([]);
  const [newModName, setNewModName] = useState('');
  const [newModPhone, setNewModPhone] = useState('');
  const [modSuccessMsg, setModSuccessMsg] = useState('');

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const subscribeToEvents = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource("/api/whatsapp/events");
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "qr") {
          setQrState(p => ({ ...p, qr: d.qr, status: "qr_ready" }));
          setConnecting(false);
        } else if (d.type === "status" || d.type === "state") {
          setQrState(p => ({ ...p, status: d.status, number: d.number || p.number, error: d.error !== undefined ? d.error : p.error, qr: (d.status === "connected" || d.status === "disconnected" || d.status === "starting") ? null : (d.qr || p.qr) }));
          if (d.status === "connected")    showToast("WhatsApp connected! ✅");
          if (d.status === "disconnected" && d.type === "status") showToast(d.error || "WhatsApp disconnected.", "error");
          if (d.status === "connected" || d.status === "disconnected" || d.status === "qr_ready") setConnecting(false);
        }
      } catch(err) {}
    };
  };

  const loadQueueStats = () => {
    axios.get("/api/whatsapp/queue-stats").then(r => setQueueStats(r.data)).catch(() => {});
  };

  useEffect(() => {
    axios.get("/api/whatsapp/state").then(r => setQrState(r.data)).catch(() => {});
    axios.get("/api/whatsapp/module-numbers").then(r => setModuleNumbers(r.data)).catch(() => {});
    axios.get("/api/settings").then(r => {
      const s = r.data;
      setApiSettings(p => ({
        ...p,
        whatsapp_provider:    s.whatsapp_provider    || "msg91",
        whatsapp_api_key:     (s.whatsapp_api_key === "***" ? "" : s.whatsapp_api_key) || "",
        whatsapp_sender_id:   s.whatsapp_sender_id   || "",
        whatsapp_from_number: s.whatsapp_from_number || "",
        whatsapp_enabled:     s.whatsapp_enabled      || "true",
        whatsapp_template_name: s.whatsapp_template_name || "",
        whatsapp_template_lang: s.whatsapp_template_lang || "en",
        whatsapp_template_namespace: s.whatsapp_template_namespace || "",
        whatsapp_api_version: s.whatsapp_api_version || "v21.0",
      }));
      if (s.whatsapp_status_template) setTemplate(s.whatsapp_status_template);
      if (s.whatsapp_mode)            setActiveMode(s.whatsapp_mode);
      if (s.whatsapp_notify_mode)     setNotifyMode(s.whatsapp_notify_mode);
      if (s.whatsapp_notify_time)     setNotifyTime(s.whatsapp_notify_time);
    }).catch(() => {});
    subscribeToEvents();
    loadQueueStats();
    const interval = setInterval(loadQueueStats, 30000);
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      clearInterval(interval);
    };
  }, []);

  const handleConnect    = async () => { setConnecting(true); setQrState(p => ({ ...p, status: "starting", error: null, qr: null })); try { subscribeToEvents(); await axios.post("/api/whatsapp/connect", { force: true }); } catch (err) { showToast(err?.response?.data?.error || "Failed", "error"); setConnecting(false); } };
  // 09-Nov-2026: the live updates (EventSource) can be cut by the dev proxy; the state is also asked for every 4 s
  // while a start is going on, so the QR still shows up
  useEffect(() => {
    if (!["starting", "connecting", "qr_ready"].includes(qrState.status)) return;
    const t = setInterval(() => { axios.get("/api/whatsapp/state").then(r => { setQrState(p => ({ ...p, ...r.data })); if (r.data.status !== "starting") setConnecting(false); }).catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, [qrState.status]);
  const handleDisconnect = async () => { try { await axios.post("/api/whatsapp/disconnect"); setQrState({ status: "disconnected", qr: null, number: null }); } catch (err) { showToast(err?.response?.data?.error || "Failed", "error"); } };
  const handleQrTest     = async () => { if (!testNumber) { showToast("Enter a number", "error"); return; } setTestingQr(true); try { await axios.post("/api/whatsapp/test", { toNumber: testNumber, message: testMsg || undefined }); showToast("Sent! \u2705"); } catch (err) { showToast(err?.response?.data?.error || "Failed", "error"); } finally { setTestingQr(false); } };
  const setApi           = (k, v) => setApiSettings(p => ({ ...p, [k]: v }));
  const handleSaveApi    = async () => { setSavingApi(true); try { const s = { ...apiSettings, whatsapp_mode: "api" }; if (!s.whatsapp_api_key) delete s.whatsapp_api_key; await axios.post("/api/settings/bulk", { settings: s }); showToast("API settings saved! \u2705"); } catch (err) { showToast(err?.response?.data?.error || "Failed", "error"); } finally { setSavingApi(false); } };
  const handleApiTest    = async () => { if (!apiTestNum) { showToast("Enter a number", "error"); return; } setTestingApi(true); try { await axios.post("/api/whatsapp/api-test", { toNumber: apiTestNum }); showToast("Test sent via API! \u2705"); } catch (err) { showToast(err?.response?.data?.error || "Failed", "error"); } finally { setTestingApi(false); } };
  const handleSaveTpl    = async () => { setSavingTpl(true); try { await axios.post("/api/settings/bulk", { settings: { whatsapp_status_template: template } }); showToast("Template saved!"); } catch (err) { showToast(err?.response?.data?.error || "Failed", "error"); } finally { setSavingTpl(false); } };
  const handleModeSwitch = async (m) => { setActiveMode(m); await axios.post("/api/settings/bulk", { settings: { whatsapp_mode: m } }).catch(() => {}); };

  const handleSaveNotify = async () => {
    setSavingNotify(true);
    try {
      await axios.post("/api/settings/bulk", { settings: { whatsapp_notify_mode: notifyMode, whatsapp_notify_time: notifyTime } });
      await axios.post("/api/whatsapp/restart-scheduler");
      showToast("Notification schedule saved! \u2705");
    } catch (err) { showToast(err?.response?.data?.error || "Failed to save", "error"); }
    finally { setSavingNotify(false); }
  };

  
  const handleAddModuleNumber = async () => {
      if(!newModName || !newModPhone) { showToast("Name and Number required", "error"); return; }
      try {
          await axios.post("/api/whatsapp/module-numbers", { moduleName: newModName, phoneNumber: newModPhone });
          showToast("Saved module number");
          setModSuccessMsg('✅ Number added and saved successfully!');
          setTimeout(() => setModSuccessMsg(''), 4000);
          const r = await axios.get("/api/whatsapp/module-numbers");
          setModuleNumbers(r.data);
          setNewModName(''); setNewModPhone('');
      } catch(e) { showToast(e?.response?.data?.error || "Failed to save", "error"); }
  };
  const handleDeleteModuleNumber = async (mName) => {
      try {
          await axios.delete("/api/whatsapp/module-numbers/" + encodeURIComponent(mName));
          showToast("Deleted");
          setModSuccessMsg('🗑️ Number deleted successfully!');
          setTimeout(() => setModSuccessMsg(''), 4000);
          const r = await axios.get("/api/whatsapp/module-numbers");
          setModuleNumbers(r.data);
      } catch(e) { showToast("Failed to delete", "error"); }
  };

  const handleSaveAll = async () => {
    
    setSavingAll(true);
    try {
      // Build full settings object
      const allSettings = {
        whatsapp_mode: activeMode,
        whatsapp_notify_mode: notifyMode,
        whatsapp_notify_time: notifyTime,
        whatsapp_status_template: template,
        ...(activeMode === "api" ? {
          whatsapp_provider:    apiSettings.whatsapp_provider,
          whatsapp_sender_id:   apiSettings.whatsapp_sender_id,
          whatsapp_from_number: apiSettings.whatsapp_from_number,
          whatsapp_enabled:     apiSettings.whatsapp_enabled,
          whatsapp_template_name: apiSettings.whatsapp_template_name,
          whatsapp_template_lang: apiSettings.whatsapp_template_lang,
          whatsapp_template_namespace: apiSettings.whatsapp_template_namespace,
          whatsapp_api_version: apiSettings.whatsapp_api_version,
          ...(apiSettings.whatsapp_api_key ? { whatsapp_api_key: apiSettings.whatsapp_api_key } : {})
        } : {})
      };
      await axios.post("/api/settings/bulk", { settings: allSettings });
      await axios.post("/api/whatsapp/restart-scheduler");
      showToast("All WhatsApp settings saved! \u2705");
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to save", "error");
    } finally { setSavingAll(false); }
  };

  const handleFlushNow = async () => {
    setFlushing(true);
    try {
      const r = await axios.post("/api/whatsapp/flush-queue");
      if (r.data.failed) showToast("Sent to " + (r.data.sent || 0) + " parties, " + r.data.failed + " failed: " + ((r.data.errors || [])[0] || ""), "error");
      else showToast("Sent " + (r.data.sent || 0) + " parties, " + (r.data.total || 0) + " notifications. \u2705");
      loadQueueStats();
    } catch (err) { showToast(err?.response?.data?.error || "Failed", "error"); }
    finally { setFlushing(false); }
  };

  const card = { background: "var(--bg-panel,#ffffff)", border: "1px solid var(--border-color,#e2e8f0)", borderRadius: "10px", padding: "20px 24px", marginBottom: "16px" };
  const inp  = { width: "100%", padding: "8px 12px", border: "1px solid var(--border-color,#94a3b8)", borderRadius: "6px", fontSize: "0.875rem", color: "var(--text-main,#0f172a)", backgroundColor: "#ffffff", outline: "none", boxSizing: "border-box" };
  const sc   = ({ starting: { bg:"#eff6ff",border:"#93c5fd",text:"#2563eb",dot:"#3b82f6" }, disconnected: { bg:"#fef2f2",border:"#fca5a5",text:"#dc2626",dot:"#ef4444" }, qr_ready: { bg:"#fefce8",border:"#fde047",text:"#ca8a04",dot:"#eab308" }, connecting: { bg:"#eff6ff",border:"#93c5fd",text:"#2563eb",dot:"#3b82f6" }, connected: { bg:"#f0fdf4",border:"#86efac",text:"#16a34a",dot:"#22c55e" } })[qrState.status] || { bg:"#fef2f2",border:"#fca5a5",text:"#dc2626",dot:"#ef4444" };
  const statusLabel = { starting:"Starting WhatsApp Web... (QR in about 30-60 seconds)", disconnected:"Disconnected", qr_ready:"Scan QR from mobile WhatsApp", connecting:"Connecting...", connected:"Connected" + (qrState.number ? " ("+qrState.number+")" : "") }[qrState.status];

  return (
    <div style={{ width: "100%" }}>
      {/* 09-Nov-2026: drawn on <body> - inside the page it sat under the top bar, so "Saved" was never seen */}
      {toast && createPortal((
        <div style={{ position:"fixed", top:"80px", right:"16px", zIndex:100000, background: toast.type==="error"?"#fef2f2":"#f0fdf4", border:"1px solid "+(toast.type==="error"?"#fca5a5":"#86efac"), color: toast.type==="error"?"#dc2626":"#16a34a", padding:"12px 18px", borderRadius:"8px", fontWeight:600, fontSize:"0.875rem", display:"flex", alignItems:"center", gap:"8px", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }}>
          {toast.type==="error"?<XCircle size={16}/>:<CheckCircle size={16}/>} {toast.msg}
        </div>
      ), document.body)}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px" }}>
        <div style={{ width:"38px", height:"38px", background:"#25D366", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <MessageCircle size={22} color="white" />
        </div>
        <div>
          <h3 style={{ margin:0, fontSize:"1.05rem", fontWeight:700, color:"var(--text-main,#0f172a)" }}>WhatsApp Notifications</h3>
          <p style={{ margin:0, fontSize:"0.78rem", color:"var(--text-muted,#64748b)" }}>QR Scan or API — Instant or Scheduled</p>
        </div>
      </div>

      {/* Connection Mode Tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:"20px", background:"var(--bg-app)", borderRadius:"10px", padding:"4px" }}>
        {[{ id:"qr", label:"📱 QR Scan (Free)", desc:"Scan from mobile" }, { id:"api", label:"\uD83D\uDD11 API Key", desc:"MSG91 / 2Factor etc." }].map(m => (
          <button key={m.id} onClick={()=>handleModeSwitch(m.id)} style={{ flex:1, padding:"10px 16px", border:"none", borderRadius:"8px", cursor:"pointer", background: activeMode===m.id?"white":"transparent", color: activeMode===m.id?"#0f172a":"#64748b", fontWeight: activeMode===m.id?700:500, fontSize:"0.85rem", boxShadow: activeMode===m.id?"0 2px 8px rgba(0,0,0,0.1)":"none", transition:"all 0.2s", display:"flex", flexDirection:"column", alignItems:"center", gap:"2px" }}>
            <span>{m.label}</span>
            <span style={{ fontSize:"0.7rem", color: activeMode===m.id?"#64748b":"#94a3b8", fontWeight:400 }}>{m.desc}</span>
          </button>
        ))}
      </div>

      {/* QR Mode */}
      {activeMode==="qr" && (
        <>
          <div style={{ ...card, background:sc.bg, border:"1px solid "+sc.border }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:sc.dot, boxShadow:"0 0 6px "+sc.dot }} />
                <span style={{ fontWeight:700, color:sc.text, fontSize:"0.9rem" }}>{statusLabel}</span>
              </div>
              {qrState.status==="disconnected" && qrState.error && <div style={{ flex:1, margin:"0 14px", fontSize:"0.78rem", color:"#b91c1c" }}>{qrState.error}</div>}
              <div style={{ display:"flex", gap:"8px" }}>
                {qrState.status==="disconnected" && <button onClick={handleConnect} disabled={connecting} style={{ padding:"7px 16px", background:"#25D366", color:"white", border:"none", borderRadius:"6px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}>{connecting?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Wifi size={14}/>}{connecting?"Starting...":"Connect"}</button>}
                {(qrState.status==="qr_ready"||qrState.status==="connecting"||qrState.status==="starting") && <button onClick={handleConnect} style={{ padding:"7px 16px", background:"#f59e0b", color:"white", border:"none", borderRadius:"6px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}><RefreshCw size={14}/> Refresh QR</button>}
                {qrState.status==="connected" && <button onClick={handleDisconnect} style={{ padding:"7px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}><Unplug size={14}/> Disconnect</button>}
              </div>
            </div>
          </div>
          {qrState.qr && (
            <div style={{ ...card, textAlign:"center", padding:"28px 24px" }}>
              <div style={{ fontSize:"0.9rem", fontWeight:700, color:"#0f172a", marginBottom:"16px", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}><Smartphone size={18} color="#25D366"/> Scan QR code with your mobile WhatsApp</div>
              <img src={qrState.qr} alt="QR" style={{ width:"260px", height:"260px", borderRadius:"12px", border:"3px solid #25D366", padding:"8px", background:"white" }}/>
              <div style={{ marginTop:"14px", fontSize:"0.8rem", color:"#64748b", lineHeight:"2" }}><b>Steps:</b><br/>1. Open WhatsApp on your mobile<br/>2. <b>3 dots (⋮) &rarr; Linked Devices &rarr; Link a Device</b><br/>3. Scan the QR code with your camera</div>
              <div style={{ marginTop:"8px", fontSize:"0.73rem", color:"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", gap:"5px" }}><Loader2 size={11} style={{animation:"spin 1s linear infinite"}}/> QR refreshes every 60 seconds</div>
            </div>
          )}
          {qrState.status==="connected" && (
            <div style={card}>
              <h4 style={{ margin:"0 0 12px 0", fontSize:"0.85rem", fontWeight:700, color:"#0f172a", display:"flex", alignItems:"center", gap:"6px" }}><Send size={14} color="#25D366"/> Send Test Message</h4>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <input type="text" value={testNumber} onChange={e=>setTestNumber(e.target.value)} placeholder="Mobile number (e.g. 9876543210)" style={inp}/>
                <textarea value={testMsg} onChange={e=>setTestMsg(e.target.value)} placeholder="Message (optional)" rows={2} style={{...inp,resize:"vertical"}}/>
                <button onClick={handleQrTest} disabled={testingQr} style={{ padding:"8px 20px", background:"#25D366", color:"white", border:"none", borderRadius:"6px", fontWeight:700, fontSize:"0.875rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", alignSelf:"flex-start" }}>{testingQr?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Send size={14}/>}{testingQr?"Sending...":"Send WhatsApp"}</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* API Mode */}
      {activeMode==="api" && (
        <>
          <div style={card}>
            <h4 style={{ margin:"0 0 16px 0", fontSize:"0.85rem", fontWeight:700, color:"#0f172a", display:"flex", alignItems:"center", gap:"6px" }}><Shield size={14}/> API Configuration</h4>
            <div style={{ marginBottom:"14px" }}>
              <label style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>API Provider</label>
              <select value={apiSettings.whatsapp_provider} onChange={e=>setApi("whatsapp_provider",e.target.value)} style={{...inp,cursor:"pointer"}}>
                {PROVIDERS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <p style={{ margin:"4px 0 0", fontSize:"0.72rem", color:"#64748b" }}>{PROVIDERS.find(p=>p.value===apiSettings.whatsapp_provider)?.desc}</p>
            </div>
            <div style={{ marginBottom:"14px" }}>
              <label style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>API Key</label>
              <div style={{ position:"relative" }}>
                <input type={showKey?"text":"password"} value={apiSettings.whatsapp_api_key} onChange={e=>setApi("whatsapp_api_key",e.target.value)} placeholder="Enter API key..." style={{...inp,paddingRight:"42px"}}/>
                <span onClick={()=>setShowKey(!showKey)} style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", cursor:"pointer", color:"#94a3b8" }}>{showKey?<EyeOff size={15}/>:<Eye size={15}/>}</span>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"16px" }}>
              {apiSettings.whatsapp_provider==="2factor" && <div><label style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Sender ID</label><input type="text" value={apiSettings.whatsapp_sender_id} onChange={e=>setApi("whatsapp_sender_id",e.target.value.toUpperCase())} placeholder="EAGLEV" style={inp} maxLength={6}/></div>}
              {apiSettings.whatsapp_provider!=="2factor" && <div><label style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>{apiSettings.whatsapp_provider==="meta"?"Phone Number ID":"From Number"}</label><input type="text" value={apiSettings.whatsapp_from_number} onChange={e=>setApi("whatsapp_from_number",e.target.value.trim())} placeholder={apiSettings.whatsapp_provider==="meta"?"e.g. 106540352242922":"+91XXXXXXXXXX"} style={inp}/></div>}
              {apiSettings.whatsapp_provider==="meta" && <div><label style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Graph API version</label><input type="text" value={apiSettings.whatsapp_api_version} onChange={e=>setApi("whatsapp_api_version",e.target.value.trim())} placeholder="v21.0" style={inp}/></div>}
              <label style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"0.8rem", fontWeight:600, color:"#334155", marginTop:"18px" }}>
                <input type="checkbox" checked={String(apiSettings.whatsapp_enabled)!=="false"} onChange={e=>setApi("whatsapp_enabled", e.target.checked?"true":"false")}/> Sending switched on
              </label>
            </div>
            {(apiSettings.whatsapp_provider==="msg91" || apiSettings.whatsapp_provider==="meta") && (
              <div style={{ border:"1px dashed #93c5fd", background:"#eff6ff", borderRadius:"8px", padding:"12px", marginBottom:"16px" }}>
                <div style={{ fontSize:"0.75rem", fontWeight:700, color:"#1e40af", marginBottom:"6px" }}>Approved WhatsApp template (needed to message a customer first)</div>
                <div style={{ fontSize:"0.72rem", color:"#1e3a8a", marginBottom:"10px" }}>WhatsApp delivers a plain text only if the customer messaged you in the last 24 hours. For status updates, create a template with 3 values and get it approved: {"{{1}}"} = party name, {"{{2}}"} = AWB / job / BE no, {"{{3}}"} = status. Leave the name empty to send plain text.</div>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr" + (apiSettings.whatsapp_provider==="msg91" ? " 2fr" : ""), gap:"10px" }}>
                  <div><label style={{ fontSize:"0.7rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Template name</label><input type="text" value={apiSettings.whatsapp_template_name} onChange={e=>setApi("whatsapp_template_name",e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} placeholder="shipment_status" style={inp}/></div>
                  <div><label style={{ fontSize:"0.7rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Language</label><input type="text" value={apiSettings.whatsapp_template_lang} onChange={e=>setApi("whatsapp_template_lang",e.target.value.trim())} placeholder="en" style={inp}/></div>
                  {apiSettings.whatsapp_provider==="msg91" && <div><label style={{ fontSize:"0.7rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Namespace (from MSG91)</label><input type="text" value={apiSettings.whatsapp_template_namespace} onChange={e=>setApi("whatsapp_template_namespace",e.target.value.trim())} placeholder="optional" style={inp}/></div>}
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleSaveApi} disabled={savingApi} style={{ padding:"8px 20px", background:"var(--primary-color-start,#3b82f6)", color:"white", border:"none", borderRadius:"6px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}>{savingApi?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}{savingApi?"Saving...":"Save API Settings"}</button>
            </div>
          </div>
          <div style={{...card, borderColor:"#fef3c7", background:"#fffbeb"}}>
            <h4 style={{ margin:"0 0 12px 0", fontSize:"0.85rem", fontWeight:700, color:"#92400e", display:"flex", alignItems:"center", gap:"6px" }}><TestTube2 size={14}/> Test API Message</h4>
            <div style={{ display:"flex", gap:"10px" }}>
              <input type="text" value={apiTestNum} onChange={e=>setApiTestNum(e.target.value)} placeholder="Mobile number (e.g. 9876543210)" style={{...inp,flex:1}}/>
              <button onClick={handleApiTest} disabled={testingApi} style={{ padding:"8px 16px", background:"#25D366", color:"white", border:"none", borderRadius:"6px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", whiteSpace:"nowrap" }}>{testingApi?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<MessageCircle size={14}/>}{testingApi?"Testing...":"Send Test"}</button>
            </div>
          </div>
        </>
      )}

      {/* ── Notification Mode ── */}
      <div style={card}>
        <h4 style={{ margin:"0 0 16px 0", fontSize:"0.85rem", fontWeight:700, color:"#0f172a", display:"flex", alignItems:"center", gap:"6px" }}>
          <Bell size={14} color="#f59e0b"/> Client Status Notification Mode
        </h4>

        {/* Mode radio toggle */}
        <div style={{ display:"flex", gap:"12px", marginBottom:"18px" }}>
          {[
            { id:"instant",   icon:<Zap size={15}/>,   label:"Instant",   desc:"Send immediately when new status arrives" },
            { id:"scheduled", icon:<Clock size={15}/>,  label:"Scheduled", desc:"Send all pending notifications at a specific time daily" },
          ].map(m => (
            <label key={m.id} style={{
              flex:1, display:"flex", gap:"12px", alignItems:"flex-start", padding:"14px 16px",
              border:"2px solid "+(notifyMode===m.id?"var(--primary-color-start,#3b82f6)":"var(--border-color,#e2e8f0)"),
              borderRadius:"10px", cursor:"pointer",
              background: notifyMode===m.id?"var(--bg-app,#eff6ff)":"var(--bg-panel,#ffffff)",
              transition:"all 0.2s"
            }}>
              <input type="radio" name="notifyMode" value={m.id} checked={notifyMode===m.id} onChange={()=>setNotifyMode(m.id)} style={{ accentColor:"var(--primary-color-start,#3b82f6)", marginTop:"2px" }}/>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", fontWeight:700, fontSize:"0.85rem", color:"var(--text-main,#0f172a)", marginBottom:"3px" }}>{m.icon}{m.label}</div>
                <div style={{ fontSize:"0.75rem", color:"var(--text-muted,#64748b)" }}>{m.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Time picker (only for scheduled) */}
        {notifyMode==="scheduled" && (
          <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px", background:"#fffbeb", borderRadius:"8px", border:"1px solid #fde047", marginBottom:"16px" }}>
            <Clock size={18} color="#ca8a04"/>
            <div>
              <div style={{ fontSize:"0.8rem", fontWeight:700, color:"#92400e", marginBottom:"4px" }}>Send at (IST)</div>
              <input type="time" value={notifyTime} onChange={e=>setNotifyTime(e.target.value)} style={{...inp, width:"140px", fontWeight:700, fontSize:"1rem", color:"#92400e", background:"white" }}/>
            </div>
            <div style={{ fontSize:"0.75rem", color:"#92400e", lineHeight:"1.6" }}>
              Every day at <b>{notifyTime}</b> IST, all pending AWB status<br/>updates will be sent in a batch.
            </div>
          </div>
        )}

        {/* Queue stats */}
        <div style={{ display:"flex", gap:"10px", marginBottom:"16px" }}>
          <div style={{ flex:1, padding:"12px 14px", background:"#fef9c3", borderRadius:"8px", border:"1px solid #fde68a", textAlign:"center" }}>
            <div style={{ fontSize:"1.4rem", fontWeight:800, color:"#b45309" }}>{queueStats.pending}</div>
            <div style={{ fontSize:"0.72rem", color:"#92400e", fontWeight:600 }}>Pending in Queue</div>
          </div>
          <div style={{ flex:1, padding:"12px 14px", background:"#f0fdf4", borderRadius:"8px", border:"1px solid #86efac", textAlign:"center" }}>
            <div style={{ fontSize:"1.4rem", fontWeight:800, color:"#16a34a" }}>{queueStats.sentToday}</div>
            <div style={{ fontSize:"0.72rem", color:"#15803d", fontWeight:600 }}>Sent Today</div>
          </div>
          {queueStats.failed > 0 && (
            <div title={queueStats.lastError || ""} style={{ flex:1, padding:"12px 14px", background:"#fef2f2", borderRadius:"8px", border:"1px solid #fca5a5", textAlign:"center" }}>
              <div style={{ fontSize:"1.4rem", fontWeight:800, color:"#dc2626" }}>{queueStats.failed}</div>
              <div style={{ fontSize:"0.72rem", color:"#b91c1c", fontWeight:600 }}>Failed (5 tries)</div>
            </div>
          )}
          <button onClick={handleFlushNow} disabled={flushing||queueStats.pending===0} style={{
            padding:"10px 16px", background: flushing||queueStats.pending===0?"#94a3b8":"#f59e0b",
            color:"white", border:"none", borderRadius:"8px", fontWeight:700, fontSize:"0.82rem",
            cursor: flushing||queueStats.pending===0?"not-allowed":"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", gap:"4px"
          }}>
            {flushing?<Loader2 size={18} style={{animation:"spin 1s linear infinite"}}/>:<PlayCircle size={18}/>}
            <span style={{fontSize:"0.72rem"}}>{flushing?"Sending...":"Send Now"}</span>
          </button>
        </div>

        {queueStats.lastError && <div style={{ fontSize:"0.72rem", color:"#b91c1c", marginBottom:"10px" }}>Last send error: {queueStats.lastError}</div>}
        <button onClick={handleSaveNotify} disabled={savingNotify} style={{ padding:"8px 20px", background:"var(--primary-color-start,#3b82f6)", color:"white", border:"none", borderRadius:"6px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}>
          {savingNotify?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}
          {savingNotify?"Saving...":"Save Notification Settings"}
        </button>
      </div>

      {/* Notification flows */}
      <div style={card}>
        <h4 style={{ margin:"0 0 12px 0", fontSize:"0.85rem", fontWeight:700, color:"#0f172a", display:"flex", alignItems:"center", gap:"6px" }}><Zap size={14} color="#f59e0b"/> What Gets Sent Automatically</h4>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {[
            { icon:"🔑", label:"Password Reset", desc:"User Profile mobile → new password will be sent (always instant)" },
            { icon:"📦", label:"Shipment Status (Client)", desc:"Party Master mobile → " + (notifyMode==="instant"?"sent immediately":"queued, batch sent at "+notifyTime) },
            { icon:"🔒", label:"Account Lock/Activate", desc:"Employee mobile → account status alert (always instant)" },
          ].map((item,i) => (
            <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start", padding:"8px 12px", background:"var(--bg-app)", borderRadius:"7px", border:"1px solid var(--border-color,#e2e8f0)" }}>
              <span style={{ fontSize:"16px" }}>{item.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:"0.82rem", color:"var(--text-main,#0f172a)" }}>{item.label}</div>
                <div style={{ fontSize:"0.73rem", color:"var(--text-muted,#64748b)", marginTop:"2px" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template with Live Preview + Samples */}
      <div style={card}>
        <h4 style={{ margin:"0 0 4px 0", fontSize:"0.85rem", fontWeight:700, color:"#0f172a", display:"flex", alignItems:"center", gap:"6px" }}>
          <Users size={14}/> Client Status Message Template
        </h4>
        <p style={{ margin:"0 0 14px 0", fontSize:"0.73rem", color:"#64748b" }}>
          Variables:&nbsp;
          {["{name}","{awb}","{status}"].map(v=>(
            <code key={v} style={{ background:"#e0f2fe", color:"#0284c7", padding:"2px 7px", borderRadius:"4px", fontWeight:700, fontSize:"0.72rem", marginRight:"6px", border:"1px solid #bae6fd" }}>{v}</code>
          ))}
        </p>

        {/* Sample Templates */}
        <div style={{ marginBottom:"14px" }}>
          <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:"8px" }}>📋 Sample Templates — Click to Apply</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
            {[
              { label:"📄 Standard", preview:"Formal, short", tpl:"Dear {name},\n\nYour consignment *{awb}* status:\n\n📦 {status}\n\n_Committed Cargo Care Ltd._" },
              { label:"✈️ Air Cargo", preview:"Airline style", tpl:"✈️ *Flight Update — Committed Cargo*\n\nDear {name},\n\nAWB No: *{awb}*\nStatus: {status}\n\nFor assistance: +91-XXXXXXXXXX\n\n_This is an auto-generated message._" },
              { label:"🚨 Urgent Alert", preview:"Attention-grabbing", tpl:"🚨 *URGENT — Action Required*\n\nDear {name},\n\nYour shipment *{awb}* needs attention:\n\n⚠️ {status}\n\nPlease contact us immediately.\n📞 Call: +91-XXXXXXXXXX\n\n_Committed Cargo Care Ltd._" },
              { label:"🎉 Delivered", preview:"Cheerful delivery", tpl:"🎉 Great News, {name}!\n\nYour consignment *{awb}* has been successfully delivered!\n\n✅ {status}\n\nThank you for choosing *Committed Cargo Care Ltd.*\nWe look forward to serving you again! 🌟" },
              { label:"🕒 Delay Notice", preview:"Apology + ETA", tpl:"Dear {name},\n\nWe regret to inform you that your consignment *{awb}* has been delayed.\n\n🕒 Current Status: {status}\n\nWe sincerely apologize for the inconvenience and are working to resolve this at the earliest.\n\n_Committed Cargo Care Ltd._" },
              { label:"📋 Customs Hold", preview:"Customs clearance", tpl:"⚠️ *Customs Update — {name}*\n\nYour consignment *{awb}* is currently:\n\n🛑 {status}\n\nPlease arrange the required documents at the earliest to avoid demurrage charges.\n\n📞 Contact: +91-XXXXXXXXXX\n_Committed Cargo Care Ltd._" },
            ].map((s,i) => (
              <button key={i} onClick={()=>setTemplate(s.tpl)} style={{
                padding:"10px 12px", background: template===s.tpl?"#e0f2fe":"var(--bg-app,#f8fafc)",
                border:"1.5px solid "+(template===s.tpl?"#0284c7":"var(--border-color,#e2e8f0)"),
                borderRadius:"8px", cursor:"pointer", textAlign:"left", transition:"all 0.15s"
              }}>
                <div style={{ fontWeight:700, fontSize:"0.8rem", color: template===s.tpl?"#0284c7":"var(--text-main,#0f172a)", marginBottom:"2px" }}>{s.label}</div>
                <div style={{ fontSize:"0.7rem", color:"#64748b" }}>{s.preview}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor + Preview side by side */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", alignItems:"start" }}>
          {/* Left: Editor */}
          <div>
            <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:"6px" }}>✏️ Edit Template</div>
            <textarea
              value={template}
              onChange={e=>setTemplate(e.target.value)}
              rows={10}
              style={{...inp, resize:"vertical", fontFamily:"'Courier New',monospace", fontSize:"0.8rem", lineHeight:"1.7"}}
            />
          </div>

          {/* Right: WhatsApp-style Preview */}
          <div>
            <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:"6px" }}>💬 WhatsApp Preview</div>
            <div style={{ background:"#ddd5c8", borderRadius:"10px", padding:"12px", minHeight:"220px" }}>
              {/* Bot message bubble */}
              <div style={{ display:"flex", alignItems:"flex-end", gap:"6px", marginBottom:"4px" }}>
                <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"#25D366", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <MessageCircle size={14} color="white"/>
                </div>
                <div style={{ background:"white", borderRadius:"0 10px 10px 10px", padding:"10px 14px", maxWidth:"85%", boxShadow:"0 1px 2px rgba(0,0,0,0.15)", position:"relative" }}>
                  {/* Render template with sample values — bold *text* and line breaks */}
                  <div style={{ fontSize:"13px", color:"#111", lineHeight:"1.6", whiteSpace:"pre-wrap", wordBreak:"break-word" }}
                    dangerouslySetInnerHTML={{ __html:
                      template
                        .replace(/{name}/g,   '<span style="color:#1a7f37;font-weight:700">ABC Exports Ltd.</span>')
                        .replace(/{awb}/g,    '<span style="color:#0550ae;font-weight:700">020-12345678</span>')
                        .replace(/{status}/g, '<span style="color:#cf222e;font-weight:700">Shipment arrived at Delhi Airport ✅</span>')
                        .replace(/\*([^*]+)\*/g, '<b>$1</b>')
                        .replace(/_([^_]+)_/g,   '<i style="color:#555">$1</i>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                  {/* WhatsApp-style timestamp */}
                  <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:"3px", marginTop:"4px" }}>
                    <span style={{ fontSize:"10px", color:"#94a3b8" }}>
                      {new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}
                    </span>
                  </div>
                </div>
              </div>
              {/* Sample info box */}
              <div style={{ textAlign:"center", marginTop:"8px" }}>
                <span style={{ fontSize:"0.65rem", background:"rgba(255,255,255,0.6)", padding:"3px 10px", borderRadius:"10px", color:"#4a4a4a" }}>
                  📋 Sample preview — actual values replace {"{name}"} {"{awb}"} {"{status}"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop:"14px" }}>
          <button onClick={handleSaveTpl} disabled={savingTpl} style={{ padding:"8px 22px", background:"var(--primary-color-start,#3b82f6)", color:"white", border:"none", borderRadius:"6px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"7px" }}>
            {savingTpl?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<CheckCircle size={14}/>}
            {savingTpl?"Saving...":"Save Template"}
          </button>
        </div>
      </div>

      {/* ── Sticky Save All Bar ── */}
      
      {/* Module-wise WhatsApp Numbers */}
      <div style={card}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px", borderBottom:"1px solid var(--border-color,#e2e8f0)", paddingBottom:"12px" }}>
          <MessageCircle size={20} color="#0284c7" />
          <h3 style={{ margin:0, fontSize:"1.1rem", color:"var(--text-main,#0f172a)" }}>Module-wise WhatsApp Routing</h3>
        </div>
        <p style={{ fontSize:"0.85rem", color:"var(--text-muted,#64748b)", marginBottom:"16px", lineHeight:"1.5" }}>
          Assign specific WhatsApp numbers for different system modules. When a module sends an alert (e.g., Purchase Order Approvals), it will send to the number configured here.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
            <select value={newModName} onChange={e=>setNewModName(e.target.value)} style={inp}>
              <option value="" disabled>Select Module...</option>
              <option value="Admin">Admin</option>
              <option value="Purchase (Director)">Purchase (Director)</option>
              <option value="HR Alerts">HR Alerts</option>
              <option value="Operations Updates">Operations Updates</option>
              <option value="Accounts">Accounts</option>
            </select>
            <input value={newModPhone} onChange={e=>setNewModPhone(e.target.value)} placeholder="Phone Number (e.g. 919876543210)" style={inp} />
            <button onClick={handleAddModuleNumber} style={{ padding: "8px 16px", background: "#0284c7", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>Add Number</button>
        </div>
        {modSuccessMsg && (
            <div style={{ padding: '10px 15px', background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                {modSuccessMsg}
            </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Module Name</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>WhatsApp Number</th>
                    <th style={{ padding: '10px', width: '80px', textAlign: 'center' }}>Action</th>
                </tr>
            </thead>
            <tbody>
                {moduleNumbers.map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{m.moduleName}</td>
                        <td style={{ padding: '10px' }}>{m.phoneNumber}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button onClick={() => handleDeleteModuleNumber(m.moduleName)} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Delete</button>
                        </td>
                    </tr>
                ))}
                {moduleNumbers.length === 0 && (
                    <tr>
                        <td colSpan="3" style={{ padding: '15px', textAlign: 'center', color: '#94a3b8' }}>No module-specific numbers configured. System will use default numbers from environment variables.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>

      <div style={{
        position: "sticky", bottom: 0, zIndex: 10,
        background: "linear-gradient(to top, var(--bg-app,#f8fafc) 80%, transparent)",
        padding: "16px 90px 4px 0", marginTop: "8px", // right gap: the chat robot button sits over that corner
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"
      }}>
        <div style={{ fontSize:"0.75rem", color:"var(--text-muted,#64748b)" }}>
            💾 CLICK <b>SAVE ALL SETTINGS</b> TO SAVE ALL CHANGES
        </div>
        <button
          onClick={handleSaveAll}
          disabled={savingAll}
          style={{
            padding: "7px 18px",
            background: savingAll ? "#94a3b8" : "linear-gradient(135deg, #25D366, #128C7E)",
            color: "white", border: "none", borderRadius: "6px",
            fontWeight: 600, fontSize: "0.82rem",
            cursor: savingAll ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "6px",
            boxShadow: savingAll ? "none" : "0 2px 8px rgba(37,211,102,0.35)",
            transition: "all 0.2s", whiteSpace: "nowrap"
          }}
        >
          {savingAll ? <Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> : <Save size={14}/>}
          {savingAll ? "Saving..." : "Save All Settings"}
        </button>
      </div>

    </div>
  );
}




