import React from 'react';
import useNetworkSettingsTab from './NetworkSettingsTabParts/useNetworkSettingsTab';
import NetworkSftpSettingsSection from './NetworkSettingsTabParts/sections/NetworkSftpSettingsSection';
import DescartesSelfDiagnosticsSection from './NetworkSettingsTabParts/sections/DescartesSelfDiagnosticsSection';

// NetworkSettingsTab: state/logic in ./NetworkSettingsTabParts/use*.jsx, screen sections in ./NetworkSettingsTabParts/sections/.
export default function NetworkSettingsTab() {
  const ctx = {};
  Object.assign(ctx, useNetworkSettingsTab(ctx));
  return <div style={{ maxWidth: '900px' }}>

      <NetworkSftpSettingsSection ctx={ctx} />
      <DescartesSelfDiagnosticsSection ctx={ctx} />

    </div>;
}
