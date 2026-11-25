import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { jobEntryApi } from '@/components/JobEntry/jobEntryApi';
import { refreshItemDutyBoxes } from '../helpers';
import { getItemForm, itemFieldText, itemFieldValue, setItemField } from './itemForm';
import { asObjectOrNull, patchItem } from './popupValues';
import responseBody from './responseBody';

const CLOSED_TARIFF_SEARCH = { open: false, field: 'ritc', q: '', rows: [], loading: false, searched: false };
const EMPTY_PENDING_IGST = { notnNo: '', srNo: '', flag: 'A', amount: '' };
const HISTORY_PARTICULARS = [['brandName', 'brand'], ['model', 'model'], ['endUse', 'end use'], ['countryOfOrigin', 'origin'], ['genericDesc', ''], ['manufacturer', '']];

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
const igstLabel = (igst) => 'IGST ' + igst.rate + '%' + (igst.srNo ? ' (' + igst.notnNo + ' Sl ' + igst.srNo + ')' : '');
const tariffIgstLabel = (tariff) => 'IGST ' + tariff.igstRate + '%' + (tariff.igstSrNo ? ' (' + tariff.igstNotnNo + ' Sl ' + tariff.igstSrNo + ')' : '');

// one CTH, several IGST serials with different rates: the rate depends on the description / value - say so
const warnIgstVaries = (ritc, tariff) => {
  if (!tariff.igstRateVaries || !Array.isArray(tariff.igstOptions)) return;
  const options = tariff.igstOptions.slice(0, 6).map((option) => option.notnNo + ' Sl ' + option.srNo + ' = ' + option.rate + '%').join(', ');
  toast(`IGST for ${ritc} depends on the goods description / value - ${tariff.igstOptions.length} serials apply: ${options}${tariff.igstOptions.length > 6 ? ', ...' : ''}. ${tariff.igstRate}% (Sl ${tariff.igstSrNo}) was used - check it.`, { icon: '⚠️', duration: 12000 });
};

// agencies (FSSAI, PQIS, AQCS, CDSCO ...) that clear this CTH - from iCAFFE's Agencywise CTH master
const warnPgaAgencies = (ritc, tariff) => {
  if (!Array.isArray(tariff.pgaAgencies) || !tariff.pgaAgencies.length) return;
  toast(`${ritc} is cleared by other agencies too: ${tariff.pgaAgencies.join(', ')}. Fill the SWIFT / PGA details and their documents (e-Sanchit).`, { icon: '🏛️', duration: 10000 });
};

// concession / FTA notifications for this CTH and the job's country of origin (iCAFFE masters)
const showFtaRows = async (ritc, origin) => {
  try {
    const response = await responseBody(jobEntryApi.tariffFtaRows(ritc, origin));
    const rows = (response && Array.isArray(response.data)) ? response.data : [];
    if (!rows.length) return;
    const text = rows.slice(0, 5).map((row) => `${row.notifNo}${row.scheme && row.scheme !== 'CUSTOM' ? ' [' + row.scheme + ']' : ''} Sl ${row.serialNo} = ${row.dutyRate == null ? 'see notn' : row.dutyRate + '%'}${row.conditionNo ? ' (cond ' + row.conditionNo + ')' : ''}`).join(', ');
    toast(`Origin ${origin}: ${rows.length} concession / FTA / safeguard row(s) for ${ritc} - ${text}${rows.length > 5 ? ', ...' : ''}. Needs a valid certificate of origin.`, { icon: '🌐', duration: 12000 });
  } catch {
    // extra information only
  }
};

// RITC / CTH / CETH lookup on the Tariff master, the Tariff master fill of blank boxes, "Last used" (what this
// importer's earlier jobs used for the same product) and the BCD exemptions for an RITC. Only BLANK boxes of the item
// form are filled and nothing reaches the job before SAVE / MODIFY; the IGST rate the master gives is kept aside
// (takePendingIgst) and put on the item by SAVE / MODIFY of the same RITC.
export default function useTariffLookup(grid) {
  const { items, setItems, selectedRowId, selectedItem, jobData, invoices } = grid;
  const [tariffSearch, setTariffSearch] = useState(CLOSED_TARIFF_SEARCH);
  const [autoDesc, setAutoDesc] = useState(false); // on = the picked RITC's tariff text replaces the description
  const [itemHistory, setItemHistory] = useState(null); // { options, desc, model }
  // BCD exemption / concession notifications for the RITC just filled from the Tariff master: what the office's own
  // jobs file under and single-serial rows of the Notification master (the tariff rate alone is often not what is filed)
  const [bcdExemptions, setBcdExemptions] = useState(null); // { ritc, tariffBcd, itemsFiled, options, also }
  const autoTariffSeen = useRef('');
  const pendingTariff = useRef(null);
  const historySeen = useRef('');

  useEffect(() => {
    setItemHistory(null);
    setBcdExemptions(null);
    historySeen.current = '';
  }, [selectedRowId, jobData?.id]);

  const savedRowId = selectedRowId && selectedItem.id ? selectedRowId : null;
  const savedRowItem = savedRowId ? selectedItem : {};

  const refreshDutyEstimate = (liveItem) => {
    try {
      refreshItemDutyBoxes(liveItem, invoices, jobData || {});
    } catch {
      // estimate only
    }
  };

  const pendingIgstFor = (ritc, rowId) => {
    const pending = pendingTariff.current;
    return pending && pending.ritc === ritc && String(pending.rowId || '') === String(rowId || '') ? pending : null;
  };

  const takePendingIgst = (ritc, rowId) => {
    const pending = pendingIgstFor(digitsOnly(ritc), rowId);
    if (!pending) return null;
    pendingTariff.current = null;
    return pending.igstData;
  };

  const runTariffSearch = async (queryArgument) => {
    const query = String(typeof queryArgument === 'string' ? queryArgument : tariffSearch.q).trim();
    if (!query) { toast.error('Type a code or a description first'); return; }
    setTariffSearch((previous) => ({ ...previous, q: query, loading: true }));
    try {
      const headers = await responseBody(jobEntryApi.tariffHeaders(query));
      const rows = (Array.isArray(headers) ? headers : []).map((header) => {
        const basicDuty = (header.components || []).find((component) => /BCD|BASIC/i.test(String(component.dutyCategory || '')));
        return { id: header.id, hsnCode: header.hsnCode, description: header.description, uqc: header.uqc, bcd: basicDuty && basicDuty.rate != null && basicDuty.rate !== '' ? Number(basicDuty.rate) : null };
      });
      setTariffSearch((previous) => ({ ...previous, q: query, rows, loading: false, searched: true }));
    } catch (error) {
      setTariffSearch((previous) => ({ ...previous, loading: false, searched: true, rows: [] }));
      toast.error('Tariff master not reachable: ' + error.message);
    }
  };

  const openTariffSearch = (field) => {
    const current = itemFieldText(field);
    setTariffSearch({ open: true, field, q: current, rows: [], loading: false, searched: false });
    if (current) setTimeout(() => runTariffSearch(current), 0);
  };

  const askBcdExemptions = async (ritc, tariffBcd) => {
    try {
      const form = getItemForm();
      if (!form) return;
      if (itemFieldText('bcdNotificationNo', form)) { setBcdExemptions(null); return; }
      const origin = String(itemFieldText('countryOfOrigin', form) || jobData?.countryOfOrigin || jobData?.autoField_20 || '').trim().toUpperCase();
      const response = await responseBody(jobEntryApi.tariffExemptions(ritc, /^[A-Z]{2}$/.test(origin) ? origin : undefined));
      if (!response || !response.success) { setBcdExemptions(null); return; }
      const tariffRate = tariffBcd === null || tariffBcd === undefined || tariffBcd === '' ? null : Number(tariffBcd);
      // filed before, or a master row that is lower than the tariff rate
      const options = (response.data || []).filter((option) => option.used > 0 || (option.rate !== null && (tariffRate === null || option.rate < tariffRate)));
      if (!options.length) { setBcdExemptions(null); return; }
      setBcdExemptions({ ritc, tariffBcd: tariffRate, itemsFiled: response.itemsFiled || 0, options, also: response.also || [] });
    } catch {
      // extra information only
    }
  };

  const applyBcdExemption = (exemption) => {
    const form = getItemForm();
    if (!form || !exemption) return;
    if (!bcdExemptions || digitsOnly(itemFieldText('ritc', form)) !== bcdExemptions.ritc) {
      toast.error('The RITC box was changed - these notifications were for ' + (bcdExemptions ? bcdExemptions.ritc : 'another RITC'));
      setBcdExemptions(null);
      return;
    }
    setItemField('bcdNotificationNo', exemption.notifNo);
    setItemField('bcdSrNo', exemption.serialNo || '');
    const hasRate = exemption.rate !== null && exemption.rate !== undefined;
    if (hasRate) setItemField('bcdRate', String(exemption.rate));
    const pending = pendingIgstFor(bcdExemptions.ritc, savedRowId);
    refreshDutyEstimate(pending ? { ...savedRowItem, igstData: pending.igstData } : savedRowItem);
    setBcdExemptions(null);
    toast.success(`BCD ${hasRate ? exemption.rate + '%' : '(type the rate)'} under ${exemption.notifNo}${exemption.serialNo ? ' Sl ' + exemption.serialNo : ''} - check that the goods meet the notification${exemption.conditionNo ? ' (condition ' + exemption.conditionNo + ')' : ''}, then ${savedRowId ? 'MODIFY' : 'SAVE'}`, { duration: 8000 });
    if (Array.isArray(exemption.countries) && exemption.countries.length) {
      toast(`${exemption.notifNo} is a country notification (${exemption.countries.slice(0, 8).join(', ')}${exemption.countries.length > 8 ? ' ...' : ''}) - it needs a valid certificate of origin.`, { icon: '🌐', duration: 10000 });
    }
  };

  // asked when the description / model box is left while the RITC is still blank, or with the "Last Used" button
  const askItemHistory = async (byButton) => {
    const form = getItemForm();
    if (!form) return;
    const description = itemFieldText('desc', form);
    const model = itemFieldText('model', form);
    if (!byButton && itemFieldText('ritc', form)) return; // the heading is already there
    if (!description && !model) { if (byButton) toast('Type the item description (or model no) first'); return; }
    const mark = String(selectedRowId || 'new') + '|' + description.toUpperCase() + '|' + model.toUpperCase();
    if (!byButton && historySeen.current === mark) return;
    historySeen.current = mark;
    try {
      const response = await responseBody(jobEntryApi.itemHistory({
        iec: String(jobData?.iecCode || jobData?.autoField_5 || '').trim(), desc: description, model, ...(jobData?.id ? { excludeJobId: String(jobData.id) } : {}),
      }));
      const options = (response && response.success && Array.isArray(response.options)) ? response.options : [];
      if (!options.length) { setItemHistory(null); if (byButton) toast('No earlier entry of this description / model was found'); return; }
      setItemHistory({ options, desc: description, model });
    } catch {
      historySeen.current = '';
      if (byButton) toast.error('Could not read the earlier entries');
    }
  };

  const applyItemHistory = async (entry) => {
    const form = getItemForm();
    if (!form || !entry || !entry.fields) return;
    const fields = entry.fields;
    const filled = [];
    const fillBlank = (name, value, label) => {
      if (!form.elements[name] || itemFieldText(name, form) || !hasValue(value)) return false;
      setItemField(name, String(value));
      if (label) filled.push(label + ' ' + value);
      return true;
    };
    const typedRitc = digitsOnly(itemFieldText('ritc', form));
    if (typedRitc && typedRitc !== fields.ritc) {
      toast.error(`The RITC box has ${typedRitc}; this earlier entry used ${fields.ritc}. Clear the RITC box first if you want the earlier one.`, { duration: 7000 });
      return;
    }
    fillBlank('ritc', fields.ritc, 'RITC');
    fillBlank('cth', fields.cth || fields.ritc);
    fillBlank('ceth', fields.ceth);
    fillBlank('uqc', fields.uqc, 'UQC');
    fillBlank('bcdNotificationNo', fields.bcdNotificationNo);
    fillBlank('bcdSrNo', fields.bcdSrNo);
    if (fillBlank('bcdRate', fields.bcdRate)) filled.push('BCD ' + fields.bcdRate + '%');
    fillBlank('bcdFlag', fields.bcdFlag);
    fillBlank('swsNotificationNo', fields.swsNotificationNo);
    fillBlank('swsSrNo', fields.swsSrNo);
    fillBlank('swsRate', fields.swsRate);
    fillBlank('swsFlag', fields.swsFlag);
    fillBlank('healthCessNotificationNo', fields.healthCessNotificationNo);
    fillBlank('healthCessSrNo', fields.healthCessSrNo);
    fillBlank('healthCessRate', fields.healthCessRate);
    HISTORY_PARTICULARS.forEach(([name, label]) => fillBlank(name, fields[name], label));

    const savedIgst = savedRowId ? asObjectOrNull(selectedItem.igstData) : null;
    let liveItem = savedRowItem;
    if (!(savedIgst && hasValue(savedIgst.rate)) && fields.igstData && hasValue(fields.igstData.rate)) {
      const igstData = { ...EMPTY_PENDING_IGST, ...(savedIgst || {}), ...fields.igstData };
      pendingTariff.current = { ritc: fields.ritc, rowId: savedRowId, igstData };
      liveItem = { ...liveItem, igstData };
      filled.push(igstLabel(igstData));
    }
    refreshDutyEstimate(liveItem);
    setItemHistory(null);
    if (filled.length) toast.success('From job ' + (entry.lastJobNo || '') + ': ' + filled.join(', ') + ' - check, then ' + (savedRowId ? 'MODIFY' : 'SAVE'), { duration: 7000 });
    else toast('Nothing new: the boxes already have values');

    // a rate used months ago may have changed: say so when today's Tariff master differs
    try {
      const response = await responseBody(jobEntryApi.tariffLine(fields.ritc));
      const tariff = response && response.success ? response.data : null;
      if (!tariff || tariff.exact === false) {
        if (tariff) toast(`RITC ${fields.ritc} of the earlier entry is not in today's Tariff master - check the heading.`, { icon: '⚠️', duration: 9000 });
        return;
      }
      const differences = [];
      const rateOf = (value) => (hasValue(value) ? parseFloat(value) : null);
      const typedBcd = itemFieldText('bcdRate', form);
      if (rateOf(tariff.bcdRate) !== null && rateOf(typedBcd) !== null && rateOf(tariff.bcdRate) !== rateOf(typedBcd)) differences.push(`BCD ${typedBcd}% here, ${tariff.bcdRate}% in the Tariff master`);
      const igstNow = pendingTariff.current && pendingTariff.current.ritc === fields.ritc ? pendingTariff.current.igstData : savedIgst;
      if (rateOf(tariff.igstRate) !== null && igstNow && rateOf(igstNow.rate) !== null && rateOf(tariff.igstRate) !== rateOf(igstNow.rate) && !tariff.igstRateVaries) differences.push(`IGST ${igstNow.rate}% here, ${tariff.igstRate}% in the Tariff master`);
      if (differences.length) toast('The earlier entry differs from the Tariff master: ' + differences.join('; ') + '. A notification / exemption may explain it - check.', { icon: '⚠️', duration: 12000 });
      if (Array.isArray(tariff.pgaAgencies) && tariff.pgaAgencies.length) toast(`${fields.ritc} is cleared by other agencies too: ${tariff.pgaAgencies.join(', ')}.`, { icon: '🏛️', duration: 8000 });
    } catch {
      // the comparison is extra
    }
  };

  // Asked as soon as an 8-digit RITC is typed (leaving the RITC box) or picked in the lookup. A saved item is touched
  // only when its RITC was changed in the box. A code the master does not have is asked once; a code it has is asked
  // again only while a box is still blank. A sibling line of the heading (RITC not in the master) fills nothing.
  const autoTariff = async (rawRitc) => {
    const ritc = digitsOnly(rawRitc);
    if (ritc.length !== 8) return;
    const rowId = savedRowId;
    if (rowId && digitsOnly(selectedItem.ritc || selectedItem.hsCode) === ritc) return;
    if (autoTariffSeen.current === ritc) return;
    const form = getItemForm();
    if (!form) return;
    const savedIgst = rowId ? asObjectOrNull(selectedItem.igstData) : null;
    const needIgst = !(savedIgst && String(savedIgst.rate || '').trim()) && !pendingIgstFor(ritc, rowId);
    if (itemFieldText('bcdRate', form) && itemFieldText('desc', form) && itemFieldText('uqc', form) && !needIgst) return; // nothing blank to fill
    try {
      const response = await responseBody(jobEntryApi.tariffLine(ritc));
      if (!response || !response.success) { autoTariffSeen.current = ritc; return; } // not in the master: the operator types the rates
      const tariff = response.data || {};
      if (digitsOnly(itemFieldText('ritc', form)) !== ritc) return; // the box was changed while the master was asked
      if (tariff.exact === false) {
        autoTariffSeen.current = ritc;
        toast(`RITC ${ritc} is not in the Tariff master - rates were not filled. Check the rate in the tariff.`, { icon: '⚠️', duration: 7000 });
        return;
      }
      const filled = [];
      if (!itemFieldText('desc', form) && tariff.description) { setItemField('desc', tariff.description); filled.push('description'); }
      if (!itemFieldText('bcdRate', form) && tariff.bcdRate != null) { setItemField('bcdRate', String(tariff.bcdRate)); filled.push('BCD ' + tariff.bcdRate + '%'); }
      if (!itemFieldText('uqc', form) && tariff.uqc) { setItemField('uqc', tariff.uqc); filled.push('UQC ' + tariff.uqc); }
      if (!itemFieldText('cth', form)) setItemField('cth', ritc);
      let liveItem = rowId ? selectedItem : {};
      if (needIgst && tariff.igstRate != null) {
        const igstData = { ...EMPTY_PENDING_IGST, ...(savedIgst || {}), rate: String(tariff.igstRate) };
        if (!igstData.notnNo && tariff.igstNotnNo) igstData.notnNo = tariff.igstNotnNo;
        if (!igstData.srNo && tariff.igstSrNo) igstData.srNo = tariff.igstSrNo;
        pendingTariff.current = { ritc, rowId, igstData };
        liveItem = { ...liveItem, igstData };
        filled.push(tariffIgstLabel(tariff));
      }
      if (!filled.length) return;
      refreshDutyEstimate(liveItem);
      toast.success('From the Tariff master: ' + filled.join(', ') + ' - check, then ' + (rowId ? 'MODIFY' : 'SAVE'), { duration: 6000 });
      askBcdExemptions(ritc, tariff.bcdRate);
      warnIgstVaries(ritc, tariff);
      warnPgaAgencies(ritc, tariff);
    } catch {
      // server not reachable: Fetch Item still works
    }
  };

  // a line picked in the lookup: only the boxes change - SAVE makes the new item / MODIFY writes the selected one
  const pickTariff = (row) => {
    const field = tariffSearch.field;
    const code = digitsOnly(row.hsnCode);
    setItemField(field, code);
    if (field === 'ritc') {
      if (!itemFieldValue('cth')) setItemField('cth', code);
      // CETH as iCAFFE files it: NOEXCISE, except goods still under central excise (chapters 22 / 24 / 27). A copied
      // RITC is refused by ICES (error 317 Invalid CETH).
      if (!itemFieldValue('ceth')) setItemField('ceth', /^(22|24|27)/.test(code) ? code : 'NOEXCISE');
      if (row.description && (autoDesc || !itemFieldValue('desc'))) setItemField('desc', row.description);
      if (row.uqc && !itemFieldValue('uqc')) setItemField('uqc', row.uqc);
    }
    setTariffSearch((previous) => ({ ...previous, open: false }));
    toast.success(field.toUpperCase() + ' ' + code + (row.description ? ' - ' + String(row.description).slice(0, 50) : ''));
    if (field === 'ritc') setTimeout(() => autoTariff(code), 50);
  };

  // Fetch Item: fills BLANK boxes from the Tariff master
  const handleFetchItem = async () => {
    if (!selectedRowId || !selectedItem) { toast.error('Please select an item first'); return; }
    const form = getItemForm();
    const ritc = digitsOnly((form && form.elements.ritc && form.elements.ritc.value) || selectedItem.ritc || selectedItem.hsCode);
    if (!ritc) { toast.error('RITC is required to fetch item details'); return; }
    try {
      const response = await responseBody(jobEntryApi.tariffLine(ritc));
      if (!response || !response.success) { toast.error(response?.message || 'RITC not found in Tariff master'); return; }
      const tariff = response.data || {};
      const current = (name) => (form && form.elements[name] ? form.elements[name].value : selectedItem[name]) || '';
      const filled = [];
      const update = {};
      // the master may answer with a sibling line of the same 6-digit heading (exact:false) - its rates are NOT the
      // item's rates, so only the description / UQC are offered
      const exact = tariff.exact !== false;
      if (!exact) toast(`RITC ${ritc} is not in the Tariff master - nearest line ${tariff.matchedCode || tariff.ritc} shown; BCD / IGST were NOT filled from it. Check the rate in the tariff.`, { icon: '⚠️', duration: 9000 });
      if (!current('desc') && tariff.description) {
        update.desc = tariff.description;
        update.productDescription = tariff.description;
        setItemField('desc', tariff.description);
        filled.push('description' + (exact ? '' : ' (nearest line)'));
      }
      if (exact && !current('bcdRate') && tariff.bcdRate != null) { update.bcdRate = String(tariff.bcdRate); setItemField('bcdRate', String(tariff.bcdRate)); filled.push('BCD ' + tariff.bcdRate + '%'); }
      if (!current('uqc') && tariff.uqc) { update.uqc = tariff.uqc; update.unit = tariff.uqc; setItemField('uqc', tariff.uqc); filled.push('UQC'); }
      if (!current('cth')) { update.cth = ritc; setItemField('cth', ritc); }
      const savedIgst = asObjectOrNull(selectedItem.igstData);
      // the IGST notification / serial come with the rate (iCAFFE 009/2025): a blank one is filled, a typed one is kept
      if (exact && tariff.igstRate != null && !(savedIgst && savedIgst.rate)) {
        update.igstData = { ...EMPTY_PENDING_IGST, ...(savedIgst || {}), rate: String(tariff.igstRate) };
        if (!update.igstData.notnNo && tariff.igstNotnNo) update.igstData.notnNo = tariff.igstNotnNo;
        if (!update.igstData.srNo && tariff.igstSrNo) update.igstData.srNo = tariff.igstSrNo;
        filled.push(tariffIgstLabel(tariff));
      }
      if (exact) {
        warnIgstVaries(ritc, tariff);
        warnPgaAgencies(ritc, tariff);
      }
      const origin = String(jobData?.countryOfOrigin || jobData?.autoField_20 || '').trim().toUpperCase();
      if (exact && origin) showFtaRows(ritc, origin);
      if (exact) askBcdExemptions(ritc, tariff.bcdRate);
      setItems(patchItem(items, selectedRowId, update));
      toast.success(filled.length ? 'Filled from Tariff: ' + filled.join(', ') : 'Nothing new: the boxes already have values');
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch tariff');
    }
  };

  return {
    tariffSearch, setTariffSearch, openTariffSearch, runTariffSearch, pickTariff, autoDesc, setAutoDesc,
    autoTariff, takePendingIgst, itemHistory, setItemHistory, askItemHistory, applyItemHistory, bcdExemptions, setBcdExemptions, applyBcdExemption,
    handleFetchItem,
  };
}

