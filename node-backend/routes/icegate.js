const path = require('path');
const fs = require('fs'); // fix 28-Oct-2026: used by the e-Sanchit upload folder but was never required
const express   = require("express");
const router    = express.Router();
const AppSetting = require("../models/AppSetting");
const axios     = require("axios");
const { buildBE_CACHI01, buildSB_CACHE01 } = require("../utils/IcegateJsonBuilder");
const { validateIcegateJson } = require("../utils/icegateValidate");
const IcegateProfile = require("../models/IcegateProfile");
const ImportJob = require("../models/ImportJob");
const ExportJob = require("../models/ExportJob");
const { logIcegate, who } = require("../utils/icegateLog");

// ICEGATE uses govt SSL cert — bypass verification
const { httpsAgent: icegateAgent, rejectUnauthorized: tlsStrict } = require('../utils/tls'); // certificate check on by default (28-Oct-2026)

// DSC signing through the Local Signer (local_signer/app.py, PKCS#11 hardware token). 30-Oct-2026
// Before this the URL "http://localhost:5050" was written into the BE route and the SB route separately, so a signer
// running on another machine or port could not be used at all, and the two copies could drift apart. It is one
// setting now (icegate_dsc_signer_url, or the DSC_SIGNER_URL environment variable).
async function getSignerUrl() {
  try {
    const row = await AppSetting.findOne({ where: { key: 'icegate_dsc_signer_url' } });
    if (row && String(row.value || '').trim()) return String(row.value).trim().replace(/\/+$/, '');
  } catch (e) { /* no settings table yet: fall through to the environment / default */ }
  return String(process.env.DSC_SIGNER_URL || 'http://localhost:5050').trim().replace(/\/+$/, '');
}

// Signs the JSON and returns the three fields the ICEGATE schema's digSign block wants.
// Throws an Error with .userMessage for anything the operator has to act on.
async function signJsonWithDsc(jsonStr, pin) {
  const base = await getSignerUrl();
  let data;
  try {
    const r = await axios.post(base + '/sign-json', { json_data: jsonStr, pin }, { timeout: 30000 });
    data = r.data || {};
  } catch (err) {
    const answered = !!(err.response);   // the signer replied with an error: it is running, the signing failed
    const detail = (err.response && err.response.data && err.response.data.error) ? err.response.data.error : err.message;
    const e = new Error(detail);
    e.userMessage = answered
      ? 'DSC signing failed at ' + base + ': ' + detail + ' (check that the token is plugged in, the PIN is right and the token drivers are installed)'
      : 'DSC Signer not reachable at ' + base + '. Start the Local Signer app and insert the DSC token'
        + ' (a signer on another machine or port is set in Settings > ICEGATE > DSC signer URL). Details: ' + detail;
    // 424, not 500: a 500 with "ECONNREFUSED" in it is shown as "Server error (ref ...)" by server.js. 17-Nov-2026
    e.httpStatus = answered ? 400 : 424;
    throw e;
  }
  if (!data.success) {
    const e = new Error(data.error || 'Unknown error');
    e.userMessage = 'DSC signing failed: ' + (data.error || 'Unknown error');
    e.httpStatus = 400;
    throw e;
  }
  // startCertificate is the signer's certificate. Older copies of local_signer/app.py did not return it; the file
  // then goes out without it rather than with something made up, and the caller says so in the reply.
  return {
    signatureB64:    data.signature_b64 || '',
    signerCn:        data.signer_cn || '',
    certificateB64:  data.certificate_b64 || '',
    signerVersion:   String(data.signer_version || '1'),
    signerUrl:       base,
  };
}

// 18-Nov-2026: the signed file in the layout ICEGATE's own signer utility writes (checked byte for byte against two
// BE files signed with it): the text that was signed, its closing "}" replaced by the digSign block. The signer signs
// the same text either way; only the layout of digSign in the file is ICEGATE's.
function attachDigSign(jsonStr, sg) {
  const body = String(jsonStr).replace(/\n\}\s*$/, '');
  return body + '\n,\n"digSign":\n{\n"startSignature":' + JSON.stringify(sg.signatureB64 || '')
    + ',\n"startCertificate":' + JSON.stringify(sg.certificateB64 || '')
    + ',\n"signerVersion":' + JSON.stringify(sg.signerVersion || '1.0') + '\n}\n}';
}
// ICEGATE format (signerVersion 1.0) = a raw RSA signature, not a PKCS#7 file: it is not sent as a separate .p7s part.
function isCmsSignature(sg) { return !!sg && String(sg.signerVersion || '') === '1'; }

// 17-Nov-2026: did ICEGATE take the file? Production answers {"message": "Your file has been accepted and is being
// processed.", uniqueId ...} - the old check (validationStatus === "SUCCESS" only) called that a FAILURE: the job was not
// marked Filed, no unique ID was kept, and pressing Send again would have filed a second BE / SB. Taken = HTTP 2xx and
// SUCCESS / ACCEPTED, or a unique ID, or an "accepted / being processed" message - and no failure status.
function fileTaken(httpStatus, data) {
  if (!data || typeof data !== 'object' || httpStatus < 200 || httpStatus >= 300) return false;
  const vs = String(data.validationStatus || '').trim().toUpperCase();
  const msg = String(data.message || '');
  if (/FAIL|ERROR|REJECT|INVALID/.test(vs)) return false;
  if (vs === 'SUCCESS' || vs === 'ACCEPTED') return true;
  if (/not\s+(been\s+)?accepted|reject|fail|invalid|\berror\b/i.test(msg)) return false;
  if (String(data.errorMessage || '').trim() && !/accepted/i.test(msg)) return false;
  return !!String(data.uniqueId || '').trim() || /\baccepted\b|being processed/i.test(msg);
}

// Helper: get ICEGATE config from DB or env
async function getIcegateConfig(profileId = null) {
  if (profileId) {
    const p = await IcegateProfile.findByPk(profileId);
    if (!p) throw new Error("Selected ICEGATE Profile not found.");
    return { loginId: p.loginId, password: p.password, apiKey: p.apiKey, baseUrl: p.baseUrl || "https://cisapi.icegate.gov.in" };
  }
  
  const dp = await IcegateProfile.findOne({ where: { isDefault: true } });
  if (dp) return { loginId: dp.loginId, password: dp.password, apiKey: dp.apiKey, baseUrl: dp.baseUrl || "https://cisapi.icegate.gov.in" };

  const settings = await AppSetting.findAll({ where: { group: "icegate" } });
  const cfg = {};
  settings.forEach(s => { cfg[s.key] = s.value; });
  return {
    loginId:  cfg.icegate_login_id  || process.env.ICEGATE_LOGIN_ID  || "",
    password: cfg.icegate_password  || process.env.ICEGATE_PASSWORD  || "",
    apiKey:   cfg.icegate_api_key   || process.env.ICEGATE_API_KEY   || "",
    baseUrl:  cfg.icegate_base_url  || process.env.ICEGATE_BASE_URL  || "https://cisapi.icegate.gov.in",
  };
}

// In-memory token cache per API Key
let _tokenCacheMap = {};

async function getAuthToken(cfg) {
  const cacheKey = cfg.apiKey;
  const cached = _tokenCacheMap[cacheKey];
  // Return cached token if still valid (with 2 min buffer)
  if (cached && cached.token && cached.expiresAt && new Date() < new Date(new Date(cached.expiresAt).getTime() - 120000)) {
    return cached;
  }

  const url = `${cfg.baseUrl}/authentication/v1.0/api/authenticate`;

  // Per ICEGATE API Contract v1.4:
  // Send {"key": "<API_KEY>"} in body — no loginId/password, no X-Api-Key header
  const response = await axios.post(url, { key: cfg.apiKey }, {
    headers: { "Content-Type": "application/json" },
    httpsAgent: icegateAgent,
    timeout: 30000,
  });

  const data = response.data;
  console.log(`[ICEGATE] auth response for ${cfg.loginId}:`, JSON.stringify(data));

  // Response fields: accessToken, status, tokenExpiresIn, message
  const tokenData = {
    token:      data.accessToken || data.token || "",
    expiresAt:  data.tokenExpiresIn || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status:     data.status || "Authenticated",
    message:    data.message || "",
  };
  _tokenCacheMap[cacheKey] = tokenData;
  return tokenData;
}

// POST /api/icegate/test-auth — Test ICEGATE authentication
router.post("/test-auth", async (req, res) => {
  try {
    const { profileId, loginId, password, apiKey, baseUrl } = req.body;
    let cfg;
    
    const masked = (v) => !v || String(v).startsWith('****');
    if (loginId && apiKey) {
        cfg = { loginId, password, apiKey, baseUrl: baseUrl || 'https://cisapi.icegate.gov.in' };
        if ((masked(cfg.password) || masked(cfg.apiKey)) && profileId && profileId !== 'new') { // the screen shows saved secrets masked (28-Oct-2026)
            const dbCfg = await getIcegateConfig(profileId);
            if (masked(cfg.password)) cfg.password = dbCfg.password;
            if (masked(cfg.apiKey)) cfg.apiKey = dbCfg.apiKey;
        }
    } else {
        cfg = await getIcegateConfig(profileId);
    }
    
    // force fresh cache for this profile
    delete _tokenCacheMap[cfg.apiKey]; 
    
    if (!cfg.loginId || !cfg.password || !cfg.apiKey) {
      return res.status(400).json({ success: false, error: "ICEGATE credentials not configured." });
    }
    const tokenData = await getAuthToken(cfg);
    res.json({ success: true, status: tokenData.status, expiresAt: tokenData.expiresAt, message: "Authentication successful" });
  } catch (err) {
    const errBody = err.response?.data;
    const msg = errBody?.message || errBody?.error || errBody?.errorMessage || err.message;
    console.error("[ICEGATE] auth error status:", err.response?.status);
    console.error("[ICEGATE] auth error body:", JSON.stringify(errBody));
    res.status(500).json({ success: false, error: msg, statusCode: err.response?.status, details: errBody });
  }
});

// POST /api/icegate/file-submit — Submit BE or SB JSON file to ICEGATE
// Per API Contract v1.4: multipart/form-data, token in header, file in 'file' field
router.post("/file-submit", async (req, res) => {
  try {
    const { jsonContent, fileName, profileId } = req.body;
    const cfg       = await getIcegateConfig(profileId);
    const tokenData = await getAuthToken(cfg);
    
    if (!jsonContent) return res.status(400).json({ success: false, error: "jsonContent is required" });


    const url = `${cfg.baseUrl}/jsonfiling/v1.0/api/fileSubmit`;

    // Build multipart form-data
    const FormData = require("form-data");
    const form = new FormData();
    const fileBuffer = Buffer.from(
      typeof jsonContent === "string" ? jsonContent : JSON.stringify(jsonContent, null, 2),
      "utf8"
    );
    form.append("file", fileBuffer, {
      filename: fileName || "filing.json",
      contentType: "application/json",
    });

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        "token": tokenData.token,   // Per doc: header name is "token"
      },
      httpsAgent: icegateAgent,
      timeout: 60000,
      validateStatus: null,
    });

    const data = response.data;
    console.log("[ICEGATE] fileSubmit status:", response.status, "| response:", JSON.stringify(data).substring(0, 1000));

    if (fileTaken(response.status, data)) {
        res.json({ success: true, validationStatus: data.validationStatus, message: data.message, uniqueId: data.uniqueId, errorMessage: data.errorMessage });
    } else {
      res.status(400).json({ success: false, validationStatus: data.validationStatus, error: data.errorMessage || data.message || "Filing failed", details: data });
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error("[ICEGATE] file-submit error:", msg, err.response?.data);
    res.status(500).json({ success: false, error: msg, details: err.response?.data });
  }
});

// POST /api/icegate/get-ack — Get acknowledgement for submitted file
// Per API Contract v1.4 section 5: senderId + uniqueId in body, token in header
router.post("/get-ack", async (req, res) => {
  try {
    const { profileId } = req.body;
    const cfg       = await getIcegateConfig(profileId);
    const tokenData = await getAuthToken(cfg);
    const { uniqueId, senderId } = req.body;

    if (!uniqueId) return res.status(400).json({ success: false, error: "uniqueId is required" });

    const url = `${cfg.baseUrl}/jsonfiling/v1.0/api/outbound/getAck`;
    const response = await axios.post(url,
      { uniqueId, senderId: senderId || cfg.loginId },
      {
        headers: {
          "Content-Type": "application/json",
          "token": tokenData.token,
        },
        httpsAgent: icegateAgent,
        timeout: 30000,
        validateStatus: null,
      }
    );
    console.log("[ICEGATE] getAck status:", response.status, "| data:", JSON.stringify(response.data).substring(0, 200));
    res.json({ success: true, data: response.data, status: response.status });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/icegate/submit-be — Build CACHI01 JSON and submit to ICEGATE
router.post("/submit-be", async (req, res) => {
  try {
    const { profileId } = req.body;
    const { jobData, items, invoices, beType, transportMode, indicator, amendment, amendmentType, amendReason, profileId: reqProfileId, pin } = req.body;
    if (!jobData) return res.status(400).json({ success: false, error: "jobData is required" });
    // 29-Oct-2026: ICEGATE takes only a FRESH BE as JSON; a BE amendment is the flat file CACHI01_A (/amend-be-flat).
    // Before, an "amendment" went out as a fresh BE JSON with messageType A in the header only.
    if (amendment) return res.status(400).json({ success: false, error: 'A BE amendment cannot be sent as JSON. Use ACTIONS > BE Amendment File (.be) and upload that file on ICEGATE.' });
    // 10-Nov-2026: an amended job (copy made by the BE amendment register) is never sent as a fresh BE
    if (jobData._amendmentId || /^AMD\//.test(String(jobData.jobNo || ''))) return res.status(400).json({ success: false, error: 'This is an amended job: send it from Customs > BE Amendments (amendment file), not as a fresh BE.' });
    // 16-Nov-2026: a job with a BE No was filed already - sending it again would file a second BE
    { const f = filedBe(jobData); if (f) return res.status(409).json({ success: false, error: `This job already has BE No ${f.no}${f.date ? ' dt ' + f.date : ''} - it was filed. Sending it again would file a NEW Bill of Entry. For a change use ACTIONS > BE Amendment. If the BE No on the job is wrong, clear it in Job Header > BE Filing Details and save first.` }); }

    // Build + check the BE before logging in to ICEGATE (28-Oct-2026: the login came first, so a login problem hid the
    // validation errors and every check cost an ICEGATE token)
    await require('../utils/icegateJobNo').withStoredNo('BE', jobData);   // 18-Nov-2026: the number of the first filing is kept
    const cachi01Json = await buildBE_CACHI01(jobData, items || [], invoices || [], {
      beType, transportMode, indicator: indicator || "P", amendment: !!amendment, amendmentType, amendReason, profileId: reqProfileId
    });
    const beCheck = validateIcegateJson('BE', cachi01Json, { screen: jobData });
    if (!amendment) await require('../utils/icegateJobNo').checkJobNo('BE', beCheck, jobData, cachi01Json);   // 18-Nov-2026: numeric job no, once per FY
    if (!beCheck.ok) return res.status(422).json({ success: false, error: 'Validation failed: fix ' + beCheck.errors.length + ' error(s) before sending', validation: beCheck });

    const cfg       = await getIcegateConfig(profileId);
    // production ICEGATE accepts only DSC-signed files; only the UAT server takes an unsigned test file
    if (!pin && !/uat/i.test(String(cfg.baseUrl || ''))) return res.status(400).json({ success: false, error: 'Enter the DSC token PIN: ICEGATE production accepts only a signed BE file.' });
    const tokenData = await getAuthToken(cfg);

    const jsonStr    = JSON.stringify(cachi01Json, null, 2);
    let jsonStrFinal = jsonStr;   // the signed file: the same JSON with digSign filled in
    const fileName   = `BE_${Date.now()}_CACHI01.json`;
    const url        = `${cfg.baseUrl}/jsonfiling/v1.0/api/fileSubmit`;

    let signatureB64 = null;
    let signerCn     = '';
    let attachP7s    = true;

    let signWarning = null;
    if (!pin) {
      console.warn("[ICEGATE] No token PIN provided – submitting unsigned (may be rejected in production).");
    } else {
      let sg;
      try {
        sg = await signJsonWithDsc(jsonStr, pin);
      } catch (signErr) {
        console.error("[ICEGATE] Local signer error:", signErr.message);
        await logIcegate('IMPORT', jobData.id, 'ICEGATE_NOT_SENT', 'BE not sent to ICEGATE - the file could not be signed: ' + (signErr.userMessage || signErr.message), who(req));
        return res.status(signErr.httpStatus || 500).json({ success: false, error: signErr.userMessage || signErr.message });
      }
      signatureB64 = sg.signatureB64;
      signerCn     = sg.signerCn;
      if (!isCmsSignature(sg)) attachP7s = false;
      // 30-Oct-2026: the signature was only attached as a separate part of the upload and the BE JSON went out with
      // no digSign block at all, which ICEGATE answers with "Digital Signature (DSC) validation failed". The CACHI01
      // schema carries it inside the file: digSign { startSignature, startCertificate, signerVersion }.
      cachi01Json.digSign = {
        startSignature:   signatureB64,
        startCertificate: sg.certificateB64,
        signerVersion:    sg.signerVersion,
      };
      jsonStrFinal = attachDigSign(jsonStr, sg);
      if (!sg.certificateB64) signWarning = 'The signer did not return the certificate, so digSign.startCertificate is empty - update local_signer/app.py on the signing machine';
      console.log("[ICEGATE] JSON signed via DSC token. Signer CN:", signerCn, "| certificate:", sg.certificateB64 ? 'yes' : 'MISSING');
    }

    // Build multipart form-data
    const FormData = require("form-data");
    const form = new FormData();
    form.append("file", Buffer.from(jsonStrFinal, "utf8"), {
      filename: fileName,
      contentType: "application/json",
    });
    
    // Attach PKCS#7 detached signature (old CMS format only; the ICEGATE format carries the signature in digSign only)
    if (signatureB64 && attachP7s) {
      const sigBuffer = Buffer.from(signatureB64, "base64");
      form.append("signature", sigBuffer, {
        filename:    fileName.replace(".json", ".p7s"),
        contentType: "application/pkcs7-signature",
      });
    }

    console.log("[ICEGATE] submit-be — submitting file:", fileName);
    const response = await axios.post(url, form, {
      headers: { ...form.getHeaders(), "token": tokenData.token },
      httpsAgent: icegateAgent,
      timeout: 60000,
      validateStatus: null,
    });

    const data = response.data;
    console.log("[ICEGATE] submit-be response:", response.status, JSON.stringify(data).substring(0, 1000));

    if (fileTaken(response.status, data)) {
        try {
            // 30-Oct-2026: the JSON that ICEGATE received is kept on the job (filedJson) and the job is locked again
            if (jobData && jobData.id) await ImportJob.update({
                icegateStatus: (!!amendment) ? 'Amended' : 'Filed',
                icegateUniqueId: data.uniqueId,
                isAmended: !!amendment,
                filedJson: jsonStrFinal, filedAt: new Date(), filedFileName: fileName, filedSigner: signerCn || null,
                amendUnlockedAt: null, amendUnlockedBy: null,
                // 18-Nov-2026: the reply of the earlier filing is dropped - the reply window showed the old rejection
                // (Port of Origin) under the new Unique ID until ICEGATE was asked again
                icegateAck: null, icegateAckAt: null,
                icegateJobNo: Number((cachi01Json.headerField || {}).jobNumber) || null
            }, { where: { id: jobData.id } });
        } catch(e) { console.error('Failed to update ImportJob DB status:', e.message); }
        const hf = cachi01Json.headerField || {};
        await logIcegate('IMPORT', jobData.id, 'ICEGATE_SENT', `BE sent to ICEGATE as ${cfg.loginId}${signerCn ? ', signed by ' + signerCn : ' (NOT signed)'} - Unique ID ${data.uniqueId || '-'}, control no ${hf.sequenceOrControlNumber || '-'}. ICEGATE: ${String(data.message || data.validationStatus || 'taken').replace(/\.+$/, '')}. The answer of ICES (BE No or errors) comes later - ICEGATE REPLY on the job.`, who(req));

        res.json({
        success: true,
        validationStatus: data.validationStatus,
        message: data.message || "BE filed successfully to ICEGATE",
        uniqueId: data.uniqueId,
        fileName,
        signerCn,
        signWarning,
        cachi01: cachi01Json,
      });
    } else {
      await logIcegate('IMPORT', jobData.id, 'ICEGATE_NOT_SENT', `BE not taken by ICEGATE (as ${cfg.loginId}, HTTP ${response.status}): ${data.errorMessage || data.message || data.validationStatus || 'no reason given'}`, who(req));
      res.status(400).json({
        success: false,
        validationStatus: data.validationStatus,
        error: data.errorMessage || data.message || "Filing failed",
        details: data,
        cachi01: cachi01Json,  // return JSON for debugging
      });
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error("[ICEGATE] submit-be error:", msg);
    await logIcegate('IMPORT', req.body && req.body.jobData && req.body.jobData.id, 'ICEGATE_NOT_SENT', 'BE not sent to ICEGATE: ' + msg, who(req));
    res.status(500).json({ success: false, error: msg, details: err.response?.data });
  }
});

// POST /api/icegate/be-ack { jobId, profileId? } — ask ICEGATE for the acknowledgement of a filed BE (getAck) and
// put the answer on the job: Accepted (BE no / date filled when empty), Rejected (error list) or still pending. 29-Oct-2026
// GET  /api/icegate/be-ack/:jobId — the last stored answer
router.post("/be-ack", async (req, res) => {
  try {
    const { jobId, profileId, uniqueId } = req.body || {};
    const job = jobId ? await ImportJob.findByPk(jobId) : null;
    if (!job) return res.status(404).json({ success: false, error: 'Job not found - save the job first' });
    let r;
    try { r = await require('../utils/icegateAck').checkJobAck(job, { getIcegateConfig, getAuthToken }, { profileId, uniqueId, author: who(req) }); }
    catch (e) { if (!e.response && !/ECONN|ETIMEDOUT|ENOTFOUND/.test(String(e.code || e.message))) return res.status(400).json({ success: false, error: e.message }); throw e; }
    const fresh = await ImportJob.findByPk(job.id, { attributes: ['icegateStatus', 'icegateUniqueId', 'icegateAckAt', 'beNo', 'beDate', 'extendedData'] });
    let ext = {}; try { ext = fresh && fresh.extendedData ? JSON.parse(fresh.extendedData) : {}; } catch (e) { ext = {}; }
    res.json({ success: true, state: r.state, message: r.message, beNo: r.beNo, beDate: r.beDate, errors: r.errors, meta: r.stored.meta, ackText: r.stored.ackText, uniqueId: r.uniqueId, senderId: r.senderId, saved: r.saved, job: { icegateStatus: fresh.icegateStatus, icegateUniqueId: fresh.icegateUniqueId, icegateAckAt: fresh.icegateAckAt, beNo: fresh.beNo || ext.beNo || '', beDate: fresh.beDate || ext.beDate || '' } });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(502).json({ success: false, error: 'Could not reach ICEGATE: ' + msg });
  }
});
router.get("/be-ack/:jobId", async (req, res) => {
  try {
    const job = await ImportJob.findByPk(req.params.jobId, { attributes: ['id', 'icegateStatus', 'icegateUniqueId', 'icegateAck', 'icegateAckAt', 'beNo', 'beDate', 'extendedData'] });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    let ack = null; try { ack = job.icegateAck ? JSON.parse(job.icegateAck) : null; } catch (e) { ack = null; }
    // 18-Nov-2026: an answer stored for another (earlier) filing of the job is not shown as this filing's answer
    if (ack && ack.uniqueId && job.icegateUniqueId && ack.uniqueId !== job.icegateUniqueId) ack = null;
    let ext = {}; try { ext = job.extendedData ? JSON.parse(job.extendedData) : {}; } catch (e) { ext = {}; }
    res.json({ success: true, icegateStatus: job.icegateStatus, uniqueId: job.icegateUniqueId, at: ack ? job.icegateAckAt : null, ack, beNo: job.beNo || ext.beNo || '', beDate: job.beDate || ext.beDate || '' });   // BE no / date are columns since 30-Oct-2026
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/icegate/preview-be — Preview CACHI01 JSON without submitting
// 16-Nov-2026: a job that already has a BE No was filed. A file made from it for ICEGATE is a NEW BE: before, the .be and
// the JSON carried the old BE No / date in every row (a fresh filing has them blank), and Send to ICEGATE sent the filed
// job again as a new BE. The checklist still gets the BE No (preview without forFiling).
const filedBe = (d) => { const no = String((d && (d.beNo || d.beNumber)) || '').trim(); return no ? { no, date: String(d.beDate || '').trim() } : null; };
const filedNote = (f) => `This job already has BE No ${f.no}${f.date ? ' dt ' + f.date : ''} (filed). A file made now is a NEW Bill of Entry, so its BE No / date are left blank. For a change to the filed BE use ACTIONS > BE Amendment.`;
function freshFiling(cj) {
  const m = (cj && cj.master) || {};
  for (const rows of Object.values(m)) if (Array.isArray(rows)) rows.forEach(r => { if (r && typeof r === 'object') { if ('beNumber' in r) r.beNumber = ''; if ('beDate' in r) r.beDate = ''; } });
  return cj;
}

router.post("/preview-be", async (req, res) => {
  try {
    const { jobData, items, invoices, beType, transportMode, profileId, forFiling } = req.body;
    if (!jobData) return res.status(400).json({ success: false, error: "jobData is required" });
    await require('../utils/icegateJobNo').withStoredNo('BE', jobData);
    const cachi01 = await buildBE_CACHI01(jobData, items || [], invoices || [], { beType, transportMode, profileId });
    const filed = forFiling ? filedBe(jobData) : null;
    if (filed) freshFiling(cachi01);
    const validation = validateIcegateJson('BE', cachi01, { screen: jobData });
    await require('../utils/icegateJobNo').checkJobNo('BE', validation, jobData, cachi01);
    if (filed) validation.warnings.unshift('Job: ' + filedNote(filed));
    res.json({ success: true, cachi01, validation, filedNote: filed ? filedNote(filed) : undefined });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/icegate/sign-be-file { jobData, items, invoices, beType, transportMode, profileId, pin } - the BE file signed
// with the DSC token exactly as "Confirm Submit" signs it, given back to download. NOTHING is sent to ICEGATE. 17-Nov-2026:
// ICEGATE answered "DSC Verification Failed" to a BE sent from here; this file is checked on ICEGATE's own signer site
// (filesign.icegate.gov.in, Verify) to tell a DSC / registration problem from a signing-format problem.
router.post("/sign-be-file", async (req, res) => {
  try {
    const { jobData, items, invoices, beType, transportMode, profileId, pin } = req.body || {};
    if (!jobData) return res.status(400).json({ success: false, error: "jobData is required" });
    if (!pin) return res.status(400).json({ success: false, error: "Enter the DSC token PIN" });
    await require('../utils/icegateJobNo').withStoredNo('BE', jobData);
    const cachi01Json = await buildBE_CACHI01(jobData, items || [], invoices || [], { beType, transportMode, indicator: 'P', profileId });
    if (filedBe(jobData)) freshFiling(cachi01Json);
    const validation = validateIcegateJson('BE', cachi01Json, { screen: jobData });
    await require('../utils/icegateJobNo').checkJobNo('BE', validation, jobData, cachi01Json);
    const jsonStr = JSON.stringify(cachi01Json, null, 2);
    let sg;
    try { sg = await signJsonWithDsc(jsonStr, pin); }
    catch (signErr) { return res.status(signErr.httpStatus || 424).json({ success: false, error: signErr.userMessage || signErr.message }); }
    cachi01Json.digSign = { startSignature: sg.signatureB64, startCertificate: sg.certificateB64, signerVersion: sg.signerVersion };
    const signedFile = attachDigSign(jsonStr, sg);
    const hf = cachi01Json.headerField || {};
    const tag = (v) => String(v || '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40);
    const fileName = `BE_${tag(jobData.jobNo || jobData.id || 'job')}_${tag(hf.senderID || 'ICEGATE')}_SIGNED_NOT_SENT.json`;
    await logIcegate('IMPORT', jobData.id, 'ICEGATE_SIGNED_FILE', `Signed BE file made for checking (${fileName}) - NOT sent to ICEGATE. ICEGATE ID ${hf.senderID || '-'}, signed by ${sg.signerCn || '-'}${sg.certificateB64 ? '' : ' (certificate missing in the file)'}.`, who(req));
    res.json({ success: true, fileName, json: signedFile, signedText: jsonStr, signatureB64: sg.signatureB64, signerCn: sg.signerCn, senderId: hf.senderID || '', certificate: !!sg.certificateB64, validation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/icegate/flat-be — the same BE as an ICES 1.5 flat file (.be) for upload on ICEGATE (29-Oct-2026).
// Built from the CACHI01 JSON (one source for both); layout checked against production .be files of another ERP.
router.post("/flat-be", async (req, res) => {
  try {
    const { jobData, items, invoices, beType, transportMode, profileId } = req.body;
    if (!jobData) return res.status(400).json({ success: false, error: "jobData is required" });
    // 14-Nov-2026: an amended job (AMD/...) goes as an amendment file (CACHI01_A) from the BE Amendment window, never as a new BE
    if (jobData._amendmentId || /^AMD\//i.test(String(jobData.jobNo || ''))) return res.status(400).json({ success: false, error: 'This is an amended job - make its amendment file in the BE Amendment window (a full BE file of it would file a new BE)' });
    await require('../utils/icegateJobNo').withStoredNo('BE', jobData);
    const cachi01 = await buildBE_CACHI01(jobData, items || [], invoices || [], { beType, transportMode, profileId, indicator: "P" });
    const filed = filedBe(jobData);
    freshFiling(cachi01); // a fresh BE file: BE No / date blank, as in every filed iCAFFE .be (16-Nov-2026)
    const validation = validateIcegateJson('BE', cachi01, { screen: jobData });
    await require('../utils/icegateJobNo').checkJobNo('BE', validation, jobData, cachi01);
    if (filed) validation.warnings.unshift('Job: ' + filedNote(filed));
    const { writeBeFlat } = require('../utils/beFlatFile');
    const { text, unconfirmedTables } = writeBeFlat(cachi01, { withInfo: true, beNo: '', beDate: '' });
    // ICEGATE file name: the numeric job no, at most 8 characters
    const job = String((cachi01.headerField || {}).jobNumber || '').replace(/\D/g, '').slice(-8) || 'BE';
    res.json({ success: true, fileName: job + '.be', content: text, validation, unconfirmedTables, filedNote: filed ? filedNote(filed) : undefined });
  } catch (err) {
    console.error("[ICEGATE] flat-be error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/icegate/amend-be-flat — BE amendment flat file (CACHI01_A), 29-Oct-2026. Layout from a filed amendment
// (prior BE -> final with the IGM details, code A_PBEIGM). Body: the job (as for /flat-be) + codes [..] + reason
// (+ amendJobNo / amendJobDate). The BE No / Date of the filed BE come from the job.
router.post("/amend-be-flat", async (req, res) => {
  try {
    const { jobData, items, invoices, beType, transportMode, profileId, codes, reason, amendJobNo } = req.body;
    if (!jobData) return res.status(400).json({ success: false, error: "jobData is required" });
    const { writeBeAmendFlat, AMEND_CODES } = require('../utils/beFlatFile');
    await require('../utils/icegateJobNo').withStoredNo('BE', jobData);   // an amendment goes with the number the BE was filed with
    const cachi01 = await buildBE_CACHI01(jobData, items || [], invoices || [], { beType, transportMode, profileId, indicator: "P", isAmendment: true, amendment: true, amendReason: reason });
    const want = (codes || []).map(c => String(c).toUpperCase());
    // checks of the parts that are sent
    const errors = [];
    if (!(cachi01.headerField || {}).senderID) errors.push('ICEGATE ID (sender) missing - select an ICEGATE profile');
    if (!String(jobData.beNo || '').replace(/\D/g, '')) errors.push('BE No of the filed BE is empty (Job > BE No)');
    if (!String(jobData.beDate || '').trim()) errors.push('BE Date of the filed BE is empty');
    if (want.some(c => ['A_PBEIGM', 'A_IGM', 'S_IGMS'].includes(c))) {
      const igms = (cachi01.master || {}).igmsModel || [];
      if (!igms.length) errors.push('IGM details are empty (Job Header > IGM)');
      igms.forEach((g, i) => {
        const w = `IGM ${i + 1}: `;
        if (!g.igmNumber) errors.push(w + 'IGM No is empty');
        if (!g.igmDate) errors.push(w + 'IGM Date is empty');
        if (want.includes('A_PBEIGM') && !g.inwardDate) errors.push(w + 'Inward date is empty (needed to make a prior BE final)');
        if (!g.mawbNo) errors.push(w + 'MAWB / BL No is empty');
        if (!(Number(g.totalNoOfPackages) > 0)) errors.push(w + 'Packages are empty');
        if (!(Number(g.grossWeight) > 0)) errors.push(w + 'Gross weight is empty');
      });
    }
    if (errors.length) return res.status(400).json({ success: false, error: errors.join('; '), errors });
    const jobNo = String(amendJobNo || (cachi01.headerField || {}).jobNumber || '').replace(/\D/g, '').slice(-7);
    const { text, unconfirmedCodes } = writeBeAmendFlat(cachi01, { codes: want, reason, jobNo, beNo: jobData.beNo, beDate: String(jobData.beDate || '').replace(/-/g, '').slice(0, 8) });
    res.json({ success: true, fileName: (jobNo || 'BEAMD') + '.be', content: text, unconfirmedCodes, codes: Object.fromEntries(want.map(c => [c, AMEND_CODES[c] && AMEND_CODES[c].label])) });
  } catch (err) {
    console.error("[ICEGATE] amend-be-flat error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});
router.get("/be-amend-codes", (req, res) => {
  const { AMEND_CODES } = require('../utils/beFlatFile');
  res.json({ success: true, data: Object.entries(AMEND_CODES).map(([code, v]) => ({ code, label: v.label, confirmed: !!v.confirmed })) });
});

// 16-Nov-2026: a job with an SB No was filed. Send to ICEGATE sent it again as a fresh SB (a second Shipping Bill with
// Customs), and the .sb file of it carried the old SB No / date in every row of a fresh "F" file (iCAFFE leaves them
// blank). The job in the database counts as well as the screen (the screen may be older than the SB No).
const filedSb = (d) => { const no = String((d && (d.sbNo || d.sbNumber)) || '').trim(); return no ? { no, date: String((d && d.sbDate) || '').trim() } : null; };
const filedSbNote = (f) => `This job already has SB No ${f.no}${f.date ? ' dt ' + f.date : ''} (filed). A file made now is a NEW Shipping Bill, so its SB No / date are left blank. For a change to the filed SB use Amend in the Export job list.`;
async function sbState(exportData) {
  let d = exportData || {};
  if (d.id) {
    try {
      const j = await ExportJob.findByPk(d.id, { attributes: ['sbNo', 'sbDate', 'icegateUniqueId', 'icegateStatus', 'additionalData'] });
      if (j) {
        let x = {}; try { x = JSON.parse(j.additionalData || '{}') || {}; } catch (e) { x = {}; }
        const no = j.sbNo || x.sbNumber || d.sbNo || d.sbNumber;
        d = { sbNo: no, sbDate: (j.sbNo || x.sbNumber ? (j.sbDate || x.sbDate) : d.sbDate) || '', icegateUniqueId: j.icegateUniqueId || d.icegateUniqueId, icegateStatus: j.icegateStatus || d.icegateStatus };
      }
    } catch (e) { console.warn('[ICEGATE] SB state of job', d.id, e.message); }
  }
  const filed = filedSb(d);
  // sent and accepted by ICEGATE, SB No not back yet
  const sent = !filed && d.icegateUniqueId && /^(filed|amended)$/i.test(String(d.icegateStatus || '').trim()) ? String(d.icegateUniqueId) : null;
  return { filed, sent };
}

// POST /api/icegate/submit-sb — Build CACHE01 JSON and submit SB to ICEGATE
router.post("/submit-sb", async (req, res) => {
  try {
    const { profileId, pin } = req.body;
    // 16-Nov-2026: a filed job is not sent again as a fresh SB (an amendment goes on)
    if (req.body.exportData && !req.body.amendment) {
      const st = await sbState(req.body.exportData);
      if (st.filed) return res.status(409).json({ success: false, filed: true, error: `This job already has SB No ${st.filed.no}${st.filed.date ? ' dt ' + st.filed.date : ''} - it was filed. Sending it again would file a NEW Shipping Bill. For a change use Amend in the Export job list.` });
      if (st.sent && req.body.resendOk !== true) return res.status(409).json({ success: false, sent: true, uniqueId: st.sent, error: `This SB was already sent to ICEGATE and accepted (ICEGATE id ${st.sent}); the SB No is not back yet. Send it again only if ICEGATE rejected it.` });
    }
    const cfg       = await getIcegateConfig(profileId);
    const tokenData = await getAuthToken(cfg);

    const { exportData, items, invoices, indicator, amendment, amendmentType, amendReason } = req.body;
    if (!exportData) return res.status(400).json({ success: false, error: "exportData is required" });

    // STEP 1: Build the CACHE01 JSON payload
    // Note: signerCn/signedAt not available yet at this point — will be added after signing
    const cache01Json = await buildSB_CACHE01(exportData, items || [], invoices || [], {
      indicator: indicator || "P", amendment: !!amendment, amendmentType, amendReason, profileId,
      signerCn: null, signedAt: null   // will be updated below after DSC sign
    });

    // Do not send a SB that ICEGATE will reject (28-Oct-2026)
    const sbCheck = validateIcegateJson('SB', cache01Json, { mode: exportData.shipmentMode, epzTyped: exportData.autoField_11, invoices: invoices || [], ...(amendment ? { amendment: true, amendReason, amendmentType, sbNo: exportData.sbNo || exportData.sbNumber, sbDate: exportData.sbDate } : {}) });
    if (!amendment) await require('../utils/icegateJobNo').checkJobNo('SB', sbCheck, exportData, cache01Json);   // 18-Nov-2026
    if (!sbCheck.ok) return res.status(422).json({ success: false, error: 'Validation failed: fix ' + sbCheck.errors.length + ' error(s) before sending', validation: sbCheck });

    let jsonStr  = JSON.stringify(cache01Json, null, 2);
    let jsonStrFinal = jsonStr;   // will be updated with digSign after signing
    const fileName = "SB_" + Date.now() + "_CACHE01.json";

    // STEP 2: Digitally sign JSON using Local DSC Signer (same tech as ICEGATE Common Signer Utility)
    //         Local Signer runs at the DSC signer URL setting (default http://localhost:5050, local_signer/app.py)
    //         It uses PKCS11 hardware token to produce PKCS#7 / CMS detached signature
    let signatureB64 = null;
    let signerCn     = '';
    let attachP7s    = true;

    let signWarning = null;
    if (!pin) {
      console.warn("[ICEGATE] No token PIN provided – submitting unsigned (may be rejected in production).");
    } else {
      let sg;
      try {
        sg = await signJsonWithDsc(jsonStr, pin);
      } catch (signErr) {
        console.error("[ICEGATE] Local signer error:", signErr.message);
        await logIcegate('EXPORT', exportData && exportData.id, 'ICEGATE_NOT_SENT', 'SB not sent to ICEGATE - the file could not be signed: ' + (signErr.userMessage || signErr.message), who(req));
        return res.status(signErr.httpStatus || 500).json({ success: false, error: signErr.userMessage || signErr.message });
      }
      signatureB64 = sg.signatureB64;
      signerCn     = sg.signerCn;
      if (!isCmsSignature(sg)) attachP7s = false;
      // 30-Oct-2026: this block used to write signerName / signedAt / signAlgorithm / signatureType - none of which
      // exist in the CACHE01 schema. Its digSign is {startSignature, startCertificate, signerVersion}.
      cache01Json.digSign = {
        startSignature:   signatureB64,
        startCertificate: sg.certificateB64,
        signerVersion:    sg.signerVersion,
      };
      jsonStrFinal = attachDigSign(jsonStr, sg);
      if (!sg.certificateB64) signWarning = 'The signer did not return the certificate, so digSign.startCertificate is empty - update local_signer/app.py on the signing machine';
      console.log("[ICEGATE] JSON signed via DSC token. Signer CN:", signerCn, "| certificate:", sg.certificateB64 ? 'yes' : 'MISSING');
    }

    // STEP 3: Submit to ICEGATE — JSON file + PKCS7 signature as multipart form
    const url      = cfg.baseUrl + "/jsonfiling/v1.0/api/fileSubmit";
    const FormData = require("form-data");
    const form     = new FormData();

    form.append("file", Buffer.from(jsonStrFinal, "utf8"), {
      filename:    fileName,
      contentType: "application/json",
    });

    // Attach PKCS#7 detached signature (old CMS format only; the ICEGATE format carries the signature in digSign only)
    if (signatureB64 && attachP7s) {
      const sigBuffer = Buffer.from(signatureB64, "base64");
      form.append("signature", sigBuffer, {
        filename:    fileName.replace(".json", ".p7s"),
        contentType: "application/pkcs7-signature",
      });
    }

    console.log("[ICEGATE] submit-sb — submitting:", fileName, signatureB64 ? "(SIGNED with DSC)" : "(UNSIGNED)");

    const response = await axios.post(url, form, {
      headers:        { ...form.getHeaders(), "token": tokenData.token },
      httpsAgent:     icegateAgent,
      timeout:        60000,
      validateStatus: null,
    });

    const data = response.data;
    console.log("[ICEGATE] submit-sb response:", response.status, JSON.stringify(data).substring(0, 1000));

    if (fileTaken(response.status, data)) {
      try {
        if (exportData && exportData.id) await ExportJob.update({
          icegateStatus: (!!amendment) ? 'Amended' : 'Filed',
          icegateUniqueId: data.uniqueId,
          isAmended: !!amendment
        }, { where: { id: exportData.id } });
        // the job leaves DRAFT once the SB is sent (Export dashboard). 29-Oct-2026
        await ExportJob.update({ status: 'SUBMITTED' }, { where: { id: exportData.id, [require('sequelize').Op.or]: [{ status: null }, { status: 'DRAFT' }, { status: '' }] } });
        // 17-Nov-2026: the ICEGATE ID the SB went out with - its reply (getAck) must be asked with that ID
        const ej = await ExportJob.findByPk(exportData.id, { attributes: ['id', 'additionalData'] });
        if (ej) { let x = {}; try { x = JSON.parse(ej.additionalData || '{}') || {}; } catch (e) { x = {}; } x.icegateSenderId = cfg.loginId; delete x.icegateAck; await ExportJob.update({ additionalData: JSON.stringify(x) }, { where: { id: exportData.id } }); }
      } catch (e) { console.error('Failed to update ExportJob DB status:', e.message); }
      await logIcegate('EXPORT', exportData && exportData.id, 'ICEGATE_SENT', `SB sent to ICEGATE as ${cfg.loginId}${signerCn ? ', signed by ' + signerCn : ' (NOT signed)'} - Unique ID ${data.uniqueId || '-'}, control no ${(cache01Json.headerField || {}).sequenceOrControlNumber || '-'}. ICEGATE: ${String(data.message || data.validationStatus || 'taken').replace(/\.+$/, '')}.`, who(req));
      res.json({
        success:          true,
        validationStatus: data.validationStatus,
        message:          data.message || "SB filed successfully to ICEGATE",
        uniqueId:         data.uniqueId,
        fileName,
        signerCn,
        signWarning,
        cache01:          cache01Json,
      });
    } else {
      await logIcegate('EXPORT', exportData && exportData.id, 'ICEGATE_NOT_SENT', `SB not taken by ICEGATE (as ${cfg.loginId}, HTTP ${response.status}): ${data.errorMessage || data.message || data.validationStatus || 'no reason given'}`, who(req));
      res.status(400).json({
        success:          false,
        validationStatus: data.validationStatus,
        error:            data.errorMessage || data.message || "SB filing failed",
        details:          data,
        cache01:          cache01Json,
      });
    }

  } catch (err) {
    const msg = (err.response && err.response.data)
      ? (err.response.data.message || err.response.data.error || err.message)
      : err.message;
    console.error("[ICEGATE] submit-sb error:", msg);
    await logIcegate('EXPORT', req.body && req.body.exportData && req.body.exportData.id, 'ICEGATE_NOT_SENT', 'SB not sent to ICEGATE: ' + msg, who(req));
    res.status(500).json({ success: false, error: msg, details: err.response && err.response.data });
  }
})

// POST /api/icegate/sb-ack { jobId, profileId?, uniqueId? } - the ICEGATE reply of a Shipping Bill, as /be-ack: asked with
// the ICEGATE ID the SB went out with, SB No / date filled when blank, status Accepted / Rejected, a job log line.
// GET /api/icegate/sb-ack/:jobId - the last stored answer. 17-Nov-2026
router.post("/sb-ack", async (req, res) => {
  try {
    const { jobId, profileId, uniqueId } = req.body || {};
    const job = jobId ? await ExportJob.findByPk(jobId) : null;
    if (!job) return res.status(404).json({ success: false, error: 'Job not found - save the job first' });
    let r;
    try { r = await require('../utils/icegateAck').checkSbAck(job, { getIcegateConfig, getAuthToken }, { profileId, uniqueId, author: who(req) }); }
    catch (e) { if (!e.response && !/ECONN|ETIMEDOUT|ENOTFOUND/.test(String(e.code || e.message))) return res.status(400).json({ success: false, error: e.message }); throw e; }
    const fresh = await ExportJob.findByPk(job.id, { attributes: ['icegateStatus', 'icegateUniqueId', 'sbNo', 'sbDate', 'status'] });
    res.json({ success: true, state: r.state, message: r.message, sbNo: r.sbNo, sbDate: r.sbDate, errors: r.errors, meta: r.stored.meta, ackText: r.stored.ackText, uniqueId: r.uniqueId, senderId: r.senderId, saved: r.saved, job: { icegateStatus: fresh.icegateStatus, icegateUniqueId: fresh.icegateUniqueId, sbNo: fresh.sbNo || '', sbDate: fresh.sbDate || '', status: fresh.status } });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(502).json({ success: false, error: 'Could not reach ICEGATE: ' + msg });
  }
});
router.get("/sb-ack/:jobId", async (req, res) => {
  try {
    const job = await ExportJob.findByPk(req.params.jobId, { attributes: ['id', 'icegateStatus', 'icegateUniqueId', 'sbNo', 'sbDate', 'additionalData'] });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    let x = {}; try { x = JSON.parse(job.additionalData || '{}') || {}; } catch (e) { x = {}; }
    if (x.icegateAck && x.icegateAck.uniqueId && job.icegateUniqueId && x.icegateAck.uniqueId !== job.icegateUniqueId) delete x.icegateAck;   // 18-Nov-2026: an earlier filing's answer
    res.json({ success: true, icegateStatus: job.icegateStatus, uniqueId: job.icegateUniqueId, ack: x.icegateAck || null, senderId: x.icegateSenderId || '', sbNo: job.sbNo || x.sbNumber || '', sbDate: job.sbDate || '' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/icegate/sign-sb-file { exportData, items, invoices, profileId, pin, amendment... } - the Shipping Bill signed
// with the DSC token exactly as Confirm Submit signs it, to download and check on filesign.icegate.gov.in. NOTHING is
// sent to ICEGATE. 17-Nov-2026
router.post("/sign-sb-file", async (req, res) => {
  try {
    const { exportData, items, invoices, profileId, pin, amendment, amendmentType, amendReason } = req.body || {};
    if (!exportData) return res.status(400).json({ success: false, error: "exportData is required" });
    if (!pin) return res.status(400).json({ success: false, error: "Enter the DSC token PIN" });
    const cache01Json = await buildSB_CACHE01(exportData, items || [], invoices || [], { indicator: "P", amendment: !!amendment, amendmentType, amendReason, profileId, signerCn: null, signedAt: null });
    const validation = validateIcegateJson('SB', cache01Json, { mode: exportData.shipmentMode, epzTyped: exportData.autoField_11, invoices: invoices || [] });
    if (!amendment) await require('../utils/icegateJobNo').checkJobNo('SB', validation, exportData, cache01Json);
    const jsonStr = JSON.stringify(cache01Json, null, 2);
    let sg;
    try { sg = await signJsonWithDsc(jsonStr, pin); }
    catch (signErr) { return res.status(signErr.httpStatus || 424).json({ success: false, error: signErr.userMessage || signErr.message }); }
    cache01Json.digSign = { startSignature: sg.signatureB64, startCertificate: sg.certificateB64, signerVersion: sg.signerVersion };
    const signedFile = attachDigSign(jsonStr, sg);
    const hf = cache01Json.headerField || {};
    const tag = (v) => String(v || '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40);
    const fileName = `SB_${tag(exportData.jobNo || hf.jobNumber || exportData.id || 'job')}_${tag(hf.senderID || 'ICEGATE')}_SIGNED_NOT_SENT.json`;
    await logIcegate('EXPORT', exportData.id, 'ICEGATE_SIGNED_FILE', `Signed SB file made for checking (${fileName}) - NOT sent to ICEGATE. ICEGATE ID ${hf.senderID || '-'}, signed by ${sg.signerCn || '-'}${sg.certificateB64 ? '' : ' (certificate missing in the file)'}.`, who(req));
    res.json({ success: true, fileName, json: signedFile, signerCn: sg.signerCn, senderId: hf.senderID || '', certificate: !!sg.certificateB64, validation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/icegate/flat-sb — the same shipping bill as an ICES 1.5 flat file (.sb) for upload on ICEGATE (29-Oct-2026).
// Built from the CACHE01 JSON (one source for both), with the same pre-check; the button only showed a message before.
router.post("/flat-sb", async (req, res) => {
  try {
    const { exportData, items, invoices, profileId } = req.body; // profileId: ICEGATE ID of the file (17-Nov-2026)
    if (!exportData) return res.status(400).json({ success: false, error: "exportData is required" });
    const cache01 = await buildSB_CACHE01(exportData, items || [], invoices || [], { indicator: "P", profileId });
    const validation = validateIcegateJson('SB', cache01, { mode: exportData.shipmentMode, epzTyped: exportData.autoField_11, invoices: invoices || [] });
    await require('../utils/icegateJobNo').checkJobNo('SB', validation, exportData, cache01);
    // a fresh SB file ("F"): SB No / date blank, as in every iCAFFE .sb (16-Nov-2026; it carried the job's SB No)
    const filed = (await sbState(exportData)).filed;
    if (filed) validation.warnings.unshift('Job: ' + filedSbNote(filed));
    // 18-Nov-2026 warning "not carried by the .sb" removed 19-Nov-2026: the .sb now writes every part of the ICES 1.5
    // Exports message format 3.7 (accessories, third party, cess, AR4, packing, EOU, stuffing, SW constituent / production /
    // control, re-export ...). Only service tax refund (STR) stays out - "not yet implemented" in ICES.
    {
      const str = (cache01.master || {}).servTaxRefund || [];
      if (Array.isArray(str) && str.length) validation.warnings.unshift('Flat file: the service tax refund rows (' + str.length + ') are not in the .sb - ICES has not implemented that part of the message.');
    }
    const content = require('../utils/sbFileReader').writeFlat(cache01, { sbNo: '', sbDate: '' });
    const job = String((cache01.headerField || {}).jobNumber || 'SB').replace(/\D/g, '') || 'SB';
    res.json({ success: true, fileName: job + '.sb', content, validation, filedNote: filed ? filedSbNote(filed) : undefined });
  } catch (err) {
    console.error("[ICEGATE] flat-sb error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/icegate/preview-sb — Preview CACHE01 JSON without submitting
router.post("/preview-sb", async (req, res) => {
  try {
    const { exportData, items, invoices, profileId } = req.body; // profileId: ICEGATE ID of the file (17-Nov-2026)
    if (!exportData) return res.status(400).json({ success: false, error: "exportData is required" });
    const cache01 = await buildSB_CACHE01(exportData, items || [], invoices || [], { indicator: "P", profileId });
    const validation = validateIcegateJson('SB', cache01, { mode: exportData.shipmentMode, epzTyped: exportData.autoField_11, invoices: invoices || [] });
    await require('../utils/icegateJobNo').checkJobNo('SB', validation, exportData, cache01);
    // 16-Nov-2026: say so when the job was filed (not for an amendment)
    const filed = req.body.amendment ? null : (await sbState(exportData)).filed;
    if (filed) validation.warnings.unshift('Job: ' + filedSbNote(filed));
    res.json({ success: true, cache01, validation, filedNote: filed ? filedSbNote(filed) : undefined });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// POST /api/icegate/amend-sb — Generate Amendment JSON
router.post("/amend-sb", async (req, res) => {
  try {
    const { jobId, amendmentType, amendReason } = req.body;
    if (!jobId) return res.status(400).json({ success: false, error: "jobId is required" });
    if (!amendReason) return res.status(400).json({ success: false, error: "amendReason is required" });

    // the job as the screen loads it (the old include asked for job.items, a link the job does not have, so this
    // always failed; additionalData fields were also missing). Indicator T / P (was "A", not a valid indicator: the
    // amendment is marked by messageType A). The JSON is checked like a fresh SB, plus the amendment fields. 29-Oct-2026
    const exportData = await require('./exportJobs').loadExportJob(jobId);
    if (!exportData) return res.status(404).json({ success: false, error: "Job not found" });
    const invoices = exportData.invoices || [];
    const items = invoices.flatMap((inv, i) => (inv.items || []).map(it => ({ ...it, invSr: it.invSr || i + 1 })));

    const cache01 = await buildSB_CACHE01(exportData, items, invoices, {
      indicator: req.body.indicator === 'T' ? 'T' : 'P',
      profileId: req.body.profileId || undefined, // 17-Nov-2026
      isAmendment: true,
      amendmentType,
      amendReason
    });
    const validation = validateIcegateJson('SB', cache01, { mode: exportData.shipmentMode, epzTyped: exportData.autoField_11, invoices, amendment: true, amendReason, amendmentType, sbNo: exportData.sbNo || exportData.sbNumber, sbDate: exportData.sbDate });
    res.json({ success: true, cache01, validation, message: validation.ok ? "Amendment JSON generated." : "Amendment JSON generated with " + validation.errors.length + " error(s) - fix them before sending." });
  } catch (err) {
    console.error("Error generating amendment:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
const multer = require('multer');
// 29-Oct-2026: PDFs are kept per job (uploads/esanchit_archive/<job no>/<doc code>_<irn>_<time>_<name>.pdf) so the
// documents of a job can be found later; before every file went into one folder as esanchit-<random>.pdf. The form
// fields jobNo / docCode / irn must be appended BEFORE the pdf part (multer reads them in stream order).
// 30-Oct-2026: a name made only of dots/dashes ("..") is not a folder name (it pointed at the uploads root)
const safeName = (s, dflt) => { const v = String(s || '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60); return !v || /^[._-]+$/.test(v) ? dflt : v; };
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/esanchit_archive', safeName(req.body && req.body.jobNo, 'misc'));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const b = req.body || {};
    const orig = safeName(path.basename(String(file.originalname || 'document.pdf'), '.pdf'), 'document');
    cb(null, `${safeName(b.documentCode || b.docCode, 'doc')}_${safeName(b.irn, 'noirn')}_${Date.now()}_${orig}.pdf`);
  }
});
// only PDFs: by type/extension at upload time, and by the %PDF header once written (pdfOnly)
const upload = multer({ storage: storage, limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const okType = /pdf$/i.test(String(file.mimetype || '')) || /\.pdf$/i.test(String(file.originalname || ''));
  cb(okType ? null : new Error('Only PDF files can be attached (e-Sanchit takes PDF only)'), okType);
} });
const pdfOnly = (req, res, next) => {
  if (!req.file) return next();
  try {
    const fd = fs.openSync(req.file.path, 'r'); const head = Buffer.alloc(5); fs.readSync(fd, head, 0, 5, 0); fs.closeSync(fd);
    if (head.toString('latin1') !== '%PDF-') { try { fs.unlinkSync(req.file.path); } catch (e) { /* gone */ } return res.status(400).json({ success: false, error: 'The file is not a PDF (header check failed)' }); }
  } catch (e) { return res.status(400).json({ success: false, error: 'Could not read the uploaded file' }); }
  next();
};
// multer's own refusals (type / size) as a JSON answer instead of a crash
const uploadErr = (err, req, res, next) => (err ? res.status(400).json({ success: false, error: err.message || 'Upload failed' }) : next());
const archiveUrl = (req) => '/uploads/esanchit_archive/' + safeName(req.body && req.body.jobNo, 'misc') + '/' + req.file.filename;

// the signing relay keeps the PDF in memory: nothing to write, nothing to clean up, and no stray folder under
// uploads/esanchit_archive (which is for documents kept with a job)
const signUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const okType = /pdf$/i.test(String(file.mimetype || '')) || /\.pdf$/i.test(String(file.originalname || ''));
  cb(okType ? null : new Error('Only PDF files can be signed (e-Sanchit takes PDF only)'), okType);
} });

// GET /api/icegate/signer-status - is the DSC signer running, and does it see the token drivers? The e-Sanchit panel
// asked localhost:5050 straight from the browser, which told the operator "not running" whenever the signer sat on
// another machine. 30-Oct-2026
router.get('/signer-status', async (req, res) => {
  const base = await getSignerUrl();
  try {
    // 16-Nov-2026: 12 s (the signer may be looking at the token drivers when asked)
    const r = await axios.get(base + '/status', { timeout: 12000 });
    res.json({ success: true, signerUrl: base, ...(r.data || {}) });
  } catch (e) {
    res.json({ success: false, signerUrl: base, status: 'not running', dll_found: false, error: e.message });
  }
});

// POST /api/icegate/sign-pdf - sign a document PDF with the DSC token. Fields: pdf, pin. Answers with the signed PDF.
// 30-Oct-2026: four screens posted straight to "http://localhost:5050/sign-pdf", so e-Sanchit signing only worked when
// the token sat in the same machine as the browser, and the URL could not be changed anywhere. The browser asks the
// backend now, which knows the one DSC signer URL setting (and reaches a signer on another machine).
router.post('/sign-pdf', signUpload.single('pdf'), uploadErr, async (req, res) => {
  const cleanup = () => { if (req.file) req.file.buffer = null; };
  try {
    if (!req.file || !req.file.buffer || !req.file.buffer.length) return res.status(400).json({ success: false, error: 'PDF file is required' });
    if (req.file.buffer.slice(0, 5).toString('latin1') !== '%PDF-') { cleanup(); return res.status(400).json({ success: false, error: 'The file is not a PDF (header check failed)' }); }
    const pin = String((req.body && req.body.pin) || '').trim();
    if (!pin) { cleanup(); return res.status(400).json({ success: false, error: 'DSC token PIN is required' }); }
    const base = await getSignerUrl();
    const FormData = require('form-data');
    const form = new FormData();
    form.append('pdf', req.file.buffer, { filename: req.file.originalname || 'document.pdf', contentType: 'application/pdf' });
    form.append('pin', pin);
    let r;
    try {
      r = await axios.post(base + '/sign-pdf', form, { headers: form.getHeaders(), responseType: 'arraybuffer', timeout: 60000, maxBodyLength: Infinity, maxContentLength: Infinity });
    } catch (err) {
      cleanup();
      const answered = !!(err.response);
      let detail = err.message;
      if (answered && err.response.data) { try { detail = JSON.parse(Buffer.from(err.response.data).toString('utf8')).error || detail; } catch (e) { /* not JSON */ } }
      return res.status(answered ? 400 : 500).json({ success: false, error: answered
        ? 'DSC signing failed at ' + base + ': ' + detail + ' (check that the token is plugged in, the PIN is right and the token drivers are installed)'
        : 'DSC Signer not reachable at ' + base + '. Start the Local Signer app and insert the DSC token'
          + ' (a signer on another machine or port is set in Settings > ICEGATE > DSC signer URL). Details: ' + detail });
    }
    const signed = Buffer.from(r.data);
    cleanup();
    if (signed.slice(0, 5).toString('latin1') !== '%PDF-') {
      let detail = 'the signer did not answer with a PDF';
      try { detail = JSON.parse(signed.toString('utf8')).error || detail; } catch (e) { /* not JSON either */ }
      return res.status(400).json({ success: false, error: 'DSC signing failed: ' + detail });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="signed_' + safeName(path.basename(String(req.file.originalname || 'document.pdf'), '.pdf'), 'document') + '.pdf"');
    res.send(signed);
  } catch (e) {
    cleanup();
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/icegate/esanchit-archive - keep a document PDF with the job (no signing / upload). Fields: jobNo, docCode, irn, pdf. 29-Oct-2026
router.post('/esanchit-archive', upload.single('pdf'), uploadErr, pdfOnly, (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'PDF file is required' });
  res.json({ success: true, fileUrl: archiveUrl(req), fileName: req.file.filename });
});
// GET /api/icegate/esanchit-archive?jobNo=... - the PDFs kept for a job
router.get('/esanchit-archive', (req, res) => {
  const key = safeName(req.query.jobNo, 'misc');
  const dir = path.join(__dirname, '../uploads/esanchit_archive', key);
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.pdf$/i.test(f)).map(f => { const st = fs.statSync(path.join(dir, f)); return { fileName: f, fileUrl: '/uploads/esanchit_archive/' + key + '/' + f, size: st.size, savedAt: st.mtime }; }); } catch (e) { files = []; }
  res.json({ success: true, data: files });
});

// POST /api/icegate/upload-esanchit — Upload signed PDF to e-Sanchit via Puppeteer
router.post("/upload-esanchit", upload.single('pdf'), uploadErr, pdfOnly, async (req, res) => {
  try {
    const { profileId, documentCode } = req.body;
    if (!documentCode) return res.status(400).json({ success: false, error: "documentCode is required" });
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Signed PDF file is required in 'pdf' field" });
    }

    const tempPath = req.file.path;
    const fileUrl = archiveUrl(req);
    // 29-Oct-2026: the e-Sanchit portal upload (EsanchitUploader, Puppeteer) is not finished - it used to answer with an
    // invented "IRN_<time>" that went into the job and would be rejected by ICEGATE. Until the portal upload is mapped
    // (set ESANCHIT_AUTO_UPLOAD=1 to try it), the signed PDF is kept in the archive and the user uploads it on e-Sanchit
    // and types the real 16-digit IRN.
    if (process.env.ESANCHIT_AUTO_UPLOAD !== '1') {
      return res.json({ success: false, signedOnly: true, fileUrl, error: 'Signed PDF saved. Upload it on the e-Sanchit portal (icegate.gov.in > e-Sanchit) and enter the IRN it gives.' });
    }
    const cfg = await getIcegateConfig(profileId);
    const { uploadToESanchit } = require("../utils/EsanchitUploader");
    const result = await uploadToESanchit(cfg.loginId, cfg.password, tempPath, documentCode);
    if (result.success && /^\d{16}$/.test(String(result.irn || ''))) {
      res.json({ success: true, irn: result.irn, drn: result.drn, message: result.message, fileUrl });
    } else {
      res.json({ success: false, signedOnly: true, fileUrl, error: result.error || 'e-Sanchit did not return a 16-digit IRN - upload the signed PDF on the portal and enter the IRN' });
    }
    
    // Cleanup temp file after some time or immediately
    // Cleanup removed so file remains in esanchit_archive

  } catch (err) {
    console.error("Error in /upload-esanchit:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// POST /api/icegate/test-imap - Test IMAP connection
router.post('/test-imap', async (req, res) => {
  let { imapEmail, imapAppPassword, imapHost, imapPort, imapFolder } = req.body;
  if (imapAppPassword && String(imapAppPassword).startsWith('****') && req.body.id) { // saved password (masked on the screen)
    const p = await require('../models/IcegateProfile').findByPk(req.body.id).catch(() => null);
    imapAppPassword = p ? p.imapAppPassword : '';
  }
  if (!imapEmail || !imapAppPassword) {
    return res.status(400).json({ success: false, message: "Email and App Password are required." });
  }

  const imaps = require('imap-simple');
  const config = {
    imap: {
      user: imapEmail,
      password: imapAppPassword,
      host: imapHost || 'imap.gmail.com',
      port: imapPort || 993,
      tls: true,
      authTimeout: 5000,
      tlsOptions: { rejectUnauthorized: tlsStrict }
    }
  };

  try {
    const connection = await imaps.connect(config);
    connection.on('error', (err) => {
      console.error("IMAP Connection error handled gracefully:", err.message);
    });
    // Try to open the specified box if not ALL
    let testFolder = (imapFolder || 'INBOX').split(',')[0].trim();
    if (testFolder.toUpperCase() === 'ALL') testFolder = 'INBOX'; // fallback just to test auth
    
    await connection.openBox(testFolder);
    connection.end();
    return res.json({ success: true, message: "Connection Successful!" });
  } catch (err) {
    console.error("IMAP Test Error:", err);
    return res.json({ success: false, message: "Connection Failed: " + err.message });
  }
});

module.exports = router;
module.exports.getIcegateConfig = getIcegateConfig;
module.exports.getAuthToken = getAuthToken;