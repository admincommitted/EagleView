import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, CheckCircle, Save, X, Server } from "lucide-react";

const inp = {
  width: "100%", padding: "8px 12px", border: "1px solid var(--border-color, #cbd5e1)", borderRadius: "6px",
  fontSize: "13px", boxSizing: "border-box", outline: "none", marginTop: "4px"
};
const lbl = { fontSize: "12px", fontWeight: 600, color: "var(--text-muted, var(--text-muted, #475569))", display: "block" };

export default function IcegateProfileSettings() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [testingAuth, setTestingAuth] = useState(false);
  const [icegateMsg, setIcegateMsg] = useState(null);

  async function handleTestAuth() {
    if (!form.loginId || !form.apiKey) {
      setIcegateMsg({ text: "Please enter ICEGATE Login ID and API Key to test.", type: 'error' });
      return;
    }
    setTestingAuth(true);
    setIcegateMsg(null);
    const startTime = Date.now();
    try {
      const payload = { ...form, profileId: editingId };
      const res = await fetch('/api/icegate/test-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (data.success) {
        setIcegateMsg({ text: `✅ ICEGATE API Connected! Status: ${data.status}`, type: 'success', time: timeTaken });
      } else {
        setIcegateMsg({ text: `❌ ICEGATE API Failed: ${data.error || data.message}`, type: 'error', time: timeTaken });
      }
    } catch (e) {
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
      setIcegateMsg({ text: `❌ Error: ${e.message}`, type: 'error', time: timeTaken });
    } finally {
      setTestingAuth(false);
    }
  }
  const [testingImap, setTestingImap] = useState(false);
  const [imapMsg, setImapMsg] = useState(null);
  const [chaList, setChaList] = useState([]);

  useEffect(() => {
    fetchProfiles();
    fetchChaList();
  }, []);

  async function fetchChaList() {
    try {
      const res = await fetch("/api/masters/cha-master");
      const json = await res.json();
      if (json.success) setChaList(json.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchProfiles() {
    try {
      const res = await fetch("/api/icegate-profiles");
      const json = await res.json();
      if (json.success) setProfiles(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleAddNew() {
    setEditingId("new");
    setForm({
      profileName: "",
      loginId: "",
      password: "",
      apiKey: "",
      baseUrl: "https://cisapi.icegate.gov.in",
      linkedChaCode: "",
      isDefault: profiles.length === 0
    });
    setMsg({ text: "", type: "" });
  }

  function handleEdit(p) {
    setEditingId(p.id);
    setForm({ ...p, password: "" }); // Clear password so they don't overwrite with ********
    setMsg({ text: "", type: "" });
  }

  
  async function handleTestImap() {
    if (!form.imapEmail || !form.imapAppPassword) {
      setImapMsg({ text: "Please enter Email ID and App Password to test.", type: 'error' });
      return;
    }
    setTestingImap(true);
    setImapMsg(null);
    const startTime = Date.now();
    try {
      const res = await fetch('/api/icegate/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (data.success) {
        setImapMsg({ text: '✅ Connection Successful! System can read the emails.', type: 'success', time: timeTaken });
      } else {
        setImapMsg({ text: `❌ Connection Failed: ${data.message}`, type: 'error', time: timeTaken });
      }
    } catch (e) {
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
      setImapMsg({ text: `❌ Error: ${e.message}`, type: 'error', time: timeTaken });
    } finally {
      setTestingImap(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setMsg({ text: "", type: "" });
    try {
      const url = editingId === "new" ? "/api/icegate-profiles" : `/api/icegate-profiles/${editingId}`;
      const method = editingId === "new" ? "POST" : "PUT";
      
      const payload = { ...form };
      if (!payload.password && editingId !== "new") {
        payload.password = "********"; // Tell backend not to update it
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      
      if (json.success) {
        setMsg({ text: "Profile saved successfully!", type: "success" });
        setEditingId(null);
        fetchProfiles();
      } else {
        setMsg({ text: json.error || "Failed to save", type: "error" });
      }
    } catch (err) {
      setMsg({ text: "Network error", type: "error" });
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this profile?")) return;
    try {
      await fetch(`/api/icegate-profiles/${id}`, { method: "DELETE" });
      fetchProfiles();
    } catch (e) {}
  }

  async function handleTest(profileId) {
    setTestingAuth(profileId);
    setMsg({ text: "", type: "" });
    try {
      const res = await fetch("/api/icegate/test-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId })
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ text: `Test connection successful for Profile!`, type: "success" });
      } else {
        setMsg({ text: data.error || "Connection failed", type: "error" });
      }
    } catch (err) {
      setMsg({ text: "Network error", type: "error" });
    } finally {
      setTestingAuth(null);
    }
  }

  // if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "16px", color: "var(--text-main, var(--text-main, #0f172a))", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Server size={18} color="#6366f1" /> ICEGATE Profiles
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted, var(--text-muted, #64748b))", margin: "4px 0 0 0" }}>
            Manage multiple ICEGATE login credentials. You can link them to specific CHA codes.
          </p>
        </div>
        {!editingId && (
          <button onClick={handleAddNew} style={{ background: "#6366f1", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add New Profile
          </button>
        )}
      </div>

      {msg.text && (
        <div style={{ padding: "12px 16px", background: msg.type === "error" ? "#fef2f2" : "#f0fdf4", color: msg.type === "error" ? "#991b1b" : "#166534", border: `1px solid ${msg.type === "error" ? "#fecaca" : "#22c55e"}`, borderRadius: "6px", fontSize: "13px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          {msg.type === "success" && <CheckCircle size={16} />}
          {msg.text}
        </div>
      )}

      {editingId ? (
        <div style={{ background: "var(--bg-app, var(--bg-app, #f8fafc))", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: "8px", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--text-main, var(--text-main, #1e293b))" }}>
            {editingId === "new" ? "Create New Profile" : "Edit Profile"}
          </h3>
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={lbl}>Profile Name *</label>
                <input style={inp} required value={form.profileName} onChange={e => setForm({...form, profileName: e.target.value})} placeholder="e.g. Delhi Branch CHA" />
              </div>
              <div>
                <label style={lbl}>Linked CHA Code (Optional)</label>
                <select style={inp} value={form.linkedChaCode} onChange={e => setForm({...form, linkedChaCode: e.target.value})}>
                  <option value="">-- Select CHA --</option>
                  {chaList.map(c => (
                    <option key={c.id} value={c.chaCode}>
                      {c.chaCode} - {c.chaName}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Auto-selects this profile for this CHA</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={lbl}>ICEGATE Login ID *</label>
                <input style={inp} required value={form.loginId} onChange={e => setForm({...form, loginId: e.target.value})} placeholder="e.g. CCCPL1998" />
              </div>
              <div>
                <label style={lbl}>ICEGATE Password *</label>
                <input style={inp} type="password" required={editingId === "new"} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={editingId !== "new" ? "Leave blank to keep unchanged" : "Password"} />
              </div>
            </div>

            <div>
              <label style={lbl}>ICEGATE API Key *{form.apiKeyHint && String(form.apiKey || '').startsWith('****') ? ` (saved key ${form.apiKeyHint} - paste a new key to change it)` : ''}</label>
              <textarea style={{...inp, height: "80px", fontFamily: "monospace"}} required value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})} placeholder="Paste your API key here..." />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" id="isDef" checked={form.isDefault} onChange={e => setForm({...form, isDefault: e.target.checked})} />
              <label htmlFor="isDef" style={{ fontSize: "13px", color: "var(--text-muted, var(--text-muted, #475569))", cursor: "pointer" }}>Set as Default Profile</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', marginBottom: '8px' }}>
              <button type="button" onClick={handleTestAuth} disabled={testingAuth} style={{ padding: '6px 14px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: testingAuth ? 'wait' : 'pointer', minWidth: '160px' }}>
                {testingAuth ? 'Testing... ⏳' : 'Test ICEGATE API'}
              </button>
              {icegateMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500, padding: '6px 12px', borderRadius: '4px', background: icegateMsg.type === 'success' ? '#dcfce7' : '#fee2e2', color: icegateMsg.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${icegateMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
                  <span>{icegateMsg.text}</span>
                  {icegateMsg.time && <span style={{ background: icegateMsg.type === 'success' ? '#bbf7d0' : '#fecaca', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, opacity: 0.9 }}>⏱ {icegateMsg.time}s</span>}
                </div>
              )}
            </div>

                        <h4 style={{ margin: "16px 0 8px 0", color: "#e2e8f0", borderBottom: "1px solid #334155", paddingBottom: "8px" }}>Automatic Document Fetch (Email/IMAP)</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={lbl}>Registered Email ID</label>
                <input style={inp} value={form.imapEmail} onChange={e => setForm({...form, imapEmail: e.target.value})} placeholder="e.g. docs@company.com" />
              </div>
              <div>
                <label style={lbl}>Email App Password</label>
                <input style={inp} type="password" value={form.imapAppPassword} onChange={e => setForm({...form, imapAppPassword: e.target.value})} placeholder="16-digit App Password" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <label style={lbl}>IMAP Server</label>
                <input style={inp} value={form.imapHost} onChange={e => setForm({...form, imapHost: e.target.value})} placeholder="e.g. imap.gmail.com" />
              </div>
              <div>
                <label style={lbl}>IMAP Port</label>
                <input style={inp} type="number" value={form.imapPort} onChange={e => setForm({...form, imapPort: parseInt(e.target.value) || 993})} />
              </div>
              <div>
                <label style={lbl}>Scan Folder/Label</label>
                <input style={inp} value={form.imapFolder} onChange={e => setForm({...form, imapFolder: e.target.value})} placeholder="e.g. INBOX or ICEGATE_DOCS" />
                <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "4px", lineHeight: "1.4" }}>
                  Tip: Type <b>ALL</b> to scan every label, or use commas for multiple (e.g. <b>INBOX, Customs</b>).
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <button type="button" onClick={handleTestImap} disabled={testingImap} style={{ padding: '6px 14px', background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: testingImap ? 'wait' : 'pointer', minWidth: '160px' }}>
                {testingImap ? 'Testing... ⏳' : 'Test IMAP Connection'}
              </button>
              {imapMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500, padding: '6px 12px', borderRadius: '4px', background: imapMsg.type === 'success' ? '#dcfce7' : '#fee2e2', color: imapMsg.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${imapMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
                  <span>{imapMsg.text}</span>
                  {imapMsg.time && <span style={{ background: imapMsg.type === 'success' ? '#bbf7d0' : '#fecaca', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, opacity: 0.9 }}>⏱ {imapMsg.time}s</span>}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
              <button type="button" onClick={() => setEditingId(null)} style={{ padding: "8px 16px", background: "#fff", border: "1px solid var(--border-color, #cbd5e1)", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "var(--text-muted, var(--text-muted, #475569))" }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: "8px 24px", background: "#6366f1", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                <Save size={14} /> Save Profile
              </button>
            </div>
          
          </form>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {profiles.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", background: "var(--bg-app, var(--bg-app, #f8fafc))", borderRadius: "8px", border: "1px dashed var(--border-color, #cbd5e1)", color: "var(--text-muted, var(--text-muted, #64748b))", fontSize: "13px" }}>
              No ICEGATE profiles configured yet. Add one to start filing!
            </div>
          ) : (
            profiles.map(p => (
              <div key={p.id} style={{ background: "#fff", border: p.isDefault ? "2px solid #a5b4fc" : "1px solid var(--border-color, #e2e8f0)", borderRadius: "8px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <h4 style={{ margin: 0, fontSize: "14px", color: "var(--text-main, var(--text-main, #0f172a))" }}>{p.profileName}</h4>
                    {p.isDefault && <span style={{ background: "#eef2ff", color: "#4f46e5", fontSize: "10px", padding: "2px 6px", borderRadius: "10px", fontWeight: 600 }}>DEFAULT</span>}
                  </div>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--text-muted, var(--text-muted, #64748b))" }}>
                    <span><strong>ID:</strong> {p.loginId}</span>
                    {p.linkedChaCode && <span><strong>CHA:</strong> <span style={{ fontFamily: "monospace", background: "var(--bg-input, var(--bg-input, #f1f5f9))", padding: "2px 4px", borderRadius: "4px" }}>{p.linkedChaCode}</span></span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleTest(p.id)} disabled={testingAuth === p.id} style={{ padding: "6px 12px", background: "#f0fdf4", border: '1px solid #000000', color: "#166534", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
                    {testingAuth === p.id ? "Testing..." : "Test Connection"}
                  </button>
                  <button onClick={() => handleEdit(p)} style={{ padding: "6px", background: "var(--bg-input, var(--bg-input, #f1f5f9))", border: "1px solid var(--border-color, #cbd5e1)", color: "var(--text-muted, var(--text-muted, #475569))", borderRadius: "6px", cursor: "pointer" }}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} style={{ padding: "6px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "6px", cursor: "pointer" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
