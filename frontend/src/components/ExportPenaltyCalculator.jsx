import { useEffect, useState } from 'react';
import { Calendar, ClipboardCheck, Clock, DollarSign, FileText, FileWarning, Ship, Warehouse } from 'lucide-react';
import { exportEntryApi } from './ExportEntry/exportEntryApi';
import { CalculatorModal, DateField, ExposureLine, ExposureTotal, InputGroup, NumberField } from './PenaltyCalculatorParts';
import { daysBetween, isAfter, toYmd } from './penaltyDates';

const policyFor = (isAir) => ({ groundRentFreeDays: isAir ? 2 : 7, detentionFreeDays: isAir ? 0 : 5 });
const LEO_FREE_DAYS = 3;
const LATE_LEO_PER_DAY = 1000;

const additionalDataOf = (job) => {
  let data = job.additionalData || job.extendedData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  return data && typeof data === 'object' ? data : {};
};

// ground rent (terminal demurrage) for the days at the port beyond the free days
function groundRentOf(dates, freeDays, mode) {
  if (!dates.gateInDate || !dates.sailingDate || !isAfter(dates.sailingDate, dates.gateInDate)) return { days: 0, amount: 0 };
  const days = Math.max(0, daysBetween(dates.gateInDate, dates.sailingDate) - freeDays);
  return { days, amount: days > 0 ? days * (mode === 'AIR' ? 1500 : 2500) : 0 };
}

// LEO more than 3 days after gate-in: Rs 1,000 a day after that
function lateLeoOf(dates) {
  if (!dates.gateInDate || !dates.leoDate || !isAfter(dates.leoDate, dates.gateInDate)) return { days: 0, amount: 0 };
  const days = daysBetween(dates.gateInDate, dates.leoDate);
  return { days, amount: days > LEO_FREE_DAYS ? (days - LEO_FREE_DAYS) * LATE_LEO_PER_DAY : 0 };
}

export default function ExportPenaltyCalculator({ isOpen, onClose, job }) {
  const [mode, setMode] = useState('SEA');
  const [activeJobRef, setActiveJobRef] = useState(job?.jobNo || 'No job selected');
  const [dates, setDates] = useState({ gateInDate: '', sbFilingDate: '', leoDate: '', sailingDate: '' });
  const [params, setParams] = useState({ ...policyFor(false), fobValue: 0 });

  // the job's own SB date / LEO date / FOB come from the record; the rest stays blank for the user to type
  useEffect(() => {
    if (!isOpen) return undefined;
    setActiveJobRef(job?.jobNo || 'No job selected');
    const isAir = String(job?.mode || '').toUpperCase() === 'AIR';
    setMode(isAir ? 'AIR' : 'SEA');
    setParams({ ...policyFor(isAir), fobValue: Math.round(parseFloat(job?.fobValue) || 0) });
    setDates({ gateInDate: toYmd(job?.gateInDate), sbFilingDate: toYmd(job?.sbDate), leoDate: toYmd(job?.leoDate), sailingDate: toYmd(job?.sailingDate) });
    if (!job?.jobNo) return undefined;
    let live = true;
    const loadJob = async () => {
      try {
        const result = await exportEntryApi.exportJobList();
        const jobs = (result && result.success && result.data) || (Array.isArray(result) ? result : []);
        const saved = jobs.find((row) => String(row.jobNo) === String(job.jobNo));
        if (!saved || !live) return;
        const extra = additionalDataOf(saved);
        const savedIsAir = String(saved.shipmentMode || saved.mode || '').toUpperCase() === 'AIR';
        setMode(savedIsAir ? 'AIR' : 'SEA');
        setParams((previous) => ({
          ...previous, ...policyFor(savedIsAir),
          fobValue: Math.round(parseFloat(saved.fobValue || saved.totalFob || extra.fobValue || extra.totalFobInr) || previous.fobValue || 0),
        }));
        setDates((previous) => ({
          gateInDate: previous.gateInDate || toYmd(saved.gateInDate || extra.gateInDate || extra.cargoArrivalDate),
          sbFilingDate: previous.sbFilingDate || toYmd(saved.sbDate || extra.sbDate),
          leoDate: previous.leoDate || toYmd(saved.leoDate || extra.leoDate),
          sailingDate: previous.sailingDate || toYmd(saved.sailingDate || extra.sailingDate || extra.egmDate),
        }));
      } catch {
        // the user types the dates
      }
    };
    loadJob();
    return () => { live = false; };
  }, [isOpen, job]);

  const changeDate = (event) => setDates((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const changeParam = (event) => setParams((previous) => ({ ...previous, [event.target.name]: Number(event.target.value) }));

  const groundRent = groundRentOf(dates, params.groundRentFreeDays, mode);
  const lateLeo = lateLeoOf(dates);
  const totalExposure = groundRent.amount + lateLeo.amount;
  const rupees = (amount) => amount.toLocaleString('en-IN');

  return (
    <CalculatorModal
      open={isOpen}
      onClose={onClose}
      title="EXPORT FINANCIAL RISK CALCULATOR"
      jobRef={activeJobRef}
      width={900}
      inputs={(
        <>
          <InputGroup icon={Calendar} title="LOGISTICS DATES">
            <DateField icon={Warehouse} label="GATE IN DATE" name="gateInDate" value={dates.gateInDate} onChange={changeDate} />
            <DateField icon={FileText} label="SB FILING DATE" name="sbFilingDate" value={dates.sbFilingDate} onChange={changeDate} />
            <DateField icon={ClipboardCheck} label="LEO DATE" name="leoDate" value={dates.leoDate} onChange={changeDate} />
            <DateField icon={Ship} label="SAILING / FLIGHT DATE" name="sailingDate" value={dates.sailingDate} onChange={changeDate} />
          </InputGroup>
          <InputGroup icon={Clock} title="POLICY & FREE DAYS">
            <NumberField icon={Warehouse} label="GROUND RENT FREE DAYS" name="groundRentFreeDays" value={params.groundRentFreeDays} onChange={changeParam} />
            <NumberField icon={DollarSign} label="FOB VALUE (₹)" name="fobValue" value={params.fobValue} onChange={changeParam} />
          </InputGroup>
        </>
      )}
      results={(
        <>
          <ExposureTotal amount={rupees(totalExposure)} tone="danger" />
          <ExposureLine icon={Warehouse} title="GROUND RENT (DEMURRAGE)" note={`${groundRent.days} BILLABLE DAYS`} amount={rupees(groundRent.amount)} tone="good" />
          <ExposureLine
            icon={FileWarning}
            title="LATE LEO PENALTY"
            note={`${lateLeo.days > LEO_FREE_DAYS ? lateLeo.days - LEO_FREE_DAYS : 0} LATE DAYS`}
            amount={rupees(lateLeo.amount)}
            tone="warn"
          />
        </>
      )}
    />
  );
}
