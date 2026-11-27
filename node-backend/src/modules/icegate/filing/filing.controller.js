import { ApiResponse } from '../../../core/http/index.js';
import { who } from '../../../utils/customs/icegateLog.js';
import * as filingService from './filing.service.js';
import * as beFilingService from './beFiling.service.js';
import * as sbFilingService from './sbFiling.service.js';
import * as dscSignerService from './dscSigner.service.js';
import * as esanchitService from './esanchit.service.js';
import { testImapConnection } from './imapTest.service.js';

/** Answer of an unexpected failure: { success: false, error }, as the old routes' catch blocks. */
export const failureBody = (error) => ({ success: false, error: error.message });

/** The same answer, after the log line the old route wrote (the message only, or the whole error). */
export const loggedFailureBody =
  (label, { wholeError = false } = {}) =>
  (error) => {
    console.error(label, wholeError ? error : error.message);
    return failureBody(error);
  };

export const testAuthentication = async (req, res) => {
  ApiResponse.send(res, await filingService.testIcegateLogin(req.body));
};

export const submitJsonFile = async (req, res) => {
  ApiResponse.send(res, await filingService.submitJsonFile(req.body));
};

export const getAcknowledgement = async (req, res) => {
  ApiResponse.send(res, await filingService.getAcknowledgement(req.body));
};

export const submitBillOfEntry = async (req, res) => {
  ApiResponse.send(res, await beFilingService.submitBillOfEntry(req.body, who(req)));
};

export const checkBeAcknowledgement = async (req, res) => {
  ApiResponse.send(res, await beFilingService.checkBeAcknowledgement(req.body, who(req)));
};

export const getStoredBeAcknowledgement = async (req, res) => {
  ApiResponse.send(res, await beFilingService.getStoredBeAcknowledgement(req.params.jobId));
};

export const previewBillOfEntry = async (req, res) => {
  ApiResponse.send(res, await beFilingService.previewBillOfEntry(req.body));
};

export const signBillOfEntryFile = async (req, res) => {
  ApiResponse.send(res, await beFilingService.signBillOfEntryFile(req.body, who(req)));
};

export const makeBeFlatFile = async (req, res) => {
  ApiResponse.send(res, await beFilingService.makeBeFlatFile(req.body));
};

export const makeBeAmendmentFlatFile = async (req, res) => {
  ApiResponse.send(res, await beFilingService.makeBeAmendmentFlatFile(req.body));
};

export const listBeAmendmentCodes = (req, res) => {
  ApiResponse.send(res, beFilingService.listBeAmendmentCodes());
};

export const submitShippingBill = async (req, res) => {
  ApiResponse.send(res, await sbFilingService.submitShippingBill(req.body, who(req)));
};

export const checkSbAcknowledgement = async (req, res) => {
  ApiResponse.send(res, await sbFilingService.checkSbAcknowledgement(req.body, who(req)));
};

export const getStoredSbAcknowledgement = async (req, res) => {
  ApiResponse.send(res, await sbFilingService.getStoredSbAcknowledgement(req.params.jobId));
};

export const signShippingBillFile = async (req, res) => {
  ApiResponse.send(res, await sbFilingService.signShippingBillFile(req.body, who(req)));
};

export const makeSbFlatFile = async (req, res) => {
  ApiResponse.send(res, await sbFilingService.makeSbFlatFile(req.body));
};

export const previewShippingBill = async (req, res) => {
  ApiResponse.send(res, await sbFilingService.previewShippingBill(req.body));
};

export const makeSbAmendment = async (req, res) => {
  ApiResponse.send(res, await sbFilingService.makeSbAmendment(req.body));
};

export const getSignerStatus = async (req, res) => {
  ApiResponse.send(res, await dscSignerService.getSignerStatus());
};

// the PDF is held in memory only for the signing
const releaseUploadedPdf = (req) => {
  if (req.file) req.file.buffer = null;
};

export const signPdf = async (req, res) => {
  try {
    const signedPdf = await dscSignerService.signPdfDocument(req.file, req.body && req.body.pin);
    const downloadName = esanchitService.signedDownloadName(req.file.originalname);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + downloadName + '"');
    res.send(signedPdf);
  } finally {
    releaseUploadedPdf(req);
  }
};

export const archivePdf = (req, res) => {
  ApiResponse.send(res, esanchitService.describeArchivedPdf(req.file, req.body));
};

export const listArchivedPdfs = async (req, res) => {
  ApiResponse.send(res, await esanchitService.listArchivedPdfs(req.query.jobNo));
};

export const uploadSignedPdf = async (req, res) => {
  ApiResponse.send(res, await esanchitService.uploadSignedPdf(req.file, req.body));
};

export const testImap = async (req, res) => {
  ApiResponse.send(res, await testImapConnection(req.body));
};
