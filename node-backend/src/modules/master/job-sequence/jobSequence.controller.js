import * as jobSequenceService from './jobSequence.service.js';

const sequenceListOf = (body) => {
  if (Array.isArray(body)) return body;
  return body && Array.isArray(body.sequences) ? body.sequences : null;
};

export async function listJobSequences(req, res) {
  res.json({ success: true, data: await jobSequenceService.listJobSequences() });
}

export async function jobSequenceStatus(req, res) {
  res.json(await jobSequenceService.jobSequenceStatus(req.query));
}

export async function saveJobSequences(req, res) {
  const financialYearId = req.query.financialYearId || (req.body && req.body.financialYearId);
  res.json(await jobSequenceService.saveJobSequences(sequenceListOf(req.body), financialYearId));
}
