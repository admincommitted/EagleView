import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui';
import { AirExportPage } from './AirExportParts/widgets';
import { useEcsd } from './EcsdFormParts/useEcsd';
import { previewEcsd } from './EcsdFormParts/previewEcsd';
import { AwbPicker, ConsignmentPanels, LinkedHawbsPanel, RoutePanel, SecurityPanels } from './EcsdFormParts/EcsdSections';

export default function EcsdForm() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const ecsd = useEcsd();
  const { consignment, awbId, busy } = ecsd;

  return (
    <AirExportPage activeTab="create" className="tw:py-0">
      <div ref={formRef} className="tw:flex tw:flex-col tw:gap-2 tw:px-2 tw:py-1">
        <h2 className="tw:m-0 tw:text-base tw:font-normal tw:text-foreground">e-CSD</h2>
        {ecsd.savedNote && (
          <div className="tw:flex tw:items-center tw:justify-between tw:rounded tw:bg-success/10 tw:px-2 tw:py-1.5 tw:text-entry tw:text-success">
            {ecsd.savedNote}
            <Button variant="ghost" size="icon-sm" aria-label="Hide the message" onClick={ecsd.hideSavedNote}><X /></Button>
          </div>
        )}

        <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded tw:border tw:border-border tw:bg-card tw:p-2">
          <AwbPicker ecsd={ecsd} />
          <div className="tw:my-2 tw:border-t tw:border-border" />
          <ConsignmentPanels ecsd={ecsd} />
          <LinkedHawbsPanel linkedHawbs={ecsd.linkedHawbs} loading={ecsd.hawbLoading} />
          <RoutePanel consignment={consignment} />
          <SecurityPanels declaration={ecsd.declaration} setField={ecsd.setField} />

          <div className="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Button variant="link" onClick={ecsd.clearDeclaration}>Clear</Button>
              <Button variant="default" onClick={() => previewEcsd(formRef.current, consignment.awbNumber)}>Preview</Button>
            </div>
            <div className="tw:flex tw:gap-2">
              <Button variant="default" onClick={() => navigate(awbId ? `/freight/awb?id=${awbId}` : '/freight/awb')}>Go to AWB</Button>
              <Button variant="default" disabled={busy} onClick={ecsd.save}>{busy ? 'Saving...' : 'Save'}</Button>
              <Button variant="default" disabled={busy} onClick={ecsd.remove}>Void</Button>
            </div>
          </div>
        </div>
      </div>
    </AirExportPage>
  );
}
