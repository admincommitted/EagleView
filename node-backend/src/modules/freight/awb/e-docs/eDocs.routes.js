import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { deleteDocument, extractDocumentData, listDocuments, uploadDocuments } from './eDocs.controller.js';
import { awbDocsUpload } from './eDocs.upload.js';

const router = Router();

router.post('/docs/:tempId', awbDocsUpload, asyncHandler(uploadDocuments));
router.post('/docs/extract/:docId', asyncHandler(extractDocumentData));
router.get('/docs/:tempId', asyncHandler(listDocuments));
router.delete('/docs/:id', asyncHandler(deleteDocument));

export default router;
