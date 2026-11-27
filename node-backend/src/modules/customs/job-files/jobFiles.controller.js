import { listJobFiles, openJobFolder, removeJobFile, uploadOtherDocument } from './jobFiles.service.js';

const MAX_FILE_SIZE_MB = 25;

const whoIs = (req) => (req.user && (req.user.username || req.user.name || req.user.email)) || 'user';

/** multer for one file, answering its own error (a file over the size limit) instead of passing it on. */
export const receiveOneFile = (upload) => (req, res, next) =>
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    const message = /too large/i.test(error.message) ? `The file is bigger than ${MAX_FILE_SIZE_MB} MB` : error.message;
    return res.status(400).json({ success: false, error: message });
  });

export async function listFiles(req, res) {
  const folder = await openJobFolder(req.params.module, req.params.jobId, req.user, 'view');
  res.json(await listJobFiles(folder));
}

export async function uploadOther(req, res) {
  const folder = await openJobFolder(req.params.module, req.params.jobId, req.user, 'edit');
  res.json({ success: true, file: await uploadOtherDocument(folder, req.file, req.body, whoIs(req)) });
}

export async function removeFile(req, res) {
  const folder = await openJobFolder(req.params.module, req.params.jobId, req.user, 'edit');
  const removed = await removeJobFile(folder, { kind: req.query.kind, file: req.query.file }, whoIs(req));
  res.json({ success: true, removed });
}

export { MAX_FILE_SIZE_MB };
