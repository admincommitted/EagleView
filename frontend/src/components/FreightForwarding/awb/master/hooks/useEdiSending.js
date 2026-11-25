import { useState } from 'react';

// XFWB / XFZB / XFFM sending: the CSD send menu, its options and the "sending" / "sent" flags
export default function useEdiSending() {
  const [showCsdSendMenu, setShowCsdSendMenu] = useState(false);
  const [csdSendOptions, setCsdSendOptions] = useState({ securityStatus: 'SPX', screeningMethod: 'XRY', issuerName: '' });
  const [sendingXfzb, setSendingXfzb] = useState(false);
  const [sendingXffm, setSendingXffm] = useState(false);
  const [xfwbSent, setXfwbSent] = useState(false);

  return {
    showCsdSendMenu, setShowCsdSendMenu, csdSendOptions, setCsdSendOptions,
    sendingXfzb, setSendingXfzb, sendingXffm, setSendingXffm, xfwbSent, setXfwbSent,
  };
}
