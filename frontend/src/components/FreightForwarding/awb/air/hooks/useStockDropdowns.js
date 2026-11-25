import { useLayoutEffect, useRef, useState } from 'react';
import { freightApi } from '../../../freightApi';
import { listOrEmpty } from './airWaybillData';

const DROPDOWN_MIN_WIDTH = 320;

// the suggestion lists are drawn fixed under their box, so they are not cut off by the scrolling form
function placeUnder(dropdown, anchorRect, minWidth) {
  dropdown.style.position = 'fixed';
  dropdown.style.top = (anchorRect.bottom + 2) + 'px';
  dropdown.style.left = anchorRect.left + 'px';
  if (minWidth) dropdown.style.width = Math.max(anchorRect.width, minWidth) + 'px';
  dropdown.style.zIndex = '99';
}

export default function useStockDropdowns({ awbPrefix, setAwbSuffix, setUiModal }) {
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

  const hawkBtnRect = () => (hawbBtnRef.current ? hawbBtnRef.current.getBoundingClientRect() : null);

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (showAwbDrop && awbDropdownRef.current && awbSuffixInputRef.current) {
        placeUnder(awbDropdownRef.current, awbSuffixInputRef.current.getBoundingClientRect(), DROPDOWN_MIN_WIDTH);
      }
      if (showHawbDrop && hawbDropdownRef.current && hawbBtnRef.current) {
        const buttonRect = hawkBtnRect();
        if (buttonRect) placeUnder(hawbDropdownRef.current, buttonRect);
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

  const openHawbStockDrop = async () => {
    if (showHawbDrop) { setShowHawbDrop(false); return; }
    try {
      const stock = listOrEmpty(await freightApi.availableHawbStock());
      setHawbStockList(stock);
      setHawbStockFiltered(stock);
      setHawbSearchVal('');
      setShowHawbDrop(true);
    } catch {
      setHawbStockList([]);
      setHawbStockFiltered([]);
      setShowHawbDrop(false);
    }
  };

  const filterHawbStock = (typed) => {
    setHawbSearchVal(typed);
    if (!typed.trim()) { setHawbStockFiltered(hawbStockList); return; }
    setHawbStockFiltered(hawbStockList.filter((stock) => (stock.fullHawbNumber || '').includes(typed)));
  };

  const fetchStock = async () => {
    if (awbPrefix.length !== 3) {
      setUiModal({ isOpen: true, title: 'VALIDATION ERROR', message: 'PLEASE ENTER A 3-DIGIT AIRLINE PREFIX FIRST.', type: 'error' });
      return;
    }
    try {
      const answer = await freightApi.nextAwbFromStock(awbPrefix);
      if (answer.success) setAwbSuffix(answer.serial);
      else setUiModal({ isOpen: true, title: 'STOCK EXHAUSTED', message: answer.error || 'NO STOCK AVAILABLE FOR THIS PREFIX', type: 'error' });
    } catch (error) {
      const answer = error.response?.data;
      if (answer) setUiModal({ isOpen: true, title: 'STOCK EXHAUSTED', message: answer.error || 'NO STOCK AVAILABLE FOR THIS PREFIX', type: 'error' });
      else setUiModal({ isOpen: true, title: 'NETWORK ERROR', message: 'FAILED TO FETCH STOCK', type: 'error' });
    }
  };

  return {
    awbDropList, setAwbDropList, showAwbDrop, setShowAwbDrop, awbFocusedIndex, setAwbFocusedIndex, awbSuffixInputRef, awbDropdownRef,
    hawbStockList, setHawbStockList, hawbStockFiltered, setHawbStockFiltered, showHawbDrop, setShowHawbDrop,
    hawbSearchVal, setHawbSearchVal, hawbDropdownRef, hawbBtnRef, hawkBtnRect,
    openHawbStockDrop, filterHawbStock, fetchStock,
  };
}
