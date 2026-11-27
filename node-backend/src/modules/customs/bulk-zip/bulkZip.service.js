import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { BACKEND_ROOT, UPLOADS_DIR } from '../../../config/env.js';
import { NotFoundError } from '../../../core/http/index.js';

const DEFAULT_ZIP_NAME = 'bulk_download.zip';
const ZIP_OPTIONS = { zlib: { level: 9 } };

// only files inside the uploads folder: a path such as "../.env" is never zipped
function uploadFilePath(fileUrl) {
  const relativePath = String(fileUrl || '').replace(/^\/+/, '');
  const absolutePath = path.resolve(BACKEND_ROOT, relativePath);
  if (!absolutePath.startsWith(UPLOADS_DIR + path.sep)) return null;
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile() ? absolutePath : null;
}

/** The selected /uploads/... files that exist on the server. */
export function existingUploadFiles(fileUrls) {
  const found = fileUrls.map(uploadFilePath).filter(Boolean);
  if (!found.length) {
    throw new NotFoundError('None of the selected files were found on the server', {
      body: { error: 'None of the selected files were found on the server' },
    });
  }
  return found;
}

export const zipFileName = (zipName) => String(zipName || DEFAULT_ZIP_NAME).replace(/[^\w.\- ]/g, '_');

export const createZipArchive = () => new ZipArchive(ZIP_OPTIONS);

/** Entry names in the zip: the file name, with _2, _3 ... when two files have the same name. */
export function zipEntries(absolutePaths) {
  const usedNames = new Set();
  return absolutePaths.map((absolutePath) => {
    const extension = path.extname(absolutePath);
    let name = path.basename(absolutePath);
    for (let copy = 2; usedNames.has(name); copy++)
      name = `${path.basename(absolutePath, extension)}_${copy}${extension}`;
    usedNames.add(name);
    return { absolutePath, name };
  });
}
