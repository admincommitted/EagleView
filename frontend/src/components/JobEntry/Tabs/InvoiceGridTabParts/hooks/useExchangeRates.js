import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { askText } from '@/components/common/askConfirm';
import { unitsOf } from '@/utils/cbicExchange';
import { useJobContext } from '../../../JobContext';
import { jobEntryApi } from '../../../jobEntryApi';
import { displayDay, exchangeRateRows, localDay, masterRateDate, rateText } from './exchangeRateData';
import { invoiceCurrencies, upperTrim } from './invoiceData';

const SAVE_DELAY_MS = 50;
const RATE_TOAST_MS = 6000;
const SAME_RATE_TOLERANCE = 1e-6;

const uniqueCurrencies = (invoices) => [...new Set(invoices.flatMap(invoiceCurrencies))];

export default function useExchangeRates({ invoices, invoiceFormData, onSave }) {
  const { jobData, setJobData, masters } = useJobContext();

  // A BE takes the CBIC rates in force on its BE date when it has one (filed earlier, keyed in now), else today's -
  // the day it is filed. The Currency master holds today's rates only, so the day's rates come from the notification history.
  const beDay = localDay(jobData.beDate);
  const rateDay = beDay || localDay(new Date());
  const rateDayLabel = beDay ? `on the BE date ${displayDay(rateDay)}` : `today (${displayDay(rateDay)})`;

  const [rateBook, setRateBook] = useState(null);
  useEffect(() => {
    let current = true;
    const loadRatesInForce = async () => {
      try {
        const book = await jobEntryApi.currenciesInForce(rateDay);
        if (current && book.success && book.rates?.length) setRateBook({ day: rateDay, source: book.source, rates: book.rates });
      } catch {
        // no history for that day: the Currency master is used
      }
    };
    loadRatesInForce();
    return () => { current = false; };
  }, [rateDay]);

  const masterFor = (currencyCode) =>
    (rateBook?.day === rateDay && rateBook.rates.find((rate) => upperTrim(rate.currencyCode) === currencyCode))
    || (masters.currencies || []).find((currency) => upperTrim(currency.currencyCode) === currencyCode);

  const rateInForce = (currencyCode, master) => {
    const units = unitsOf(currencyCode);
    return {
      currencyCode, rate: +(parseFloat(master.importRate) * units).toFixed(4), unitInRs: units,
      source: `${master.notificationNo ? `${master.notificationNo}, ` : ''}in force ${rateDayLabel}`,
    };
  };

  // the rate the invoice form shows: the job's row for the currency, else the one that is put on the job when the invoice is added
  const previewRateFor = (currencyValue) => {
    const currencyCode = upperTrim(currencyValue);
    const jobRow = exchangeRateRows(jobData).find((row) => upperTrim(row.currencyCode) === currencyCode) || null;
    if (jobRow || !currencyCode || currencyCode === 'INR') return jobRow;
    const master = masterFor(currencyCode);
    if (!master || !parseFloat(master.importRate)) return null;
    const preview = rateInForce(currencyCode, master);
    return { ...preview, effectiveDate: master.effectiveDate, source: `${preview.source} - put on the job when the invoice is added` };
  };

  // currencies on the invoices that have no exchange-rate row take the import rate in force; returns the job's rows
  const addMissingRates = (invoiceList) => {
    const jobRates = exchangeRateRows(jobData);
    const ratedCurrencies = new Set(jobRates.map((row) => upperTrim(row.currencyCode)));
    const currencies = uniqueCurrencies(invoiceList);
    const added = [];
    currencies.forEach((currencyCode) => {
      if (ratedCurrencies.has(currencyCode)) return;
      const master = masterFor(currencyCode);
      if (!master || !parseFloat(master.importRate)) return;
      const { source, ...rate } = rateInForce(currencyCode, master);
      added.push({ ...rate, standardCurrency: 'Y', effectiveDate: masterRateDate(master), source });
    });
    if (added.length) {
      setJobData((previous) => ({ ...previous, _exchangeRates: [...jobRates, ...added] }));
      toast(`Exchange rate in force ${rateDayLabel}: ${added.map(rateText).join(', ')} - check with "Update Exchange Rate"`, { duration: RATE_TOAST_MS });
    }
    const missing = currencies.filter((currencyCode) => !ratedCurrencies.has(currencyCode) && !added.some((row) => row.currencyCode === currencyCode));
    if (missing.length) toast.error(`No exchange rate for ${missing.join(', ')} - use "Update Exchange Rate"`);
    return [...jobRates, ...added];
  };

  const askRate = (currencyCode, units, master, suggested) => askText({
    title: `Exchange rate - ${currencyCode}`,
    message: `Customs exchange rate for ${currencyCode} (rupees per ${units} ${currencyCode})`,
    note: master?.importRate
      ? `CBIC rate in force ${rateDayLabel}: ${master.importRate} per 1${master.notificationNo ? ` (${master.notificationNo}, effective ${displayDay(masterRateDate(master))})` : ''}`
      : `No CBIC rate for ${currencyCode} in the Currency master.`,
    label: `Rupees per ${units} ${currencyCode}`,
    value: suggested,
    okLabel: 'Use this rate',
    check: (text) => (parseFloat(text) > 0 ? '' : 'Type a rate above 0'),
  });

  // one rate per currency used on the invoices (the invoice being typed counts too), saved as the job's rate rows
  const handleUpdateExchangeRate = async () => {
    const formHasCurrency = invoiceFormData && (invoiceFormData.currency || invoiceFormData.invoiceCurrency);
    const currencies = uniqueCurrencies(formHasCurrency ? [...invoices, invoiceFormData] : invoices);
    if (!currencies.length) { toast('All invoices are in INR - no exchange rate needed'); return; }
    let rows = exchangeRateRows(jobData).filter((row) => row?.currencyCode);
    for (const currencyCode of currencies) {
      const existing = rows.find((row) => upperTrim(row.currencyCode) === currencyCode);
      const master = masterFor(currencyCode);
      const units = existing ? (parseFloat(existing.unitInRs) || 1) : unitsOf(currencyCode);
      const suggested = existing ? existing.rate : (master?.importRate ? (parseFloat(master.importRate) * units).toFixed(4) : '');
      const answer = await askRate(currencyCode, units, master, suggested);
      if (answer === null) return;
      const rate = parseFloat(answer);
      if (!(rate > 0)) { toast.error(`Rate for ${currencyCode} is not a number - stopped`); return; }
      // the master's rate keeps the master's date, a re-typed same rate keeps its own date, any other rate is dated the rate day
      const sameAsMaster = master && Math.abs(rate - parseFloat(master.importRate) * units) < SAME_RATE_TOLERANCE;
      const sameAsBefore = existing && Math.abs(parseFloat(existing.rate) - rate) < SAME_RATE_TOLERANCE && existing.effectiveDate;
      const effectiveDate = sameAsMaster ? masterRateDate(master) : (sameAsBefore ? localDay(existing.effectiveDate) : rateDay);
      rows = rows.filter((row) => upperTrim(row.currencyCode) !== currencyCode).concat([{ currencyCode, rate, unitInRs: units, standardCurrency: 'Y', effectiveDate }]);
    }
    setJobData((previous) => ({ ...previous, _exchangeRates: rows }));
    if (onSave) setTimeout(() => onSave({ _exchangeRates: rows }), SAVE_DELAY_MS);
    toast.success(`Exchange rates saved: ${rows.map(rateText).join(', ')}`);
  };

  return { previewRateFor, addMissingRates, handleUpdateExchangeRate };
}
