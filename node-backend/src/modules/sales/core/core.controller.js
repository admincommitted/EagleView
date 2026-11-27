import { ApiError, ApiResponse } from '../../../core/http/index.js';
import * as salesService from './core.service.js';

const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;

/**
 * Creating a lead / quotation answered a database error whose text mentions "unique" as a duplicate number (400),
 * any other unexpected error as 500 { success: false, error }.
 */
async function answerCreate(res, create, duplicateMessage) {
  try {
    ApiResponse.send(res, await create());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (String(error.message).includes('unique')) {
      return ApiResponse.send(res, { success: false, error: duplicateMessage }, HTTP_BAD_REQUEST);
    }
    return ApiResponse.send(res, { success: false, error: error.message }, HTTP_SERVER_ERROR);
  }
}

export async function listLeads(req, res) {
  ApiResponse.send(res, await salesService.listLeads(req.query));
}

export async function nextEnquiryNumber(req, res) {
  ApiResponse.send(res, { success: true, enquiryNo: await salesService.nextEnquiryNumber() });
}

export async function createLead(req, res) {
  await answerCreate(res, () => salesService.createLead(req.body, req.user), 'That enquiry number already exists');
}

export async function updateLead(req, res) {
  ApiResponse.send(res, await salesService.updateLead(req.params.id, req.body));
}

export async function listQuotes(req, res) {
  ApiResponse.send(res, await salesService.listQuotes(req.query));
}

export async function nextQuoteNumber(req, res) {
  ApiResponse.send(res, { success: true, quoteNo: await salesService.nextQuoteNumber() });
}

export async function listRates(req, res) {
  ApiResponse.send(res, await salesService.listRates());
}

export async function createQuote(req, res) {
  await answerCreate(res, () => salesService.createQuote(req.body, req.user), 'That quote number already exists');
}

export async function updateQuote(req, res) {
  ApiResponse.send(res, await salesService.updateQuote(req.params.id, req.body));
}

export async function recordQuoteSent(req, res) {
  ApiResponse.send(res, await salesService.recordQuoteSent(req.params.id, req.body));
}

export async function convertQuoteToJob(req, res) {
  ApiResponse.send(res, await salesService.convertQuoteToJob(req.params.id, req.body));
}

export async function deleteQuote(req, res) {
  ApiResponse.send(res, await salesService.deleteQuote(req.params.id));
}
