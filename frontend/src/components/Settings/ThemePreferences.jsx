import React, { useState } from 'react';
import { useTheme } from '../../ThemeContext';
import { Moon, Bell, Palette, Globe, X, RotateCcw, Save } from 'lucide-react';

export default function ThemePreferences({ onClose }) {
  const { themeMode, setThemeMode, accentColor, setAccentColor } = useTheme();
  
  const [localTheme, setLocalTheme] = useState(themeMode);
  const [localAccent, setLocalAccent] = useState(accentColor);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('en');

  const accents = [
    { id: 'blue', color: 'var(--primary-color-start, #0ea5e9)' },
    { id: 'green', color: '#22c55e' },
    { id: 'purple', color: '#8b5cf6' },
    { id: 'red', color: '#ef4444' },
    { id: 'orange', color: '#f59e0b' },
  ];

  const handleSave = () => {
    setThemeMode(localTheme);
    setAccentColor(localAccent);
    if(onClose) onClose();
  };

  const handleReset = () => {
    setLocalTheme('light');
    setLocalAccent('blue');
    setNotifications(true);
    setLanguage('en');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', width: '450px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        
        {/* Header */}
        <div style={{ background: '#f59e0b', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '10px' }}>
            <SettingsIcon color="#fff" size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 800, letterSpacing: '1px' }}>APP SETTINGS</h2>
            <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customize your workspace</p>
          </div>
          <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Theme Preference */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color, var(--border-color, #e2e8f0))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--border-color, var(--border-color, #e2e8f0))', borderRadius: '12px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                <Moon size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main, var(--text-main, #0f172a))', textTransform: 'uppercase' }}>Theme Preference</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase' }}>Choose light or dark mode</p>
              </div>
            </div>
            <select value={localTheme} onChange={e => setLocalTheme(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color, var(--border-color, #cbd5e1))', background: 'var(--bg-input, #fff)', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 600, outline: 'none', width: '130px' }}>
              <option value="light">LIGHT MODE</option>
              <option value="dark">DARK MODE</option>
            </select>
          </div>

          {/* Push Notifications */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color, var(--border-color, #e2e8f0))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--border-color, var(--border-color, #e2e8f0))', borderRadius: '12px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                <Bell size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main, var(--text-main, #0f172a))', textTransform: 'uppercase' }}>Push Notifications</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase' }}>Enable alerts for job updates</p>
              </div>
            </div>
            <div 
              onClick={() => setNotifications(!notifications)}
              style={{ width: '44px', height: '24px', background: notifications ? '#f59e0b' : 'var(--border-color, var(--border-color, #cbd5e1))', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
            >
              <div style={{ position: 'absolute', top: '2px', left: notifications ? '22px' : '2px', width: '20px', height: '20px', background: '#fff', borderRadius: '50%', transition: '0.3s' }}></div>
            </div>
          </div>

          {/* Theme Color */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color, var(--border-color, #e2e8f0))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--border-color, var(--border-color, #e2e8f0))', borderRadius: '12px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                <Palette size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main, var(--text-main, #0f172a))', textTransform: 'uppercase' }}>Theme Color</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase' }}>Accent color of the app</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {accents.map(acc => (
                <div 
                  key={acc.id}
                  onClick={() => setLocalAccent(acc.id)}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', background: acc.color, cursor: 'pointer', border: localAccent === acc.id ? '2px solid var(--text-main, var(--text-main, #0f172a))' : '2px solid transparent', outline: localAccent === acc.id ? '2px solid transparent' : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
          </div>

          {/* Language */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--border-color, var(--border-color, #e2e8f0))', borderRadius: '12px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                <Globe size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main, var(--text-main, #0f172a))', textTransform: 'uppercase' }}>Language</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase' }}>Interface Language</p>
              </div>
            </div>
            <select value={language} onChange={e => setLanguage(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color, var(--border-color, #cbd5e1))', background: 'var(--bg-input, #fff)', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 600, outline: 'none', width: '130px' }}>
              <option value="en">ENGLISH (US)</option>
              <option value="hi">HINDI (IN)</option>
            </select>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: 'var(--bg-app, var(--bg-app, #f8fafc))', borderTop: '1px solid var(--border-color, var(--border-color, #e2e8f0))', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'transparent', border: '1px dashed var(--border-color, var(--border-color, #cbd5e1))', borderRadius: '8px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, cursor: 'pointer' }}>
            <RotateCcw size={16} /> RESET DEFAULTS
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 24px', background: 'var(--bg-panel, #fff)', border: '1px solid var(--border-color, var(--border-color, #cbd5e1))', borderRadius: '8px', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 700, cursor: 'pointer' }}>
              CANCEL
            </button>
            <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: '#f59e0b', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
              <Save size={16} /> SAVE CHANGES
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function SettingsIcon({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );
}
