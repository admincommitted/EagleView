import { z } from 'zod';
import { isJobFilesModule } from './jobFiles.service.js';

export const jobFolderParamsSchema = z
  .looseObject({})
  .refine((params) => isJobFilesModule(params.module), { message: 'Module must be import or export' });
