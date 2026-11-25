import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import askConfirm, { askText } from '@/components/common/askConfirm';
import { salesCrmApi } from '../SalesParts/salesApi';
import { emailQuotation, quotationEmailText } from './quoteEmail';

const askReason = (title, message) => askText({ title, message, label: 'Reason', required: false });

export default function useSalesCrm({ search, statusFilter }) {
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [leadCounts, setLeadCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const filters = { q: search || undefined, status: statusFilter || undefined };
    const [leadList, quoteList] = await Promise.allSettled([salesCrmApi.leads(filters), salesCrmApi.quotes()]);
    if (leadList.status === 'fulfilled') {
      setLeads(leadList.value.data || []);
      setQuotes(quoteList.status === 'fulfilled' ? quoteList.value.data || [] : []);
      setLeadCounts(leadList.value.counts || {});
    } else {
      setLeads([]);
      setQuotes([]);
      setError(errorMessage(leadList.reason));
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const setQuoteStatus = async (quote, status, extra) => {
    try {
      await salesCrmApi.updateQuote(quote.id, { status, ...extra });
      toast.success(`Marked ${status.toLowerCase()}`);
      await load();
    } catch (failure) {
      toast.error(errorMessage(failure));
    }
  };

  const rejectQuote = async (quote) => {
    const why = await askReason('Quotation rejected', `Why was quotation ${quote.quoteNo} rejected?`);
    if (!why?.trim()) { toast.error('Not changed - a rejection needs a reason'); return; }
    setQuoteStatus(quote, 'REJECTED', { rejectReason: why.trim() });
  };

  const convertToJob = async (quote) => {
    const jobNo = (await askText({
      title: 'Link to job',
      message: `Which job number does quotation ${quote.quoteNo} become?`,
      note: 'Create the job first in Import / Export Entry, then paste its job number here.',
      label: 'Job number',
      required: false,
    }))?.trim();
    if (!jobNo) { toast.error('Not converted - the job number links the quote to the job'); return; }
    try {
      await salesCrmApi.convertQuote(quote.id, jobNo);
      toast.success(`Quotation ${quote.quoteNo} linked to job ${jobNo}`);
      await load();
    } catch (failure) {
      toast.error(`Not converted: ${errorMessage(failure)}`);
    }
  };

  const sendQuote = async (quote) => {
    const to = (await askText({ title: 'Email the quotation', label: 'Email the quotation to:', value: quote.email || '', required: false, okLabel: 'Send' }))?.trim();
    if (!to) return;
    try {
      await emailQuotation(quote.id, quote.quoteNo, to, quotationEmailText(quote));
      toast.success(`Quotation emailed to ${to}`);
      await load();
    } catch (failure) {
      toast.error(`Not sent: ${errorMessage(failure)} (check Settings > Email)`);
    }
  };

  const removeQuote = async (quote) => {
    if (!(await askConfirm({ title: 'Delete quotation', message: `Delete quotation ${quote.quoteNo}?`, okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await salesCrmApi.deleteQuote(quote.id);
      toast.success('Deleted');
      await load();
    } catch (failure) {
      toast.error(errorMessage(failure));
    }
  };

  const markLost = async (lead) => {
    const why = await askReason('Enquiry lost', `Why was the enquiry from ${lead.clientName} lost?`);
    if (!why?.trim()) { toast.error('Not changed - a lost lead is only useful with the reason'); return; }
    try {
      await salesCrmApi.updateLead(lead.id, { status: 'LOST', lostReason: why.trim() });
      await load();
    } catch (failure) {
      toast.error(errorMessage(failure));
    }
  };

  return {
    leads, quotes, leadCounts, loading, error, load,
    approveQuote: (quote) => setQuoteStatus(quote, 'APPROVED'),
    rejectQuote, convertToJob, sendQuote, removeQuote, markLost,
  };
}
