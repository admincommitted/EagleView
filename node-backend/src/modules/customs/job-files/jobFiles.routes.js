import { Router } from 'express';
import { memoryUpload } from '../../../middlewares/upload.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { handleRoute } from '../shared/handleRoute.js';
import { MAX_FILE_SIZE_MB, listFiles, receiveOneFile, removeFile, uploadOther } from './jobFiles.controller.js';
import { jobFolderParamsSchema } from './jobFiles.validation.js';

const router = Router();
const upload = memoryUpload({ maxFileSizeMb: MAX_FILE_SIZE_MB });

const checkModule = validate(
  { params: jobFolderParamsSchema },
  { errorBody: (message) => ({ success: false, error: message }) },
);
const logWith = (label) => (error) => console.error(label, error);

router.get('/:module/:jobId', checkModule, handleRoute(listFiles, { onError: logWith('[job files]') }));
router.post(
  '/:module/:jobId/other',
  receiveOneFile(upload),
  checkModule,
  handleRoute(uploadOther, { onError: logWith('[job files upload]') }),
);
router.delete('/:module/:jobId', checkModule, handleRoute(removeFile, { onError: logWith('[job files delete]') }));

export default router;
