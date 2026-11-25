import { Download, Eye, FileText, FolderOpen, Save, UploadCloud } from 'lucide-react';
import SpinningLoader from './SpinningLoader';

// Items of the ACTIONS menu (ActionMenu). An amended job has no BE file downloads: its file is the amendment file.
export function jobActionsMenuItems({ isAmendedJob, loadingPreview, isAiLoading, isSubmitting, actions }) {
  return [
    { label: 'Import from File', icon: FolderOpen, tone: 'accent', onSelect: actions.importFile },
    { label: 'Preview JSON', icon: loadingPreview ? SpinningLoader : Eye, disabled: loadingPreview, onSelect: actions.previewJson },
    ...(isAmendedJob ? [] : [
      { label: 'Download BE File (CACHI01 JSON)', icon: Download, onSelect: actions.downloadJson },
      { label: 'Download BE Flat File (.be)', icon: Download, onSelect: actions.downloadFlatBe },
    ]),
    {
      label: isAmendedJob ? 'This Amendment (file / sign / send)' : 'BE Amendment',
      title: 'Amendment of a filed BE as an ICEGATE flat file (e.g. prior BE made final with the IGM details)',
      icon: FileText,
      onSelect: actions.beAmendment,
    },
    { label: 'Save Draft', icon: Save, tone: 'accent', onSelect: actions.saveDraft },
    {
      label: isAiLoading ? 'Extracting AI...' : 'AI PDF Extract',
      title: 'Reads a supplier invoice PDF with AI and adds it as a new invoice with its items',
      icon: isAiLoading ? SpinningLoader : UploadCloud,
      disabled: isAiLoading,
      onSelect: actions.aiExtract,
    },
    {
      label: isSubmitting ? 'Submitting...' : 'Send to ICEGATE',
      title: 'Saves the job, checks it and sends the signed BE JSON to ICEGATE',
      icon: isSubmitting ? SpinningLoader : UploadCloud,
      disabled: isSubmitting,
      tone: 'success',
      onSelect: actions.sendToIcegate,
    },
  ];
}
