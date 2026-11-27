import { ExportJob } from '../../../models/index.js';
import { Op } from '../../../config/database.js';
import {
  ApiError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from '../../../core/http/index.js';
import { buildSB_CACHE01 } from '../../../utils/customs/IcegateJsonBuilder.js';
import { validateIcegateJson } from '../../../utils/customs/icegateValidate.js';
import { checkJobNo } from '../../../utils/customs/icegateJobNo.js';
import { writeFlat } from '../../../utils/customs/sbFileReader.js';
import { checkSbAck } from '../../../utils/customs/icegateAck.js';
import { logIcegate } from '../../../utils/customs/icegateLog.js';
import { loadExportJob } from '../../customs/export-job/exportJob.service.js';
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

const FRESH_SB_INDICATOR = 'P';
const TEST_SB_INDICATOR = 'T';
const DRAFT_STATUSES = [{ status: null }, { status: 'DRAFT' }, { status: '' }];
const SB_STATE_ATTRIBUTES = ['sbNo', 'sbDate', 'icegateUniqueId', 'icegateStatus', 'additionalData'];
const ACK_JOB_ATTRIBUTES = ['icegateStatus', 'icegateUniqueId', 'sbNo', 'sbDate', 'status'];
const STORED_ACK_ATTRIBUTES = ['id', 'icegateStatus', 'icegateUniqueId', 'sbNo', 'sbDate', 'additionalData'];

const ackHelpers = { getIcegateConfig, getAuthToken };

function parseAdditionalData(text) {
  try {
    return JSON.parse(text || '{}') || {};
  } catch {
    return {};
  }
}

const filedShippingBill = (jobData) => {
  const number = String((jobData && (jobData.sbNo || jobData.sbNumber)) || '').trim();
  return number ? { no: number, date: String((jobData && jobData.sbDate) || '').trim() } : null;
};

const filedSbNote = (filed) =>
  `This job already has SB No ${filed.no}${filed.date ? ' dt ' + filed.date : ''} (filed).` +
  ' A file made now is a NEW Shipping Bill, so its SB No / date are left blank. For a change to the filed SB use Amend in the Export job list.';

/** The SB state of the job: the saved job counts as well as the screen (the screen may be older than the SB No). */
async function savedSbFields(exportData) {
  let jobData = exportData || {};
  if (!jobData.id) return jobData;
  try {
    const job = await ExportJob.findByPk(jobData.id, { attributes: SB_STATE_ATTRIBUTES });
    if (job) {
      const extra = parseAdditionalData(job.additionalData);
      const savedNumber = job.sbNo || extra.sbNumber;
      jobData = {
        sbNo: savedNumber || jobData.sbNo || jobData.sbNumber,
        sbDate: (savedNumber ? job.sbDate || extra.sbDate : jobData.sbDate) || '',
        icegateUniqueId: job.icegateUniqueId || jobData.icegateUniqueId,
        icegateStatus: job.icegateStatus || jobData.icegateStatus,
      };
    }
  } catch (error) {
    console.warn('[ICEGATE] SB state of job', jobData.id, error.message);
  }
  return jobData;
}

/** filed = the job has an SB No; sent = ICEGATE took the SB and the SB No is not back yet. */
async function shippingBillState(exportData) {
  const jobData = await savedSbFields(exportData);
  const filed = filedShippingBill(jobData);
  const sentAndTaken =
    !filed && jobData.icegateUniqueId && /^(filed|amended)$/i.test(String(jobData.icegateStatus || '').trim());
  return { filed, sent: sentAndTaken ? String(jobData.icegateUniqueId) : null };
}

/** A filed job is not sent again as a fresh SB (an amendment goes on). */
async function checkJobCanBeSent({ exportData, amendment, resendOk }) {
  if (!exportData || amendment) return;
  const state = await shippingBillState(exportData);
  if (state.filed) {
    const message =
      `This job already has SB No ${state.filed.no}${state.filed.date ? ' dt ' + state.filed.date : ''} - it was filed.` +
      ' Sending it again would file a NEW Shipping Bill. For a change use Amend in the Export job list.';
    throw new ConflictError(message, { body: { success: false, filed: true, error: message } });
  }
  if (state.sent && resendOk !== true) {
    const message =
      `This SB was already sent to ICEGATE and accepted (ICEGATE id ${state.sent}); the SB No is not back yet.` +
      ' Send it again only if ICEGATE rejected it.';
    throw new ConflictError(message, { body: { success: false, sent: true, uniqueId: state.sent, error: message } });
  }
}

const screenChecks = (exportData, invoices) => ({
  mode: exportData.shipmentMode,
  epzTyped: exportData.autoField_11,
  invoices: invoices || [],
});

const amendmentChecks = ({ exportData, amendReason, amendmentType }) => ({
  amendment: true,
  amendReason,
  amendmentType,
  sbNo: exportData.sbNo || exportData.sbNumber,
  sbDate: exportData.sbDate,
});

function failValidation(validation) {
  const message = 'Validation failed: fix ' + validation.errors.length + ' error(s) before sending';
  throw new ApiError(422, message, { body: { success: false, error: message, validation } });
}

/** The ICEGATE ID the SB went out with is kept: its reply (getAck) must be asked with that ID. */
async function rememberSenderId(jobId, loginId) {
  const job = await ExportJob.findByPk(jobId, { attributes: ['id', 'additionalData'] });
  if (!job) return;
  const extra = parseAdditionalData(job.additionalData);
  extra.icegateSenderId = loginId;
  delete extra.icegateAck;
  await ExportJob.update({ additionalData: JSON.stringify(extra) }, { where: { id: jobId } });
}

async function markJobSent(exportData, answer, amendment, config) {
  try {
    if (exportData && exportData.id) {
      await ExportJob.update(
        {
          icegateStatus: amendment ? 'Amended' : 'Filed',
          icegateUniqueId: answer.uniqueId,
          isAmended: !!amendment,
        },
        { where: { id: exportData.id } },
      );
    }
    // the job leaves DRAFT once the SB is sent (Export dashboard)
    await ExportJob.update({ status: 'SUBMITTED' }, { where: { id: exportData.id, [Op.or]: DRAFT_STATUSES } });
    await rememberSenderId(exportData.id, config.loginId);
  } catch (error) {
    console.error('Failed to update ExportJob DB status:', error.message);
  }
}

const icegateSaid = (answer) => String(answer.message || answer.validationStatus || 'taken').replace(/\.+$/, '');

const sentLogText = (config, signing, answer, headerField) =>
  `SB sent to ICEGATE as ${config.loginId}` +
  `${signing.signerCn ? ', signed by ' + signing.signerCn : ' (NOT signed)'} - Unique ID ${answer.uniqueId || '-'},` +
  ` control no ${headerField.sequenceOrControlNumber || '-'}. ICEGATE: ${icegateSaid(answer)}.`;

async function rejectNotTaken(exportData, config, response, cache01Json, author) {
  const answer = response.data;
  const reason = answer.errorMessage || answer.message || answer.validationStatus || 'no reason given';
  await logIcegate(
    'EXPORT',
    exportData && exportData.id,
    'ICEGATE_NOT_SENT',
    `SB not taken by ICEGATE (as ${config.loginId}, HTTP ${response.status}): ${reason}`,
    author,
  );
  const message = answer.errorMessage || answer.message || 'SB filing failed';
  throw new BadRequestError(message, {
    body: {
      success: false,
      validationStatus: answer.validationStatus,
      error: message,
      details: answer,
      cache01: cache01Json,
    },
  });
}

async function buildCheckedShippingBill(request) {
  const { exportData, items, invoices, indicator, amendment, amendmentType, amendReason, profileId } = request;
  const cache01Json = await buildSB_CACHE01(exportData, items || [], invoices || [], {
    indicator: indicator || FRESH_SB_INDICATOR,
    amendment: !!amendment,
    amendmentType,
    amendReason,
    profileId,
    signerCn: null,
    signedAt: null,
  });
  const validation = validateIcegateJson('SB', cache01Json, {
    ...screenChecks(exportData, invoices),
    ...(amendment ? amendmentChecks(request) : {}),
  });
  if (!amendment) await checkJobNo('SB', validation, exportData, cache01Json);
  if (!validation.ok) failValidation(validation);
  return cache01Json;
}

async function fileShippingBill(request, author) {
  const { profileId, pin, exportData, amendment } = request;
  await checkJobCanBeSent(request);
  const config = await getIcegateConfig(profileId);
  const tokenData = await getAuthToken(config);
  if (!exportData) throw new BadRequestError('exportData is required');

  const cache01Json = await buildCheckedShippingBill(request);
  const jsonText = JSON.stringify(cache01Json, null, 2);
  const fileName = 'SB_' + Date.now() + '_CACHE01.json';
  const signing = await signFilingFile(cache01Json, jsonText, pin, {
    module: 'EXPORT',
    jobId: exportData && exportData.id,
    documentLabel: 'SB',
    author,
  });

  const form = buildFilingForm(fileName, signing.fileText, signing);
  console.log('[ICEGATE] submit-sb — submitting:', fileName, signing.signatureB64 ? '(SIGNED with DSC)' : '(UNSIGNED)');
  const response = await sendFilingForm(config, tokenData, form);
  const answer = response.data;
  console.log('[ICEGATE] submit-sb response:', response.status, loggedAnswer(answer));

  if (!fileTaken(response.status, answer)) await rejectNotTaken(exportData, config, response, cache01Json, author);

  await markJobSent(exportData, answer, amendment, config);
  await logIcegate(
    'EXPORT',
    exportData && exportData.id,
    'ICEGATE_SENT',
    sentLogText(config, signing, answer, cache01Json.headerField || {}),
    author,
  );
  return {
    success: true,
    validationStatus: answer.validationStatus,
    message: answer.message || 'SB filed successfully to ICEGATE',
    uniqueId: answer.uniqueId,
    fileName,
    signerCn: signing.signerCn,
    signWarning: signing.signWarning,
    cache01: cache01Json,
  };
}

/** POST /submit-sb: builds the CACHE01 JSON, signs it with the DSC token and files the Shipping Bill on ICEGATE. */
export async function submitShippingBill(request, author) {
  try {
    return await fileShippingBill(request, author);
  } catch (error) {
    rethrowApiError(error);
    const message = icegateErrorMessage(error);
    console.error('[ICEGATE] submit-sb error:', message);
    await logIcegate(
      'EXPORT',
      request && request.exportData && request.exportData.id,
      'ICEGATE_NOT_SENT',
      'SB not sent to ICEGATE: ' + message,
      author,
    );
    throw new InternalServerError(message, {
      body: { success: false, error: message, details: error.response && error.response.data },
    });
  }
}

async function askShippingBillAcknowledgement(job, options) {
  try {
    return await checkSbAck(job, ackHelpers, options);
  } catch (error) {
    if (isJobProblem(error)) throw new BadRequestError(error.message);
    throw error;
  }
}

async function readSbAcknowledgement({ jobId, profileId, uniqueId }, author) {
  const job = jobId ? await ExportJob.findByPk(jobId) : null;
  if (!job) throw new NotFoundError('Job not found - save the job first');
  const ack = await askShippingBillAcknowledgement(job, { profileId, uniqueId, author });
  const fresh = await ExportJob.findByPk(job.id, { attributes: ACK_JOB_ATTRIBUTES });
  return {
    success: true,
    state: ack.state,
    message: ack.message,
    sbNo: ack.sbNo,
    sbDate: ack.sbDate,
    errors: ack.errors,
    meta: ack.stored.meta,
    ackText: ack.stored.ackText,
    uniqueId: ack.uniqueId,
    senderId: ack.senderId,
    saved: ack.saved,
    job: {
      icegateStatus: fresh.icegateStatus,
      icegateUniqueId: fresh.icegateUniqueId,
      sbNo: fresh.sbNo || '',
      sbDate: fresh.sbDate || '',
      status: fresh.status,
    },
  };
}

/** POST /sb-ack: the ICEGATE reply of a Shipping Bill, asked with the ICEGATE ID it went out with. */
export async function checkSbAcknowledgement(request = {}, author) {
  try {
    return await readSbAcknowledgement(request, author);
  } catch (error) {
    throw icegateUnreachable(error);
  }
}

/** GET /sb-ack/:jobId: the last stored reply, unless it belongs to an earlier filing of the job. */
export async function getStoredSbAcknowledgement(jobId) {
  const job = await ExportJob.findByPk(jobId, { attributes: STORED_ACK_ATTRIBUTES });
  if (!job) throw new NotFoundError('Job not found');
  const extra = parseAdditionalData(job.additionalData);
  const ack = extra.icegateAck;
  if (ack && ack.uniqueId && job.icegateUniqueId && ack.uniqueId !== job.icegateUniqueId) delete extra.icegateAck;
  return {
    success: true,
    icegateStatus: job.icegateStatus,
    uniqueId: job.icegateUniqueId,
    ack: extra.icegateAck || null,
    senderId: extra.icegateSenderId || '',
    sbNo: job.sbNo || extra.sbNumber || '',
    sbDate: job.sbDate || '',
  };
}

/**
 * POST /sign-sb-file: the Shipping Bill signed exactly as Confirm Submit signs it, to download and verify on
 * filesign.icegate.gov.in. NOTHING is sent to ICEGATE.
 */
export async function signShippingBillFile(request, author) {
  const { exportData, items, invoices, profileId, pin, amendment, amendmentType, amendReason } = request;
  const cache01Json = await buildSB_CACHE01(exportData, items || [], invoices || [], {
    indicator: FRESH_SB_INDICATOR,
    amendment: !!amendment,
    amendmentType,
    amendReason,
    profileId,
    signerCn: null,
    signedAt: null,
  });
  const validation = validateIcegateJson('SB', cache01Json, screenChecks(exportData, invoices));
  if (!amendment) await checkJobNo('SB', validation, exportData, cache01Json);
  const jsonText = JSON.stringify(cache01Json, null, 2);
  const signature = await signForChecking(jsonText, pin);
  const signedFile = attachDigSign(jsonText, signature);
  const headerField = cache01Json.headerField || {};
  const fileName = signedCheckFileName(
    'SB',
    exportData.jobNo || headerField.jobNumber || exportData.id || 'job',
    headerField.senderID,
  );
  await logIcegate(
    'EXPORT',
    exportData.id,
    'ICEGATE_SIGNED_FILE',
    `Signed SB file made for checking (${fileName}) - NOT sent to ICEGATE.` +
      ` ICEGATE ID ${headerField.senderID || '-'}, signed by ${signature.signerCn || '-'}` +
      `${signature.certificateB64 ? '' : ' (certificate missing in the file)'}.`,
    author,
  );
  return {
    success: true,
    fileName,
    json: signedFile,
    signerCn: signature.signerCn,
    senderId: headerField.senderID || '',
    certificate: !!signature.certificateB64,
    validation,
  };
}

/** The fresh-filing CACHE01 JSON of the screen's job and its checks (profileId = the ICEGATE ID of the file). */
async function buildFreshShippingBill({ exportData, items, invoices, profileId }) {
  const cache01 = await buildSB_CACHE01(exportData, items || [], invoices || [], {
    indicator: FRESH_SB_INDICATOR,
    profileId,
  });
  const validation = validateIcegateJson('SB', cache01, screenChecks(exportData, invoices));
  await checkJobNo('SB', validation, exportData, cache01);
  return { cache01, validation };
}

// the .sb carries every part of the ICES 1.5 Exports message format 3.7 except service tax refund, which ICES has
// not implemented
function warnServiceTaxRefundLeftOut(cache01, validation) {
  const refundRows = (cache01.master || {}).servTaxRefund || [];
  if (Array.isArray(refundRows) && refundRows.length) {
    validation.warnings.unshift(
      'Flat file: the service tax refund rows (' +
        refundRows.length +
        ') are not in the .sb - ICES has not implemented that part of the message.',
    );
  }
}

/** POST /flat-sb: the same shipping bill as an ICES 1.5 flat file (.sb), always a fresh SB (SB No / date blank). */
export async function makeSbFlatFile(request) {
  const { cache01, validation } = await buildFreshShippingBill(request);
  const { filed } = await shippingBillState(request.exportData);
  if (filed) validation.warnings.unshift('Job: ' + filedSbNote(filed));
  warnServiceTaxRefundLeftOut(cache01, validation);
  const content = writeFlat(cache01, { sbNo: '', sbDate: '' });
  const jobNumber = String((cache01.headerField || {}).jobNumber || 'SB').replace(/\D/g, '') || 'SB';
  return {
    success: true,
    fileName: jobNumber + '.sb',
    content,
    validation,
    filedNote: filed ? filedSbNote(filed) : undefined,
  };
}

/** POST /preview-sb: the CACHE01 JSON and its checks, nothing sent; a filed job is pointed out (not for an amendment). */
export async function previewShippingBill(request) {
  const { cache01, validation } = await buildFreshShippingBill(request);
  const filed = request.amendment ? null : (await shippingBillState(request.exportData)).filed;
  if (filed) validation.warnings.unshift('Job: ' + filedSbNote(filed));
  return { success: true, cache01, validation, filedNote: filed ? filedSbNote(filed) : undefined };
}

const itemsOfInvoices = (invoices) =>
  invoices.flatMap((invoice, index) =>
    (invoice.items || []).map((item) => ({ ...item, invSr: item.invSr || index + 1 })),
  );

/**
 * POST /amend-sb: the amendment JSON of a saved job (loaded as the screen loads it). The amendment is marked by
 * messageType A; the indicator stays T / P. It is checked like a fresh SB plus the amendment fields.
 */
export async function makeSbAmendment({ jobId, amendmentType, amendReason, indicator, profileId }) {
  const exportData = await loadExportJob(jobId);
  if (!exportData) throw new NotFoundError('Job not found');
  const invoices = exportData.invoices || [];
  const cache01 = await buildSB_CACHE01(exportData, itemsOfInvoices(invoices), invoices, {
    indicator: indicator === TEST_SB_INDICATOR ? TEST_SB_INDICATOR : FRESH_SB_INDICATOR,
    profileId: profileId || undefined,
    isAmendment: true,
    amendmentType,
    amendReason,
  });
  const validation = validateIcegateJson('SB', cache01, {
    ...screenChecks(exportData, invoices),
    ...amendmentChecks({ exportData, amendReason, amendmentType }),
  });
  return {
    success: true,
    cache01,
    validation,
    message: validation.ok
      ? 'Amendment JSON generated.'
      : 'Amendment JSON generated with ' + validation.errors.length + ' error(s) - fix them before sending.',
  };
}
