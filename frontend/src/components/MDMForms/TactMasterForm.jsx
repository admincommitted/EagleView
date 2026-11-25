import { Card, Tabs } from '@/components/ui';
import AircraftCommandCenter from './AircraftCommandCenter';
import useTactMasterForm from './TactMasterFormParts/useTactMasterForm';
import TactAndIataSection from './TactMasterFormParts/sections/TactAndIataSection';
import TactRecordsSection from './TactMasterFormParts/sections/TactRecordsSection';

export default function TactMasterForm() {
  const ctx = useTactMasterForm();
  return (
    <div className="tw:min-h-screen tw:w-full tw:bg-page tw:p-3 tw:md:p-6">
      <Tabs value={ctx.activeTab} onValueChange={ctx.setActiveTab}>
        <TactAndIataSection ctx={ctx} />
        <Card className="tw:p-4 tw:md:p-6">
          <TactRecordsSection ctx={ctx} />
        </Card>
      </Tabs>
      {ctx.selectedAircraft && <AircraftCommandCenter aircraft={ctx.selectedAircraft} onClose={() => ctx.setSelectedAircraft(null)} />}
    </div>
  );
}
