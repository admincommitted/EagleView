import React, { useState, useEffect } from "react";
import { Save, CheckCircle, XCircle, RefreshCw, Shield, Key, Globe, User, Lock, Wifi } from "lucide-react";

export default function IcegateSettings() {
  const [form, setForm] = useState({
    icegate_login_id: "",
    icegate_password: "",
    icegate_api_key: "",
    icegate_base_url: "https://cisapi.icegate.gov.in",
  });
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [msg, setMsg]               = useState({ text: "", type: "" });
  const [tokenInfo, setTokenInfo]   = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res  = await fetch("/api/settings");
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        icegate_login_id: data.icegate_login_id || "",
        icegate_password: "",  // always keep blank — backend masks as *** for security
        icegate_api_key:  data.icegate_api_key  || "",
        icegate_base_url: data.icegate_base_url  || "https://cisapi.icegate.gov.in",
      }));
      // Track if password is already saved
      if (data.icegate_password === "***") {
        setPasswordSaved(true);
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg({ text: "", type: "" });
    try {
      const fields = [
        { key: "icegate_login_id", label: "ICEGATE Login ID",  group: "icegate" },
        { key: "icegate_password", label: "ICEGATE Password",  group: "icegate" },
        { key: "icegate_api_key",  label: "ICEGATE API Key",   group: "icegate" },
        { key: "icegate_base_url", label: "ICEGATE Base URL",  group: "icegate" },
      ];
      const settingsObj = {
        icegate_login_id: form.icegate_login_id,
        icegate_api_key:  form.icegate_api_key,
        icegate_base_url: form.icegate_base_url,
      };
      // Only update password if user typed something new
      if (form.icegate_password) {
        settingsObj.icegate_password = form.icegate_password;
      }
      const res = await fetch("/api/settings/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settingsObj })
      });
      const data = await res.json();
      if (data.success) setMsg({ text: "ICEGATE settings saved successfully!", type: "success" });
      else setMsg({ text: "Save failed: " + (data.error || "Unknown error"), type: "error" });
    } catch (e) {
      setMsg({ text: "Network error: " + e.message, type: "error" });
    } finally { setSaving(false); }
  };

  const handleTestConnection = async () => {
    setTesting(true); setMsg({ text: "", type: "" }); setTokenInfo(null);
    try {
      const res  = await fetch("/api/icegate/test-auth", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMsg({ text: "ICEGATE Authentication Successful!", type: "success" });
        setTokenInfo(data);
      } else {
        // Show ICEGATE's actual error
        const errDetails = data.details?.errors?.join(", ") || data.details?.message || "";
        const fullErr = data.error + (errDetails ? " → " + errDetails : "");
        const hint = (data.details?.errors || []).some(e => e.includes("API Key"))
          ? " ⚠️ ICEGATE API Key needs to be activated on the ICEGATE portal first (Settings > API Key Activation)."
          : "";
        setMsg({ text: "Auth Failed: " + fullErr + hint, type: "error" });
      }
    } catch (e) {
      setMsg({ text: "Network Error: " + e.message, type: "error" });
    } finally { setTesting(false); }
  };

  const inp = {
    width: "100%", padding: "8px 12px", border: "1px solid var(--border-color, #cbd5e1)",
    borderRadius: "6px", fontSize: "13px", outline: "none", background: "#fff",
    boxSizing: "border-box", fontFamily: "monospace"
  };
  const lbl = { fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" };
  const row = { marginBottom: "16px" };

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", padding: "12px 16px", background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", borderRadius: "8px", color: "white" }}>
        <Shield size={22} />
        <div>
          <div style={{ fontWeight: "bold", fontSize: "15px" }}>ICEGATE API Configuration</div>
          <div style={{ fontSize: "11px", opacity: 0.85 }}>Customs Integrated System — BE/SB JSON Filing</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "11px", background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "12px" }}>CBIC · India Customs</div>
      </div>

      <div style={{ background: "#f0f9ff", border: "1px solid #000000", borderRadius: "6px", padding: "12px", marginBottom: "20px", fontSize: "11px", color: "var(--primary-text, #0369a1)" }}>
        <div style={{ fontWeight: "bold", marginBottom: "6px" }}>ICEGATE API Endpoints</div>
        <div style={{ fontFamily: "monospace", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span><strong>Auth:</strong> /authentication/v1.0/api/authenticate</span>
          <span><strong>File Submit:</strong> /jsonfiling/v1.0/api/fileSubmit</span>
          <span><strong>File Status:</strong> /jsonfiling/v1.0/api/fileStatus</span>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div style={row}>
          <label style={lbl}>ICEGATE Login ID</label>
          <input style={inp} value={form.icegate_login_id} onChange={e => setForm(p => ({ ...p, icegate_login_id: e.target.value }))} placeholder="e.g. CCCPL1998" autoComplete="off" />
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px" }}>Your registered ICEGATE user ID</div>
        </div>

        <div style={row}>
          <label style={lbl}>
            ICEGATE Password
            {passwordSaved && <span style={{ marginLeft: "8px", fontSize: "11px", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "10px", fontWeight: "500" }}>✓ Saved</span>}
          </label>
          <input style={inp} type="password" value={form.icegate_password} onChange={e => { setForm(p => ({ ...p, icegate_password: e.target.value })); setPasswordSaved(false); }} placeholder={passwordSaved ? "Leave blank to keep existing password" : "Enter your ICEGATE portal password"} autoComplete="new-password" />
          {passwordSaved && !form.icegate_password && <div style={{ fontSize: "11px", color: "#059669", marginTop: "3px" }}>Password is already saved. Enter new password only if you want to change it.</div>}
        </div>

        <div style={row}>
          <label style={lbl}>API Key (X-Api-Key Header)</label>
          <textarea style={{ ...inp, height: "80px", resize: "none", fontSize: "11px" }} value={form.icegate_api_key} onChange={e => setForm(p => ({ ...p, icegate_api_key: e.target.value }))} placeholder="Paste your ICEGATE API Key here..." />
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px" }}>Provided by ICEGATE after registration. Sent as X-Api-Key header.</div>
        </div>

        <div style={row}>
          <label style={lbl}>Base URL</label>
          <input style={inp} value={form.icegate_base_url} onChange={e => setForm(p => ({ ...p, icegate_base_url: e.target.value }))} placeholder="https://cisapi.icegate.gov.in" />
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px" }}>Production: https://cisapi.icegate.gov.in</div>
        </div>

        {msg.text && (
          <div style={{ padding: "10px 14px", borderRadius: "6px", marginBottom: "16px", fontSize: "13px", fontWeight: "500",
            background: msg.type === "success" ? "#dcfce7" : "#fee2e2",
            color: msg.type === "success" ? "#166534" : "#991b1b",
            border: "1px solid " + (msg.type === "success" ? "#16a34a" : "#dc2626"),
            display: "flex", alignItems: "center", gap: "8px" }}>
            {msg.text}
          </div>
        )}

        {tokenInfo && (
          <div style={{ background: "#f0fdf4", border: '1px solid #000000', borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", fontSize: "12px", color: "#166534" }}>
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Token Details</div>
            <div>Status: <strong>{tokenInfo.status || "Authenticated"}</strong></div>
            {tokenInfo.expiresAt && <div>Expires: <strong>{tokenInfo.expiresAt}</strong></div>}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="submit" disabled={saving} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 20px", background: saving ? "#94a3b8" : "var(--primary-color-end, #1d4ed8)", color: "white", border: "none", borderRadius: "6px", cursor: saving ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "13px" }}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button type="button" onClick={handleTestConnection} disabled={testing} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 20px", background: testing ? "#94a3b8" : "#059669", color: "white", border: "none", borderRadius: "6px", cursor: testing ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "13px" }}>
            {testing ? "Testing..." : "Test ICEGATE Connection"}
          </button>
        </div>
      </form>
    </div>
  );
}
