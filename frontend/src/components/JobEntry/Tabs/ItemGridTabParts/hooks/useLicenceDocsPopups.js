import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { normDoc } from '../../../EsanchitDocsPanel';
import { setItemFlag } from './itemForm';
import { asList, noItemSelected, patchItem } from './popupValues';
import useRowListPopup from './useRowListPopup';

const EMPTY_SCHEME_CATEGORY = { ritc: '', schemeCode: '', licenseNo: '', date: '' };
// Licence (BE licenseModel): licence no, date, code, port, item sr no in the licence, debit value / quantity
const EMPTY_LICENCE = { licenceNo: '', licenceDate: '', licenceCode: '', regnPort: '', itemSrNoLicence: '', debitValue: '', debitQty: '', debitUqc: '' };
const noDocsRowEditor = () => {};

// Scheme code category, licence and supporting document (e-Sanchit) popups of the selected item
export default function useLicenceDocsPopups(grid) {
  const { items, setItems, selectedRowId, selectedItem, esanchitDocs, setEsanchitDocs } = grid;

  const schemeCategory = useRowListPopup({ grid, dataKey: 'schemeCatData', flagName: 'schemeCodCategoryFlag', emptyForm: EMPTY_SCHEME_CATEGORY });
  const addSchemeCatRow = () => {
    if (!schemeCategory.form.schemeCode) return;
    schemeCategory.addRow(schemeCategory.form);
  };

  const [showLicenceModal, setShowLicenceModal] = useState(false);
  const [tempLicenceData, setTempLicenceData] = useState([]);
  const [licenceForm, setLicenceForm] = useState(EMPTY_LICENCE);
  const [licenceEditId, setLicenceEditId] = useState(null);

  const openLicenceModal = () => {
    if (noItemSelected(selectedRowId)) return;
    let rows = asList(selectedItem.licenceData);
    // licences typed in Scheme Code Category before are offered here too
    if (!rows.length) {
      rows = asList(selectedItem.schemeCatData).filter((row) => row.licenseNo).map((row, index) => ({
        ...EMPTY_LICENCE, id: Date.now() + index, licenceNo: row.licenseNo, licenceDate: row.date || '', licenceCode: String(row.schemeCode || '').slice(0, 2),
      }));
    }
    setTempLicenceData(rows);
    setLicenceForm({ ...EMPTY_LICENCE, debitUqc: selectedItem.uqc || selectedItem.unit || '' });
    setLicenceEditId(null);
    setShowLicenceModal(true);
  };
  const addLicenceRow = () => {
    if (!String(licenceForm.licenceNo || '').trim()) { toast.error('Enter the Licence / Regn No'); return; }
    if (licenceEditId !== null) setTempLicenceData(tempLicenceData.map((row) => (row.id === licenceEditId ? { ...licenceForm, id: licenceEditId } : row)));
    else setTempLicenceData([...tempLicenceData, { ...licenceForm, id: Date.now() }]);
    setLicenceForm({ ...EMPTY_LICENCE, debitUqc: licenceForm.debitUqc });
    setLicenceEditId(null);
  };
  const editLicenceRow = (row) => { setLicenceForm({ ...EMPTY_LICENCE, ...row }); setLicenceEditId(row.id); };
  const removeLicenceRow = (id) => setTempLicenceData(tempLicenceData.filter((row) => row.id !== id));
  const saveLicenceModal = () => {
    const flag = setItemFlag('licenceFlag', tempLicenceData.length > 0);
    setItems(patchItem(items, selectedRowId, { licenceData: tempLicenceData, licenceFlag: flag }));
    setShowLicenceModal(false);
  };

  // The item e-Sanchit popup is the shared EsanchitDocsPanel in item mode. Item rows live on the item (docsData);
  // invoice and BE rows live once on the job (esanchitDocs, the rows tab 5 shows), so a BE document entered from any
  // item is sent once. The popup shows the item's own rows plus the job rows of its invoice and of the BE.
  const [showSupportingDocsModal, setShowSupportingDocsModal] = useState(false);
  const [tempDocsData, setTempDocsData] = useState([]);
  const docsJobRowsShown = useRef(new Set());
  const jobDocs = () => (Array.isArray(esanchitDocs) ? esanchitDocs : []).map((doc, index) => normDoc(doc, index));
  const jobDocsOfItem = (item) => jobDocs().filter((doc) => doc.docFor === 'HEADER' || (doc.docFor === 'INVOICE' && String(doc.invSrNo || '') === String(item.invSrNo || '')));
  const asOwnItemDoc = (doc) => ({ ...doc, invSrNo: String(selectedItem.invSrNo || ''), itemSrNo: String(selectedItem.itemSrNo || '') });

  const openSupportingDocsModal = () => {
    if (noItemSelected(selectedRowId)) return;
    const ownDocs = asList(selectedItem.docsData).map((doc, index) => normDoc(doc, index)).map((doc) => ({ ...asOwnItemDoc(doc), docFor: 'ITEM' }));
    const sharedDocs = jobDocsOfItem(selectedItem);
    docsJobRowsShown.current = new Set(sharedDocs.map((doc) => doc.id));
    setTempDocsData([...ownDocs, ...sharedDocs]);
    setShowSupportingDocsModal(true);
  };
  const saveSupportingDocsModal = () => {
    const docs = tempDocsData.map((doc, index) => normDoc(doc, index));
    // item rows -> this item; invoice / BE rows -> the job (replacing the job rows this popup showed)
    const ownDocs = docs.filter((doc) => doc.docFor === 'ITEM').map(asOwnItemDoc);
    const jobLevelDocs = docs.filter((doc) => doc.docFor !== 'ITEM').map((doc) => ({ ...doc, invSrNo: doc.docFor === 'HEADER' ? '' : String(selectedItem.invSrNo || ''), itemSrNo: '' }));
    const shownIds = docsJobRowsShown.current;
    const keptJobDocs = (Array.isArray(esanchitDocs) ? esanchitDocs : []).filter((doc) => !shownIds.has(doc.id));
    if (jobLevelDocs.length || shownIds.size) setEsanchitDocs([...keptJobDocs, ...jobLevelDocs].map((doc, index) => ({ ...doc, srNo: index + 1 })));
    const flag = setItemFlag('supportingDocsFlag', ownDocs.length > 0);
    setItems(patchItem(items, selectedRowId, { docsData: ownDocs, supportingDocsFlag: flag }));
    const withoutIrn = docs.filter((doc) => !doc.irn).length;
    if (withoutIrn) toast(`${withoutIrn} document(s) have no IRN yet - attach the PDF and click Upload before filing`, { icon: '⚠️', duration: 6000 });
    setShowSupportingDocsModal(false);
  };

  // IRNs elsewhere on the job (other items' own rows, job rows of other invoices) - refused in the popup
  const docsOtherIrns = useMemo(() => {
    if (!showSupportingDocsModal) return [];
    const shownIds = docsJobRowsShown.current;
    const otherItemIrns = items.filter((item) => item.id !== selectedRowId).flatMap((item) => asList(item.docsData).map((doc) => doc && doc.irn).filter(Boolean));
    const otherJobIrns = (Array.isArray(esanchitDocs) ? esanchitDocs : []).map((doc, index) => normDoc(doc, index))
      .filter((doc) => !shownIds.has(doc.id)).map((doc) => doc.irn).filter(Boolean);
    return [...otherItemIrns, ...otherJobIrns];
  }, [showSupportingDocsModal, items, esanchitDocs, selectedRowId]);

  return {
    showSchemeCategoryModal: schemeCategory.show, setShowSchemeCategoryModal: schemeCategory.setShow,
    tempSchemeCatData: schemeCategory.rows, setTempSchemeCatData: schemeCategory.setRows, schemeCatForm: schemeCategory.form, setSchemeCatForm: schemeCategory.setForm,
    openSchemeCategoryModal: schemeCategory.open, addSchemeCatRow, removeSchemeCatRow: schemeCategory.removeRow, saveSchemeCategoryModal: schemeCategory.save,

    showLicenceModal, setShowLicenceModal, tempLicenceData, licenceForm, setLicenceForm, licenceEditId,
    openLicenceModal, addLicenceRow, editLicenceRow, removeLicenceRow, saveLicenceModal,

    showSupportingDocsModal, setShowSupportingDocsModal, tempDocsData, setTempDocsData, openSupportingDocsModal, saveSupportingDocsModal, docsOtherIrns,
    // older readers of the ctx; the e-Sanchit panel edits its rows itself
    docsForm: null, docsEditId: null, setDocsForm: noDocsRowEditor, addDocsRow: noDocsRowEditor, editDocsRow: noDocsRowEditor, copyDocsRow: noDocsRowEditor, removeDocsRow: noDocsRowEditor,
  };
}
