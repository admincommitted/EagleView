import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, Field, Input, Modal, SelectBox } from '@/components/ui';
import { volWtFromDims, cbmFromDims, chargeableOf, unitKL } from '../awb/weightCalc';
import FWBTextArea from '../../FWBTextArea';
import { askConfirm } from '../../common/askConfirm';

const RATE_CLASSES = ['SELECT', 'M - MINIMUM CHARGE', 'N - NORMAL RATE', 'Q - QUANTITY RATE', 'B - BASIC CHARGE', 'K - RATE PER KILOGRAM', 'C - SPECIFIC COMMODITY RATE', 'R - CLASS RATE REDUCTION', 'S - CLASS RATE SURCHARGE'];
const RATE_CLASS_BY_LETTER = Object.fromEntries(RATE_CLASSES.slice(1).map((rateClass) => [rateClass.charAt(0), rateClass]));
// the grid keeps only the letter; these five are shown with their name when a line is opened again
const NAMED_ON_OPEN = ['M', 'N', 'Q', 'B', 'K'];
const EMPTY_DIMENSION = { length: '', width: '', height: '', noOfUnits: '' };
const EMPTY_LINE = {
  noOfPcs: '', slac: '', rcp: '', rateClassCode: 'SELECT', rateClassPercentage: '', commodityItemNumber: '',
  grossWeight: '', gwUnit: 'KG', chargeableWeight: '', cwUnit: 'KG', rateCharge: '', rateAsAgreed: false, goodsDescription: '',
  dimensions: [EMPTY_DIMENSION], cmIn: 'CM', mc: 'MC', uldType: '', uldSerial: '', uldOwner: '', uldRateClass: '', harmonisedCode: '',
  volume: '', volumetricWeight: '', totalAmount: '',
};
const ULD_FIELDS = [
  { key: 'uldType', label: 'ULD TYPE', placeholder: 'EG: [AKE]' },
  { key: 'uldSerial', label: 'ULD SERIAL NO', placeholder: 'EG: [A8983]' },
  { key: 'uldOwner', label: 'ULD OWNER CODE', placeholder: 'EG: [XB]' },
  { key: 'uldRateClass', label: 'ULD RATE CLASS', placeholder: '' },
];
const DIMENSION_FIELDS = [
  { key: 'length', label: 'LENGTH', pattern: /[^0-9.]/g },
  { key: 'width', label: 'WIDTH', pattern: /[^0-9.]/g },
  { key: 'height', label: 'HEIGHT', pattern: /[^0-9.]/g },
];

const digits = (text) => text.replace(/[^0-9]/g, '');
const decimal = (text) => text.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '');
const twoDecimals = (text) => (text && !isNaN(parseFloat(text)) ? parseFloat(text).toFixed(2) : null);
const isMeasured = (dimension) => parseFloat(dimension.length) > 0 && parseFloat(dimension.width) > 0 && parseFloat(dimension.height) > 0;

function lineFromInitial(initialData) {
  const rateClass = initialData.rateClassCode || initialData.rateClass || 'SELECT';
  return {
    ...EMPTY_LINE,
    noOfPcs: initialData.noOfPcs || initialData.pieces || '',
    slac: initialData.slac || '',
    rcp: initialData.rcp || '',
    rateClassCode: NAMED_ON_OPEN.includes(rateClass) ? RATE_CLASS_BY_LETTER[rateClass] : rateClass,
    rateClassPercentage: initialData.rateClassPercentage || '',
    commodityItemNumber: initialData.commodityItemNumber || initialData.commodityItemNo || '',
    grossWeight: initialData.grossWeight || '',
    gwUnit: unitKL(initialData.gwUnit) === 'L' ? 'LB' : 'KG',
    volumetricWeight: initialData.volumetricWeight || '',
    volume: initialData.volume || '',
    chargeableWeight: initialData.chargeableWeight || '',
    cwUnit: unitKL(initialData.gwUnit || initialData.cwUnit) === 'L' ? 'LB' : 'KG',
    rateCharge: initialData.rateCharge || '',
    rateAsAgreed: initialData.rateAsAgreed || false,
    goodsDescription: initialData.goodsDescription || initialData.natureOfGoods || '',
    dimensions: initialData.dimensions?.length > 0
      ? initialData.dimensions
      : [{ length: initialData.length || '', width: initialData.width || '', height: initialData.height || '', noOfUnits: initialData.noOfUnits || '' }],
    cmIn: initialData.cmIn || 'CM',
    mc: initialData.mc || 'MC',
    uldType: initialData.uldType || '',
    uldSerial: initialData.uldSerial || '',
    uldOwner: initialData.uldOwner || '',
    uldRateClass: initialData.uldRateClass || '',
    harmonisedCode: initialData.harmonisedCode || '',
  };
}

// Rate class suggestion from what is typed: a commodity item number -> C; a class percentage -> R (under 100) or
// S (over 100); otherwise N under 45 kg (100 lb) chargeable weight and Q from there. Only a hint - "Use" picks it.
function suggestRateClass(line) {
  const chargeable = parseFloat(line.chargeableWeight) || 0;
  const percentage = parseFloat(String(line.rateClassPercentage || '').replace(/[^0-9.]/g, '')) || 0;
  const limit = line.gwUnit === 'LB' ? 100 : 45;
  const unit = line.gwUnit === 'LB' ? 'lb' : 'kg';
  if (String(line.commodityItemNumber || '').trim()) return { code: 'C', why: 'a commodity item number is filled' };
  if (percentage > 0 && percentage < 100) return { code: 'R', why: 'the class percentage ' + percentage + ' is under 100' };
  if (percentage > 100) return { code: 'S', why: 'the class percentage ' + percentage + ' is over 100' };
  if (chargeable > 0) {
    return chargeable < limit
      ? { code: 'N', why: 'chargeable weight ' + chargeable + ' ' + unit + ' is under ' + limit + ' ' + unit }
      : { code: 'Q', why: 'chargeable weight ' + chargeable + ' ' + unit + ' is ' + limit + ' ' + unit + ' or more' };
  }
  return null;
}

function validate(line) {
  const errors = {};
  if (!line.noOfPcs || isNaN(Number(line.noOfPcs)) || Number(line.noOfPcs) <= 0) errors.noOfPcs = 'No. of Pieces is required';
  if (!line.grossWeight || isNaN(parseFloat(line.grossWeight)) || parseFloat(line.grossWeight) <= 0) errors.grossWeight = 'Gross Weight is required';
  if (!line.chargeableWeight || isNaN(parseFloat(line.chargeableWeight)) || parseFloat(line.chargeableWeight) <= 0) errors.chargeableWeight = 'Chargeable Weight is required';
  if (!line.goodsDescription || line.goodsDescription.trim() === '') errors.goodsDescription = 'Goods Description is required';
  return errors;
}

const errorNote = (text) => (text ? <span className="tw:text-destructive">{text}</span> : undefined);

const AUTO_BOX = 'tw:bg-[#e0f2fe] tw:font-bold';

export default function RateLineModal({ isOpen, onClose, onSave, initialData, densityGroup }) {
  const [line, setLine] = useState(EMPTY_LINE);
  const [errors, setErrors] = useState({});
  const [uldOpen, setUldOpen] = useState(false);
  // the chargeable weight is worked out only after a change in this window: opening a saved line keeps its own
  const touched = useRef(false);

  const derive = (fields) => setLine((current) => ({ ...current, ...fields }));
  const edit = (fields) => { touched.current = true; derive(fields); };
  const clearError = (field) => {
    if (errors[field]) setErrors((current) => { const next = { ...current }; delete next[field]; return next; });
  };

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setLine(initialData ? lineFromInitial(initialData) : EMPTY_LINE);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isOpen) touched.current = false; }, [isOpen]);

  // volume and volumetric weight from the dimension lines with the AWB's ratio (IATA 1:6 = 6000 cm3 per kg); chargeable
  // weight = higher of gross and volumetric weight rounded up to the next 0.5 kg / whole lb, in the unit of the gross weight
  useEffect(() => {
    const measured = line.dimensions
      .map((dimension) => ({ length: dimension.length, width: dimension.width, height: dimension.height, pieces: dimension.noOfUnits, unit: line.cmIn === 'IN' ? 'INCH' : 'CM' }))
      .filter((dimension) => isMeasured(dimension) && parseFloat(dimension.pieces) > 0);
    const fields = { cwUnit: line.gwUnit === 'LB' ? 'LB' : 'KG' };
    let volumetric = 0;
    if (measured.length) {
      volumetric = volWtFromDims(measured, densityGroup);
      Object.assign(fields, { volume: cbmFromDims(measured).toFixed(3), volumetricWeight: volumetric.toFixed(2) });
    } else {
      volumetric = parseFloat(line.volumetricWeight) || 0;
      if (touched.current) fields.volume = '';
    }
    if (touched.current) {
      const chargeable = chargeableOf(line.grossWeight, volumetric, line.gwUnit === 'LB' ? 'L' : 'K', true);
      fields.chargeableWeight = chargeable ? chargeable.toFixed(2) : '';
    }
    derive(fields);
  }, [line.dimensions, line.cmIn, line.grossWeight, line.gwUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const chargeable = parseFloat(line.chargeableWeight) || 0;
    const rate = parseFloat(line.rateCharge) || 0;
    let totalAmount = '';
    if (rate > 0 && /^(M|B)/.test(String(line.rateClassCode || ''))) totalAmount = rate.toFixed(2);
    else if (chargeable > 0 && rate > 0) totalAmount = (chargeable * rate).toFixed(2);
    derive({ totalAmount });
  }, [line.chargeableWeight, line.rateCharge, line.rateClassCode]);

  if (!isOpen) return null;

  // the units of the dimension lines should add up to the pieces of the line (not every piece is always measured)
  const pieces = Number(line.noOfPcs) || 0;
  const unitsSum = line.dimensions.filter(isMeasured).reduce((sum, dimension) => sum + (parseInt(dimension.noOfUnits, 10) || 0), 0);
  const unitsDiffer = pieces > 0 && unitsSum > 0 && unitsSum !== pieces;
  const suggestion = suggestRateClass(line);
  const rateClassLetter = String(line.rateClassCode || '').charAt(0);
  const isFlatCharge = /^(M|B)/.test(String(line.rateClassCode || ''));
  const errorCount = Object.keys(errors).length;
  const uldHasValue = ULD_FIELDS.some((field) => String(line[field.key] || '').trim() !== '');
  const uldShown = uldOpen || uldHasValue;

  const editDimension = (index, field, value) => edit({ dimensions: line.dimensions.map((dimension, position) => (position === index ? { ...dimension, [field]: value } : dimension)) });
  const addDimension = () => derive({ dimensions: [...line.dimensions, EMPTY_DIMENSION] });
  const removeDimension = (index) => derive({ dimensions: line.dimensions.filter((_, position) => position !== index) });
  const formatOnBlur = (field) => (event) => { const formatted = twoDecimals(event.target.value); if (formatted) derive({ [field]: formatted }); };

  const handleClear = () => {
    setErrors({});
    derive({ ...EMPTY_LINE, volume: line.volume, volumetricWeight: line.volumetricWeight, totalAmount: line.totalAmount });
  };

  const handleAdd = async () => {
    const found = validate(line);
    if (Object.keys(found).length > 0) { setErrors(found); return; }
    if (unitsDiffer) {
      const goAhead = await askConfirm({ title: 'Pieces and dimension units do not match', message: 'No. of pieces is ' + pieces + ', but the dimension lines add up to ' + unitsSum + ' units.', note: 'The volume and the volumetric weight are worked out for ' + unitsSum + ' units; the AWB will show ' + pieces + ' pieces.', okLabel: 'Add anyway', cancelLabel: 'Go back and correct' });
      if (!goAhead) return;
    }
    // a chargeable weight far above the gross weight is almost always a typing slip in the dimensions (mm for cm) or a CBM figure taken as kg
    const gross = parseFloat(line.grossWeight) || 0;
    const chargeable = parseFloat(line.chargeableWeight) || 0;
    if (gross > 0 && chargeable > gross * 30) {
      const goAhead = await askConfirm({ title: 'Chargeable weight looks too high', message: 'Chargeable weight ' + chargeable + ' kg is ' + Math.round(chargeable / gross) + ' times the gross weight ' + gross + ' kg.', note: 'Check the dimensions (cm / inch) and the number of units.', okLabel: 'Add anyway', cancelLabel: 'Go back and check' });
      if (!goAhead) return;
    }
    // no class chosen: N (normal rate) under 45 kg / 100 lb chargeable, Q (quantity rate) from there
    const rateClass = (line.rateClassCode && line.rateClassCode !== 'SELECT' ? line.rateClassCode : (chargeable < (line.gwUnit === 'LB' ? 100 : 45) ? 'N' : 'Q')).charAt(0);
    const unit = line.gwUnit === 'LB' ? 'L' : 'K';
    const [firstDimension] = line.dimensions;
    onSave?.({
      pieces: line.noOfPcs, noOfPcs: line.noOfPcs, slac: line.slac, rcp: line.rcp,
      rateClass, rateClassCode: rateClass, rateClassPercentage: line.rateClassPercentage,
      commodityItemNo: line.commodityItemNumber, commodityItemNumber: line.commodityItemNumber,
      grossWeight: line.grossWeight, gwUnit: unit, volumetricWeight: line.volumetricWeight, chargeableWeight: line.chargeableWeight, cwUnit: unit, cwManual: true,
      rateCharge: line.rateCharge, total: line.totalAmount, totalAmount: line.totalAmount, rateAsAgreed: line.rateAsAgreed,
      natureOfGoods: line.goodsDescription, goodsDescription: line.goodsDescription,
      dimensions: line.dimensions, cmIn: line.cmIn, volume: line.volume, mc: line.mc,
      length: firstDimension?.length, width: firstDimension?.width, height: firstDimension?.height, noOfUnits: firstDimension?.noOfUnits,
      uldType: line.uldType, uldSerial: line.uldSerial, uldOwner: line.uldOwner, uldRateClass: line.uldRateClass, harmonisedCode: line.harmonisedCode,
    });
    onClose();
  };

  const footer = (
    <>
      <span className="tw:mr-auto tw:text-[11px] tw:font-semibold">
        {errorCount > 0 && <span className="tw:text-destructive">⚠ {errorCount} required field{errorCount > 1 ? 's' : ''} missing</span>}
        {errorCount === 0 && unitsDiffer && <span className="rl-units-warn tw:text-warning">&#9888; Pieces {pieces}, dimension units {unitsSum} - they do not match.</span>}
      </span>
      <Button variant="destructive" onClick={handleClear}>CLEAR</Button>
      <Button variant="default" onClick={handleAdd}>ADD</Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title="Add / edit rate line" width={920} footer={footer}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-2">
        <div className="tw:flex tw:flex-col tw:gap-3">
          <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-3">
            <Field label="NO. OF PCS" required layout="col" note={errorNote(errors.noOfPcs)}>
              <Input required aria-invalid={Boolean(errors.noOfPcs)} value={line.noOfPcs} onChange={(event) => { edit({ noOfPcs: digits(event.target.value) }); clearError('noOfPcs'); }} />
            </Field>
            <Field label="SLAC" layout="col"><Input value={line.slac} onChange={(event) => edit({ slac: digits(event.target.value) })} /></Field>
            <Field label="RCP" layout="col"><Input value={line.rcp} onChange={(event) => edit({ rcp: event.target.value })} /></Field>
          </div>

          <Field label="RATE CLASS CODE" required layout="col"
            note={(
              <>
                {suggestion && rateClassLetter !== suggestion.code && (
                  <span className="rl-rc-hint tw:block">
                    Suggested: <b className="tw:text-foreground">{RATE_CLASS_BY_LETTER[suggestion.code]}</b> - {suggestion.why}.{' '}
                    <Button variant="link" size="sm" className="tw:h-auto" onClick={() => derive({ rateClassCode: RATE_CLASS_BY_LETTER[suggestion.code] })}>Use</Button>
                  </span>
                )}
                {!suggestion && line.rateClassCode === 'SELECT' && <span className="tw:block">Not chosen: N under 45 kg, Q from 45 kg</span>}
                {isFlatCharge && <span className="rl-rc-flat tw:block tw:text-warning">With {rateClassLetter} the Rate / Charge box is the whole charge - it is not multiplied by the weight.</span>}
              </>
            )}>
            <SelectBox className="tw:w-full" value={line.rateClassCode} onValueChange={(rateClassCode) => edit({ rateClassCode })} options={RATE_CLASSES} />
          </Field>

          <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2">
            <Field label="RATE CLASS PERCENTAGE" layout="col">
              <Input value={line.rateClassPercentage} placeholder="EG: [N70]" onChange={(event) => edit({ rateClassPercentage: event.target.value })} />
            </Field>
            <Field label="COMMODITY ITEM NUMBER" layout="col">
              <Input value={line.commodityItemNumber} onChange={(event) => edit({ commodityItemNumber: event.target.value })} />
            </Field>
          </div>

          <div className="tw:grid tw:grid-cols-[1fr_60px] tw:gap-2 tw:sm:grid-cols-[1.2fr_60px_1.2fr_60px]">
            <Field label="GROSS WEIGHT" required layout="col" note={errorNote(errors.grossWeight)}>
              <Input required aria-invalid={Boolean(errors.grossWeight)} value={line.grossWeight} onBlur={formatOnBlur('grossWeight')}
                onChange={(event) => { edit({ grossWeight: decimal(event.target.value) }); clearError('grossWeight'); }} />
            </Field>
            <Field label="KG/LB" layout="col">
              <SelectBox className="tw:w-full" value={line.gwUnit} onValueChange={(gwUnit) => edit({ gwUnit })} options={['KG', 'LB']} />
            </Field>
            <Field label="VOLUMETRIC WEIGHT" layout="col"><Input readOnly value={line.volumetricWeight} className={AUTO_BOX} /></Field>
            <Field label="KG/LB" layout="col"><Input readOnly value="KG" className={cn(AUTO_BOX, 'tw:text-center tw:text-[11px]')} /></Field>
          </div>

          <div className="tw:grid tw:grid-cols-[1fr_60px] tw:gap-2 tw:sm:grid-cols-[1.2fr_60px_1.2fr_60px]">
            <Field label="CHARGEABLE WEIGHT" required layout="col" note={errorNote(errors.chargeableWeight)}>
              <Input required aria-invalid={Boolean(errors.chargeableWeight)} value={line.chargeableWeight} onBlur={formatOnBlur('chargeableWeight')}
                onChange={(event) => { edit({ chargeableWeight: decimal(event.target.value) }); clearError('chargeableWeight'); }} />
            </Field>
            <Field label="KG/LB" layout="col"><Input readOnly value={line.cwUnit} className={cn(AUTO_BOX, 'tw:text-center tw:text-[11px]')} /></Field>
            <Field label="RATE / CHARGE" required layout="col" className="tw:col-span-2">
              <Input value={line.rateCharge} onBlur={formatOnBlur('rateCharge')} onChange={(event) => edit({ rateCharge: decimal(event.target.value) })} className="tw:bg-[#fef9c3]" />
            </Field>
          </div>

          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-end">
            <Field label="TOTAL AMOUNT" layout="col" className="tw:sm:w-[170px]">
              <Input readOnly value={line.totalAmount} className={cn(AUTO_BOX, 'tw:text-right tw:text-[13px]')} />
            </Field>
            <div className="tw:flex tw:flex-col tw:gap-1 tw:pb-0.5">
              <label className="tw:flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:text-[10px] tw:font-bold tw:text-head">
                <Checkbox checked={line.rateAsAgreed} onCheckedChange={(checked) => edit({ rateAsAgreed: checked === true })} />
                RATE AS AGREED
              </label>
              <span className="tw:text-[10px] tw:text-muted-foreground">Prints &quot;AS AGREED&quot; on the AWB; the charges stay for accounting.</span>
            </div>
          </div>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-3">
          <Field label="NATURE AND QUALITY OF GOODS (GOODS DESCRIPTION)" required layout="col" labelClassName="tw:whitespace-normal" note={errorNote(errors.goodsDescription)}>
              <FWBTextArea value={line.goodsDescription} maxLines={11} maxCharsPerLine={20} required aria-invalid={Boolean(errors.goodsDescription)} className="tw:min-h-[80px]"
                onChange={(event) => { edit({ goodsDescription: event.target.value }); clearError('goodsDescription'); }} />
          </Field>

          <div className="tw:flex tw:flex-col tw:gap-1">
            {line.dimensions.map((dimension, index) => (
              <div key={index} className="tw:flex tw:flex-wrap tw:items-end tw:gap-1 tw:sm:flex-nowrap">
                {DIMENSION_FIELDS.map((field) => (
                  <Field key={field.key} label={index === 0 ? field.label : undefined} layout="col" className="tw:min-w-[60px] tw:flex-1">
                    <Input value={dimension[field.key]} onChange={(event) => editDimension(index, field.key, event.target.value.replace(field.pattern, ''))} />
                  </Field>
                ))}
                <Field label={index === 0 ? 'CM/IN' : undefined} layout="col" className="tw:w-[70px]">
                  <SelectBox className="tw:w-full" value={line.cmIn} onValueChange={(cmIn) => edit({ cmIn })} options={['CM', 'IN']} />
                </Field>
                <Field label={index === 0 ? 'NO. OF UNITS' : undefined} layout="col" className="tw:min-w-[60px] tw:flex-1">
                  <Input value={dimension.noOfUnits} onChange={(event) => editDimension(index, 'noOfUnits', digits(event.target.value))} />
                </Field>
                <div className="tw:flex tw:gap-1">
                  {index === line.dimensions.length - 1 && <Button variant="default" size="icon" aria-label="Add a dimension line" onClick={addDimension}><Plus /></Button>}
                  {line.dimensions.length > 1 && <Button variant="destructive" size="icon" aria-label="Remove this dimension line" onClick={() => removeDimension(index)}><Minus /></Button>}
                </div>
              </div>
            ))}
          </div>

          <div className="tw:grid tw:grid-cols-[2fr_1fr] tw:gap-2 tw:sm:grid-cols-[2fr_1fr_70px_1fr]">
            <Field label="VOLUME" layout="col"><Input readOnly value={line.volume ? `${line.volume} CBM` : ''} className={AUTO_BOX} /></Field>
            <Field label="MC" layout="col">
              <SelectBox className="tw:w-full" value={line.mc} onValueChange={(mc) => edit({ mc })} options={['MC', 'CC']} />
            </Field>
          </div>

          <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2 tw:sm:grid-cols-2">
            <Field label="HARMONISED COMMODITY CODE" layout="col">
              <Input value={line.harmonisedCode} onChange={(event) => edit({ harmonisedCode: event.target.value })} />
            </Field>
            <div className="tw:pb-1">
              <Button variant="link" onClick={() => setUldOpen((open) => !open)}>{uldShown ? (uldHasValue ? 'ULD details' : 'Hide ULD details') : '+ ULD details'}</Button>
            </div>
          </div>
          {uldShown && (
            <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:sm:grid-cols-4">
              {ULD_FIELDS.map((field) => (
                <Field key={field.key} label={field.label} layout="col">
                  <Input value={line[field.key]} placeholder={field.placeholder} onChange={(event) => edit({ [field.key]: event.target.value })} />
                </Field>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
