import { ApiResponse } from '../../../core/http/index.js';
import { extractInvoice, testExtraction } from './aiExtractor.service.js';

export const extractInvoiceData = async (req, res) => {
  ApiResponse.send(res, await extractInvoice(req.file, req.body));
};

export const testModel = async (req, res) => {
  ApiResponse.send(res, await testExtraction(req.file, req.body));
};
