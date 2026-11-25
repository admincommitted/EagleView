import { useLayoutEffect, useRef, useState } from 'react';
import { freightApi } from '../../../freightApi';
import { awbCheckDigitError } from './houseWaybillData';

const DROPDOWN_GAP_PX = 2;
const AWB_DROPDOWN_MIN_WIDTH_PX = 320;
const DROPDOWN_Z_INDEX = '99';

const placeBelow = (dropdown, anchorRect, width) => {
  Object.assign(dropdown.style, {
    position: 'fixed',
    top: `${anchorRect.bottom + DROPDOWN_GAP_PX}px`,
    left: `${anchorRect.left}px`,
    zIndex: DROPDOWN_Z_INDEX,
    ...(width ? { width: `${width}px` } : {}),
  });
};

// MAWB number (prefix + serial with its stock suggestions), HAWB number (with the HAWB stock list) and the airline of the prefix
export default function useAwbNumbers({ masterAirlines, setUiModal }) {
  const [awbPrefix, setAwbPrefix] = useState('');
  const [awbSuffix, setAwbSuffix] = useState('');
  const [hawbNumber, setHawbNumber] = useState('');

  const [awbDropList, setAwbDropList] = useState([]);
  const [showAwbDrop, setShowAwbDrop] = useState(false);
  const [awbFocusedIndex, setAwbFocusedIndex] = useState(-1);
  const awbSuffixInputRef = useRef(null);
  const awbDropdownRef = useRef(null);

  const [hawbStockList, setHawbStockList] = useState([]);
  const [hawbStockFiltered, setHawbStockFiltered] = useState([]);
  const [showHawbDrop, setShowHawbDrop] = useState(false);
  const [hawbSearchVal, setHawbSearchVal] = useState('');
  const hawbDropdownRef = useRef(null);
  const hawbBtnRef = useRef(null);

  const hawbButtonRect = () => (hawbBtnRef.current ? hawbBtnRef.current.getBoundingClientRect() : null);

  // the dropdowns are fixed-position so they are not clipped by the form; they follow their box on scroll / resize
  useLayoutEffect(() => {
    const updatePosition = () => {
      if (showAwbDrop && awbDropdownRef.current && awbSuffixInputRef.current) {
        const inputRect = awbSuffixInputRef.current.getBoundingClientRect();
        placeBelow(awbDropdownRef.current, inputRect, Math.max(inputRect.width, AWB_DROPDOWN_MIN_WIDTH_PX));
      }
      if (showHawbDrop && hawbDropdownRef.current && hawbBtnRef.current) {
        const buttonRect = hawbButtonRect();
        if (buttonRect) placeBelow(hawbDropdownRef.current, buttonRect);
      }
    };
    updatePosition();
    if (!showAwbDrop && !showHawbDrop) return undefined;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showAwbDrop, awbDropList, showHawbDrop, hawbStockList]);

  const showHawbStock = (list, open) => {
    setHawbStockList(list);
    setHawbStockFiltered(list);
    if (open) setHawbSearchVal('');
    setShowHawbDrop(open);
  };

  const openHawbStockDrop = async () => {
    if (showHawbDrop) {
      setShowHawbDrop(false);
      return;
    }
    try {
      const stock = await freightApi.availableHawbStock();
      showHawbStock(Array.isArray(stock) ? stock : [], true);
    } catch (error) {
      // the server answered with an error: the list opens empty; no answer at all: it stays closed
      showHawbStock([], Boolean(error.response));
    }
  };

  const filterHawbStock = (searchText) => {
    setHawbSearchVal(searchText);
    if (!searchText.trim()) {
      setHawbStockFiltered(hawbStockList);
      return;
    }
    setHawbStockFiltered(hawbStockList.filter((stock) => (stock.fullHawbNumber || '').includes(searchText)));
  };

  const fetchStock = async () => {
    if (awbPrefix.length !== 3) {
      setUiModal({ isOpen: true, title: 'VALIDATION ERROR', message: 'PLEASE ENTER A 3-DIGIT AIRLINE PREFIX FIRST.', type: 'error' });
      return;
    }
    const showNoStock = (message) => setUiModal({ isOpen: true, title: 'STOCK EXHAUSTED', message: message || 'NO STOCK AVAILABLE FOR THIS PREFIX', type: 'error' });
    try {
      const stock = await freightApi.nextAwbFromStock(awbPrefix);
      if (stock.success) setAwbSuffix(stock.serial);
      else showNoStock(stock.error);
    } catch (error) {
      const answer = error.response?.data;
      if (answer && typeof answer === 'object') showNoStock(answer.error);
      else setUiModal({ isOpen: true, title: 'NETWORK ERROR', message: 'FAILED TO FETCH STOCK', type: 'error' });
    }
  };

  const getAwbError = () => awbCheckDigitError(awbSuffix);

  const foundAirline = masterAirlines.find((airline) => airline.prefix === awbPrefix);
  const airlineName = foundAirline ? foundAirline.name : null;
  const airlineCode = foundAirline ? (foundAirline.code2 || '') : '';

  return {
    awbPrefix, setAwbPrefix, awbSuffix, setAwbSuffix, awbNo: awbPrefix + awbSuffix, hawbNumber, setHawbNumber, getAwbError,
    awbDropList, setAwbDropList, showAwbDrop, setShowAwbDrop, awbFocusedIndex, setAwbFocusedIndex, awbSuffixInputRef, awbDropdownRef,
    hawbStockList, setHawbStockList, hawbStockFiltered, setHawbStockFiltered, showHawbDrop, setShowHawbDrop,
    hawbSearchVal, setHawbSearchVal, hawbDropdownRef, hawbBtnRef, hawkBtnRect: hawbButtonRect,
    openHawbStockDrop, filterHawbStock, fetchStock, foundAirline, airlineName, airlineCode,
  };
}
