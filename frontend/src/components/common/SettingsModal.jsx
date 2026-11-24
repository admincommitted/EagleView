import React, { useState, useEffect } from 'react';
import { askConfirm } from './askConfirm';
import { X, Settings as SettingsIcon, Bell, Globe, Moon, Palette, Save, CheckCircle, RotateCcw, AlertCircle } from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const [originalSettings, setOriginalSettings] = useState(null);
  const [settings, setSettings] = useState({
    theme: 'light', appBackground: 'sky', notificationsEnabled: true, language: 'en', timezone: 'UTC', primaryColor: 'blue'
  });
  const [showToast, setShowToast] = useState(false);
  const [errorToast, setErrorToast] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupNote, setBackupNote] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      
      const token = localStorage.getItem('token') || '';
      if (token === 'dummy-token') {
          setUserRole('admin');
      } else {
          try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              if (payload && payload.role) setUserRole(payload.role);
          } catch(e) {}
      }
      const res = await fetch('/api/auth/settings', {

        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) { setSettings(data); setOriginalSettings(data); }
      } else {
        setErrorToast('Could not load your settings (HTTP ' + res.status + ')'); setTimeout(() => setErrorToast(null), 3000);
      }
    } catch (err) {
      setErrorToast('Could not load your settings: ' + err.message); setTimeout(() => setErrorToast(null), 3000);
    }
  };

  // Live preview effect
  useEffect(() => {
    if (settings) {
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: settings }));
    }
  }, [settings]);

  // Revert on close if not saved
  const handleCancel = () => {
    if (originalSettings) {
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: originalSettings }));
    } else {
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: { theme: 'light', appBackground: 'slate', primaryColor: 'blue' } }));
    }
    onClose();
  };

  const handleReset = () => {
    const defaultSettings = { theme: 'light', appBackground: 'sky', notificationsEnabled: true, language: 'en', timezone: 'UTC', primaryColor: 'blue' };
    setSettings(defaultSettings);
    // Don't auto save, just update the UI state so user can preview before saving
  };

  const handleSave = async () => {
    try {
      
      const token = localStorage.getItem('token') || '';
      if (token === 'dummy-token') {
          setUserRole('admin');
      } else {
          try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              if (payload && payload.role) setUserRole(payload.role);
          } catch(e) {}
      }
      const res = await fetch('/api/auth/settings', {

        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // only the fields of this screen (28-Oct-2026: the whole row incl. id / userId was sent back)
        body: JSON.stringify({ theme: settings.theme || 'light', appBackground: settings.appBackground, primaryColor: settings.primaryColor, notificationsEnabled: settings.notificationsEnabled !== false, language: settings.language || 'en', timezone: settings.timezone || 'Asia/Kolkata' })
      });
      if (res.ok) {
        const saved = await res.json().catch(() => ({}));
        if (saved.settings) setOriginalSettings(saved.settings);
        setShowToast(true);
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: saved.settings || settings }));
        setTimeout(() => {
            setShowToast(false);
            onClose();
        }, 1500);
      } else {
        const errorData = await res.json();
        const msg = "Failed to save settings: " + (errorData.error || errorData.message || JSON.stringify(errorData));
        setErrorToast(msg);
        setTimeout(() => setErrorToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      const msg = "Error saving settings: " + err.message;
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 3000);
    }
  };

  
  const handleBackup = async () => {
    if (!(await askConfirm({ title: 'Start system backup', message: 'Make a full backup of the code and the database now?', note: 'It can take a little time. Nothing is changed or deleted.', okLabel: 'Start backup', cancelLabel: 'Cancel' }))) return;
    setIsBackingUp(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/auth/system-backup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setBackupNote((data.message || 'Backup completed') + ' - saved to ' + data.backupDir);
      } else {
        setErrorToast("Backup failed: " + data.error);
        setTimeout(() => setErrorToast(null), 3000);
      }
    } catch (err) {
      setErrorToast("Backup error: " + err.message);
      setTimeout(() => setErrorToast(null), 3000);
    } finally {
      setIsBackingUp(false);
    }
  };

  // 22-Nov-2026: the window in the plain look of the other windows - thin title bar, one line per setting (name at the
  // left, its control at the right), small colour squares in even rows, flat 24px buttons. The settings, the live
  // preview, Save / Cancel / Reset and the backup call are as before.
  const COLORS = ['ocean', 'blue', 'emerald', 'forest', 'violet', 'plum', 'rose', 'crimson', 'amber', 'pumpkin', 'cyan', 'pink', 'teal', 'indigo', 'midnight', 'gray', 'ruby', 'lime', 'sage', 'coral', 'magenta', 'slate', 'navy', 'sky', 'gold', 'fuchsia', 'tangerine', 'cerulean', 'olive', 'berry', 'chocolate', 'lavender', 'deepteal', 'steel', 'royal', 'petrol', 'bottle', 'maroon', 'bronze', 'charcoal'];
  const colorMap = {
    ocean: '#008ac1', blue: '#0ea5e9', emerald: '#10b981', forest: '#15803d', violet: '#8b5cf6', plum: '#701a75', rose: '#f43f5e', crimson: '#be123c', amber: '#f59e0b', pumpkin: '#c2410c',
    cyan: '#06b6d4', pink: '#ec4899', teal: '#14b8a6', indigo: '#6366f1', midnight: '#1e3a8a', gray: '#64748b',
    ruby: '#e11d48', lime: '#84cc16', sage: '#5f7161', coral: '#ff7f50', magenta: '#d946ef', slate: '#475569', navy: '#0f172a', sky: '#38bdf8',
    gold: '#eab308', fuchsia: '#c026d3', tangerine: '#f97316', cerulean: '#0284c7', olive: '#65a30d', berry: '#9f1239', chocolate: '#78350f', lavender: '#a855f7', deepteal: '#08676d',
    steel: '#4a6fa5', royal: '#2548c9', petrol: '#0b6477', bottle: '#1b6b4a', maroon: '#8a1c2c', bronze: '#9a6a2f', charcoal: '#3a3f4b'
  };
  const pickColor = (color) => {
    let newBg = settings.appBackground;
    if (['rose', 'pink', 'crimson', 'ruby', 'magenta', 'berry'].includes(color)) newBg = 'rose';
    else if (['ocean', 'blue', 'cyan', 'indigo', 'sky', 'cerulean'].includes(color)) newBg = 'sky';
    else if (['emerald', 'forest', 'teal', 'lime', 'sage', 'olive', 'deepteal'].includes(color)) newBg = 'mint';
    else if (['violet', 'plum', 'lavender', 'fuchsia'].includes(color)) newBg = 'lavender';
    else if (['amber', 'pumpkin', 'coral', 'tangerine', 'gold', 'chocolate'].includes(color)) newBg = 'peach';
    else if (['slate', 'navy', 'gray', 'midnight'].includes(color)) newBg = 'slate';
    else if (['steel', 'charcoal'].includes(color)) newBg = 'coolgrey';
    else if (color === 'royal') newBg = 'ice';
    else if (color === 'petrol') newBg = 'seagreen';
    else if (color === 'bottle') newBg = 'mint';
    else if (color === 'maroon') newBg = 'rose';
    else if (color === 'bronze') newBg = 'ivory';
    setSettings({...settings, primaryColor: color, appBackground: newBg});
  };
  const row = { display: 'flex', alignItems: 'center', gap: '12px', padding: '5px 0', borderBottom: '1px solid var(--lg-line, #e2e8f0)' };
  const name = { fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #1e293b)', display: 'inline-flex', alignItems: 'center', gap: '6px' };
  const sub = { fontSize: '11px', color: 'var(--text-muted, #64748b)', textTransform: 'none', marginLeft: '20px' };
  const btn = { display: 'inline-flex', alignItems: 'center', gap: '5px', height: '24px', padding: '0 12px', borderRadius: '2px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '11px', cursor: 'pointer' };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="app-settings" style={{
        backgroundColor: 'var(--bg-panel, #ffffff)', borderRadius: '3px', width: '100%', maxWidth: '520px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)', overflow: 'hidden',
        maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', padding: 0
      }}>
        {/* the colour squares take their colour from --sw (a fixed inline blue / green would be turned into the theme colour by the theme rules) */}
        <style>{`.app-settings button.sw { width: 18px !important; height: 18px !important; min-height: 0 !important; padding: 0 !important; border-radius: 2px !important; background: var(--sw) !important; border: 1px solid rgba(15,23,42,0.18) !important; box-shadow: none !important; cursor: pointer; }
.app-settings button.sw.sw-on { outline: 2px solid var(--text-main, #0f172a); outline-offset: 2px; }`}</style>
        <div style={{ background: 'linear-gradient(135deg, var(--primary-color-start, #10b981), var(--primary-color-end, #059669))', padding: '3px 8px 3px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#ffffff' }}><SettingsIcon size={13} color="#ffffff" /> App settings</span>
          <button onClick={handleCancel} title="Close without saving" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#ffffff', width: '22px', height: '22px', padding: 0, borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: '6px 14px 10px 14px', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel, #ffffff)', overflowY: 'auto', flex: 1, minHeight: 0 }}>

          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={name}><Moon size={14} /> Background theme</div>
              <div style={sub}>Colour of the page behind the screens</div>
            </div>
            <select className="input-field" value={settings.appBackground || 'slate'} onChange={e => setSettings({...settings, appBackground: e.target.value})} style={{ width: '160px', flexShrink: 0 }}>
              <option value="slate">CLASSIC SLATE</option>
              <option value="white">PURE WHITE</option>
              <option value="warm">WARM SAND</option>
              <option value="sky">SOFT SKY</option>
              <option value="mint">FRESH MINT</option>
              <option value="lavender">LAVENDER</option>
              <option value="peach">WARM PEACH</option>
              <option value="rose">SOFT ROSE</option>
              <option value="coolgrey">COOL GREY</option>
              <option value="ivory">IVORY</option>
              <option value="ice">ICE BLUE</option>
              <option value="seagreen">SEA GREEN</option>
              <option value="lemon">SOFT LEMON</option>
            </select>
          </div>

          <div style={{ ...row, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={name}><Palette size={14} /> Theme colour</div>
              <div style={sub}>Colour of the menu bar, headings and buttons</div>
              <div style={{ ...sub, marginTop: '2px', fontWeight: 600, color: 'var(--text-main, #1e293b)' }}>Now: {String(settings.primaryColor || 'blue').toUpperCase()}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 18px)', gap: '5px', flexShrink: 0, paddingTop: '2px' }}>
              {COLORS.map(color => (
                <button
                  type="button"
                  key={color}
                  title={color.toUpperCase()}
                  aria-label={'Theme colour ' + color}
                  onClick={() => pickColor(color)}
                  className={'sw' + (settings.primaryColor === color ? ' sw-on' : '')}
                  style={{ '--sw': colorMap[color] }}
                />
              ))}
            </div>
          </div>

          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={name}><Bell size={14} /> Push notifications</div>
              <div style={sub}>Pop-up alerts for new notifications</div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>
              <input type="checkbox" checked={!!settings.notificationsEnabled} onChange={e => setSettings({...settings, notificationsEnabled: e.target.checked})} style={{ width: '14px', height: '14px', margin: 0, cursor: 'pointer' }} />
              {settings.notificationsEnabled ? 'On' : 'Off'}
            </label>
          </div>

          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={name}><Globe size={14} /> Language</div>
              <div style={sub}>The screens are in English only for now</div>
            </div>
            <select className="input-field" value={settings.language || 'en'} onChange={e => setSettings({...settings, language: e.target.value})} style={{ width: '160px', flexShrink: 0 }}>
              <option value="en">ENGLISH (US)</option>
              {/* screens are in English only for now: other languages are kept but not offered (they changed nothing) */}
              {settings.language === 'hi' && <option value="hi">HINDI (IN) - not available yet</option>}
              {settings.language === 'es' && <option value="es">SPANISH (ES) - not available yet</option>}
            </select>
          </div>

          {userRole === 'admin' && (
            <div style={{ ...row, borderBottom: 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...name, color: '#b91c1c' }}>System backup (admin only)</div>
                <div style={{ ...sub, marginLeft: 0 }}>{backupNote || 'Makes a full backup of the code and the database'}</div>
              </div>
              <button onClick={handleBackup} disabled={isBackingUp} style={{ ...btn, border: '1px solid #fca5a5', backgroundColor: 'var(--bg-panel, #ffffff)', color: '#b91c1c', cursor: isBackingUp ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                {isBackingUp ? 'Backing up...' : 'Start backup'}
              </button>
            </div>
          )}

        </div>

        <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--lg-line, #e2e8f0)', backgroundColor: 'var(--bg-app, #f8fafc)', padding: '6px 14px', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={handleReset} title="Back to the default colours (not saved until Save)" style={{ ...btn, border: '1px solid var(--border-color, #cbd5e1)', backgroundColor: 'var(--bg-panel, #ffffff)', color: 'var(--text-muted, #64748b)' }}>
            <RotateCcw size={12} /> Reset defaults
          </button>
          <span style={{ flex: 1, minWidth: 0, fontSize: '11px', fontWeight: 600, textTransform: 'none', color: errorToast ? '#dc2626' : '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {errorToast ? <><AlertCircle size={13} /> {errorToast}</> : showToast ? <><CheckCircle size={13} /> Settings saved</> : null}
          </span>
          <button onClick={handleCancel} style={{ ...btn, border: '1px solid var(--border-color, #cbd5e1)', backgroundColor: 'var(--bg-panel, #ffffff)', color: 'var(--text-main, #334155)' }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ ...btn, border: 'none', background: 'var(--primary-color-end, #059669)', color: '#ffffff' }}>
            <Save size={12} /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
