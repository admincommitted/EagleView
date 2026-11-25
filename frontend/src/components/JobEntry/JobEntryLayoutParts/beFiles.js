import { downloadBlob } from '@/lib/download';

// screenJob = { jobData, items, esanchitDocs, beType, transportMode } - the job on the screen, or one read for the job list
export const beRequestOf = (screenJob, extra) => ({
  jobData: { ...screenJob.jobData, esanchitDocs: screenJob.esanchitDocs || [] },
  items: screenJob.items,
  invoices: screenJob.jobData.invoices || [],
  beType: screenJob.beType,
  transportMode: screenJob.transportMode,
  ...extra,
});

const fileNamePart = (text) => String(text).replace(/[^\w-]+/g, '_');

export const beJsonFileName = (jobNo, senderId) =>
  `BE_${fileNamePart(jobNo || 'DRAFT')}${senderId ? `_${fileNamePart(senderId)}` : ''}_CACHI01.json`;

export const prettyJson = (value) => JSON.stringify(value, null, 2);

export const downloadJson = (value, fileName) => downloadBlob(new Blob([prettyJson(value)], { type: 'application/json' }), fileName);

export const validationErrorCount = (validation) => validation?.errors?.length || 0;
