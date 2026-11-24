import React, { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, Clock, AlertCircle, CheckCircle2, Server } from "lucide-react";

/**
 * SftpStatusBadge — Live Descartes SFTP connection indicator
 * Green pulsing = connected | Red = offline | Grey = checking
 */
export default function SftpStatusBadge({ showLabel = true }) {
  const [status,    setStatus]    = useState(null);
  const [tooltip,   setTooltip]   = useState(false);
  const [checking,  setChecking]  = useState(false);
  const [countdown, setCountdown] = useState(30);

  const fetchStatus = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const res  = await fetch("/api/settings/sftp-status");
      const data = await res.json();
      setStatus(data);
      setCountdown(30);
    } catch {
      setStatus({ connected: false, lastError: "Cannot reach backend" });
    } finally {
      if (manual) setChecking(false);
    }
  }, []);

  // Auto-poll every 30s
  useEffect(() => {
    fetchStatus();
    const poll = setInterval(() => fetchStatus(), 30000);
    return () => clearInterval(poll);
  }, [fetchStatus]);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 30), 1000);
    return () => clearInterval(t);
  }, []);

  const connected   = status?.connected;
  const isChecking  = checking || !status;

  const dot = isChecking ? "#94a3b8"
            : connected  ? "#16a34a"
            : "#dc2626";

  const bg  = isChecking ? "#f1f5f9"
            : connected  ? "#dcfce7"
            : "#fee2e2";

  const border = isChecking ? "#cbd5e1"
               : connected  ? "#86efac"
               : "#fca5a5";

  const labelText = isChecking ? "Checking…"
                  : connected  ? `Descartes ${(status?.env || "test").toUpperCase()}`
                  : "Descartes Offline";

  const lastOk = status?.lastConnectedAt
    ? new Date(status.lastConnectedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const lastCheck = status?.lastCheckedAt
    ? new Date(status.lastCheckedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", zIndex: 50 }}>

      {/* ── Pill Badge ── */}
      <div
        onClick={() => setTooltip(t => !t)}
        style={{
          display: "flex", alignItems: "center", gap: "7px",
          padding: "5px 12px", borderRadius: "20px",
          background: bg, border: `1.5px solid ${border}`,
          cursor: "pointer", userSelect: "none",
          boxShadow: connected ? "0 0 0 3px #dcfce7" : "none",
          transition: "all 0.3s",
        }}
        title="Click for Descartes SFTP details"
      >
        {/* Pulsing dot */}
        <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
          {connected && !isChecking && (
            <span style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: dot, opacity: 0.45,
              animation: "sftp-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
            }}/>
          )}
          {isChecking ? (
            <RefreshCw size={10} color={dot} style={{ animation: "sftp-spin 1s linear infinite" }}/>
          ) : (
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot, display: "block" }}/>
          )}
        </span>

        {showLabel && (
          <span style={{ fontSize: "11px", fontWeight: 700, color: dot, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            {labelText}
          </span>
        )}
      </div>

      {/* ── Tooltip Popup ── */}
      {tooltip && (
        <>
          {/* Backdrop */}
          <div onClick={() => setTooltip(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998 }}/>

          <div style={{
            position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 999,
            background: "#0f172a", borderRadius: "12px",
            padding: "16px", minWidth: "260px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
            color: "#e2e8f0", fontSize: "12px",
          }}>

            {/* Arrow */}
            <div style={{
              position: "absolute", top: -6, right: 14,
              width: 12, height: 12, background: "#0f172a",
              transform: "rotate(45deg)",
              boxShadow: "-2px -2px 4px rgba(255,255,255,0.05)",
            }}/>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {connected
                ? <CheckCircle2 size={16} color="#4ade80"/>
                : <WifiOff size={16} color="#f87171"/>
              }
              <span style={{ fontWeight: 800, fontSize: "13px", color: connected ? "#4ade80" : "#f87171" }}>
                {connected ? "Descartes SFTP Connected" : "Descartes SFTP Offline"}
              </span>
            </div>

            {/* Server info */}
            {status?.host && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "#94a3b8" }}>
                <Server size={11}/>
                <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{status.host}:22</span>
                <span style={{ background: "#1e3a5f", color: "#60a5fa", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                  {(status.env || "test").toUpperCase()}
                </span>
              </div>
            )}

            {/* Timestamps */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "10px" }}>
              {lastOk && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8" }}>
                  <Clock size={10} color="#4ade80"/>
                  <span>Last connected: <strong style={{ color: "#4ade80" }}>{lastOk}</strong></span>
                </div>
              )}
              {lastCheck && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b" }}>
                  <Clock size={10}/>
                  <span>Last checked: {lastCheck}</span>
                </div>
              )}
              {!lastOk && !connected && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f87171" }}>
                  <AlertCircle size={10} color="#f87171"/>
                  <span>Never connected this session</span>
                </div>
              )}
            </div>

            {/* Error */}
            {status?.lastError && !connected && (
              <div style={{
                background: "#2d1515", border: "1px solid #7f1d1d33", borderRadius: "6px",
                padding: "8px", marginBottom: "10px", color: "#fca5a5", fontSize: "11px", lineHeight: 1.5,
              }}>
                <AlertCircle size={10} style={{ display: "inline", marginRight: 4 }}/>
                {status.lastError}
              </div>
            )}

            {!connected && (
              <div style={{ color: "#64748b", fontSize: "10px", marginBottom: "10px", lineHeight: 1.5 }}>
                💡 FSU polls every 5 min. Descartes may temporarily block repeated connections. Badge auto-updates.
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#475569", fontSize: "10px" }}>
                Refreshes in <strong style={{ color: "#94a3b8" }}>{countdown}s</strong>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); fetchStatus(true); }}
                disabled={checking}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  background: "#1e293b", border: "1px solid #334155",
                  color: "#94a3b8", borderRadius: "6px", padding: "4px 10px",
                  fontSize: "11px", cursor: checking ? "not-allowed" : "pointer", fontWeight: 600,
                }}
              >
                <RefreshCw size={10} style={checking ? { animation: "sftp-spin 1s linear infinite" } : {}}/>
                {checking ? "Checking…" : "Check Now"}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes sftp-ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes sftp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
