import { useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { emptyParties } from '../../savedAwb';
import { runEdiValidation } from '../../awbValidate';
import { voidAwb } from '../../createAwb';
import { freightApi } from '../../../freightApi';
import { downloadAWBPDF, printAWB, showSuccessToast } from '../../../printLogic';
import { STORAGE_KEY } from './useDraftRestore';
import { emptySphCodes, loggedInUser, newTempAwbId } from './masterWaybillData';

const EMPTY_RATE_LINE = { id: 1, pieces: '', grossWeight: '', rateClass: '', commodityItemNo: '', chargeableWeight: '', rateCharge: '', total: '', natureOfGoods: '' };

// CLEAR, VOID, VIEW LOGS, PRINT and VALIDATE EDI
export default function useMasterActions(form) {
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsData, setLogsData] = useState([]);

  const runIataValidation = () => runEdiValidation(form, 'MAWB');

  // the boxes are emptied at once; freshScreen then mounts a new screen so every box is as on a new page
  const handleClearForm = () => {
    form.setExtraDocs({});
    form.setTempAwbId(newTempAwbId());
    form.setCurrentAwbId(null);
    form.setXfwbSent(false);
    form.setDepAirport(''); form.setDestAirport(''); form.setDestinationCurrency(''); form.setCcChargesDest('');
    form.setBy1(''); form.setBy2(''); form.setBy3(''); form.setTo1(''); form.setTo2(''); form.setTo3('');
    form.setAgentDetails({});
    form.setNatureOfGoods(''); form.setVolume(''); form.setDensityGroup('1:6'); form.setMcUnit('MC'); form.setNoDimensions(false);
    form.setLinkedHawbs([]);
    form.setAwbPrefix(''); form.setAwbSuffix('');
    form.setRateLines([EMPTY_RATE_LINE]);
    form.setOtherCharges([]); form.setOciRows([]); form.setDimRows([]);
    form.setSphCodes(emptySphCodes());
    form.setSsrText(''); form.setOsiText(''); form.setSci('');
    form.setFlightNumber1(''); form.setFlightDate1(''); form.setFlightTime1(''); form.setFlightTime2(''); form.setFlightNumber2(''); form.setFlightDate2('');
    form.setCurrencyCode('INR'); form.setChargeCode('PP');
    form.setWtValPC('P'); form.setOtherPC('P');
    form.setCarriageValue('NVD'); form.setCustomsValue('NCV'); form.setInsuranceValue('XXX');
    form.setAccountingInfo(''); form.setSignatureShipper(''); form.setSignatureCarrier('');
    form.setExecutedDate(form.getTodayDate()); form.setExecutedPlace('NEW DELHI');
    form.setParties(emptyParties());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no browser storage - no draft to drop
    }
    form.freshScreen();
    showSuccessToast('Info', 'Form Cleared.', false);
  };

  const handleVoidAWB = async () => {
    if (!form.currentAwbId) {
      showSuccessToast('Error', 'No AWB loaded to void. Please save or modify first.', true);
      return;
    }
    const confirmed = await askConfirm({ title: 'Void AWB', message: 'Are you sure you want to VOID this AWB?', okLabel: 'Void', tone: 'danger' });
    if (!confirmed) return;
    try {
      await voidAwb(form.currentAwbId, { type: 'MAWB', user: loggedInUser() });
      showSuccessToast('Success', 'AWB successfully VOIDED.');
      handleClearForm();
    } catch (error) {
      showSuccessToast('Error', error?.response?.data?.error || 'Failed to void AWB.', true);
    }
  };

  const handleViewLogs = async () => {
    if (!form.awbPrefix || !form.awbSuffix) {
      showSuccessToast('Error', 'No AWB selected', true);
      return;
    }
    try {
      const logs = await freightApi.awbLogs(`${form.awbPrefix}-${form.awbSuffix}`);
      if (logs.success) {
        setLogsData(logs.data);
        setShowLogsModal(true);
      } else {
        showSuccessToast('Error', logs.message || 'Failed to fetch logs', true);
      }
    } catch (error) {
      showSuccessToast('Error', error.response?.data?.message || 'Failed to fetch logs', true);
    }
  };

  const handlePrintOptionsSubmit = ({ selectedCopies, includeTerms, actionType }) => {
    if (actionType === 'print') printAWB(selectedCopies, includeTerms);
    else if (actionType === 'pdf') downloadAWBPDF(selectedCopies, includeTerms);
  };

  return {
    runIataValidation, handleClearForm, handleVoidAWB, handleViewLogs, handlePrintOptionsSubmit,
    showPrintOptions, setShowPrintOptions, showLogsModal, setShowLogsModal, logsData, setLogsData,
    getLoggedInUser: loggedInUser,
  };
}
