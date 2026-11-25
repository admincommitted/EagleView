import { useLayoutEffect, useRef, useState } from 'react';
import { freightApi } from '../../../freightApi';
import { awbCheckDigitError } from './masterWaybillData';

const STOCK_LIST_MIN_WIDTH = 320;

// MAWB number (airline prefix + 8-digit serial), its stock suggestions list and the airline of the prefix
export default function useAwbNumber({ masterAirlines, setUiModal }) {
  const [awbPrefix, setAwbPrefix] = useState('');
  const [awbSuffix, setAwbSuffix] = useState('');
  const [awbDropList, setAwbDropList] = useState([]);
  const [showAwbDrop, setShowAwbDrop] = useState(false);
  const [awbFocusedIndex, setAwbFocusedIndex] = useState(-1);
  const awbSuffixInputRef = useRef(null);
  const awbDropdownRef = useRef(null);

  // the suggestions list floats under the serial box and follows it on scroll / resize
  useLayoutEffect(() => {
    const placeDropdown = () => {
      const dropdown = awbDropdownRef.current;
      const input = awbSuffixInputRef.current;
      if (!showAwbDrop || !dropdown || !input) return;
      const rect = input.getBoundingClientRect();
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${rect.bottom + 2}px`;
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.width = `${Math.max(rect.width, STOCK_LIST_MIN_WIDTH)}px`;
      dropdown.style.zIndex = '99';
    };
    placeDropdown();
    if (!showAwbDrop) return undefined;
    window.addEventListener('scroll', placeDropdown, true);
    window.addEventListener('resize', placeDropdown);
    return () => {
      window.removeEventListener('scroll', placeDropdown, true);
      window.removeEventListener('resize', placeDropdown);
    };
  }, [showAwbDrop, awbDropList]);

  const awbNo = awbPrefix + awbSuffix;
  const getAwbError = () => awbCheckDigitError(awbSuffix);

  const foundAirline = masterAirlines.find((airline) => airline.prefix === awbPrefix);
  const airlineName = foundAirline ? foundAirline.name : null;
  const airlineCode = foundAirline ? (foundAirline.code2 || '') : '';

  const fetchStock = async () => {
    if (awbPrefix.length !== 3) {
      setUiModal({ isOpen: true, title: 'VALIDATION ERROR', message: 'PLEASE ENTER A 3-DIGIT AIRLINE PREFIX FIRST.', type: 'error' });
      return;
    }
    let stock;
    try {
      stock = await freightApi.nextAwbFromStock(awbPrefix);
    } catch (error) {
      stock = error.response?.data;
      if (!stock) {
        setUiModal({ isOpen: true, title: 'NETWORK ERROR', message: 'FAILED TO FETCH STOCK', type: 'error' });
        return;
      }
    }
    if (stock.success) setAwbSuffix(stock.serial);
    else setUiModal({ isOpen: true, title: 'STOCK EXHAUSTED', message: stock.error || 'NO STOCK AVAILABLE FOR THIS PREFIX', type: 'error' });
  };

  return {
    awbPrefix, setAwbPrefix, awbSuffix, setAwbSuffix, awbNo, getAwbError,
    awbDropList, setAwbDropList, showAwbDrop, setShowAwbDrop, awbFocusedIndex, setAwbFocusedIndex,
    awbSuffixInputRef, awbDropdownRef, foundAirline, airlineName, airlineCode, fetchStock,
  };
}
