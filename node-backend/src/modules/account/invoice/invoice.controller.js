import { createInvoice, listInvoices } from './invoice.service.js';

export async function addInvoice(req, res) {
  const { date, jobType, jobId, partyId, items, status } = req.body;
  res.json(
    await createInvoice({
      date,
      jobType,
      jobId,
      partyId,
      items,
      status,
    }),
  );
}

export async function getInvoices(req, res) {
  res.json(await listInvoices());
}
