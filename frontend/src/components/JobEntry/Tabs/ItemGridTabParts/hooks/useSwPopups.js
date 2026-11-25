import { useRef } from 'react';
import toast from 'react-hot-toast';
import askConfirm from '../../../../common/askConfirm';
import { readControlRowsFor } from '../../jobExcel';
import { setItemFlag } from './itemForm';
import { asList, noItemSelected, patchItem } from './popupValues';
import useRowListPopup from './useRowListPopup';

const EMPTY_SW_CONSTITUENT = { srNo: '', name: '', code: '', percent: '', yield: '', active: '' };
const EMPTY_SW_INFO = { agency: 'ALL', type: 'Select', qualifier: 'Select', code: 'Select', text: '', qty: '', uqc: '' };
const EMPTY_SW_PRODUCTION = { batch: '', qty: '', uqc: '', mnfDate: '', expDate: '', bestBefore: '' };
const EMPTY_SW_CONTROL = { typeCode: 'Select', location: '', startDate: '', endDate: '', resultCode: '', resultText: '' };
const EMPTY_SW_STATEMENT = { typeCode: 'Select', stmtCode: 'Select', stmtText: '', stmtFor: 'Select' };
const CONTROL_ROW_KEYS = ['typeCode', 'location', 'startDate', 'endDate', 'resultCode', 'resultText', 'slNo'];

const upperText = (value) => String(value ?? '').trim().toUpperCase();
const withoutPlaceholder = (value) => { const text = String(value || '').trim(); return /^select$/i.test(text) ? '' : text; };
const sameControlRow = (first, second) => CONTROL_ROW_KEYS.every((key) => upperText(first[key]) === upperText(second[key]));

const statementInvoiceSr = (row) => row.invoiceSerialNumber ?? row.invoiceSrNo ?? row.invSrNo;
const statementLevel = (row) => {
  const invoiceSr = String(statementInvoiceSr(row) ?? '0');
  const itemSr = String(row.itemSerialNumber ?? row.itemSrNo ?? '0');
  if (itemSr !== '0') return 'Item';
  return invoiceSr === '0' ? 'BE' : 'Invoice';
};
const isJobLevelStatement = (row) => /^(BE|INVOICE)$/i.test(String(row.stmtFor || ''));

// Single Window popups of the selected item: information types, constituents, production, control and statements
export default function useSwPopups(grid) {
  const { items, setItems, selectedRowId, selectedItem, jobData, setJobData, invoices } = grid;
  const swInfo = useRowListPopup({ grid, dataKey: 'swInfoData', flagName: 'swInfotypeFlag', emptyForm: EMPTY_SW_INFO });
  const swConstituent = useRowListPopup({ grid, dataKey: 'swConstData', flagName: 'swConstituentFlag', emptyForm: EMPTY_SW_CONSTITUENT });
  const swProduction = useRowListPopup({ grid, dataKey: 'swProdData', flagName: 'swProductionFlag', emptyForm: EMPTY_SW_PRODUCTION });
  const swControl = useRowListPopup({ grid, dataKey: 'swCtrlData', flagName: 'swControlFlag', emptyForm: EMPTY_SW_CONTROL });
  const swStatement = useRowListPopup({ grid, dataKey: 'swStmtData', flagName: 'swStatementFlag', emptyForm: EMPTY_SW_STATEMENT });

  const addSwConstRow = () => {
    if (!swConstituent.form.name) { toast.error('Enter the constituent name'); return; }
    swConstituent.addRow(swConstituent.form);
  };

  // the "Select" placeholders are cleared, and a row is refused until its mandatory parts are chosen (ICES asks for
  // the SW information when a row goes out empty)
  const addSwInfoRow = () => {
    const form = swInfo.form;
    const row = { ...form, agency: withoutPlaceholder(form.agency) || 'ALL', type: withoutPlaceholder(form.type), qualifier: withoutPlaceholder(form.qualifier), code: withoutPlaceholder(form.code) };
    const infoType = row.type.toUpperCase();
    if (!row.type) { toast.error('Choose the Information Type first'); return; }
    if (!row.qualifier) { toast.error('Choose the Qualifier for ' + row.type); return; }
    // ORC (origin / FTA) and DTY rows carry a code; CHR / SQC carry the measure and its UQC
    if (['ORC', 'DTY'].includes(infoType) && !row.code) { toast.error(row.type + ' needs the Information Code'); return; }
    if (['CHR', 'SQC'].includes(infoType) && !String(row.qty || '').trim()) { toast.error(row.type + ' needs the quantity (measure)'); return; }
    if (!row.code && !String(row.text || '').trim() && !String(row.qty || '').trim()) { toast.error('Enter the Information Code, text or quantity'); return; }
    swInfo.addRow(row);
  };

  const applySwInfoToAll = () => {
    if (!selectedItem.invSrNo) { toast.error("Item doesn't have an Invoice No."); return; }
    setItems(items.map((item) => (String(item.invSrNo) === String(selectedItem.invSrNo) ? { ...item, swInfoData: swInfo.rows } : item)));
    toast.success('Applied to all items in Invoice!');
    swInfo.setShow(false);
  };

  const addSwProdRow = () => {
    if (!swProduction.form.batch) return;
    swProduction.addRow(swProduction.form);
  };

  const addSwCtrlRow = () => {
    const typeCode = String(swControl.form.typeCode || '').trim();
    if (!typeCode || typeCode === 'Select') { toast.error('Enter the control type code (e.g. SEC65)'); return; }
    if (typeCode.length > 17 || /\s/.test(typeCode)) { toast.error('Control type must be the ICEGATE code (max 17 characters, no spaces)'); return; }
    swControl.addRow(swControl.form);
  };

  // control rows of this item from an Excel file (sheet SW_Control of the Job Excel / iCAFFE ImportExcel)
  const importSwCtrlExcel = async (file) => {
    if (!file) return;
    try {
      const result = readControlRowsFor(await file.arrayBuffer(), invoices, selectedItem || {});
      if (!result.total) { toast.error('No sheet "SW_Control" (or SW_CONTROL) with Control Type rows in this file'); return; }
      const newRows = result.rows.filter((row) => !swControl.rows.some((existing) => sameControlRow(existing, row)));
      if (!newRows.length) {
        toast.error(result.rows.length ? 'These control rows are already in the list' : `No row of the file is for item ${selectedItem?.invSrNo || 1}/${selectedItem?.itemSrNo || ''} (${result.other} row(s) for other items)`);
        return;
      }
      swControl.setRows([...swControl.rows, ...newRows]);
      toast.success(`${newRows.length} control row(s) added - check them and click OK`
        + (result.other ? ` (${result.other} row(s) of other items left out)` : '')
        + (result.rows.length > newRows.length ? ` (${result.rows.length - newRows.length} already there)` : ''));
    } catch (error) {
      toast.error('Could not read the file: ' + error.message);
    }
  };

  // The control rows of this item on every item of the job (an ex-bond has the same SEC65 row on all its items).
  // What belongs to the item is kept per item: a Result Text equal to this item's CTH becomes the other item's CTH,
  // a Sr No equal to this item's Item Sr No (or empty) becomes the other item's Item Sr No.
  const applySwControlToAll = async () => {
    const controlRows = swControl.rows;
    if (!controlRows.length) { toast.error('Add a control row first (ADD), then Apply to All Items'); return; }
    const typeKey = (row) => String(row.typeCode || '').toUpperCase();
    const isNewType = (row) => !controlRows.some((controlRow) => typeKey(controlRow) === typeKey(row));
    const itemsWithOtherRows = items.filter((item) => item.id !== selectedRowId && asList(item.swCtrlData).some(isNewType)).length;
    const confirmed = await askConfirm({
      title: 'Apply to all items?',
      message: `These ${controlRows.length} control row(s) will be put on all ${items.length} item(s) of this job.`,
      note: 'Each item keeps its own CTH in Result Text and its own Item Sr No in Sr No.' + (itemsWithOtherRows ? ` ${itemsWithOtherRows} item(s) have other control rows now - they are replaced.` : ''),
      okLabel: 'Apply to all items',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    const ownCth = upperText(selectedItem.cth || selectedItem.ritc);
    const ownItemSr = upperText(selectedItem.itemSrNo || selectedItem.itemNo);
    const flag = setItemFlag('swControlFlag', true);
    setItems(items.map((item, itemIndex) => (item.id === selectedRowId ? { ...item, swCtrlData: controlRows, swControlFlag: flag } : {
      ...item,
      swControlFlag: flag,
      swCtrlData: controlRows.map((row, rowIndex) => ({
        ...row,
        id: Date.now() + itemIndex * 100 + rowIndex,
        resultText: ownCth && upperText(row.resultText) === ownCth ? String(item.cth || item.ritc || '').trim() : row.resultText,
        slNo: (!upperText(row.slNo) || upperText(row.slNo) === ownItemSr) ? String(item.itemSrNo || item.itemNo || '').trim() : row.slNo,
      })),
    })));
    toast.success(`Control row(s) applied to all ${items.length} items - press MODIFY on this item, then Save in Job Header`);
    swControl.setShow(false);
  };

  // BE and invoice level statements live once on the job (jobData._statements). The popup shows them with the item's
  // own rows; on OK a BE / Invoice row goes back to the job and an Item row stays on the item, so a BE statement is
  // sent once.
  const statementJobRowsShown = useRef(new Set());
  const jobStatementRowsOf = (item) => asList(jobData && jobData._statements)
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const level = statementLevel(row);
      return level === 'BE' || (level === 'Invoice' && String(statementInvoiceSr(row)) === String(item.invSrNo || ''));
    });

  const openSwStatementModal = () => {
    if (noItemSelected(selectedRowId)) return;
    const sharedRows = jobStatementRowsOf(selectedItem);
    statementJobRowsShown.current = new Set(sharedRows.map(({ index }) => index));
    swStatement.openWith([
      ...asList(selectedItem.swStmtData),
      ...sharedRows.map(({ row, index }) => ({ typeCode: row.statementType || '', stmtCode: row.statementCode || '', stmtText: row.statementText || '', stmtFor: statementLevel(row), id: 'job-' + index })),
    ]);
  };

  const addSwStmtRow = () => {
    const form = swStatement.form;
    if (!form.typeCode || form.typeCode === 'Select') { toast.error('Select the statement type (DEC / UTG / REM)'); return; }
    if (!form.stmtCode || form.stmtCode === 'Select') { toast.error('Enter the statement code'); return; }
    if (form.typeCode === 'REM' && !String(form.stmtText || '').trim()) { toast.error('REM statement needs the text'); return; }
    swStatement.addRow(form);
  };

  const saveSwStatementModal = () => {
    const statementRows = swStatement.rows;
    const ownRows = statementRows.filter((row) => !isJobLevelStatement(row));
    const jobRows = statementRows.filter(isJobLevelStatement).map((row) => {
      const beLevel = /^BE$/i.test(row.stmtFor);
      return { invoiceSrNo: beLevel ? '0' : String(selectedItem.invSrNo || '1'), itemSrNo: '0', statementType: row.typeCode, statementCode: row.stmtCode, statementText: row.stmtText || '', stmtFor: beLevel ? 'M' : 'N' };
    });
    const shownIndexes = statementJobRowsShown.current;
    if (jobRows.length || shownIndexes.size) {
      const keptRows = asList(jobData && jobData._statements).filter((row, index) => !shownIndexes.has(index));
      const seen = new Set();
      const allRows = [...keptRows, ...jobRows].filter((row) => {
        const key = [statementLevel(row), row.invoiceSrNo ?? row.invoiceSerialNumber, row.itemSrNo ?? row.itemSerialNumber, row.statementType, row.statementCode, row.statementText].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setJobData((previous) => ({ ...previous, _statements: allRows }));
    }
    const flag = setItemFlag('swStatementFlag', statementRows.length > 0);
    setItems(patchItem(items, selectedRowId, { swStmtData: ownRows, swStatementFlag: flag }));
    swStatement.setShow(false);
  };

  const applySwStatementToAll = () => {
    if (!selectedItem.invSrNo) { toast.error("Item doesn't have an Invoice No."); return; }
    setItems(items.map((item) => (String(item.invSrNo) === String(selectedItem.invSrNo) ? { ...item, swStmtData: swStatement.rows } : item)));
    toast.success('Applied to all items in Invoice!');
    swStatement.setShow(false);
  };

  return {
    showSwInfoModal: swInfo.show, setShowSwInfoModal: swInfo.setShow, tempSwInfoData: swInfo.rows, setTempSwInfoData: swInfo.setRows,
    swInfoForm: swInfo.form, setSwInfoForm: swInfo.setForm, openSwInfoModal: swInfo.open, addSwInfoRow, removeSwInfoRow: swInfo.removeRow,
    saveSwInfoModal: swInfo.save, applySwInfoToAll,

    showSwConstModal: swConstituent.show, setShowSwConstModal: swConstituent.setShow, tempSwConstData: swConstituent.rows, setTempSwConstData: swConstituent.setRows,
    swConstForm: swConstituent.form, setSwConstForm: swConstituent.setForm, openSwConstModal: swConstituent.open, addSwConstRow,
    removeSwConstRow: swConstituent.removeRow, saveSwConstModal: swConstituent.save,

    showSwProductionModal: swProduction.show, setShowSwProductionModal: swProduction.setShow, tempSwProdData: swProduction.rows, setTempSwProdData: swProduction.setRows,
    swProdForm: swProduction.form, setSwProdForm: swProduction.setForm, openSwProductionModal: swProduction.open, addSwProdRow,
    removeSwProdRow: swProduction.removeRow, saveSwProductionModal: swProduction.save,

    showSwControlModal: swControl.show, setShowSwControlModal: swControl.setShow, tempSwCtrlData: swControl.rows, setTempSwCtrlData: swControl.setRows,
    swCtrlForm: swControl.form, setSwCtrlForm: swControl.setForm, openSwControlModal: swControl.open, addSwCtrlRow,
    removeSwCtrlRow: swControl.removeRow, importSwCtrlExcel, applySwControlToAll, saveSwControlModal: swControl.save,

    showSwStatementModal: swStatement.show, setShowSwStatementModal: swStatement.setShow, tempSwStmtData: swStatement.rows, setTempSwStmtData: swStatement.setRows,
    swStmtForm: swStatement.form, setSwStmtForm: swStatement.setForm, openSwStatementModal, addSwStmtRow,
    removeSwStmtRow: swStatement.removeRow, saveSwStatementModal, applySwStatementToAll,
  };
}
