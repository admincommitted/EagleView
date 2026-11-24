import React, { useState, useEffect } from 'react';
import { volWtFromDims, cbmFromDims, chargeableOf, unitKL } from '../awb/weightCalc';
import FWBTextArea from '../../FWBTextArea';
import { askConfirm } from '../../common/askConfirm';

export default function RateLineModal({ isOpen, onClose, onSave, initialData, densityGroup }) {
  const [noOfPcs, setNoOfPcs] = useState('');
  const [slac, setSlac] = useState('');
  const [rcp, setRcp] = useState('');
  const [rateClassCode, setRateClassCode] = useState('SELECT');
  const [rateClassPercentage, setRateClassPercentage] = useState('');
  const [commodityItemNumber, setCommodityItemNumber] = useState('');

  const [grossWeight, setGrossWeight] = useState('');
  const [gwUnit, setGwUnit] = useState('KG');

  const [chargeableWeight, setChargeableWeight] = useState('');
  const [cwUnit, setCwUnit] = useState('KG');

  const [rateCharge, setRateCharge] = useState('');
  const [rateAsAgreed, setRateAsAgreed] = useState(false);

  const [goodsDescription, setGoodsDescription] = useState('');

  const [dimensions, setDimensions] = useState([{ length: '', width: '', height: '', noOfUnits: '' }]);
  const [cmIn, setCmIn] = useState('CM');
  const [mc, setMc] = useState('MC');

  const [uldType, setUldType] = useState('');
  const [uldSerial, setUldSerial] = useState('');
  const [uldOwner, setUldOwner] = useState('');
  const [uldRateClass, setUldRateClass] = useState('');
  const [harmonisedCode, setHarmonisedCode] = useState('');

  // Derived state
  const [volume, setVolume] = useState('');
  const [volumetricWeight, setVolumetricWeight] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  // Validation errors
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      if (initialData) {
        setNoOfPcs(initialData.noOfPcs || initialData.pieces || '');
        setSlac(initialData.slac || '');
        setRcp(initialData.rcp || '');

        let rcc = initialData.rateClassCode || initialData.rateClass || 'SELECT';
        if (rcc === 'M') rcc = 'M - MINIMUM CHARGE';
        else if (rcc === 'N') rcc = 'N - NORMAL RATE';
        else if (rcc === 'Q') rcc = 'Q - QUANTITY RATE';
        else if (rcc === 'B') rcc = 'B - BASIC CHARGE';
        else if (rcc === 'K') rcc = 'K - RATE PER KILOGRAM';
        setRateClassCode(rcc);

        setRateClassPercentage(initialData.rateClassPercentage || '');
        setCommodityItemNumber(initialData.commodityItemNumber || initialData.commodityItemNo || '');
        setGrossWeight(initialData.grossWeight || '');
        setGwUnit(unitKL(initialData.gwUnit) === 'L' ? 'LB' : 'KG'); // the grid keeps K / L
        setVolumetricWeight(initialData.volumetricWeight || ''); setVolume(initialData.volume || '');
        setChargeableWeight(initialData.chargeableWeight || '');
        setCwUnit(unitKL(initialData.gwUnit || initialData.cwUnit) === 'L' ? 'LB' : 'KG');
        setRateCharge(initialData.rateCharge || '');
        setRateAsAgreed(initialData.rateAsAgreed || false);
        setGoodsDescription(initialData.goodsDescription || initialData.natureOfGoods || '');
        setDimensions(initialData.dimensions && initialData.dimensions.length > 0 ? initialData.dimensions : [{ length: initialData.length || '', width: initialData.width || '', height: initialData.height || '', noOfUnits: initialData.noOfUnits || '' }]);
        setCmIn(initialData.cmIn || 'CM');
        setMc(initialData.mc || 'MC');
        setUldType(initialData.uldType || '');
        setUldSerial(initialData.uldSerial || '');
        setUldOwner(initialData.uldOwner || '');
        setUldRateClass(initialData.uldRateClass || '');
        setHarmonisedCode(initialData.harmonisedCode || '');
      } else {
        setNoOfPcs(''); setSlac(''); setRcp(''); setRateClassCode('SELECT');
        setRateClassPercentage(''); setCommodityItemNumber('');
        setGrossWeight(''); setGwUnit('KG'); setChargeableWeight(''); setCwUnit('KG');
        setRateCharge(''); setRateAsAgreed(false); setGoodsDescription('');
        // 29-Oct-2026: setLength / setWidth / setHeight / setNoOfUnits do not exist here (ReferenceError when a new
        // rate line was opened); the dimension lines are one list
        setDimensions([{ length: '', width: '', height: '', noOfUnits: '' }]); setCmIn('CM'); setMc('MC');
        setVolume(''); setVolumetricWeight(''); setTotalAmount('');
        setUldType(''); setUldSerial(''); setUldOwner(''); setUldRateClass(''); setHarmonisedCode('');
      }
    }
  }, [isOpen]);

  // CALCULATION (29-Oct-2026, weightCalc.js): volume and volumetric weight from the dimension lines with the AWB's ratio
  // (IATA 1:6 = 6000 cm3 per kg; was volume x 167); chargeable weight = higher of gross and volumetric weight rounded
  // up to the next 0.5 kg / whole lb, in the unit of the gross weight (an LB gross was turned into KG). It is worked out
  // only after a change in this window - opening a saved line no longer overwrites its chargeable weight.
  const touched = React.useRef(false);
  useEffect(() => { if (isOpen) touched.current = false; }, [isOpen]);
  useEffect(() => {
    const dimsCm = dimensions.map(d => ({ length: d.length, width: d.width, height: d.height, pieces: d.noOfUnits, unit: cmIn === 'IN' ? 'INCH' : 'CM' }))
      .filter(d => parseFloat(d.length) > 0 && parseFloat(d.width) > 0 && parseFloat(d.height) > 0 && parseFloat(d.pieces) > 0);
    let vw = 0;
    if (dimsCm.length) {
      vw = volWtFromDims(dimsCm, densityGroup);
      setVolume(cbmFromDims(dimsCm).toFixed(3));
      setVolumetricWeight(vw.toFixed(2));
    } else {
      vw = parseFloat(volumetricWeight) || 0; // from the grid / Dimension window
      if (touched.current) setVolume('');
    }
    setCwUnit(gwUnit === 'LB' ? 'LB' : 'KG');
    if (!touched.current) return;
    const c = chargeableOf(grossWeight, vw, gwUnit === 'LB' ? 'L' : 'K', true);
    setChargeableWeight(c ? c.toFixed(2) : '');
  }, [dimensions, cmIn, grossWeight, gwUnit]); // eslint-disable-line

  // ─── CALCULATION: Total Amount ──────────────────────────────────────────────
  useEffect(() => {
    const cw = parseFloat(chargeableWeight) || 0;
    const rc = parseFloat(rateCharge) || 0;
    if (rc > 0 && /^(M|B)/.test(String(rateClassCode || ''))) {
      setTotalAmount(rc.toFixed(2)); // minimum / basic charge: the charge itself
    } else if (cw > 0 && rc > 0) {
      setTotalAmount((cw * rc).toFixed(2));
    } else {
      setTotalAmount('');
    }
  }, [chargeableWeight, rateCharge, rateClassCode]);

  const [uldOpen, setUldOpen] = useState(false);
  // 22-Nov-2026: the units of the dimension lines should add up to the pieces of the line. When they differ the
  // window says so and Add asks first in a question window (not every piece is always measured).
  const pcsN = Number(noOfPcs) || 0;
  const unitsSum = dimensions.filter(d => parseFloat(d.length) > 0 && parseFloat(d.width) > 0 && parseFloat(d.height) > 0).reduce((n, d) => n + (parseInt(d.noOfUnits, 10) || 0), 0);
  const unitsDiffer = pcsN > 0 && unitsSum > 0 && unitsSum !== pcsN;
  // Rate class suggestion from what is typed: a commodity item number -> C; a class percentage -> R (under 100) or
  // S (over 100); otherwise N under 45 kg (100 lb) chargeable weight and Q from there. Only a hint - "Use" picks it.
  const RC_NAMES = { N: 'N - NORMAL RATE', Q: 'Q - QUANTITY RATE', C: 'C - SPECIFIC COMMODITY RATE', R: 'R - CLASS RATE REDUCTION', S: 'S - CLASS RATE SURCHARGE' };
  const rcSuggest = (() => {
    const cwN = parseFloat(chargeableWeight) || 0;
    const pct = parseFloat(String(rateClassPercentage || '').replace(/[^0-9.]/g, '')) || 0;
    const lim = gwUnit === 'LB' ? 100 : 45;
    const u = gwUnit === 'LB' ? 'lb' : 'kg';
    if (String(commodityItemNumber || '').trim()) return { code: 'C', why: 'a commodity item number is filled' };
    if (pct > 0 && pct < 100) return { code: 'R', why: 'the class percentage ' + pct + ' is under 100' };
    if (pct > 100) return { code: 'S', why: 'the class percentage ' + pct + ' is over 100' };
    if (cwN > 0) return cwN < lim ? { code: 'N', why: 'chargeable weight ' + cwN + ' ' + u + ' is under ' + lim + ' ' + u } : { code: 'Q', why: 'chargeable weight ' + cwN + ' ' + u + ' is ' + lim + ' ' + u + ' or more' };
    return null;
  })();
  const rcNow = String(rateClassCode || '').charAt(0);
  const rcFlat = /^(M|B)/.test(String(rateClassCode || ''));
  if (!isOpen) return null;

  // ─── VALIDATION ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!noOfPcs || isNaN(Number(noOfPcs)) || Number(noOfPcs) <= 0) {
      errs.noOfPcs = 'No. of Pieces is required';
    }
    if (!grossWeight || isNaN(parseFloat(grossWeight)) || parseFloat(grossWeight) <= 0) {
      errs.grossWeight = 'Gross Weight is required';
    }
    if (!chargeableWeight || isNaN(parseFloat(chargeableWeight)) || parseFloat(chargeableWeight) <= 0) {
      errs.chargeableWeight = 'Chargeable Weight is required';
    }
    if (!goodsDescription || goodsDescription.trim() === '') {
      errs.goodsDescription = 'Goods Description is required';
    }
    return errs;
  };

  const clearError = (field) => {
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  };

  const handleClear = () => {
    setErrors({});
    setNoOfPcs(''); setSlac(''); setRcp(''); setRateClassCode('SELECT'); setRateClassPercentage(''); setCommodityItemNumber('');
    setGrossWeight(''); setGwUnit('KG'); setChargeableWeight(''); setCwUnit('KG'); setRateCharge(''); setRateAsAgreed(false);
    setGoodsDescription(''); setDimensions([{ length: '', width: '', height: '', noOfUnits: '' }]); setCmIn('CM'); setMc('MC');
    setUldType(''); setUldSerial(''); setUldOwner(''); setUldRateClass(''); setHarmonisedCode('');
  };

  const handleAdd = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return; // Stop — show inline errors
    }
    if (unitsDiffer) {
      const go = await askConfirm({ title: 'Pieces and dimension units do not match', message: 'No. of pieces is ' + pcsN + ', but the dimension lines add up to ' + unitsSum + ' units.', note: 'The volume and the volumetric weight are worked out for ' + unitsSum + ' units; the AWB will show ' + pcsN + ' pieces.', okLabel: 'Add anyway', cancelLabel: 'Go back and correct' });
      if (!go) return;
    }
    // 11-Nov-2026: a volumetric / chargeable weight far above the gross weight is almost always a typing slip in the
    // dimensions (mm for cm) or a CBM figure taken as kg - ask before it goes on the AWB
    { const g = parseFloat(grossWeight) || 0, cw = parseFloat(chargeableWeight) || 0;
      if (g > 0 && cw > g * 30 && !(await askConfirm({ title: 'Chargeable weight looks too high', message: 'Chargeable weight ' + cw + ' kg is ' + Math.round(cw / g) + ' times the gross weight ' + g + ' kg.', note: 'Check the dimensions (cm / inch) and the number of units.', okLabel: 'Add anyway', cancelLabel: 'Go back and check' }))) return; }

    // 11-Nov-2026: no class chosen - the grid / print / FWB showed Q while the line was saved without a class and VALIDATE
    // said "rate class missing". Now: N (normal rate) under 45 kg / 100 lb chargeable, Q (quantity rate) from there.
    const rcPicked = rateClassCode && rateClassCode !== 'SELECT' ? rateClassCode : ((parseFloat(chargeableWeight) || 0) < (gwUnit === 'LB' ? 100 : 45) ? 'N' : 'Q');
    if (onSave) {
      onSave({
        pieces: noOfPcs, noOfPcs, slac, rcp,
        rateClass: rcPicked.charAt(0),
        // 11-Nov-2026: the grid's rate class list has the letter only (Q / M / N / B / K) - "N - NORMAL RATE" showed as Q there
        rateClassCode: rcPicked.charAt(0), rateClassPercentage,
        commodityItemNo: commodityItemNumber, commodityItemNumber,
        grossWeight, gwUnit: gwUnit === 'LB' ? 'L' : 'K', volumetricWeight, chargeableWeight, cwUnit: gwUnit === 'LB' ? 'L' : 'K', cwManual: true,
        rateCharge, total: totalAmount, totalAmount, rateAsAgreed,
        natureOfGoods: goodsDescription, goodsDescription,
        dimensions, cmIn, volume, mc, length: dimensions[0]?.length, width: dimensions[0]?.width, height: dimensions[0]?.height, noOfUnits: dimensions[0]?.noOfUnits,
        uldType, uldSerial, uldOwner, uldRateClass, harmonisedCode
      });
    }
    onClose();
  };

  // Shared input style helpers
  const inputStyle = (field) => ({
    width: '100%', padding: '4px 8px', fontSize: '12px', outline: 'none', borderRadius: '6px',
    border: `1px solid ${errors[field] ? '#ef4444' : '#64748b'}`,
    backgroundColor: errors[field] ? '#fef2f2' : 'var(--bg-app, #f8fafc)',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  });

  const mandatoryStyle = (field) => ({
    ...inputStyle(field),
    border: `1px solid ${errors[field] ? '#ef4444' : '#ef4444'}`,
    backgroundColor: errors[field] ? '#fef2f2' : '#fef2f2',
  });

  const autoStyle = {
    width: '100%', padding: '4px 8px', fontSize: '12px', outline: 'none', borderRadius: '6px',
    border: '1px solid #94a3b8', backgroundColor: '#e0f2fe', fontWeight: 'bold', cursor: 'not-allowed',
  };

  const ErrorMsg = ({ field }) => errors[field]
    ? <span className="field-error-msg">{errors[field]}</span>
    : null;

  const uldHasValue = [uldType, uldSerial, uldOwner, uldRateClass].some(v => String(v || '').trim() !== '');
  const uldShown = uldOpen || uldHasValue;
  return (
    <div onChangeCapture={() => { touched.current = true; }}
      className="modal-backdrop"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-box"
        style={{ backgroundColor: 'var(--bg-panel, #ffffff)', borderRadius: '3px', width: '920px', boxShadow: '0 12px 32px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ backgroundColor: 'var(--primary-color-start, #0284c7)', color: '#fff', padding: '3px 8px 3px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: '12px' }}>
          <span>Add / edit rate line</span>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', borderRadius: '2px', width: '22px', height: '22px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >✖</button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Row 1: PCS / SLAC / RCP */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>NO. OF PCS <span style={{ color: '#dc2626' }}>*</span></span>
                <input
                  type="text" value={noOfPcs}
                  onChange={e => { setNoOfPcs(e.target.value.replace(/[^0-9]/g, '')); clearError('noOfPcs'); }}
                  className="premium-input" style={mandatoryStyle('noOfPcs')}
                />
                <ErrorMsg field="noOfPcs" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>SLAC</span>
                <input type="text" value={slac} onChange={e => setSlac(e.target.value.replace(/[^0-9]/g, ''))} className="premium-input" style={inputStyle()} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>RCP</span>
                <input type="text" value={rcp} onChange={e => setRcp(e.target.value)} className="premium-input" style={inputStyle()} />
              </div>
            </div>

            {/* Rate Class Code */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>RATE CLASS CODE <span style={{ color: '#dc2626' }}>*</span></span>
              <select value={rateClassCode} onChange={e => setRateClassCode(e.target.value)} className="premium-input" style={inputStyle()}>
                <option>SELECT</option>
                <option>M - MINIMUM CHARGE</option>
                <option>N - NORMAL RATE</option>
                <option>Q - QUANTITY RATE</option>
                <option>B - BASIC CHARGE</option>
                <option>K - RATE PER KILOGRAM</option>
                <option>C - SPECIFIC COMMODITY RATE</option>
                <option>R - CLASS RATE REDUCTION</option>
                <option>S - CLASS RATE SURCHARGE</option>
              </select>
              {rcSuggest && rcNow !== rcSuggest.code && (
                <span className="rl-rc-hint" style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'none' }}>
                  Suggested: <b style={{ color: '#0f172a' }}>{RC_NAMES[rcSuggest.code]}</b> - {rcSuggest.why}.{' '}
                  <button type="button" onClick={() => setRateClassCode(RC_NAMES[rcSuggest.code])} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '10.5px', fontWeight: 700, color: 'var(--theme-base, #0284c7)' }}>Use</button>
                </span>
              )}
              {!rcSuggest && rateClassCode === 'SELECT' && <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'none' }}>Not chosen: N under 45 kg, Q from 45 kg</span>}
              {rcFlat && <span className="rl-rc-flat" style={{ fontSize: '10.5px', color: '#b45309', textTransform: 'none' }}>With {rcNow} the Rate / Charge box is the whole charge - it is not multiplied by the weight.</span>}
            </div>

            {/* Rate Class % / Commodity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>RATE CLASS PERCENTAGE</span>
                <input type="text" value={rateClassPercentage} onChange={e => setRateClassPercentage(e.target.value)} placeholder="EG: [N70]" className="premium-input" style={inputStyle()} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>COMMODITY ITEM NUMBER</span>
                <input type="text" value={commodityItemNumber} onChange={e => setCommodityItemNumber(e.target.value)} className="premium-input" style={inputStyle()} />
              </div>
            </div>

            {/* Gross Weight / VW */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 60px 1.2fr 60px', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>GROSS WEIGHT <span style={{ color: '#dc2626' }}>*</span></span>
                <input
                  type="text" value={grossWeight}
                  onChange={e => { setGrossWeight(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '')); clearError('grossWeight'); }}
                  onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setGrossWeight(parseFloat(e.target.value).toFixed(2))}
                  className="premium-input" style={mandatoryStyle('grossWeight')}
                />
                <ErrorMsg field="grossWeight" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>KG/LB</span>
                <select value={gwUnit} onChange={e => setGwUnit(e.target.value)} className="premium-input" style={inputStyle()}>
                  <option>KG</option>
                  <option>LB</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>VOLUMETRIC WEIGHT</span>
                <input type="text" value={volumetricWeight} disabled className="premium-input" style={autoStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>KG/LB</span>
                <input type="text" value="KG" disabled className="premium-input" style={{ ...autoStyle, textAlign: 'center', fontSize: '11px' }} />
              </div>
            </div>

            {/* Chargeable Weight / Rate */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 60px 1.2fr 60px', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>CHARGEABLE WEIGHT <span style={{ color: '#dc2626' }}>*</span></span>
                <input
                  type="text" value={chargeableWeight}
                  onChange={e => { setChargeableWeight(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '')); clearError('chargeableWeight'); }}
                  onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setChargeableWeight(parseFloat(e.target.value).toFixed(2))}
                  className="premium-input" style={mandatoryStyle('chargeableWeight')}
                />
                <ErrorMsg field="chargeableWeight" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>KG/LB</span>
                <input type="text" value={cwUnit} disabled className="premium-input" style={{ ...autoStyle, textAlign: 'center', fontSize: '11px' }} />
              </div>
              <div style={{ gridColumn: '3 / 5', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>RATE / CHARGE <span style={{ color: '#dc2626' }}>*</span></span>
                <input
                  type="text" value={rateCharge}
                  onChange={e => setRateCharge(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, ''))}
                  onBlur={e => e.target.value && !isNaN(parseFloat(e.target.value)) && setRateCharge(parseFloat(e.target.value).toFixed(2))}
                  className="premium-input"
                  style={{ width: '100%', padding: '4px 8px', fontSize: '12px', outline: 'none', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#fef9c3', transition: 'border-color 0.15s' }}
                />
              </div>
            </div>

            {/* Total Amount / Rate As Agreed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 60px 1fr', gap: '8px', alignItems: 'end' }}>
              <div style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '170px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>TOTAL AMOUNT</span>
                <input type="text" value={totalAmount} disabled className="premium-input" style={{ ...autoStyle, fontSize: '13px', textAlign: 'right', fontWeight: 700 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={rateAsAgreed} onChange={e => setRateAsAgreed(e.target.checked)} style={{ cursor: 'pointer', width: '14px', height: '14px' }} />
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0369a1' }}>RATE AS AGREED</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', textTransform: 'none' }}>Prints "AS AGREED" on the AWB; the charges stay for accounting.</span>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Goods Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>
                NATURE AND QUALITY OF GOODS (GOODS DESCRIPTION) <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <FWBTextArea
                value={goodsDescription}
                onChange={e => { setGoodsDescription(e.target.value); clearError('goodsDescription'); }}
                maxLines={11} maxCharsPerLine={20}
                className="premium-input"
                style={{ width: '100%', minHeight: '80px', padding: '6px 10px', fontSize: '12px', outline: 'none', borderRadius: '6px', resize: 'vertical', border: `1px solid ${errors.goodsDescription ? '#ef4444' : '#ef4444'}`, backgroundColor: errors.goodsDescription ? '#fef2f2' : '#fef2f2' }}
              />
              <ErrorMsg field="goodsDescription" />
            </div>

            {/* L / W / H / Units Dynamic List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {dimensions.map((dim, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    {idx === 0 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>LENGTH</span>}
                    <input type="text" value={dim.length} onChange={e => { const newDims = [...dimensions]; newDims[idx].length = e.target.value.replace(/[^0-9.]/g, ''); setDimensions(newDims); }} className="premium-input" style={inputStyle()} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    {idx === 0 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>WIDTH</span>}
                    <input type="text" value={dim.width} onChange={e => { const newDims = [...dimensions]; newDims[idx].width = e.target.value.replace(/[^0-9.]/g, ''); setDimensions(newDims); }} className="premium-input" style={inputStyle()} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    {idx === 0 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>HEIGHT</span>}
                    <input type="text" value={dim.height} onChange={e => { const newDims = [...dimensions]; newDims[idx].height = e.target.value.replace(/[^0-9.]/g, ''); setDimensions(newDims); }} className="premium-input" style={inputStyle()} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '70px' }}>
                    {idx === 0 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>CM/IN</span>}
                    <select value={cmIn} onChange={e => setCmIn(e.target.value)} className="premium-input" style={inputStyle()}>
                      <option>CM</option>
                      <option>IN</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    {idx === 0 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>NO. OF UNITS</span>}
                    <input type="text" value={dim.noOfUnits} onChange={e => { const newDims = [...dimensions]; newDims[idx].noOfUnits = e.target.value.replace(/[^0-9]/g, ''); setDimensions(newDims); }} className="premium-input" style={inputStyle()} />
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '1px' }}>
                    {idx === dimensions.length - 1 && (
                      <button type="button" onClick={() => setDimensions([...dimensions, { length: '', width: '', height: '', noOfUnits: '' }])} style={{ padding: '4px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                    )}
                    {dimensions.length > 1 && (
                      <button type="button" onClick={() => { const newDims = [...dimensions]; newDims.splice(idx, 1); setDimensions(newDims); }} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Volume / MC */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 70px 1fr', gap: '8px' }}>
              <div style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>VOLUME</span>
                <input type="text" value={volume ? `${volume} CBM` : ''} disabled className="premium-input" style={autoStyle} />
              </div>
              <div style={{ gridColumn: '3 / 4', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>MC</span>
                <select value={mc} onChange={e => setMc(e.target.value)} className="premium-input" style={inputStyle()}>
                  <option>MC</option>
                  <option>CC</option>
                </select>
              </div>
            </div>

            {/* 22-Nov-2026: Harmonised code stays open; the four ULD boxes open with "+ ULD details" (or by themselves when one has a value) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>HARMONISED COMMODITY CODE</span>
                <input type="text" value={harmonisedCode} onChange={e => setHarmonisedCode(e.target.value)} className="premium-input" style={inputStyle()} />
              </div>
              <div style={{ paddingBottom: '4px' }}>
                <button type="button" onClick={() => setUldOpen(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--theme-base, #0284c7)' }}>{uldShown ? (uldHasValue ? 'ULD details' : 'Hide ULD details') : '+ ULD details'}</button>
              </div>
            </div>
            {uldShown && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
              {[
                { label: 'ULD TYPE',         val: uldType,      set: setUldType,      ph: 'EG: [AKE]'  },
                { label: 'ULD SERIAL NO',    val: uldSerial,    set: setUldSerial,    ph: 'EG: [A8983]' },
                { label: 'ULD OWNER CODE',   val: uldOwner,     set: setUldOwner,     ph: 'EG: [XB]'   },
                { label: 'ULD RATE CLASS',   val: uldRateClass, set: setUldRateClass, ph: ''   },
              ].map(({ label, val, set, ph }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap' }}>{label}</span>
                  <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph} className="premium-input" style={inputStyle()} />
                </div>
              ))}
            </div>
            )}

          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '6px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          {/* Error summary if any */}
          {Object.keys(errors).length > 0 && (
            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
              ⚠ {Object.keys(errors).length} required field{Object.keys(errors).length > 1 ? 's' : ''} missing
            </span>
          )}
          {Object.keys(errors).length === 0 && unitsDiffer && (
            <span className="rl-units-warn" style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'none' }}>
              &#9888; Pieces {pcsN}, dimension units {unitsSum} - they do not match.
            </span>
          )}
          {Object.keys(errors).length === 0 && !unitsDiffer && <span />}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleClear}
              style={{ padding: '0 12px', height: '24px', border: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: '#fff', color: '#dc2626', fontWeight: 600, fontSize: '11px', borderRadius: '2px' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >CLEAR</button>
            <button
              onClick={handleAdd}
              style={{ padding: '0 18px', height: '24px', border: 'none', borderRadius: '2px', cursor: 'pointer', backgroundColor: 'var(--primary-color-start, #2563eb)', color: '#fff', fontWeight: 600, fontSize: '11px' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--primary-color-end, #1d4ed8)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary-color-start, #2563eb)'; }}
            >ADD</button>
          </div>
        </div>

      </div>
    </div>
  );
}


