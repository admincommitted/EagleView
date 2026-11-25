import { CheckCircle, Download, Eye, FolderOpen, Save, UploadCloud } from 'lucide-react';
import SpinningLoader from '../../JobEntry/JobEntryLayoutParts/SpinningLoader';

// Items of the ACTIONS menu (ActionMenu).
export function exportActionsMenuItems({ loadingPreview, flatBusy, validating, isAiLoading, isSubmitting, actions }) {
  return [
    { label: 'Import from File', icon: FolderOpen, tone: 'accent', onSelect: actions.importFile },
    { label: 'Preview JSON', icon: loadingPreview ? SpinningLoader : Eye, disabled: loadingPreview, onSelect: actions.previewJson },
    { label: 'Export Flat File (.sb)', icon: flatBusy ? SpinningLoader : Download, onSelect: actions.flatFile },
    { label: 'Validate Job', icon: validating ? SpinningLoader : CheckCircle, tone: 'accent', onSelect: actions.validate },
    { label: 'Save Draft', icon: Save, tone: 'accent', onSelect: actions.saveDraft },
    { label: 'AI PDF EXTRACT', icon: isAiLoading ? SpinningLoader : UploadCloud, disabled: isAiLoading, onSelect: actions.aiExtract },
    {
      label: isSubmitting ? 'Submitting...' : 'Send to ICEGATE',
      icon: isSubmitting ? SpinningLoader : UploadCloud,
      disabled: isSubmitting,
      tone: 'success',
      onSelect: actions.sendToIcegate,
    },
  ];
}
