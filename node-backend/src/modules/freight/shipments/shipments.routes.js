import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import {
  changeStage,
  copyPartyFromDirectory,
  createDocket,
  deleteDocket,
  deleteEvent,
  docketByNumber,
  docketOfCustomsJob,
  docketWithInvoices,
  dueDates,
  duplicateDocket,
  listDocketFiles,
  listEvents,
  lookupMaster,
  meta,
  nextNumber,
  readStatusMail,
  registerFromCustomsJob,
  removeDocketFile,
  saveDocumentList,
  saveEvent,
  searchDockets,
  sendDocketStatusMail,
  syncCustomsMilestones,
  updateDocket,
  updateSeries,
  uploadDocketFiles,
} from './shipments.controller.js';
import { shipmentFilesUpload } from './shipments.files.js';

const router = Router();

// /:id is a number only (Express 5 has no '(\d+)' in paths): /due, /by-job ... go on to their own routes
router.param('id', (req, res, next, id) => (/^\d+$/.test(String(id)) ? next() : next('route')));

router.get('/meta', asyncHandler(meta));
router.get('/next-no', asyncHandler(nextNumber));
router.put('/series', asyncHandler(updateSeries));
router.get('/lookup/:what', asyncHandler(lookupMaster));
router.post('/party-from-directory', asyncHandler(copyPartyFromDirectory));

router.get('/', asyncHandler(searchDockets));
router.get('/by-no', asyncHandler(docketByNumber));
router.get('/:id', asyncHandler(docketWithInvoices));
router.post('/', asyncHandler(createDocket));
router.put('/:id', asyncHandler(updateDocket));
router.delete('/:id', asyncHandler(deleteDocket));
router.post('/:id/duplicate', asyncHandler(duplicateDocket));
router.post('/stage', asyncHandler(changeStage));

router.get('/:id/events', asyncHandler(listEvents));
router.post('/:id/events', asyncHandler(saveEvent));
router.delete('/:id/events/:eid', asyncHandler(deleteEvent));
router.put('/:id/doclist', asyncHandler(saveDocumentList));
router.get('/due', asyncHandler(dueDates));

router.get('/:id/files', asyncHandler(listDocketFiles));
router.post('/:id/files', shipmentFilesUpload, asyncHandler(uploadDocketFiles));
router.delete('/:id/files/:fid', asyncHandler(removeDocketFile));

router.get('/:id/mail', asyncHandler(readStatusMail));
router.post('/:id/mail', asyncHandler(sendDocketStatusMail));

router.get('/by-job', asyncHandler(docketOfCustomsJob));
router.post('/from-job', asyncHandler(registerFromCustomsJob));
router.post('/:id/sync-customs', asyncHandler(syncCustomsMilestones));

export default router;
