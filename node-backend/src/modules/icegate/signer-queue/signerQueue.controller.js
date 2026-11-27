import { ApiResponse } from '../../../core/http/index.js';
import * as signerQueueService from './signerQueue.service.js';
import * as signerJobsService from './signerJobs.service.js';

/** Answer of an unexpected failure: { success: false, error }, after the old route's log line when it had one. */
export const failureBody = (logLabel) => (error) => {
  if (logLabel) console.error(logLabel, error);
  return { success: false, error: error.message };
};

export const listSigningQueue = async (req, res) => {
  ApiResponse.send(res, await signerQueueService.listSigningQueue(req.user));
};

export const saveSignedPdf = async (req, res) => {
  ApiResponse.send(res, await signerQueueService.saveSignedPdf(req.user, req.body, req.file));
};

export const getAmendmentFileToSign = async (req, res) => {
  ApiResponse.send(res, await signerQueueService.getAmendmentFileToSign(req.user, req.params.id));
};

export const saveSignedAmendment = async (req, res) => {
  ApiResponse.send(res, await signerQueueService.saveSignedAmendment(req.user, req.params.id, req.body));
};

export const listUploadQueue = async (req, res) => {
  ApiResponse.send(res, await signerQueueService.listUploadQueue(req.user));
};

export const noteIrn = async (req, res) => {
  ApiResponse.send(res, await signerQueueService.noteIrn(req.user, req.body));
};

export const searchJobs = async (req, res) => {
  ApiResponse.send(res, await signerJobsService.searchJobs(req.user, req.query));
};

export const listDocumentCodes = async (req, res) => {
  ApiResponse.send(res, await signerJobsService.listDocumentCodes());
};

export const addDocumentToJob = async (req, res) => {
  ApiResponse.send(res, await signerJobsService.addDocumentToJob(req.user, req.body, req.file));
};

export const listJobDocuments = async (req, res) => {
  ApiResponse.send(res, await signerJobsService.listJobDocuments(req.user, req.query));
};
