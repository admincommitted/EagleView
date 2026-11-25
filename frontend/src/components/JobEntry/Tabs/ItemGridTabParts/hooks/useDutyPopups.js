import { useState } from 'react';
import toast from 'react-hot-toast';
import { setItemField, setItemFlag } from './itemForm';
import { FLAT_KEYS_BLANK, asListOrNull, asObject, asObjectOrNull, filledOr, hasAnyValue, noItemSelected, patchItem, popupValues } from './popupValues';
import useObjectPopup from './useObjectPopup';

const EMPTY_IGST = { notnNo: '', srNo: '', rate: '', flag: 'A', amount: '' };
const EMPTY_CVD = { notnNo: '', srNo: '', rate: '', flag: 'A', amount: '' };
const EMPTY_SVB = { refNo: '', date: '', loadDuty: '', loadValue: '', flag: 'A' };
const EMPTY_ANTI_DUMPING = { notnNo: '', srNo: '', rate: '', amount: '', flag: 'A', cth: '', qty: '' };
const EMPTY_OTHER_DUTY = { dutyCode: '', amount: '', rate: '', flag: 'A' };
const EMPTY_POLICY_PARA = { paraNo: '', year: '' };
const EMPTY_PREVIOUS_BE = { beNo: '', beDate: '', qty: '', uqc: '', unitPrice: '', currency: '', customHouse: '' };
const EMPTY_REIMPORT = { type: '', prevBeNo: '', prevBeDate: '' };
const EMPTY_NCD = { ncdRate: '', ncdAmount: '', ncdNotificationNo: '' };
const EMPTY_RSP_LINE = { rspValue: '', rspQty: '', rspNotificationNo: '', rspSrNo: '', rspRate: '', rspAmount: '' };

// Duty notification rows of the item (sbedutyModel in the BE JSON): AIDC (C/A), IGST (G/I), Compensation cess (G/P)...
const EMPTY_DUTY_ROW = { dutyType: 'C', addlDutyFlag: 'A', igstFlag: '', notificationNo: '', notificationSrNo: '', exmpNotificationNo: '', exmpNotificationSrNo: '' };
const isIgstDutyRow = (row) => row.dutyType === 'G' && row.addlDutyFlag === 'I';
const igstDutyRow = (notificationNo, notificationSrNo) => ({ ...EMPTY_DUTY_ROW, dutyType: 'G', addlDutyFlag: 'I', notificationNo, notificationSrNo });

// the item keeps a list of RSP rows (one per retail sale price slab); a job saved earlier carries one object
const rspRowsOf = (item) => {
  const saved = asObjectOrNull(item && item.rspData);
  if (Array.isArray(saved)) return saved.map((row, index) => ({ id: row.id || Date.now() + index, ...row }));
  return saved && (saved.rspValue || saved.rspNotificationNo || saved.rspRate || saved.rspAmount) ? [{ id: Date.now(), ...saved }] : [];
};

// Duty popups of the selected item: IGST + duty notification rows, CVD, SVB, anti-dumping, other duty, policy para,
// previous BE, re-import, RSP and NCD
export default function useDutyPopups(grid) {
  const { items, setItems, selectedRowId, selectedItem, jobData } = grid;

  const customsCvd = useObjectPopup({
    grid, emptyValue: EMPTY_CVD, flagName: 'customsCvdFlag',
    readValues: (item) => popupValues(item, item.cvdData, EMPTY_CVD, { notnNo: 'cvdNotificationNo', srNo: 'cvdSrNo' }),
    savedFields: (values) => ({ ...FLAT_KEYS_BLANK.cvd, cvdData: values }),
  });
  const svb = useObjectPopup({
    grid, emptyValue: EMPTY_SVB, flagName: 'svbFlag',
    readValues: (item) => popupValues(item, filledOr(item.svbData, item.svbItemData), EMPTY_SVB, {
      refNo: 'svbReferenceNumber', date: 'svbReferenceDate', loadValue: 'svbLoadAssessableValue', loadDuty: 'svbLoadOnDuty',
      valueStatus: 'whetherLoadProvisionalOnAssessableValue', dutyStatus: 'whetherLoadProvisionalOnDuty', customHouse: 'customHouseCodeWhichHasImposedLoad', loadType: 'svbFlag',
    }),
    savedFields: (values) => ({ ...FLAT_KEYS_BLANK.svb, svbData: values, svbItemData: values }),
  });
  const antiDumping = useObjectPopup({
    grid, emptyValue: EMPTY_ANTI_DUMPING, flagName: 'antiDumpingDutyFlag',
    readValues: (item) => popupValues(item, filledOr(item.addData, item.antiDumpingData), EMPTY_ANTI_DUMPING, {
      notnNo: 'antiDumpingDutyNotification', srNo: 'antiDumpingDutySerialNumber', cth: 'cthSerialNumber', supSlNo: 'supplierSerialNumber', qty: 'quantityAsPerAntiDumpingNotn',
    }),
    savedFields: (values) => ({ ...FLAT_KEYS_BLANK.antiDumping, addData: values, antiDumpingData: values }),
  });
  const otherDuty = useObjectPopup({
    grid, emptyValue: EMPTY_OTHER_DUTY, flagName: 'otherDutyFlag',
    readValues: (item) => asObject(item.otherDutyData, EMPTY_OTHER_DUTY),
    savedFields: (values) => ({ otherDutyData: values }),
  });
  const policyPara = useObjectPopup({
    grid, emptyValue: EMPTY_POLICY_PARA, flagName: 'policyParaFlag',
    readValues: (item) => popupValues(item, item.policyParaData, EMPTY_POLICY_PARA, { paraNo: 'policyParaNo', year: 'policyYear' }),
    savedFields: (values) => ({ ...FLAT_KEYS_BLANK.policyPara, policyParaData: values }),
  });
  const previousBe = useObjectPopup({
    grid, emptyValue: EMPTY_PREVIOUS_BE, flagName: 'previousBeFlag',
    readValues: (item) => popupValues(item, filledOr(item.prevBeData, item.previousBeData), EMPTY_PREVIOUS_BE, {
      beNo: 'previousBeNo', beDate: 'previousBeDate', unitPrice: 'prevUnitPriceInvoiced', currency: 'prevCurrencyCode', customHouse: 'prevCustomSite',
    }),
    savedFields: (values) => ({ ...FLAT_KEYS_BLANK.previousBe, prevBeData: values, previousBeData: values }),
  });
  const reimport = useObjectPopup({
    grid, emptyValue: EMPTY_REIMPORT, flagName: 'reImportFlag',
    readValues: (item) => asObject(item.reimportData, EMPTY_REIMPORT),
    savedFields: (values) => ({ reimportData: values }),
  });
  const ncd = useObjectPopup({
    grid, emptyValue: EMPTY_NCD, flagName: 'ncdCustomDutyFlag',
    readValues: (item) => popupValues(item, item.ncdData, EMPTY_NCD, { ncdNotificationNo: 'ncdNotn', ncdSrNo: 'ncdNotnSrNo' }),
    savedFields: (values) => ({ ...FLAT_KEYS_BLANK.ncd, ncdData: values }),
  });

  const [showIgstModal, setShowIgstModal] = useState(false);
  const [tempIgstData, setTempIgstData] = useState(EMPTY_IGST);
  const [tempDutyRows, setTempDutyRows] = useState([]);
  const [dutyForm, setDutyForm] = useState(EMPTY_DUTY_ROW);
  const [dutyEditIdx, setDutyEditIdx] = useState(null);

  // the rows are the item's own (item.dutyRows), first filled from an imported BE / the IGST line
  const openIgstModal = () => {
    if (noItemSelected(selectedRowId)) return;
    const igst = asObjectOrNull(selectedItem.igstData);
    setTempIgstData(igst || { ...EMPTY_IGST });
    let rows = asListOrNull(selectedItem.dutyRows);
    if (!rows) {
      const invoiceSr = String(selectedItem.invSrNo || selectedItem.invoiceSrNo || 1);
      const itemSr = String(selectedItem.itemSrNo || '');
      const jobDuties = asListOrNull(jobData?._duties) || asListOrNull(jobData?._sbedutyModel) || [];
      rows = jobDuties
        .filter((duty) => String(duty.invoiceSerialNumber || duty.invoiceSrNo || '1') === invoiceSr && String(duty.itemSerialNumber || duty.itemSrNo || '1') === itemSr)
        .map((duty) => ({
          dutyType: duty.dutyType || '', addlDutyFlag: duty.addlDutyFlag || '', igstFlag: duty.customsNotnExemptingIgstFlag || '', notificationNo: duty.notificationNo || '',
          notificationSrNo: duty.notificationSrNo || '', exmpNotificationNo: duty.exmpNotificationNo || '', exmpNotificationSrNo: duty.exmpNotificationSrNo || '',
        }));
      if (igst && igst.notnNo && !rows.some(isIgstDutyRow)) rows.push(igstDutyRow(igst.notnNo, igst.srNo || ''));
    }
    setTempDutyRows(rows.map((row, index) => ({ ...EMPTY_DUTY_ROW, ...row, _k: Date.now() + index })));
    setDutyForm(EMPTY_DUTY_ROW);
    setDutyEditIdx(null);
    setShowIgstModal(true);
  };

  const clearDutyForm = () => { setDutyForm(EMPTY_DUTY_ROW); setDutyEditIdx(null); };

  const addDutyRow = () => {
    const row = { ...dutyForm, notificationNo: String(dutyForm.notificationNo || '').trim(), notificationSrNo: String(dutyForm.notificationSrNo || '').trim() };
    if (!row.notificationNo) { toast.error('Enter the notification no.'); return; }
    if (!row.dutyType || !row.addlDutyFlag) { toast.error('Select Duty Type and Add Duty Type'); return; }
    setTempDutyRows((previous) => (dutyEditIdx !== null
      ? previous.map((existing, index) => (index === dutyEditIdx ? { ...existing, ...row } : existing))
      : [...previous, { ...row, _k: Date.now() }]));
    clearDutyForm();
  };
  const editDutyRow = (index) => { setDutyForm({ ...EMPTY_DUTY_ROW, ...tempDutyRows[index] }); setDutyEditIdx(index); };
  const removeDutyRow = (index) => {
    setTempDutyRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
    if (dutyEditIdx === index) clearDutyForm();
  };

  const saveIgstModal = () => {
    let rows = tempDutyRows.map(({ _k, ...row }) => row);
    // IGST line typed above but no G/I row in the grid -> add it, so the BE JSON carries the IGST notification
    if (tempIgstData && String(tempIgstData.notnNo || '').trim() && !rows.some(isIgstDutyRow)) {
      rows = [...rows, igstDutyRow(String(tempIgstData.notnNo).trim(), String(tempIgstData.srNo || '').trim())];
    }
    const flag = setItemFlag('igstDutyFlag', rows.length > 0 || hasAnyValue(tempIgstData));
    setItems(patchItem(items, selectedRowId, { igstData: tempIgstData, dutyRows: rows, igstDutyFlag: flag }));
    setShowIgstModal(false);
  };

  // An item can carry more than one retail sale price (MRP slabs of the same goods), each with its own quantity and
  // notification
  const [showRspModal, setShowRspModal] = useState(false);
  const [tempRspData, setTempRspData] = useState({ rspRate: '', rspAmount: '' });
  const [tempRspRows, setTempRspRows] = useState([]);
  const [rspEditIdx, setRspEditIdx] = useState(null);

  const openRspModal = () => {
    if (noItemSelected(selectedRowId)) return;
    const rows = rspRowsOf(selectedItem);
    setTempRspRows(rows);
    setRspEditIdx(null);
    setTempRspData({ rspDutyFlag: String(selectedItem.rspDutyFlag || (rows[0] && rows[0].rspDutyFlag) || '').toUpperCase(), ...EMPTY_RSP_LINE });
    setShowRspModal(true);
  };

  // Add / Update a slab: the retail price and the quantity sold at it are what ICES wants per RSP line
  const addRspRow = () => {
    const retailPrice = String(tempRspData.rspValue || '').trim();
    if (!(parseFloat(retailPrice) > 0)) { toast.error('Enter the retail sale price (RSP) of this slab'); return; }
    const slabQty = String(tempRspData.rspQty || '').trim();
    if (slabQty && !(parseFloat(slabQty) > 0)) { toast.error('Quantity must be more than 0'); return; }
    const row = {
      id: rspEditIdx !== null ? tempRspRows[rspEditIdx].id : Date.now(),
      rspValue: retailPrice,
      rspQty: slabQty,
      rspNotificationNo: String(tempRspData.rspNotificationNo || '').trim().toUpperCase(),
      rspSrNo: String(tempRspData.rspSrNo || '').trim(),
      rspRate: String(tempRspData.rspRate || '').trim(),
      rspAmount: String(tempRspData.rspAmount || '').trim(),
    };
    const nextRows = rspEditIdx !== null ? tempRspRows.map((existing, index) => (index === rspEditIdx ? row : existing)) : [...tempRspRows, row];
    // the slabs together cannot be more than the item quantity
    const itemQty = parseFloat(selectedItem?.qty || selectedItem?.quantity || 0) || 0;
    const slabTotal = nextRows.reduce((sum, slab) => sum + (parseFloat(slab.rspQty) || 0), 0);
    if (itemQty > 0 && slabTotal > itemQty + 0.001) { toast.error('The slabs add up to ' + slabTotal + ', more than the item quantity ' + itemQty); return; }
    setTempRspRows(nextRows);
    setRspEditIdx(null);
    setTempRspData((previous) => ({ rspDutyFlag: previous.rspDutyFlag, ...EMPTY_RSP_LINE }));
  };
  const editRspRow = (index) => { setTempRspData((previous) => ({ ...previous, ...tempRspRows[index] })); setRspEditIdx(index); };
  const removeRspRow = (index) => {
    setTempRspRows(tempRspRows.filter((_, rowIndex) => rowIndex !== index));
    if (rspEditIdx === index) setRspEditIdx(null);
  };
  const saveRspModal = () => {
    const dutyFlag = String(tempRspData.rspDutyFlag || '').trim().toUpperCase();
    if (dutyFlag) setItemField('rspDutyFlag', dutyFlag);
    const rows = tempRspRows.map((row) => ({ ...row, rspDutyFlag: dutyFlag || row.rspDutyFlag || '' }));
    setItems(patchItem(items, selectedRowId, { rspData: rows, ...(dutyFlag ? { rspDutyFlag: dutyFlag } : {}) }));
    setShowRspModal(false);
  };

  return {
    showIgstModal, setShowIgstModal, tempIgstData, setTempIgstData, tempDutyRows, dutyForm, setDutyForm, dutyEditIdx,
    openIgstModal, addDutyRow, editDutyRow, removeDutyRow, clearDutyForm, saveIgstModal,

    showCustomsCvdModal: customsCvd.show, setShowCustomsCvdModal: customsCvd.setShow, tempCvdData: customsCvd.values, setTempCvdData: customsCvd.setValues,
    openCustomsCvdModal: customsCvd.open, saveCustomsCvdModal: customsCvd.save,
    showSvbModal: svb.show, setShowSvbModal: svb.setShow, tempSvbData: svb.values, setTempSvbData: svb.setValues, openSvbModal: svb.open, saveSvbModal: svb.save,
    showAntiDumpingModal: antiDumping.show, setShowAntiDumpingModal: antiDumping.setShow, tempAddData: antiDumping.values, setTempAddData: antiDumping.setValues,
    openAntiDumpingModal: antiDumping.open, saveAntiDumpingModal: antiDumping.save,
    showOtherDutyModal: otherDuty.show, setShowOtherDutyModal: otherDuty.setShow, tempOtherDutyData: otherDuty.values, setTempOtherDutyData: otherDuty.setValues,
    openOtherDutyModal: otherDuty.open, saveOtherDutyModal: otherDuty.save,
    showPolicyParaModal: policyPara.show, setShowPolicyParaModal: policyPara.setShow, tempPolicyParaData: policyPara.values, setTempPolicyParaData: policyPara.setValues,
    openPolicyParaModal: policyPara.open, savePolicyParaModal: policyPara.save,
    showPreviousBeModal: previousBe.show, setShowPreviousBeModal: previousBe.setShow, tempPrevBeData: previousBe.values, setTempPrevBeData: previousBe.setValues,
    openPreviousBeModal: previousBe.open, savePreviousBeModal: previousBe.save,
    showReimportModal: reimport.show, setShowReimportModal: reimport.setShow, tempReimportData: reimport.values, setTempReimportData: reimport.setValues,
    openReimportModal: reimport.open, saveReimportModal: reimport.save,
    showNcdModal: ncd.show, setShowNcdModal: ncd.setShow, tempNcdData: ncd.values, setTempNcdData: ncd.setValues, openNcdModal: ncd.open, saveNcdModal: ncd.save,

    showRspModal, setShowRspModal, tempRspData, setTempRspData, tempRspRows, rspEditIdx, openRspModal, addRspRow, editRspRow, removeRspRow, saveRspModal,
  };
}
