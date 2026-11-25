import { useEffect, useState } from 'react';
import { CARGO_TEMPLATES, emptySphCodes, textsForSphCodes } from './masterWaybillData';

const PHARMA_GOODS = /PHARMA|MEDICINE/;

// nature of goods, special handling codes, SSR / OSI / SCI, product and the cargo templates
export default function useHandlingInfo() {
  const [natureOfGoods, setNatureOfGoods] = useState('');
  const [sphCodes, setSphCodes] = useState(emptySphCodes);
  const [ssrText, setSsrText] = useState('');
  const [osiText, setOsiText] = useState('');
  const [sci, setSci] = useState('');
  const [productId, setProductId] = useState('GEN');
  const [selectedTemplate, setSelectedTemplate] = useState('SELECT');
  const [showHandling, setShowHandling] = useState(false);

  const handleLoadTemplate = () => {
    const template = CARGO_TEMPLATES[selectedTemplate];
    if (!template) return;
    setNatureOfGoods(template.natureOfGoods);
    setSphCodes([...template.sphCodes]);
    setSsrText(template.ssrText);
  };

  useEffect(() => {
    const { ssr, osi } = textsForSphCodes(sphCodes, ssrText, osiText);
    if (ssr !== ssrText) setSsrText(ssr);
    if (osi !== osiText) setOsiText(osi);
  }, [sphCodes]); // eslint-disable-line react-hooks/exhaustive-deps -- typed SSR / OSI text is not rewritten

  useEffect(() => {
    if (!PHARMA_GOODS.test(natureOfGoods) || sphCodes.includes('PIL')) return;
    const emptyIndex = sphCodes.findIndex((code) => code === '');
    if (emptyIndex === -1) return;
    const codes = [...sphCodes];
    codes[emptyIndex] = 'PIL';
    setSphCodes(codes);
  }, [natureOfGoods]); // eslint-disable-line react-hooks/exhaustive-deps -- only a goods change adds PIL

  return {
    natureOfGoods, setNatureOfGoods, sphCodes, setSphCodes, ssrText, setSsrText, osiText, setOsiText, sci, setSci,
    productId, setProductId, selectedTemplate, setSelectedTemplate, handleLoadTemplate, showHandling, setShowHandling,
  };
}
