import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DateInput, Field, Input, Modal, Textarea } from '@/components/ui';
import { salesCrmApi } from './SalesParts/salesApi';
import ChargeLinesTable from './SalesCrmParts/ChargeLinesTable';
import ProfitabilityPanel from './SalesCrmParts/ProfitabilityPanel';
import SaveErrors from './SalesCrmParts/SaveErrors';
import { emailQuotation, quotationEmailText } from './SalesCrmParts/quoteEmail';
import { isInr, quoteTotals, toNumber } from './SalesCrmParts/quoteMath';
import { showSaveFailure } from './SalesCrmParts/saveFailure';

const VALID_DAYS = 15;

const blankLine = (id) => ({ id, head: '', buyRate: '', sellRate: '', currency: 'INR', roe: 1, qty: 1, basis: 'Flat', remarks: '' });

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function startingForm(quote, lead) {
  if (quote) {
    return {
      quoteNo: quote.quoteNo,
      date: quote.date,
      validUntil: quote.validUntil || '',
      clientName: quote.clientName,
      contactPerson: quote.contactPerson || '',
      email: quote.email || '',
      origin: quote.origin || '',
      destination: quote.destination || '',
      mode: quote.mode || '',
      commodity: quote.commodity || '',
      remarks: quote.remarks || '',
    };
  }
  return {
    quoteNo: '',
    date: new Date().toISOString().split('T')[0],
    validUntil: daysFromToday(VALID_DAYS),
    clientName: lead?.clientName || '',
    contactPerson: lead?.contactPerson || '',
    email: lead?.email || '',
    origin: lead?.origin || '',
    destination: lead?.destination || '',
    mode: lead?.serviceType || lead?.mode || '',
    commodity: lead?.commodity || '',
    remarks: '',
  };
}

function startingLines(quote) {
  if (!quote?.charges?.length) return [blankLine(1)];
  return quote.charges.map((charge) => ({
    id: charge.id, head: charge.head, buyRate: charge.buyRate, sellRate: charge.sellRate,
    currency: charge.currency, roe: charge.roe, qty: charge.qty, basis: charge.basis || '', remarks: charge.remarks || '',
  }));
}

export default function AdvancedQuoteForm({ onClose, onSaved, lead, quote }) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [rates, setRates] = useState([]);
  const [ratesNote, setRatesNote] = useState('');
  const [form, setForm] = useState(() => startingForm(quote, lead));
  const [chargeLines, setChargeLines] = useState(() => startingLines(quote));

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const textProps = (name) => ({ value: form[name], onChange: (event) => setField(name, event.target.value) });

  useEffect(() => {
    const loadLists = async () => {
      // the server fills the number in when this fails
      const [rateList, nextNo] = await Promise.allSettled([salesCrmApi.rates(), quote ? null : salesCrmApi.nextQuoteNo()]);
      const rateAnswer = rateList.status === 'fulfilled' ? rateList.value : {};
      setRates(rateAnswer.data || []);
      setRatesNote(rateAnswer.note || '');
      if (nextNo.status === 'fulfilled' && nextNo.value?.quoteNo) setField('quoteNo', nextNo.value.quoteNo);
    };
    loadLists();
  }, [quote]);

  // null means no rate on file, which the user has to resolve
  const rateOf = (code) => {
    if (isInr(code)) return 1;
    const rate = rates.find((candidate) => candidate.code === String(code).toUpperCase());
    return rate && rate.roe > 0 ? rate.roe : null;
  };

  const changeLine = (index, patch) => {
    setChargeLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const changed = { ...line, ...patch };
      if (patch.currency !== undefined) {
        const rate = rateOf(patch.currency);
        changed.roe = rate == null ? '' : rate;
      }
      return changed;
    }));
  };
  const addLine = () => setChargeLines((current) => [...current, blankLine(`n${Date.now()}`)]);
  const removeLine = (id) => setChargeLines((current) => current.filter((line) => line.id !== id));

  const totals = useMemo(() => quoteTotals(chargeLines), [chargeLines]);

  const quoteBody = () => ({
    ...form,
    leadId: quote ? quote.leadId : (lead ? lead.id : null),
    partyLedgerId: quote ? quote.partyLedgerId : (lead ? lead.partyLedgerId : null),
    validUntil: form.validUntil || null,
    charges: chargeLines.filter((line) => String(line.head || '').trim()).map((line) => ({
      head: line.head,
      buyRate: toNumber(line.buyRate),
      sellRate: toNumber(line.sellRate),
      currency: line.currency,
      roe: toNumber(line.roe) || undefined,
      qty: toNumber(line.qty) || 1,
      basis: line.basis,
      remarks: line.remarks,
    })),
  });

  // the quote is saved either way - the toast says exactly what happened to the mail
  const emailSavedQuote = async (saved) => {
    const to = (form.email || '').trim();
    if (!to) {
      toast.error('Saved, but there is no email address to send it to');
      return;
    }
    const text = quotationEmailText({
      ...form,
      quoteNo: saved.quoteNo,
      date: saved.date,
      charges: saved.charges,
      totalSellInr: saved.totalSellInr,
      validUntil: saved.validUntil,
    });
    try {
      await emailQuotation(saved.id, saved.quoteNo, to, text);
      toast.success(`Quotation ${saved.quoteNo} saved and emailed to ${to}`);
    } catch (error) {
      toast.error(`Saved as ${saved.quoteNo}, but the email did not go: ${errorMessage(error)} (check Settings > Email)`);
    }
  };

  const save = async (alsoEmail) => {
    setSaving(true);
    setErrors([]);
    try {
      const { data: saved } = await salesCrmApi.saveQuote(quote?.id, quoteBody());
      if (alsoEmail) await emailSavedQuote(saved);
      else toast.success(`Quotation ${saved.quoteNo} saved`);
      if (onSaved) onSaved(saved); else onClose();
    } catch (error) {
      showSaveFailure(error, setErrors);
    }
    setSaving(false);
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={1100}
      closeOnOutside={false}
      className="tw:md:h-[90vh]"
      title={<span className="tw:flex tw:items-center tw:gap-2"><FileText className="tw:size-5 tw:text-primary" /> Logistics CRM - Generate Quotation</span>}
      description={quote ? `Editing ${quote.quoteNo} (${quote.status})` : 'Multi-currency quote, converted at the rates on the Currency master'}
      footer={(
        <div className="tw:flex tw:w-full tw:flex-col tw:gap-3">
          <SaveErrors errors={errors} />
          <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
            <span className="tw:text-entry tw:text-muted-foreground">The email to the client lists the sell rates only - buy rates stay internal.</span>
            <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-3">
              <Button size="lg" onClick={onClose}>Cancel</Button>
              <Button size="lg" onClick={() => save(false)} disabled={saving}>{saving ? 'Saving...' : 'Save only'}</Button>
              <Button variant="default" size="lg" onClick={() => save(true)} disabled={saving}>
                <Send /> {saving ? 'Working...' : 'Save & Email to Client'}
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <div className="tw:flex tw:flex-col tw:gap-6">
        <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-[1fr_1fr_2fr]">
          <Field label="Quote No. (Auto)" layout="col"><Input value={form.quoteNo} readOnly /></Field>
          <Field label="Valid until" layout="col">
            <DateInput value={form.validUntil} onValueChange={(date) => setField('validUntil', date)} />
          </Field>
          <Field label="Date" layout="col">
            <DateInput value={form.date} onValueChange={(date) => setField('date', date)} />
          </Field>
          <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
            <Field label="Client Name" layout="col"><Input {...textProps('clientName')} /></Field>
            <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row">
              <Input {...textProps('contactPerson')} placeholder="Contact person" />
              <Input {...textProps('email')} type="email" placeholder="email for the quotation" />
            </div>
          </div>
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-4 tw:md:grid-cols-3">
          <Field label="Routing Origin" layout="col"><Input {...textProps('origin')} /></Field>
          <Field label="Routing Destination" layout="col"><Input {...textProps('destination')} /></Field>
          <Field label="Mode" layout="col"><Input {...textProps('mode')} placeholder="e.g. Sea FCL" /></Field>
          <Field label="Commodity" layout="col" className="tw:md:col-span-3">
            <Input {...textProps('commodity')} placeholder="e.g. General cargo" />
          </Field>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-3">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
            <h4 className="tw:m-0 tw:text-[15px] tw:font-bold tw:text-head">Commercials (Buy vs Sell Rates)</h4>
            <Button onClick={addLine}><Plus /> Add Charge Head</Button>
          </div>
          <ChargeLinesTable lines={chargeLines} rates={rates} onChangeLine={changeLine} onRemoveLine={removeLine} />
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-2">
          <ProfitabilityPanel totals={totals} ratesNote={ratesNote} />
          <Field label="Terms & Conditions" layout="col">
            <Textarea rows={6} {...textProps('remarks')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
