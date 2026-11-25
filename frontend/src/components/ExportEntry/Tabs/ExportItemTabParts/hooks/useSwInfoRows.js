import { useEffect, useRef } from 'react';
import { asList } from '@/utils/asList';

const GENERATED_KEYS = ['CHR/SQC', 'ORC/STO', 'ORC/DOO', 'DTY/RDT', 'ORC/EPT', 'DTY/GCESS'];
const MOOWR_KEY = 'DIR/MOOWR';

const infoKey = (type, qualifier) => `${String(type || '').toUpperCase()}/${String(qualifier || '').toUpperCase()}`;
const rowKey = (row) => infoKey(row.swInfoField1 || row.type, row.swInfoField2 || row.qual);
const firstPart = (value) => String(value || '').split('|')[0].trim();
const isScheme19 = (scheme) => /19/.test(String(scheme || ''));
const signature = (rows) => JSON.stringify(rows.map((row) => [row.swInfoField1, row.swInfoField2, row.swInfoField3, row.swInfoField4, row.swInfoField5, row.swInfoField6]));

/**
 * SW info rows that every item of the production SB files carries: ORC/STO (state code), ORC/DOO (district code),
 * ORC/EPT NCPTI, DTY/GCESS 0 INR, CHR/SQC, and DTY/RDT RODTEPY / RODTEPN for scheme 19 or a RoDTEP claim; DIR/MOOWR
 * MOOWRY when the SB Header says MOOWR = Yes (ICES Exports message format 3.3 / 3.7). Codes the user changed and rows
 * of other types typed in the SW Info window are kept.
 */
export default function useSwInfoRows({ formData, setFormData, selectedRowId, exportData, rodtepsMaster }) {
  // RoDTEP is switched on once, when the scheme of the same item is changed to a 19 scheme (a manual N is kept)
  const lastScheme = useRef({ row: undefined, scheme: undefined });
  useEffect(() => {
    const scheme = String(formData.scheme || '');
    const previous = lastScheme.current;
    lastScheme.current = { row: selectedRowId, scheme };
    const changedTo19 = previous.scheme !== undefined && previous.row === selectedRowId && previous.scheme !== scheme && isScheme19(scheme) && !isScheme19(previous.scheme);
    if (changedTo19 && formData.rodtep !== 'Y') setFormData((form) => ({ ...form, rodtep: 'Y' }));
  }, [formData.scheme, selectedRowId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const qty = formData.qty || '';
    const uqc = formData.unit || '';
    const stateCode = firstPart(formData.stateCode || exportData?.stateOriginCode);
    const districtCode = String(formData.districtCode || '').trim();
    const oldRows = asList(formData.swInfos);
    const oldRow = (type, qualifier) => oldRows.find((row) => rowKey(row) === infoKey(type, qualifier));

    const generated = [];
    if (stateCode) generated.push({ type: 'ORC', qual: 'STO', code: stateCode, msr: '', uqc: '' });
    if (districtCode) generated.push({ type: 'ORC', qual: 'DOO', code: districtCode, msr: '', uqc: '' });
    const preference = oldRow('ORC', 'EPT');
    generated.push({ type: 'ORC', qual: 'EPT', code: firstPart(preference && (preference.swInfoField3 || preference.code)) || 'NCPTI', msr: '', uqc: '' });
    const cess = oldRow('DTY', 'GCESS');
    generated.push({
      type: 'DTY', qual: 'GCESS', code: (cess && (cess.swInfoField3 || cess.code)) || '',
      msr: (cess && (cess.swInfoField5 || cess.msr)) || (formData.cessAmount > 0 ? String(formData.cessAmount) : '0'), uqc: 'INR',
    });

    // SQC / RDT are in the unit of the RoDTEP schedule (iCAFFE: 11 NOS of 83071000 -> 139.7 KGS): the item qty only when
    // the item unit is the schedule's; otherwise the measurement keyed in SW info (or kept with the job) stays
    const schedule = rodtepsMaster.find((row) => String(row.tariffItem || '') === String(formData.ritc || '').replace(/\D/g, ''));
    const scheduleUnit = String(schedule?.uqc || '').toUpperCase();
    const jobRow = (type, qualifier) => asList(exportData?._infoTypes).find((row) => String(row.infoType || '').toUpperCase() === type
      && String(row.infoQualifier || '').toUpperCase() === qualifier
      && String(parseInt(row.invoiceSerialNumber, 10) || 1) === String(parseInt(formData.invSr, 10) || 1)
      && String(parseInt(row.itemSerialNumber, 10) || 0) === String(parseInt(formData.itemSr, 10) || 0));
    const keptMeasure = (type, qualifier) => {
      const own = oldRow(type, qualifier);
      if (own && String(own.swInfoField6 || own.uqc || '').toUpperCase() === scheduleUnit) return own.swInfoField5 || own.msr || '';
      const kept = jobRow(type, qualifier);
      return kept && String(kept.infouqc || '').toUpperCase() === scheduleUnit ? String(kept.infoMeasure || '') : '';
    };
    const sameUnit = !scheduleUnit || String(uqc).toUpperCase() === scheduleUnit;
    const sqcMeasure = sameUnit ? qty : keptMeasure('CHR', 'SQC');
    const rdtMeasure = sameUnit ? qty : (keptMeasure('DTY', 'RDT') || sqcMeasure);
    const measureUnit = sameUnit ? uqc : scheduleUnit;
    generated.push({ type: 'CHR', qual: 'SQC', code: '', msr: sqcMeasure, uqc: measureUnit });
    if (isScheme19(formData.scheme) || formData.rodtep === 'Y') {
      generated.push({ type: 'DTY', qual: 'RDT', code: formData.rodtep === 'Y' ? 'RODTEPY' : 'RODTEPN', msr: rdtMeasure, uqc: measureUnit });
    }

    const moowr = /^Y/i.test(String(exportData?.autoField_31 || ''));
    if (moowr) {
      const moowrRow = oldRow('DIR', 'MOOWR');
      generated.push({ type: 'DIR', qual: 'MOOWR', code: (moowrRow && (moowrRow.swInfoField3 || moowrRow.code)) || 'MOOWRY', msr: '', uqc: '' });
    }

    const generatedKeys = new Set([...GENERATED_KEYS, ...(moowr ? [MOOWR_KEY] : [])]);
    const typedRows = oldRows.filter((row) => !generatedKeys.has(rowKey(row)));
    const swInfos = [
      ...generated.map((row, index) => {
        const old = oldRow(row.type, row.qual);
        return {
          id: old?.id || Date.now() + index, type: row.type, qual: row.qual, code: row.code, msr: row.msr, uqc: row.uqc,
          swInfoField1: row.type, swInfoField2: row.qual, swInfoField3: row.code, swInfoField4: old?.swInfoField4 || '', swInfoField5: row.msr, swInfoField6: row.uqc,
        };
      }),
      ...typedRows,
    ];
    if (signature(oldRows) !== signature(swInfos)) setFormData((form) => ({ ...form, swInfos }));
  }, [formData.qty, formData.unit, formData.rodtep, formData.scheme, formData.cessAmount, formData.stateCode, formData.districtCode, formData.swInfos, exportData?.stateOriginCode, exportData?.autoField_31, formData.ritc, rodtepsMaster]); // eslint-disable-line react-hooks/exhaustive-deps
}
