import multer from 'multer';

const BYTES_PER_MB = 1024 * 1024;

const limitsOf = ({ maxFileSizeMb, maxFiles }) => {
  const limits = {};
  if (maxFileSizeMb) limits.fileSize = maxFileSizeMb * BYTES_PER_MB;
  if (maxFiles) limits.files = maxFiles;
  return limits;
};

/** multer keeping files in memory (file.buffer). */
export function memoryUpload({ maxFileSizeMb, maxFiles, fileFilter } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: limitsOf({ maxFileSizeMb, maxFiles }),
    ...(fileFilter ? { fileFilter } : {}),
  });
}
