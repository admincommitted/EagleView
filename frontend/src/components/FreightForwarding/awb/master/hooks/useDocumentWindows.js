import { useState } from 'react';
import { newTempAwbId } from './masterWaybillData';

// the document windows (DG declaration, SLI, DO, commodity list ...), their saved contents (extraDocs) and the
// e-document pouch id of the AWB on screen
export default function useDocumentWindows() {
  const [extraDocs, setExtraDocs] = useState({});
  const [tempAwbId, setTempAwbId] = useState(newTempAwbId);
  const [showAwbVault, setShowAwbVault] = useState(false);
  const [showDocsMenu, setShowDocsMenu] = useState(false);
  const [showCommodity, setShowCommodity] = useState(false);
  const [showDgd, setShowDgd] = useState(false);
  const [showAvi, setShowAvi] = useState(false);
  const [showCsd, setShowCsd] = useState(false);
  const [showLithium, setShowLithium] = useState(false);
  const [showCoo, setShowCoo] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showCca, setShowCca] = useState(false);
  const [showTemp, setShowTemp] = useState(false);
  const [showManifest, setShowManifest] = useState(false);
  const [showSli, setShowSli] = useState(false);
  const [showDo, setShowDo] = useState(false);

  return {
    extraDocs, setExtraDocs, tempAwbId, setTempAwbId, showAwbVault, setShowAwbVault, showDocsMenu, setShowDocsMenu,
    showCommodity, setShowCommodity, showDgd, setShowDgd, showAvi, setShowAvi, showCsd, setShowCsd,
    showLithium, setShowLithium, showCoo, setShowCoo, showLabel, setShowLabel, showBooking, setShowBooking,
    showCca, setShowCca, showTemp, setShowTemp, showManifest, setShowManifest, showSli, setShowSli, showDo, setShowDo,
  };
}
