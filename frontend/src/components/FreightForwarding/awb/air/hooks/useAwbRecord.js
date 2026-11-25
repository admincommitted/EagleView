import { useState } from 'react';
import { newTempAwbId } from './airWaybillData';

// the saved record behind the screen: its id, the e-document pouch id before the first save, the document windows
export default function useAwbRecord() {
  const [currentAwbId, setCurrentAwbId] = useState(null);
  // a new pouch on CLEAR / MODIFY, so e-documents of a dropped draft do not stay with the next AWB
  const [tempAwbId, setTempAwbId] = useState(newTempAwbId);
  // document windows (DG declaration, SLI, DO, commodity list ...) kept per AWB - saved in AwbExtraDocs
  const [extraDocs, setExtraDocs] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  return { currentAwbId, setCurrentAwbId, tempAwbId, setTempAwbId, extraDocs, setExtraDocs, isSaving, setIsSaving };
}
