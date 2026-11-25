import toast from 'react-hot-toast';
import askConfirm from '@/components/common/askConfirm';
import { useJobContext } from '../../../JobContext';
import { upperTrim } from './invoiceData';

const CUMULATIVE_CHARGES = [
  { jobField: 'cumulativeFreight', amountField: 'freightValue', currencyField: 'freightCurrency', rateField: 'freightRate', label: 'freight',
    appliesTo: (invoice) => !['CIF', 'CF', 'C&F', 'CFR'].includes(upperTrim(invoice.terms)) },
  { jobField: 'cumulativeInsurance', amountField: 'insuranceValue', currencyField: 'insuranceCurrency', rateField: 'insuranceRate', label: 'insurance',
    appliesTo: (invoice) => !['CIF', 'CI'].includes(upperTrim(invoice.terms)) },
  { jobField: 'cumulativeMiscCharge', amountField: 'miscCharges', currencyField: 'miscCurrency', rateField: 'miscChargesRate', label: 'misc',
    appliesTo: () => true },
];

const jobAmount = (value) => parseFloat(String(value ?? '').replace(/,/g, '')) || 0;
const invoiceValueOf = (invoice) => parseFloat(invoice.value || invoice.invoiceValue || 0) || 0;

// The job-level amounts are split over the invoices whose terms leave the charge to be declared, in proportion to
// the invoice value, in cents (the last invoice takes the rounding), and written into each invoice's own boxes.
const splitCumulativeCharges = (invoices, amounts, currency) => {
  const splitInvoices = invoices.map((invoice) => ({ ...invoice }));
  const notes = [];
  for (const charge of CUMULATIVE_CHARGES) {
    const amount = amounts[charge.jobField];
    if (!(amount > 0)) continue;
    const takers = splitInvoices.filter((invoice) => invoiceValueOf(invoice) > 0 && charge.appliesTo(invoice));
    const takersValue = takers.reduce((sum, invoice) => sum + invoiceValueOf(invoice), 0);
    if (!takers.length || !(takersValue > 0)) { notes.push(`${charge.amountField}: no invoice takes it (terms)`); continue; }
    let centsLeft = Math.round(amount * 100);
    takers.forEach((invoice, position) => {
      const shareCents = position === takers.length - 1 ? centsLeft : Math.round(amount * 100 * invoiceValueOf(invoice) / takersValue);
      centsLeft -= shareCents;
      invoice[charge.amountField] = (shareCents / 100).toFixed(2);
      invoice[charge.currencyField] = currency;
      invoice[charge.rateField] = '';
    });
    notes.push(`${charge.label} ${amount.toFixed(2)} ${currency} over ${takers.length} invoice(s)`);
  }
  return { splitInvoices, notes };
};

export default function useCumulativeCharges({ invoices, commitInvoices }) {
  const { jobData } = useJobContext();

  const handleApplyCumulative = async () => {
    const amounts = Object.fromEntries(CUMULATIVE_CHARGES.map((charge) => [charge.jobField, jobAmount(jobData[charge.jobField])]));
    if (!Object.values(amounts).some((amount) => amount > 0)) { toast.error('Enter the cumulative freight / insurance / misc amount first'); return; }
    if (!invoices.length) { toast.error('No invoices on this job yet'); return; }
    const totalValue = invoices.reduce((sum, invoice) => sum + invoiceValueOf(invoice), 0);
    if (!(totalValue > 0)) { toast.error('The invoices have no value yet - the split is by invoice value'); return; }
    const currencies = [...new Set(invoices.map((invoice) => upperTrim(invoice.currency || invoice.invoiceCurrency)).filter(Boolean))];
    if (currencies.length !== 1) { toast.error(`The invoices use different currencies (${currencies.join(', ')}) - enter freight / insurance per invoice`); return; }

    const { splitInvoices, notes } = splitCumulativeCharges(invoices, amounts, currencies[0]);
    const confirmed = await askConfirm({
      title: 'Split the cumulative charges?',
      message: notes.join('\n'),
      note: 'The share of each invoice is worked out by invoice value and written into it.',
      okLabel: 'Split',
      cancelLabel: 'Do nothing',
    });
    if (!confirmed) return;
    commitInvoices(splitInvoices);
    toast.success('Cumulative charges written into the invoices - check them, then save the job');
  };

  return { handleApplyCumulative };
}
