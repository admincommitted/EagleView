import { ImportJob } from '../../../models/index.js';
import {
  ApiError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from '../../../core/http/index.js';
import { buildBE_CACHI01 } from '../../../utils/customs/IcegateJsonBuilder.js';
import { validateIcegateJson } from '../../../utils/customs/icegateValidate.js';
import { checkJobNo, withStoredNo } from '../../../utils/customs/icegateJobNo.js';
import { AMEND_CODES, writeBeAmendFlat, writeBeFlat } from '../../../utils/customs/beFlatFile.js';
import { checkJobAck } from '../../../utils/customs/icegateAck.js';
import { logIcegate } from '../../../utils/customs/icegateLog.js';
import { attachDigSign } from './dscSigner.service.js';
import {
  buildFilingForm,
  fileTaken,
  getAuthToken,
  getIcegateConfig,
  icegateErrorMessage,
  icegateUnreachable,
  isJobProblem,
  loggedAnswer,
  rethrowApiError,
  sendFilingForm,
  signFilingFile,
  signForChecking,
  signedCheckFileName,
} from './filing.service.js';

const FRESH_BE_INDICATOR = 'P';
const AMENDED_JOB_NO = /^AMD\//;
const AMENDED_JOB_NO_ANY_CASE = /^AMD\//i;
const BE_FILE_NAME_DIGITS = 8;
const AMENDMENT_FILE_NAME_DIGITS = 7;
const IGM_AMENDMENT_CODES = ['A_PBEIGM', 'A_IGM', 'S_IGMS'];
const PRIOR_TO_FINAL_CODE = 'A_PBEIGM';
const ACK_JOB_ATTRIBUTES = ['icegateStatus', 'icegateUniqueId', 'icegateAckAt', 'beNo', 'beDate', 'extendedData'];
const STORED_ACK_ATTRIBUTES = [
  'id',
  'icegateStatus',
  'icegateUniqueId',
  'icegateAck',
  'icegateAckAt',
  'beNo',
  'beDate',
  'extendedData',
];

const ackHelpers = { getIcegateConfig, getAuthToken };

function parseJsonText(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

/** A job with a BE No was filed already: a file made from it now is a NEW Bill of Entry. */
const filedBillOfEntry = (jobData) => {
  const number = String((jobData && (jobData.beNo || jobData.beNumber)) || '').trim();
  return number ? { no: number, date: String(jobData.beDate || '').trim() } : null;
};

const filedNote = (filed) =>
  `This job already has BE No ${filed.no}${filed.date ? ' dt ' + filed.date : ''} (filed).` +
  ' A file made now is a NEW Bill of Entry, so its BE No / date are left blank. For a change to the filed BE use ACTIONS > BE Amendment.';

/** A fresh filing carries no BE No / date in any row (the checklist preview still shows them). */
function blankBeNumbers(cachi01) {
  const master = (cachi01 && cachi01.master) || {};
  for (const rows of Object.values(master)) {
    if (!Array.isArray(rows)) continue;
    rows.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      if ('beNumber' in row) row.beNumber = '';
      if ('beDate' in row) row.beDate = '';
    });
  }
  return cachi01;
}

/** The BE JSON (CACHI01) of the screen's job, with the ICEGATE job number of its first filing. */
async function buildBillOfEntry({ jobData, items, invoices }, options) {
  await withStoredNo('BE', jobData);
  return buildBE_CACHI01(jobData, items || [], invoices || [], options);
}

/** The ICEGATE checks of the BE, plus the numeric job number (once per financial year). */
async function checkBillOfEntry(jobData, cachi01) {
  const validation = validateIcegateJson('BE', cachi01, { screen: jobData });
  await checkJobNo('BE', validation, jobData, cachi01);
  return validation;
}

function checkJobCanBeFiledAsFreshBe({ jobData, amendment }) {
  // ICEGATE takes only a FRESH BE as JSON; an amendment is the flat file CACHI01_A (/amend-be-flat)
  if (amendment) {
    throw new BadRequestError(
      'A BE amendment cannot be sent as JSON. Use ACTIONS > BE Amendment File (.be) and upload that file on ICEGATE.',
    );
  }
  if (jobData._amendmentId || AMENDED_JOB_NO.test(String(jobData.jobNo || ''))) {
    throw new BadRequestError(
      'This is an amended job: send it from Customs > BE Amendments (amendment file), not as a fresh BE.',
    );
  }
  const filed = filedBillOfEntry(jobData);
  if (filed) {
    throw new ConflictError(
      `This job already has BE No ${filed.no}${filed.date ? ' dt ' + filed.date : ''} - it was filed.` +
        ' Sending it again would file a NEW Bill of Entry. For a change use ACTIONS > BE Amendment.' +
        ' If the BE No on the job is wrong, clear it in Job Header > BE Filing Details and save first.',
    );
  }
}

function failValidation(validation) {
  const message = 'Validation failed: fix ' + validation.errors.length + ' error(s) before sending';
  throw new ApiError(422, message, { body: { success: false, error: message, validation } });
}

function checkProductionNeedsPin(config, pin) {
  // production ICEGATE accepts only DSC-signed files; only the UAT server takes an unsigned test file
  if (!pin && !/uat/i.test(String(config.baseUrl || ''))) {
    throw new BadRequestError('Enter the DSC token PIN: ICEGATE production accepts only a signed BE file.');
  }
}

/** The filed JSON is kept on the job, which is locked again; the reply of an earlier filing is dropped. */
async function markJobFiled(jobData, answer, signing, cachi01Json, fileName) {
  try {
    if (jobData && jobData.id) {
      await ImportJob.update(
        {
          icegateStatus: 'Filed',
          icegateUniqueId: answer.uniqueId,
          isAmended: false,
          filedJson: signing.fileText,
          filedAt: new Date(),
          filedFileName: fileName,
          filedSigner: signing.signerCn || null,
          amendUnlockedAt: null,
          amendUnlockedBy: null,
          icegateAck: null,
          icegateAckAt: null,
          icegateJobNo: Number((cachi01Json.headerField || {}).jobNumber) || null,
        },
        { where: { id: jobData.id } },
      );
    }
  } catch (error) {
    console.error('Failed to update ImportJob DB status:', error.message);
  }
}

const icegateSaid = (answer) => String(answer.message || answer.validationStatus || 'taken').replace(/\.+$/, '');

const sentLogText = (config, signing, answer, headerField) =>
  `BE sent to ICEGATE as ${config.loginId}` +
  `${signing.signerCn ? ', signed by ' + signing.signerCn : ' (NOT signed)'} - Unique ID ${answer.uniqueId || '-'},` +
  ` control no ${headerField.sequenceOrControlNumber || '-'}. ICEGATE: ${icegateSaid(answer)}.` +
  ' The answer of ICES (BE No or errors) comes later - ICEGATE REPLY on the job.';

async function rejectNotTaken(jobData, config, response, cachi01Json, author) {
  const answer = response.data;
  const reason = answer.errorMessage || answer.message || answer.validationStatus || 'no reason given';
  await logIcegate(
    'IMPORT',
    jobData.id,
    'ICEGATE_NOT_SENT',
    `BE not taken by ICEGATE (as ${config.loginId}, HTTP ${response.status}): ${reason}`,
    author,
  );
  const message = answer.errorMessage || answer.message || 'Filing failed';
  throw new BadRequestError(message, {
    body: {
      success: false,
      validationStatus: answer.validationStatus,
      error: message,
      details: answer,
      cachi01: cachi01Json,
    },
  });
}

async function fileBillOfEntry(request, author) {
  const { jobData, beType, transportMode, indicator, amendmentType, amendReason, profileId, pin } = request;
  checkJobCanBeFiledAsFreshBe(request);

  // the BE is built and checked before logging in, so a login problem cannot hide its validation errors
  const cachi01Json = await buildBillOfEntry(request, {
    beType,
    transportMode,
    indicator: indicator || FRESH_BE_INDICATOR,
    amendment: false,
    amendmentType,
    amendReason,
    profileId,
  });
  const validation = await checkBillOfEntry(jobData, cachi01Json);
  if (!validation.ok) failValidation(validation);

  const config = await getIcegateConfig(profileId);
  checkProductionNeedsPin(config, pin);
  const tokenData = await getAuthToken(config);

  const jsonText = JSON.stringify(cachi01Json, null, 2);
  const fileName = `BE_${Date.now()}_CACHI01.json`;
  const signing = await signFilingFile(cachi01Json, jsonText, pin, {
    module: 'IMPORT',
    jobId: jobData.id,
    documentLabel: 'BE',
    author,
  });

  const form = buildFilingForm(fileName, signing.fileText, signing);
  console.log('[ICEGATE] submit-be — submitting file:', fileName);
  const response = await sendFilingForm(config, tokenData, form);
  const answer = response.data;
  console.log('[ICEGATE] submit-be response:', response.status, loggedAnswer(answer));

  if (!fileTaken(response.status, answer)) await rejectNotTaken(jobData, config, response, cachi01Json, author);

  await markJobFiled(jobData, answer, signing, cachi01Json, fileName);
  await logIcegate(
    'IMPORT',
    jobData.id,
    'ICEGATE_SENT',
    sentLogText(config, signing, answer, cachi01Json.headerField || {}),
    author,
  );
  return {
    success: true,
    validationStatus: answer.validationStatus,
    message: answer.message || 'BE filed successfully to ICEGATE',
    uniqueId: answer.uniqueId,
    fileName,
    signerCn: signing.signerCn,
    signWarning: signing.signWarning,
    cachi01: cachi01Json,
  };
}

/** POST /submit-be: builds the CACHI01 JSON, signs it with the DSC token and files it on ICEGATE. */
export async function submitBillOfEntry(request, author) {
  try {
    return await fileBillOfEntry(request, author);
  } catch (error) {
    rethrowApiError(error);
    const message = icegateErrorMessage(error);
    console.error('[ICEGATE] submit-be error:', message);
    await logIcegate(
      'IMPORT',
      request && request.jobData && request.jobData.id,
      'ICEGATE_NOT_SENT',
      'BE not sent to ICEGATE: ' + message,
      author,
    );
    throw new InternalServerError(message, { body: { success: false, error: message, details: error.response?.data } });
  }
}

async function askJobAcknowledgement(job, options) {
  try {
    return await checkJobAck(job, ackHelpers, options);
  } catch (error) {
    if (isJobProblem(error)) throw new BadRequestError(error.message);
    throw error;
  }
}

async function readBeAcknowledgement({ jobId, profileId, uniqueId }, author) {
  const job = jobId ? await ImportJob.findByPk(jobId) : null;
  if (!job) throw new NotFoundError('Job not found - save the job first');
  const ack = await askJobAcknowledgement(job, { profileId, uniqueId, author });
  const fresh = await ImportJob.findByPk(job.id, { attributes: ACK_JOB_ATTRIBUTES });
  const extended = parseJsonText(fresh && fresh.extendedData, {});
  return {
    success: true,
    state: ack.state,
    message: ack.message,
    beNo: ack.beNo,
    beDate: ack.beDate,
    errors: ack.errors,
    meta: ack.stored.meta,
    ackText: ack.stored.ackText,
    uniqueId: ack.uniqueId,
    senderId: ack.senderId,
    saved: ack.saved,
    job: {
      icegateStatus: fresh.icegateStatus,
      icegateUniqueId: fresh.icegateUniqueId,
      icegateAckAt: fresh.icegateAckAt,
      beNo: fresh.beNo || extended.beNo || '',
      beDate: fresh.beDate || extended.beDate || '',
    },
  };
}

/** POST /be-ack: asks ICEGATE for the reply of a filed BE and puts it on the job (Accepted / Rejected / pending). */
export async function checkBeAcknowledgement(request = {}, author) {
  try {
    return await readBeAcknowledgement(request, author);
  } catch (error) {
    throw icegateUnreachable(error);
  }
}

/** GET /be-ack/:jobId: the last stored reply, unless it belongs to an earlier filing of the job. */
export async function getStoredBeAcknowledgement(jobId) {
  const job = await ImportJob.findByPk(jobId, { attributes: STORED_ACK_ATTRIBUTES });
  if (!job) throw new NotFoundError('Job not found');
  let ack = parseJsonText(job.icegateAck, null);
  if (ack && ack.uniqueId && job.icegateUniqueId && ack.uniqueId !== job.icegateUniqueId) ack = null;
  const extended = parseJsonText(job.extendedData, {});
  return {
    success: true,
    icegateStatus: job.icegateStatus,
    uniqueId: job.icegateUniqueId,
    at: ack ? job.icegateAckAt : null,
    ack,
    beNo: job.beNo || extended.beNo || '',
    beDate: job.beDate || extended.beDate || '',
  };
}

/** POST /preview-be: the CACHI01 JSON and its checks, nothing sent. forFiling = as it would be filed now. */
export async function previewBillOfEntry(request) {
  const { jobData, beType, transportMode, profileId, forFiling } = request;
  const cachi01 = await buildBillOfEntry(request, { beType, transportMode, profileId });
  const filed = forFiling ? filedBillOfEntry(jobData) : null;
  if (filed) blankBeNumbers(cachi01);
  const validation = await checkBillOfEntry(jobData, cachi01);
  if (filed) validation.warnings.unshift('Job: ' + filedNote(filed));
  return { success: true, cachi01, validation, filedNote: filed ? filedNote(filed) : undefined };
}

/**
 * POST /sign-be-file: the BE signed exactly as Confirm Submit signs it, to download and verify on ICEGATE's signer
 * site (filesign.icegate.gov.in). NOTHING is sent to ICEGATE.
 */
export async function signBillOfEntryFile(request, author) {
  const { jobData, beType, transportMode, profileId, pin } = request;
  const cachi01Json = await buildBillOfEntry(request, {
    beType,
    transportMode,
    indicator: FRESH_BE_INDICATOR,
    profileId,
  });
  if (filedBillOfEntry(jobData)) blankBeNumbers(cachi01Json);
  const validation = await checkBillOfEntry(jobData, cachi01Json);
  const jsonText = JSON.stringify(cachi01Json, null, 2);
  const signature = await signForChecking(jsonText, pin);
  const signedFile = attachDigSign(jsonText, signature);
  const headerField = cachi01Json.headerField || {};
  const fileName = signedCheckFileName('BE', jobData.jobNo || jobData.id || 'job', headerField.senderID);
  await logIcegate(
    'IMPORT',
    jobData.id,
    'ICEGATE_SIGNED_FILE',
    `Signed BE file made for checking (${fileName}) - NOT sent to ICEGATE.` +
      ` ICEGATE ID ${headerField.senderID || '-'}, signed by ${signature.signerCn || '-'}` +
      `${signature.certificateB64 ? '' : ' (certificate missing in the file)'}.`,
    author,
  );
  return {
    success: true,
    fileName,
    json: signedFile,
    signedText: jsonText,
    signatureB64: signature.signatureB64,
    signerCn: signature.signerCn,
    senderId: headerField.senderID || '',
    certificate: !!signature.certificateB64,
    validation,
  };
}

/** POST /flat-be: the same BE as an ICES 1.5 flat file (.be), always a fresh BE (BE No / date blank). */
export async function makeBeFlatFile(request) {
  const { jobData, beType, transportMode, profileId } = request;
  // an amended job (AMD/...) goes as an amendment file from the BE Amendment window, never as a new BE
  if (jobData._amendmentId || AMENDED_JOB_NO_ANY_CASE.test(String(jobData.jobNo || ''))) {
    throw new BadRequestError(
      'This is an amended job - make its amendment file in the BE Amendment window (a full BE file of it would file a new BE)',
    );
  }
  const cachi01 = await buildBillOfEntry(request, { beType, transportMode, profileId, indicator: FRESH_BE_INDICATOR });
  const filed = filedBillOfEntry(jobData);
  blankBeNumbers(cachi01);
  const validation = await checkBillOfEntry(jobData, cachi01);
  if (filed) validation.warnings.unshift('Job: ' + filedNote(filed));
  const { text, unconfirmedTables } = writeBeFlat(cachi01, { withInfo: true, beNo: '', beDate: '' });
  // ICEGATE file name: the numeric job no, at most 8 characters
  const jobNumber =
    String((cachi01.headerField || {}).jobNumber || '')
      .replace(/\D/g, '')
      .slice(-BE_FILE_NAME_DIGITS) || 'BE';
  return {
    success: true,
    fileName: jobNumber + '.be',
    content: text,
    validation,
    unconfirmedTables,
    filedNote: filed ? filedNote(filed) : undefined,
  };
}

function igmProblems(igmRows, wantedCodes) {
  const problems = [];
  if (!igmRows.length) problems.push('IGM details are empty (Job Header > IGM)');
  igmRows.forEach((igm, index) => {
    const prefix = `IGM ${index + 1}: `;
    if (!igm.igmNumber) problems.push(prefix + 'IGM No is empty');
    if (!igm.igmDate) problems.push(prefix + 'IGM Date is empty');
    if (wantedCodes.includes(PRIOR_TO_FINAL_CODE) && !igm.inwardDate)
      problems.push(prefix + 'Inward date is empty (needed to make a prior BE final)');
    if (!igm.mawbNo) problems.push(prefix + 'MAWB / BL No is empty');
    if (!(Number(igm.totalNoOfPackages) > 0)) problems.push(prefix + 'Packages are empty');
    if (!(Number(igm.grossWeight) > 0)) problems.push(prefix + 'Gross weight is empty');
  });
  return problems;
}

/** The checks of the parts an amendment file carries. */
function amendmentFileProblems(cachi01, jobData, wantedCodes) {
  const problems = [];
  if (!(cachi01.headerField || {}).senderID) problems.push('ICEGATE ID (sender) missing - select an ICEGATE profile');
  if (!String(jobData.beNo || '').replace(/\D/g, '')) problems.push('BE No of the filed BE is empty (Job > BE No)');
  if (!String(jobData.beDate || '').trim()) problems.push('BE Date of the filed BE is empty');
  if (wantedCodes.some((code) => IGM_AMENDMENT_CODES.includes(code))) {
    problems.push(...igmProblems((cachi01.master || {}).igmsModel || [], wantedCodes));
  }
  return problems;
}

async function buildBeAmendmentFile(request) {
  const { jobData, beType, transportMode, profileId, codes, reason, amendJobNo } = request;
  // an amendment goes with the job number the BE was filed with
  const cachi01 = await buildBillOfEntry(request, {
    beType,
    transportMode,
    profileId,
    indicator: FRESH_BE_INDICATOR,
    isAmendment: true,
    amendment: true,
    amendReason: reason,
  });
  const wantedCodes = (codes || []).map((code) => String(code).toUpperCase());
  const problems = amendmentFileProblems(cachi01, jobData, wantedCodes);
  if (problems.length) {
    throw new BadRequestError(problems.join('; '), {
      body: { success: false, error: problems.join('; '), errors: problems },
    });
  }
  const jobNumber = String(amendJobNo || (cachi01.headerField || {}).jobNumber || '')
    .replace(/\D/g, '')
    .slice(-AMENDMENT_FILE_NAME_DIGITS);
  const { text, unconfirmedCodes } = writeBeAmendFlat(cachi01, {
    codes: wantedCodes,
    reason,
    jobNo: jobNumber,
    beNo: jobData.beNo,
    beDate: String(jobData.beDate || '')
      .replace(/-/g, '')
      .slice(0, 8),
  });
  return {
    success: true,
    fileName: (jobNumber || 'BEAMD') + '.be',
    content: text,
    unconfirmedCodes,
    codes: Object.fromEntries(wantedCodes.map((code) => [code, AMEND_CODES[code] && AMEND_CODES[code].label])),
  };
}

/** POST /amend-be-flat: the BE amendment flat file (CACHI01_A); any failure is answered 400. */
export async function makeBeAmendmentFlatFile(request) {
  try {
    return await buildBeAmendmentFile(request);
  } catch (error) {
    rethrowApiError(error);
    console.error('[ICEGATE] amend-be-flat error:', error.message);
    throw new BadRequestError(error.message);
  }
}

/** GET /be-amend-codes */
export function listBeAmendmentCodes() {
  return {
    success: true,
    data: Object.entries(AMEND_CODES).map(([code, entry]) => ({
      code,
      label: entry.label,
      confirmed: !!entry.confirmed,
    })),
  };
}
