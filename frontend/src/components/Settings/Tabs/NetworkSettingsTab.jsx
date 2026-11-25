import useNetworkSettingsTab from './NetworkSettingsTabParts/useNetworkSettingsTab';
import NetworkSftpSettingsSection from './NetworkSettingsTabParts/sections/NetworkSftpSettingsSection';
import DescartesSelfDiagnosticsSection from './NetworkSettingsTabParts/sections/DescartesSelfDiagnosticsSection';

export default function NetworkSettingsTab() {
  const ctx = useNetworkSettingsTab();
  return (
    <div className="tw:flex tw:w-full tw:max-w-[900px] tw:flex-col tw:gap-4">
      <NetworkSftpSettingsSection ctx={ctx} />
      <DescartesSelfDiagnosticsSection ctx={ctx} />
    </div>
  );
}
