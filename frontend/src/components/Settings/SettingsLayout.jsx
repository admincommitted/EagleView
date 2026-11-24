import React, { useState, useEffect } from 'react';
import { Settings, Building, Hash, Shield, Network, Calendar, MessageCircle, Mail } from 'lucide-react';
import { useSearchParams, useLocation } from 'react-router-dom';
import CHAMasterTab from './Tabs/CHAMasterTab';
import SequenceConfigTab from './Tabs/SequenceConfigTab';
import SystemSetupTab from './Tabs/SystemSetupTab';
import BranchMasterTab from './Tabs/BranchMasterTab';
import FinancialYearTab from './Tabs/FinancialYearTab';
import IcegateProfileSettings from './IcegateProfileSettings';
import NetworkSettingsTab from './Tabs/NetworkSettingsTab';
import WhatsappSettingsTab from './Tabs/WhatsappSettingsTab';
import EmailSettingsTab from './Tabs/EmailSettingsTab';
import AiSettingsTab from './Tabs/AiSettingsTab';
import { Cpu } from 'lucide-react';
import UlipSettingsTab from './Tabs/UlipSettingsTab';
import SecuritySettingsTab from './Tabs/SecuritySettingsTab'; // 14-Nov-2026
import NumberSeriesTab from './Tabs/NumberSeriesTab'; // 05-Nov-2026: iCAFFE numbering
import { FileDigit } from 'lucide-react';
import { Globe } from 'lucide-react';
import { usePermissions } from '../../utils/permissions';

export default function SettingsLayout() {
  const [activeTab, setActiveTab] = useState('system');
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Auto-select tab from URL: /settings?tab=network or /settings/sftp → network
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['system', 'ai', 'branch', 'cha', 'fy', 'sequence', 'numseries', 'network', 'icegate', 'whatsapp', 'email', 'ulip', 'security'];
    if (tabParam === 'docseries') { setActiveTab('numseries'); return; }
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (location.pathname.includes('/document-series')) {
      setActiveTab('numseries'); // old Document Series links (05-Nov-2026: Document Series removed - numbers come from Number Series (iCAFFE))
    } else if (location.pathname.includes('/sftp') || location.pathname.includes('/network')) {
      // Old /settings/sftp URL → redirect to network tab
      setActiveTab('network');
    }
  }, [searchParams, location.pathname]);

  // 30-Oct-2026: tabs the user has no View right for are hidden (Master > User Management > System Settings forms)
  const P = usePermissions();
  const tabAllowed = (id) => P.canOpen('/settings?tab=' + id);
  const ALL_TABS = ['system', 'branch', 'cha', 'fy', 'sequence', 'numseries', 'network', 'icegate', 'ulip', 'ai', 'whatsapp', 'email', 'security'];
  useEffect(() => {
    if (!tabAllowed(activeTab)) { const first = ALL_TABS.find(tabAllowed); if (first) setActiveTab(first); }
  }, [activeTab, P.restricted]);
  const tabBtn = (id, label, icon, color = '#0369a1', bg = '#f0f9ff') => tabAllowed(id) && (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', flexShrink: 0,
        borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
        background: activeTab === id ? bg : 'transparent',
        color: activeTab === id ? color : 'var(--text-muted, #475569)',
        fontWeight: activeTab === id ? 600 : 500,
        fontSize: '13px',
        transition: 'all 0.2s',
        borderLeft: activeTab === id ? `3px solid ${color}` : '3px solid transparent',
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', padding: '1.5rem', background: 'var(--bg-app)' }}>

      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Settings size={24} color="var(--text-main, #0f172a)" />
        <h2 style={{ margin: 0, color: 'var(--text-main, #0f172a)', fontSize: '1.5rem' }}>System Settings</h2>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Sidebar */}
        {/* the list scrolls on short screens: Email (last item) was cut off below WhatsApp. 28-Oct-2026 */}
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0, overflowY: 'auto', minHeight: 0, paddingBottom: '12px' }}>

          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 16px 4px', marginTop: '4px' }}>General</div>
          {tabBtn('system',   'System Setup',     <Settings size={16} />, '#0369a1', '#f0f9ff')}
          {tabBtn('branch',   'Branch Master',    <Building size={16} />, '#0369a1', '#f0f9ff')}
          {tabBtn('cha',      'CHA Master',       <Building size={16} />, '#0369a1', '#f0f9ff')}
          {tabBtn('fy',       'Financial Year',   <Calendar size={16} />, '#0369a1', '#f0f9ff')}
          {tabBtn('sequence', 'Sequence Config',  <Hash size={16} />,     '#0369a1', '#f0f9ff')}
          {tabBtn('numseries', 'Number Series (iCAFFE)', <Hash size={16} />, '#0369a1', '#f0f9ff')}

          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 16px 4px', borderTop: '1px solid var(--border-color, #e2e8f0)', marginTop: '8px' }}>Connectivity</div>
          {tabBtn('network',   'Network / SFTP',    <Network size={16} />,      '#7c3aed', '#faf5ff')}
          {tabBtn('icegate',   'ICEGATE Profiles',  <Shield size={16} />,       '#1d4ed8', '#eff6ff')}
          {tabBtn('ulip',      'ULIP Integration',  <Globe size={16} />,        '#d97706', '#fffbeb')}
          {tabBtn('ai',        'AI Configuration',  <Cpu size={16} />,          '#e11d48', '#fff1f2')}
          {tabBtn('whatsapp',  'WhatsApp',          <MessageCircle size={16} />, '#16a34a', '#f0fdf4')}
          {tabBtn('email',     'Email',             <Mail size={16} />,          '#0891b2', '#ecfeff')}
          {tabBtn('security',  'Security',          <Shield size={16} />,        '#0f766e', '#f0fdfa')}

        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 1rem 0', minWidth: 0 }}>
          {activeTab === 'system'   && <SystemSetupTab />}
          {activeTab === 'sequence' && <SequenceConfigTab />}
          {activeTab === 'numseries' && <NumberSeriesTab />}
          {activeTab === 'branch'   && <BranchMasterTab />}
          {activeTab === 'fy'       && <FinancialYearTab />}
          {activeTab === 'cha'      && <CHAMasterTab />}
          {activeTab === 'network'  && <NetworkSettingsTab />}
          {activeTab === 'icegate'  && <IcegateProfileSettings />}
          {activeTab === 'ulip'     && <UlipSettingsTab />}
          {activeTab === 'ai'       && <AiSettingsTab />}
          {activeTab === 'whatsapp' && <WhatsappSettingsTab />}
          {activeTab === 'email'    && <EmailSettingsTab />}
          {activeTab === 'security' && <SecuritySettingsTab />}
        </div>

      </div>
    </div>
  );
}
