import { useEffect, useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { freightApi } from '../../../freightApi';
import { showValidationErrorsModal } from '../../../printLogic';
import { recalcRow, volWtFromCbm } from '../../weightCalc';
import { CONSOLIDATION_GOODS, houseRow, houseTotals } from './masterWaybillData';

const upperTrim = (value) => String(value || '').trim().toUpperCase();
const digitsOf = (value) => String(value || '').replace(/\D/g, '');

// the houses saved on this master; an error answer from the server counts as none
export async function fetchSavedHouses(mawbNumber) {
  try {
    return await freightApi.linkedHawbs(mawbNumber);
  } catch (error) {
    if (error.response) return [];
    throw error;
  }
}

// a house from / to another airport than this master, or already on another master, is linked only when confirmed
const houseMayBeLinked = async (hawb, { masterNumber, depAirport, destAirport }) => {
  const masterOrigin = upperTrim(depAirport);
  const masterDestination = upperTrim(destAirport);
  const houseOrigin = upperTrim(hawb.origin);
  const houseDestination = upperTrim(hawb.destination);
  const otherRoute = (masterOrigin && houseOrigin && masterOrigin !== houseOrigin) || (masterDestination && houseDestination && masterDestination !== houseDestination);
  if (otherRoute) {
    const linkAnyway = await askConfirm({
      title: 'Different route',
      message: `HAWB ${hawb.awbNumber} is ${houseOrigin || '?'} - ${houseDestination || '?'}, this MAWB is ${masterOrigin || '?'} - ${masterDestination || '?'}.\nLink it anyway?`,
      okLabel: 'Link',
      tone: 'warn',
    });
    if (!linkAnyway) return false;
  }
  if (hawb.masterAwbNumber && digitsOf(hawb.masterAwbNumber) !== digitsOf(masterNumber)) {
    return askConfirm({
      title: 'HAWB on another master',
      message: `HAWB ${hawb.awbNumber} is on master ${hawb.masterAwbNumber}. Move it to ${masterNumber || 'this master'} when you save?`,
      okLabel: 'Move',
      tone: 'warn',
    });
  }
  return true;
};

// Consolidation: the houses linked to this master, kept in step with its goods text and its first rate line
export default function useLinkedHouses({ awbPrefix, awbSuffix, depAirport, destAirport, natureOfGoods, setNatureOfGoods, setRateLines, densityGroup }) {
  const [linkedHawbs, setLinkedHawbs] = useState([]);
  const [showLinkHawb, setShowLinkHawb] = useState(false);
  const [hawbSearchText, setHawbSearchText] = useState('');

  const handleLinkHawb = async (thisMasterNo = '') => {
    const houseNumber = hawbSearchText.trim();
    if (!houseNumber) return;
    let hawb;
    try {
      hawb = await freightApi.hawbByNumber(houseNumber.toUpperCase());
    } catch (error) {
      console.error('HAWB link error:', error);
      showValidationErrorsModal([error.response
        ? `HAWB '${hawbSearchText}' not found in database. Please create the HAWB first.`
        : `Error fetching HAWB: ${error.message}`]);
      return;
    }
    if (linkedHawbs.some((house) => house.awb === hawb.awbNumber)) {
      showValidationErrorsModal(['This HAWB is already linked!']);
      return;
    }
    if (hawb.status === 'VOID') {
      showValidationErrorsModal([`HAWB ${hawb.awbNumber} is VOID.`]);
      return;
    }
    // the button may hand over its click event instead of the master number
    const masterNumber = typeof thisMasterNo === 'string' ? thisMasterNo : '';
    if (!(await houseMayBeLinked(hawb, { masterNumber, depAirport, destAirport }))) return;
    setLinkedHawbs((previous) => [...previous, {
      ...houseRow(hawb),
      id: hawb.id || Date.now(),
      awb: hawb.awbNumber || hawbSearchText,
      shc: hawb.sphCodes?.[0] || 'GEN',
      local: true,
    }]);
    setHawbSearchText('');
  };

  // the goods text "CONSOLIDATION AS PER MANIFEST n PCS / n KGS" follows the houses (only that own text is rewritten);
  // an EMPTY master rate line is filled from the houses - a line the user filled is never changed
  useEffect(() => {
    if (!linkedHawbs.length) return;
    const totals = houseTotals(linkedHawbs);
    const consolidationText = `CONSOLIDATION AS PER MANIFEST\n${totals.pieces} PCS / ${totals.weight} KGS`;
    const currentGoods = String(natureOfGoods || '');
    if (!currentGoods.trim() || CONSOLIDATION_GOODS.test(currentGoods)) {
      if (currentGoods !== consolidationText) setNatureOfGoods(consolidationText);
    } else if (!/CONSOL/i.test(currentGoods)) {
      setNatureOfGoods(`${consolidationText}\n${currentGoods}`);
    }
    setRateLines((previous) => {
      const lines = Array.isArray(previous) ? previous : [];
      const filled = lines.some((row) => row && ((parseFloat(row.noOfPcs ?? row.pieces) || 0) > 0 || (parseFloat(row.grossWeight) || 0) > 0));
      if (filled || !(totals.pieces > 0 && totals.weight > 0)) return previous;
      const firstLine = lines[0] || { id: Date.now(), gwUnit: 'K', isRounded: true, rateClassCode: 'Q' };
      const volumetricWeight = totals.volume > 0 ? +volWtFromCbm(totals.volume, densityGroup).toFixed(2) : '';
      const line = recalcRow({
        ...firstLine,
        noOfPcs: String(totals.pieces),
        pieces: String(totals.pieces),
        grossWeight: String(totals.weight),
        volumetricWeight,
        goodsDescription: firstLine.goodsDescription || 'CONSOLIDATION AS PER ATTACHED MANIFEST',
      }, 'grossWeight');
      return [line, ...lines.slice(1)];
    });
  }, [linkedHawbs]); // eslint-disable-line react-hooks/exhaustive-deps -- only a change of houses rewrites the goods / line

  // a complete MAWB number shows its saved houses plus the ones linked on screen and not saved yet
  useEffect(() => {
    if (awbPrefix.length !== 3 || awbSuffix.length !== 8) return;
    const loadSavedHouses = async () => {
      try {
        const houses = await fetchSavedHouses(`${awbPrefix}-${awbSuffix}`);
        if (!Array.isArray(houses)) return;
        setLinkedHawbs((previous) => [
          ...houses.map(houseRow),
          ...previous.filter((house) => house.local && !houses.some((saved) => saved.awbNumber === house.awb)),
        ]);
      } catch (error) {
        console.warn('Could not load linked HAWBs:', error.message);
      }
    };
    loadSavedHouses();
  }, [awbPrefix, awbSuffix]);

  return { linkedHawbs, setLinkedHawbs, showLinkHawb, setShowLinkHawb, hawbSearchText, setHawbSearchText, handleLinkHawb };
}
