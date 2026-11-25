import { useEffect, useState } from 'react';
import { CARGO_TEMPLATES, SPH_SLOTS, textForSphCodes } from './houseWaybillData';

const PHARMA_GOODS = /PHARMA|MEDICINE/;

// nature of goods, special handling codes with their SSR / OSI lines, SCI, product and the cargo templates
export default function useHandlingInfo() {
  const [natureOfGoods, setNatureOfGoods] = useState('');
  const [sphCodes, setSphCodes] = useState(() => Array(SPH_SLOTS).fill(''));
  const [ssrText, setSsrText] = useState('');
  const [osiText, setOsiText] = useState('');
  const [sci, setSci] = useState('');
  const [productId, setProductId] = useState('GEN');
  const [selectedTemplate, setSelectedTemplate] = useState('SELECT');

  const handleLoadTemplate = () => {
    const template = CARGO_TEMPLATES[selectedTemplate];
    if (!template) return;
    setNatureOfGoods(template.natureOfGoods);
    setSphCodes([...template.sphCodes]);
    setSsrText(template.ssrText);
  };

  useEffect(() => {
    const nextSsr = textForSphCodes(ssrText, sphCodes, 'ssr');
    const nextOsi = textForSphCodes(osiText, sphCodes, 'osi');
    if (nextSsr !== ssrText) setSsrText(nextSsr);
    if (nextOsi !== osiText) setOsiText(nextOsi);
  }, [sphCodes]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the codes change, typed text stays

  // pharmaceutical goods get the PIL code in the first free slot
  useEffect(() => {
    if (!PHARMA_GOODS.test(natureOfGoods) || sphCodes.includes('PIL')) return;
    const freeIndex = sphCodes.indexOf('');
    if (freeIndex === -1) return;
    setSphCodes(sphCodes.map((code, index) => (index === freeIndex ? 'PIL' : code)));
  }, [natureOfGoods]); // eslint-disable-line react-hooks/exhaustive-deps -- a PIL removed by hand stays removed

  return {
    natureOfGoods, setNatureOfGoods, sphCodes, setSphCodes, ssrText, setSsrText, osiText, setOsiText,
    sci, setSci, productId, setProductId, selectedTemplate, setSelectedTemplate, handleLoadTemplate,
  };
}
