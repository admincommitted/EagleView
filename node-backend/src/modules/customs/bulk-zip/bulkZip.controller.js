import { createZipArchive, existingUploadFiles, zipEntries, zipFileName } from './bulkZip.service.js';

/** Streams the selected upload files as one zip download. */
export function downloadZip(req, res) {
  const { files, zipName } = req.body || {};
  const found = existingUploadFiles(files);
  let archive;
  try {
    archive = createZipArchive();
  } catch (error) {
    return res.status(500).json({ error: `Zip library error: ${error.message}` });
  }
  archive.on('error', (error) => {
    if (!res.headersSent) res.status(500).json({ error: error.message });
    else res.end();
  });
  res.attachment(zipFileName(zipName));
  archive.pipe(res);
  for (const entry of zipEntries(found)) archive.file(entry.absolutePath, { name: entry.name });
  return archive.finalize();
}
