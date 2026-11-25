import { useEffect, useState } from 'react';
import { Banknote, Calendar, ClipboardCheck, Clock, DollarSign, FileText, FileWarning, Package, Percent, Ship, Truck, Warehouse } from 'lucide-react';
import { jobEntryApi } from './JobEntry/jobEntryApi';
import { CalculatorModal, DateField, ExposureLine, ExposureTotal, InputGroup, NumberField } from './PenaltyCalculatorParts';
import { daysBetween, isAfter, toYmd } from './penaltyDates';

const BLANK_DATES = { dischargeDate: '', beFilingDate: '', assessmentDate: '', dutyPaymentDate: '', clearanceDate: '' };
const freeDaysFor = (isAir) => ({ demurrageFreeDays: isAir ? 2 : 5, detentionFreeDays: isAir ? 0 : 14 });
const jsonList = (value) => {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  return Array.isArray(parsed) ? parsed : [];
};

// days in slabs: [[days, rate per day], ...]; the last slab takes the remaining days
const slabCharge = (days, slabs) => {
  let rest = days;
  return slabs.reduce((sum, [slabDays, rate], index) => {
    const taken = index === slabs.length - 1 ? rest : Math.min(rest, slabDays);
    rest -= taken;
    return sum + taken * rate;
  }, 0);
};

// Late BE filing: Rs 5,000 a day for the first 3 days, Rs 10,000 a day after that
function lateBeFiling(dates) {
  if (!dates.dischargeDate || !dates.beFilingDate || !isAfter(dates.beFilingDate, dates.dischargeDate)) return { days: 0, amount: 0 };
  const days = Math.max(0, daysBetween(dates.dischargeDate, dates.beFilingDate) - 1);
  return { days, amount: days > 0 ? slabCharge(days, [[3, 5000], [Infinity, 10000]]) : 0 };
}

// interest on duty paid late: 15% a year
function dutyInterest(dates, dutyAmount) {
  if (!dates.assessmentDate || !dates.dutyPaymentDate || !isAfter(dates.dutyPaymentDate, dates.assessmentDate)) return { days: 0, amount: 0 };
  const days = Math.max(0, daysBetween(dates.assessmentDate, dates.dutyPaymentDate) - 1);
  return { days, amount: days > 0 ? Math.round((dutyAmount * 0.15 / 365) * days) : 0 };
}

const DEMURRAGE_SLABS = { SEA: [[3, 2500], [4, 4000], [Infinity, 7000]], AIR: [[2, 1500], [3, 3000], [Infinity, 6000]] };

function portCharge(dates, freeDays, slabs) {
  if (!dates.dischargeDate || !dates.clearanceDate || !isAfter(dates.clearanceDate, dates.dischargeDate)) return { days: 0, amount: 0 };
  const days = Math.max(0, daysBetween(dates.dischargeDate, dates.clearanceDate) - freeDays);
  return { days, amount: days > 0 ? slabCharge(days, slabs) : 0 };
}

export default function PenaltyCalculator({ isOpen, onClose, job }) {
  const [mode, setMode] = useState('SEA');
  const [activeJobRef, setActiveJobRef] = useState(job?.jobNo || 'No job selected');
  const [dates, setDates] = useState(BLANK_DATES);
  const [params, setParams] = useState({ dutyAmount: 0, ...freeDaysFor(false) });

  // reads the job (IGM inward / arrival date, BE date, duty estimate); what the job does not have stays blank for the
  // user to type - nothing is made up
  useEffect(() => {
    if (!isOpen) return undefined;
    setActiveJobRef(job?.jobNo || 'No job selected');
    const isAir = String(job?.mode || '').toUpperCase() === 'AIR';
    setMode(isAir ? 'AIR' : 'SEA');
    setParams({ dutyAmount: 0, ...freeDaysFor(isAir) });
    setDates(BLANK_DATES);
    if (!job?.jobNo) return undefined;
    let live = true;
    const loadJob = async () => {
      try {
        const result = await jobEntryApi.jobByNumber(job.jobNo);
        const saved = (result && result.success && result.data) || null;
        if (!saved || !live) return;
        const igm = jsonList(saved._igmRows)[0] || {};
        const savedIsAir = String(saved.shipmentMode || '').toUpperCase() === 'AIR';
        setMode(savedIsAir ? 'AIR' : 'SEA');
        setParams((previous) => ({ ...previous, ...freeDaysFor(savedIsAir), dutyAmount: Math.round(parseFloat(saved.totalDuty) || 0) }));
        setDates({
          dischargeDate: toYmd(igm.inwardDate || saved.inwardDate || igm.igmDate || saved.igmDate || saved.arrivalDate || saved.autoField_17),
          beFilingDate: toYmd(saved.beDate),
          assessmentDate: toYmd(saved.assessmentDate),
          dutyPaymentDate: toYmd(saved.dutyPaymentDate || saved.dutyPaidDate),
          clearanceDate: toYmd(saved.oocDate || saved.clearanceDate),
        });
      } catch {
        // the user types the dates
      }
    };
    loadJob();
    return () => { live = false; };
  }, [isOpen, job]);

  const changeDate = (event) => setDates((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const changeParam = (event) => setParams((previous) => ({ ...previous, [event.target.name]: Number(event.target.value) }));

  const beFiling = lateBeFiling(dates);
  const interest = dutyInterest(dates, params.dutyAmount);
  const demurrage = portCharge(dates, params.demurrageFreeDays, DEMURRAGE_SLABS[mode === 'SEA' ? 'SEA' : 'AIR']);
  const detention = portCharge(dates, params.detentionFreeDays, [[7, 4500], [Infinity, 9000]]);
  const totalRisk = beFiling.amount + interest.amount + demurrage.amount + detention.amount;
  const toneOf = (amount, riskTone) => (amount > 0 ? riskTone : 'good');

  return (
    <CalculatorModal
      open={isOpen}
      onClose={onClose}
      title="Advance Penalty Calculator"
      jobRef={activeJobRef}
      width={850}
      inputs={(
        <>
          <InputGroup icon={Calendar} title="Logistics Dates">
            <DateField icon={Ship} label="Discharge Date" name="dischargeDate" value={dates.dischargeDate} onChange={changeDate} />
            <DateField icon={FileText} label="BE Filing Date" name="beFilingDate" value={dates.beFilingDate} onChange={changeDate} />
            <DateField icon={ClipboardCheck} label="Assessment Date" name="assessmentDate" value={dates.assessmentDate} onChange={changeDate} />
            <DateField icon={Banknote} label="Duty Payment Date" name="dutyPaymentDate" value={dates.dutyPaymentDate} onChange={changeDate} />
            <DateField icon={Truck} label="Clearance / Gate Out Date" name="clearanceDate" value={dates.clearanceDate} onChange={changeDate} wide />
          </InputGroup>
          <InputGroup icon={Clock} title="Policy & Free Days">
            <NumberField icon={Warehouse} label="Demurrage Free Days" name="demurrageFreeDays" value={params.demurrageFreeDays} onChange={changeParam} />
            <NumberField icon={Package} label="Detention Free Days" name="detentionFreeDays" value={params.detentionFreeDays} onChange={changeParam} />
            <NumberField icon={DollarSign} label="Total Custom Duty (₹)" name="dutyAmount" value={params.dutyAmount} onChange={changeParam} wide className="tw:font-bold" />
          </InputGroup>
        </>
      )}
      results={(
        <>
          <ExposureTotal amount={totalRisk.toLocaleString()} tone={toneOf(totalRisk, 'danger')} />
          <ExposureLine icon={FileWarning} title="Late BE Filing" note={`${beFiling.days} days late`} amount={beFiling.amount.toLocaleString()} tone={toneOf(beFiling.amount, 'danger')} />
          <ExposureLine icon={Percent} title="Duty Interest" note={`${interest.days} days late`} amount={interest.amount.toLocaleString()} tone={toneOf(interest.amount, 'warn')} />
          <ExposureLine icon={Warehouse} title="Demurrage" note={`${demurrage.days} billable days`} amount={demurrage.amount.toLocaleString()} tone={toneOf(demurrage.amount, 'info')} />
          <ExposureLine icon={Package} title="Detention" note={`${detention.days} billable days`} amount={detention.amount.toLocaleString()} tone={toneOf(detention.amount, 'danger')} />
        </>
      )}
    />
  );
}
