"""
EagleView Signer - signing core (16-Nov-2026)

One code base for the DSC USB token signing used by EagleView:
  - the desktop tool (eagleview_signer.py: window, tray icon, PIN asked in the tool), and
  - the old console signer (local_signer/app.py, START_SIGNER.bat), which now only imports this file.

HTTP API on 127.0.0.1:5050 (same as the old Local Signer, so the EagleView backend keeps working):
  GET  /status      token driver, token plugged in, certificate (name, valid to)
  POST /sign-pdf    PDF -> signed PDF (e-Sanchit)                     fields: pdf, [pin]
  POST /sign-json   ICEGATE BE / SB JSON -> signature for digSign        body: json_data, [pin], [format]
                    18-Nov-2026: ICEGATE signer format (signerVersion "1.0") - see sign_json_icegate;
                    format "cms" gives the old detached CMS (signerVersion "1")
  POST /sign-file   flat file (BE amendment) -> attached CMS (.sig)     body: data_b64, [pin]
When no PIN is sent and the tool runs, the tool asks for the PIN in its own window (ASK_PIN hook).

Fixed on the way (16-Nov-2026):
  - /sign-pdf called pyHanko's PKCS11Signer(pkcs11_module=..., user_pin=...). pyHanko has no such arguments
    (it takes an open session), so every PDF signing ended in an error. Now a session is opened and the
    signing key + its certificate are picked from the token.
  - /sign-json signed the bare SHA-256 hash with CKM_RSA_PKCS (no DigestInfo), which is not a valid
    sha256WithRSA signature. Now CKM_SHA256_RSA_PKCS over the content (DigestInfo built by hand if the token
    lacks that mechanism).
  - /sign-json built the CMS with version=Integer(1) and an EncapsulatedContentInfo object, both refused by
    asn1crypto 1.5 ("v1" / a plain dict needed) - it could not produce a signature at all.
  - Browser calls are allowed only from the EagleView addresses (any web page could otherwise ask the token).
"""
import base64
import glob
import hashlib
import io
import json
import os
import re
import struct
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone

from flask import Flask, jsonify, make_response, request, send_file

VERSION = "2.0"
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 40 * 1024 * 1024

# Hooks the desktop tool sets (None in the console signer):
ASK_PIN = None        # function(meta: dict) -> str | None   (None = cancelled)
ON_SIGNED = []        # functions(record: dict)
LOG = print           # the tool sends this to its log window

# ---------------------------------------------------------------------------------------------------------------
# Which web pages may call the signer from the browser. Calls without an Origin header (EagleView backend, curl, the
# tool itself) are always allowed. The tool keeps this list in its settings.
# ---------------------------------------------------------------------------------------------------------------
DEFAULT_ORIGINS = [
    "http://localhost:5001", "http://127.0.0.1:5001", "http://localhost:5173", "http://127.0.0.1:5173",
    "http://192.168.1.211:5001", "http://192.168.1.211:5173", "https://eagleview.committedgroup.com",
]
ALLOWED_ORIGINS = list(DEFAULT_ORIGINS)


def origin_ok(origin):
    if not origin:
        return True
    o = origin.strip().rstrip("/").lower()
    if o in ("http://127.0.0.1:5050", "http://localhost:5050"):
        return True
    return any(o == a.strip().rstrip("/").lower() for a in ALLOWED_ORIGINS if a.strip())


@app.before_request
def _guard_origin():
    origin = request.headers.get("Origin")
    if request.method == "OPTIONS":
        resp = make_response("", 204 if origin_ok(origin) else 403)
        return resp
    if not origin_ok(origin):
        return jsonify({"error": f"This page ({origin}) may not use the DSC signer. Add its address in "
                                 f"EagleView Signer > Settings > EagleView addresses."}), 403
    return None


@app.after_request
def _cors(resp):
    origin = request.headers.get("Origin")
    if origin and origin_ok(origin):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Expose-Headers"] = "X-Signer-CN, Content-Disposition"
        # Chrome: a page on the office network calling 127.0.0.1 (Private Network Access)
        resp.headers["Access-Control-Allow-Private-Network"] = "true"
    return resp


# ---------------------------------------------------------------------------------------------------------------
# DSC token driver (PKCS#11 DLL) - see the 16-Nov-2026 notes in local_signer: known DLLs first (HYP2003 =
# eps2003csp11v2.dll), then any *pkcs11* / *p11* / *csp11* DLL in System32. Each is tried in a separate process.
# ---------------------------------------------------------------------------------------------------------------
WIN = os.environ.get("SystemRoot", r"C:\Windows")
SYS32 = os.path.join(WIN, "System32")
WOW64 = os.path.join(WIN, "SysWOW64")
PF = [os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")]
KNOWN_DLL_NAMES = [
    "eps2003csp11v2.dll",      # HYP2003 (HyperPKI / Hypersecu) - the office token
    "castle_v2.dll",           # HYP2003 (newer driver)
    "eps2003csp11.dll",        # ePass2003 (Feitian)
    "eps2003auto.dll",         # ePass2003 Auto
    "ShuttleCsp11_3003.dll",   # ePass3003
    "SignatureP11.dll",        # ProxKey / Watchdata
    "WDPKCS.dll",              # Watchdata (older)
    "CryptoIDA_pkcs11.dll",    # mToken CryptoID (Longmai)
    "mtoken_pkcs11.dll",       # mToken
    "eTPKCS11.dll",            # SafeNet / Gemalto eToken 5110
    "IDPrimePKCS11.dll",       # Gemalto IDPrime
    "asepkcs.dll",             # Athena / SafeNet ASE
    "acospkcs11.dll",          # ACOS
    "BPKCS11.dll",             # Rainbow iKey
    "bit4ipki.dll",            # Bit4id
    "TrustKeyP11.dll",         # Trust Key
    "HyperPKI.dll",            # Hypersecu
    "opensc-pkcs11.dll",       # OpenSC
]
KNOWN_FULL_PATHS = [
    os.path.join(PF[0], r"SafeNet\Authentication\SAC\x64\IDPrimePKCS1164.dll"),
    os.path.join(PF[0], r"Safenet\Authentication\SAC\x64\pk2priv.dll"),
    os.path.join(PF[0], r"OpenSC Project\OpenSC\pkcs11\opensc-pkcs11.dll"),
]
PY_BITS = struct.calcsize("P") * 8
_lock = threading.Lock()
SIGN_LOCK = threading.Lock()      # one token operation at a time
DLL_PATH = None
TOKEN_INFO = {}
_last_check = 0.0
_checking = False


def _candidates():
    out = []
    env = os.environ.get("DSC_PKCS11_DLL", "").strip().strip('"')
    if env:
        out.append(env)
    dirs = [SYS32] + ([WOW64] if PY_BITS == 32 else [])
    for d in dirs:
        for n in KNOWN_DLL_NAMES:
            out.append(os.path.join(d, n))
    out += KNOWN_FULL_PATHS
    for d in dirs:
        try:
            for f in glob.glob(os.path.join(d, "*.dll")):
                b = os.path.basename(f).lower()
                if re.search(r"pkcs11|p11|csp11", b) and not b.startswith(("api-ms-", "ext-ms-")):
                    out.append(f)
        except Exception:
            pass
    seen, uniq = set(), []
    for c in out:
        k = c.lower()
        if k not in seen and os.path.isfile(c):
            seen.add(k)
            uniq.append(c)
    return uniq


def probe_main(path):
    """Run in a child process: load one DLL, print what it sees as JSON."""
    try:
        import pkcs11
        lib = pkcs11.lib(path)
        labels = []
        for slot in lib.get_slots(token_present=True):
            try:
                labels.append((slot.get_token().label or "").strip() or "token")
            except Exception:
                labels.append("token")
        print(json.dumps({"ok": True, "labels": labels}))
    except Exception as e:
        print(json.dumps({"ok": False, "labels": [], "error": str(e)[:160]}))


def _probe(path):
    if getattr(sys, "frozen", False):          # EagleViewSigner.exe: the exe itself answers --probe
        cmd = [sys.executable, "--probe", path]
    else:
        cmd = [sys.executable, os.path.abspath(__file__), "--probe", path]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=25,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        lines = [l for l in (r.stdout or "").splitlines() if l.strip().startswith("{")]
        j = json.loads(lines[-1]) if lines else {"ok": False, "labels": [], "error": (r.stderr or "no answer").strip()[-160:]}
        return bool(j.get("ok")), list(j.get("labels") or []), j.get("error")
    except Exception as e:
        return False, [], str(e)[:160]


def resolve_dll(force=False):
    global DLL_PATH, TOKEN_INFO
    with _lock:
        if DLL_PATH and TOKEN_INFO.get("token_present") and not force:
            return DLL_PATH
        tried, first_loadable, picked, picked_labels = [], None, None, []
        for c in _candidates():
            ok, labels, err = _probe(c)
            tried.append({"dll": c, "loads": ok, "tokens": labels, **({"error": err} if err else {})})
            if ok and first_loadable is None:
                first_loadable = c
            if ok and labels:
                picked, picked_labels = c, labels
                break
        old = DLL_PATH
        DLL_PATH = picked or first_loadable
        TOKEN_INFO = {"token_present": bool(picked), "token_labels": picked_labels, "checked": tried, "python_bits": PY_BITS}
        if old != DLL_PATH or not picked:
            CERT_CACHE.clear()
        return DLL_PATH


def refresh_async():
    """Look at the drivers again in the background (/status answers at once with the last result)."""
    global _checking
    if _checking:
        return
    _checking = True

    def run():
        global _checking, _last_check
        try:
            resolve_dll(force=True)
            if TOKEN_INFO.get("token_present"):
                read_certificate(quiet=True)
        except Exception as e:
            LOG(f"[signer] driver check failed: {e}")
        finally:
            _last_check = time.time()
            _checking = False
    threading.Thread(target=run, daemon=True).start()


def ensure_dll():
    if not (DLL_PATH and TOKEN_INFO.get("token_present")):
        resolve_dll()


def start_checks():
    """First look at the drivers (call once at start)."""
    global _last_check
    resolve_dll()
    _last_check = time.time()
    if TOKEN_INFO.get("token_present"):
        read_certificate(quiet=True)
    LOG(f"[signer] Token DLL: {DLL_PATH or 'NOT FOUND'} | token plugged in: {TOKEN_INFO.get('token_present')} "
        f"{TOKEN_INFO.get('token_labels') or ''}")
    for t in TOKEN_INFO.get("checked", []):
        LOG(f"[signer]   {'OK ' if t['loads'] else 'NO '} {t['dll']}  tokens={t['tokens']}  {t.get('error', '')}")


# ---------------------------------------------------------------------------------------------------------------
# Token access
# ---------------------------------------------------------------------------------------------------------------
class SignError(Exception):
    """A message the user can act on."""


def friendly(e):
    n = type(e).__name__
    msg = {
        "PinIncorrect": "Wrong PIN. (Several wrong PINs lock the token.)",
        "PinLocked": "The token PIN is locked - unlock it with the token's own utility (HYP2003 / ePass manager).",
        "PinLenRange": "The PIN length is wrong for this token.",
        "PinExpired": "The token PIN has expired - change it with the token's own utility.",
        "TokenNotPresent": "No DSC token plugged in.",
        "TokenNotRecognised": "The DSC token is not recognised - plug it out and in again.",
        "DeviceRemoved": "The DSC token was removed during signing.",
        "NoSuchToken": "No DSC token plugged in.",
        "PdfReadError": "This PDF cannot be read (damaged or password-protected) - print it to a new PDF first.",
    }.get(n)
    if msg:
        return msg
    s = str(e) or n
    if "encrypt" in s.lower():
        return "This PDF is password-protected - print it to a new PDF first."
    return s


CERT_CACHE = {}


def _open_session(pin=None):
    ensure_dll()
    if not DLL_PATH:
        raise SignError("No DSC token driver found on this PC - install the driver of your token (HYP2003 / ePass / ProxKey ...).")
    import pkcs11
    lib = pkcs11.lib(DLL_PATH)
    slots = lib.get_slots(token_present=True)
    if not slots:
        raise SignError("No DSC token plugged in.")
    token = slots[0].get_token()
    return token, (token.open(user_pin=pin) if pin is not None else token.open())


def _cert_facts(cert):
    """asn1crypto certificate -> dict for the screen."""
    from asn1crypto import x509 as _x
    subj = cert.subject.native
    iss = cert.issuer.native
    tbs = cert["tbs_certificate"]
    nb = tbs["validity"]["not_before"].native
    na = tbs["validity"]["not_after"].native
    ku = []
    try:
        ku = sorted(cert.key_usage_value.native) if cert.key_usage_value is not None else []
    except Exception:
        pass
    return {
        "name": subj.get("common_name") or cert.subject.human_friendly,
        "organization": subj.get("organization_name") or "",
        "issuer": iss.get("common_name") or cert.issuer.human_friendly,
        "serial": format(tbs["serial_number"].native, "X"),
        "valid_from": nb.strftime("%d-%m-%Y"),
        "valid_to": na.strftime("%d-%m-%Y"),
        "days_left": (na - datetime.now(timezone.utc)).days,
        "key_usage": ku,
    }


def _pick_key_and_cert(session):
    """The signing key of the token and its certificate (a token can hold a signing and an encryption pair)."""
    import pkcs11
    from pkcs11 import Attribute, ObjectClass
    from asn1crypto import x509 as _x
    certs = []
    for c in session.get_objects({Attribute.CLASS: ObjectClass.CERTIFICATE}):
        try:
            der = bytes(c[Attribute.VALUE])
            cid = None
            try:
                cid = bytes(c[Attribute.ID]) or None
            except Exception:
                pass
            lab = None
            try:
                lab = c[Attribute.LABEL]
            except Exception:
                pass
            certs.append({"der": der, "cert": _x.Certificate.load(der), "id": cid, "label": lab})
        except Exception:
            continue
    if not certs:
        raise SignError("No certificate found on the token.")

    def score(ci):
        s = 0
        try:
            ku = ci["cert"].key_usage_value.native if ci["cert"].key_usage_value is not None else set()
            if "non_repudiation" in ku or "digital_signature" in ku:
                s += 4
            if "key_encipherment" in ku and "digital_signature" not in ku:
                s -= 2
        except Exception:
            pass
        try:
            na = ci["cert"]["tbs_certificate"]["validity"]["not_after"].native
            nb = ci["cert"]["tbs_certificate"]["validity"]["not_before"].native
            if nb <= datetime.now(timezone.utc) <= na:
                s += 2
        except Exception:
            pass
        if ci["cert"].ca:
            s -= 10
        return s

    certs.sort(key=score, reverse=True)
    keys = []
    try:
        for k in session.get_objects({Attribute.CLASS: ObjectClass.PRIVATE_KEY}):
            kid = None
            lab = None
            try:
                kid = bytes(k[Attribute.ID]) or None
            except Exception:
                pass
            try:
                lab = k[Attribute.LABEL]
            except Exception:
                pass
            keys.append({"key": k, "id": kid, "label": lab})
    except Exception:
        keys = []
    for ci in certs:
        for k in keys:
            if (ci["id"] and k["id"] == ci["id"]) or (not ci["id"] and ci["label"] and k["label"] == ci["label"]):
                return k, ci
    if keys:
        return keys[0], certs[0]
    return None, certs[0]


def read_certificate(quiet=False):
    """Certificate of the plugged-in token (public - no PIN). Cached per token."""
    try:
        with SIGN_LOCK:
            token, session = _open_session(None)
            try:
                key = "%s|%s" % (DLL_PATH, getattr(token, "serial", b""))
                if key in CERT_CACHE:
                    return CERT_CACHE[key]
                _, ci = _pick_key_and_cert(session)
                facts = _cert_facts(ci["cert"])
                facts["token"] = (token.label or "").strip()
                CERT_CACHE.clear()
                CERT_CACHE[key] = facts
                return facts
            finally:
                try:
                    session.close()
                except Exception:
                    pass
    except Exception as e:
        if not quiet:
            LOG(f"[signer] certificate not read: {friendly(e)}")
        return None


def _with_key(pin, fn):
    """Open the token with the PIN, find key + certificate, run fn(key, cert_info, session)."""
    if not pin:
        raise SignError("Token PIN is required.")
    with SIGN_LOCK:
        try:
            _, session = _open_session(pin)
        except SignError:
            raise
        except Exception as e:
            raise SignError(friendly(e))
        try:
            k, ci = _pick_key_and_cert(session)
            if k is None:
                raise SignError("No private key found on the token.")
            return fn(k, ci, session)
        except SignError:
            raise
        except Exception as e:
            raise SignError(friendly(e))
        finally:
            try:
                session.close()
            except Exception:
                pass


def _rsa_sha256(key, content):
    """PKCS#1 v1.5 sha256WithRSA signature of content."""
    from pkcs11 import Mechanism
    try:
        return key["key"].sign(content, mechanism=Mechanism.SHA256_RSA_PKCS)
    except Exception as e:
        if type(e).__name__ not in ("MechanismInvalid", "MechanismParamInvalid", "FunctionNotSupported"):
            raise
        digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + hashlib.sha256(content).digest()
        return key["key"].sign(digest_info, mechanism=Mechanism.RSA_PKCS)


def sign_pdf_bytes(data, pin, reason=None):
    """PDF bytes -> signed PDF bytes (PAdES, visible to e-Sanchit's signature check). Returns (bytes, signer name)."""
    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    from pyhanko.sign import signers
    from pyhanko.sign.pkcs11 import PKCS11Signer

    if not data[:1024].lstrip().startswith(b"%PDF"):
        raise SignError("This file is not a PDF.")

    def run(k, ci, session):
        signer = PKCS11Signer(session, signing_cert=ci["cert"],
                              key_id=k["id"] if k["id"] else None,
                              key_label=None if k["id"] else k["label"])
        try:
            w = IncrementalPdfFileWriter(io.BytesIO(data), strict=False)
        except Exception as e:
            raise SignError(friendly(e))
        if getattr(w, "security_handler", None) is not None or getattr(w, "encrypted", False):
            raise SignError("This PDF is password-protected - print it to a new PDF first.")
        meta = signers.PdfSignatureMetadata(field_name="EagleView_Sign_%d" % int(time.time() * 1000),
                                            reason=reason or None)
        out = signers.sign_pdf(w, meta, signer=signer, in_place=False)
        return out.getvalue(), _cert_facts(ci["cert"])["name"]
    return _with_key(pin, run)


def sign_attached_bytes(content, pin):
    """Any file -> attached CMS / PKCS#7 (the file inside the envelope), as for an ICEGATE .be amendment file.
    Returns (der, signer name, certificate der)."""
    import asn1crypto.algos as algos
    import asn1crypto.cms as cms
    import asn1crypto.core as core

    def run(k, ci, session):
        x509_cert = ci["cert"]
        signed_attrs = cms.CMSAttributes([
            cms.CMSAttribute({"type": "content_type", "values": [cms.ContentType("data")]}),
            cms.CMSAttribute({"type": "message_digest", "values": [core.OctetString(hashlib.sha256(content).digest())]}),
            cms.CMSAttribute({"type": "signing_time", "values": [cms.Time({"utc_time": core.UTCTime(datetime.now(timezone.utc))})]}),
        ])
        to_sign = signed_attrs.dump(force=True)
        to_sign = b"\x31" + to_sign[1:]
        signature = _rsa_sha256(k, to_sign)
        signer_info = cms.SignerInfo({
            "version": "v1",
            "sid": cms.SignerIdentifier(name="issuer_and_serial_number", value=cms.IssuerAndSerialNumber({
                "issuer": x509_cert["tbs_certificate"]["issuer"],
                "serial_number": x509_cert["tbs_certificate"]["serial_number"],
            })),
            "digest_algorithm": algos.DigestAlgorithm({"algorithm": "sha256"}),
            "signed_attrs": signed_attrs,
            "signature_algorithm": algos.SignedDigestAlgorithm({"algorithm": "rsassa_pkcs1v15"}),
            "signature": core.OctetString(signature),
        })
        signed_data = cms.SignedData({
            "version": "v1",
            "digest_algorithms": cms.DigestAlgorithms([algos.DigestAlgorithm({"algorithm": "sha256"})]),
            "encap_content_info": {"content_type": "data", "content": content},
            "certificates": cms.CertificateSet([cms.CertificateChoices(name="certificate", value=x509_cert)]),
            "signer_infos": cms.SignerInfos([signer_info]),
        })
        der = cms.ContentInfo({"content_type": "signed_data", "content": signed_data}).dump()
        return der, _cert_facts(x509_cert)["name"], ci["der"]
    return _with_key(pin, run)


def _rsa_sha1(key, data):
    """PKCS#1 v1.5 sha1WithRSA signature of data."""
    from pkcs11 import Mechanism
    try:
        return key["key"].sign(data, mechanism=Mechanism.SHA1_RSA_PKCS)
    except Exception as e:
        if type(e).__name__ not in ("MechanismInvalid", "MechanismParamInvalid", "FunctionNotSupported"):
            raise
        digest_info = bytes.fromhex("3021300906052b0e03021a05000414") + hashlib.sha1(data).digest()
        return key["key"].sign(digest_info, mechanism=Mechanism.RSA_PKCS)


def sign_json_icegate(text, pin):
    """ICEGATE BE / SB JSON -> signature as ICEGATE's own signer utility makes it (18-Nov-2026).

    Found from two BE files signed with ICEGATE's signer (the signature opened with the certificate's public key):
    SHA-256 of the JSON text (UTF-8, exactly as sent), then sha1WithRSA (PKCS#1 v1.5) over those 32 bytes.
    The result is the raw 256-byte RSA signature (no PKCS#7 wrapper); digSign.signerVersion is "1.0".
    """
    content = text.encode("utf-8")
    digest = hashlib.sha256(content).digest()

    def run(k, ci, session):
        signature = _rsa_sha1(k, digest)
        try:
            cn = ci["cert"].subject.human_friendly
        except Exception:
            cn = "Unknown"
        return signature, cn, ci["der"]
    return _with_key(pin, run)


def sign_json_detached(text, pin):
    """ICEGATE CACHE01 JSON -> detached CMS SignedData (sha256WithRSA over the JSON bytes, no signed attributes)."""
    import asn1crypto.algos as algos
    import asn1crypto.cms as cms
    import asn1crypto.core as core
    content = text.encode("utf-8")

    def run(k, ci, session):
        x509_cert = ci["cert"]
        signature = _rsa_sha256(k, content)
        signer_info = cms.SignerInfo({
            "version": "v1",
            "sid": cms.SignerIdentifier(name="issuer_and_serial_number", value=cms.IssuerAndSerialNumber({
                "issuer": x509_cert["tbs_certificate"]["issuer"],
                "serial_number": x509_cert["tbs_certificate"]["serial_number"],
            })),
            "digest_algorithm": algos.DigestAlgorithm({"algorithm": algos.DigestAlgorithmId("sha256")}),
            "signature_algorithm": algos.SignedDigestAlgorithm({"algorithm": algos.SignedDigestAlgorithmId("sha256_rsa")}),
            "signature": core.OctetString(signature),
        })
        signed_data = cms.SignedData({
            "version": "v1",
            "digest_algorithms": cms.DigestAlgorithms([algos.DigestAlgorithm({"algorithm": algos.DigestAlgorithmId("sha256")})]),
            "encap_content_info": {"content_type": "data"},   # detached: no content
            "certificates": cms.CertificateSet([cms.CertificateChoices(name="certificate", value=x509_cert)]),
            "signer_infos": cms.SignerInfos([signer_info]),
        })
        der = cms.ContentInfo({"content_type": cms.ContentType("signed_data"), "content": signed_data}).dump()
        try:
            cn = x509_cert.subject.human_friendly
        except Exception:
            cn = "Unknown"
        return der, cn, ci["der"]
    return _with_key(pin, run)


# ---------------------------------------------------------------------------------------------------------------
# PIN: from the request, or asked by the tool
# ---------------------------------------------------------------------------------------------------------------
class Cancelled(Exception):
    pass


def get_pin(given, meta):
    if given:
        return given
    if ASK_PIN is None:
        raise SignError("Token PIN is required.")
    pin = ASK_PIN(meta)
    if not pin:
        raise Cancelled("Signing cancelled at the DSC signer.")
    return pin


def _record(kind, name, ok, signer="", error="", source=""):
    rec = {"time": datetime.now().strftime("%d-%m-%Y %H:%M:%S"), "kind": kind, "name": name, "ok": ok,
           "signer": signer, "error": error, "source": source}
    for f in list(ON_SIGNED):
        try:
            f(rec)
        except Exception:
            pass


def _source():
    o = request.headers.get("Origin")
    return o or "EagleView server"


def _fail(kind, name, e, pin_given):
    if isinstance(e, Cancelled):
        _record(kind, name, False, error="cancelled", source=_source())
        return jsonify({"error": str(e), "cancelled": True}), 409
    msg = friendly(e) if not isinstance(e, SignError) else str(e)
    if "Wrong PIN" in msg and not pin_given and FORGET_PIN is not None:
        FORGET_PIN()
    _record(kind, name, False, error=msg, source=_source())
    LOG(f"[{kind}] {name}: {msg}")
    return jsonify({"error": msg}), 500 if not isinstance(e, SignError) else 400


FORGET_PIN = None     # the tool clears a kept PIN after a wrong PIN


# ---------------------------------------------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------------------------------------------
@app.route("/status", methods=["GET"])
def status():
    if time.time() - _last_check > 15:
        refresh_async()
    cert = None
    if TOKEN_INFO.get("token_present"):
        cert = next(iter(CERT_CACHE.values()), None)
    return jsonify({
        "status": "running",
        "tool": ASK_PIN is not None,
        "ask_pin": ASK_PIN is not None,
        "version": VERSION,
        "checking": _checking,
        "dll_found": DLL_PATH is not None,
        "dll_path": DLL_PATH,
        "token_present": TOKEN_INFO.get("token_present", False),
        "token_labels": TOKEN_INFO.get("token_labels", []),
        "certificate": cert,
        "python_bits": PY_BITS,
        "checked": [{"dll": os.path.basename(t["dll"]), "loads": t["loads"], "tokens": len(t["tokens"]),
                     **({"error": t["error"]} if t.get("error") else {})} for t in TOKEN_INFO.get("checked", [])],
    })


@app.route("/sign-pdf", methods=["POST"])
def sign_pdf():
    if "pdf" not in request.files:
        return jsonify({"error": "No PDF file provided in 'pdf' field"}), 400
    f = request.files["pdf"]
    name = f.filename or "document.pdf"
    given = request.form.get("pin")
    try:
        data = f.read()
        pin = get_pin(given, {"kind": "PDF", "name": name, "size": len(data), "source": _source(),
                              "purpose": request.form.get("purpose") or "e-Sanchit document"})
        out, cn = sign_pdf_bytes(data, pin)
        _record("PDF", name, True, cn, source=_source())
        LOG(f"[sign-pdf] {name} signed by {cn}")
        resp = send_file(io.BytesIO(out), as_attachment=True, download_name=f"signed_{name}", mimetype="application/pdf")
        resp.headers["X-Signer-CN"] = re.sub(r"[^\x20-\x7e]", "", cn)
        return resp
    except Exception as e:
        return _fail("PDF", name, e, bool(given))


@app.route("/sign-json", methods=["POST"])
def sign_json():
    data = request.get_json(force=True, silent=True) or {}
    json_data = data.get("json_data")
    if not json_data:
        return jsonify({"error": "'json_data' field is required"}), 400
    name = data.get("name") or "ICEGATE JSON"
    given = data.get("pin")
    try:
        pin = get_pin(given, {"kind": "JSON", "name": name, "size": len(json_data), "source": _source(),
                              "purpose": data.get("purpose") or "ICEGATE filing (BE / SB JSON)"})
        if str(data.get("format") or "").lower() == "cms":
            der, cn, cert_der = sign_json_detached(json_data, pin)
            sig_b64 = base64.b64encode(der).decode("ascii")
            extra = {"signature_pem": "-----BEGIN PKCS7-----\n" + "\n".join(sig_b64[i:i + 64] for i in range(0, len(sig_b64), 64)) + "\n-----END PKCS7-----",
                     "signer_version": "1", "format": "cms"}
        else:
            raw, cn, cert_der = sign_json_icegate(json_data, pin)
            sig_b64 = base64.b64encode(raw).decode("ascii")
            extra = {"signer_version": "1.0", "format": "icegate"}
        _record("JSON", name, True, cn, source=_source())
        LOG(f"[sign-json] {name} signed by {cn} ({extra['format']})")
        out = {
            "success": True,
            "signature_b64": sig_b64,
            "signed_content_b64": base64.b64encode(json_data.encode("utf-8")).decode("ascii"),
            "signer_cn": cn,
            "certificate_b64": base64.b64encode(cert_der).decode("ascii"),
        }
        out.update(extra)
        return jsonify(out)
    except Exception as e:
        return _fail("JSON", name, e, bool(given))


@app.route("/sign-file", methods=["POST"])
def sign_file():
    data = request.get_json(force=True, silent=True) or {}
    data_b64 = data.get("data_b64")
    if not data_b64:
        return jsonify({"error": "'data_b64' field is required"}), 400
    name = data.get("name") or "file"
    given = data.get("pin")
    try:
        content = base64.b64decode(data_b64)
        pin = get_pin(given, {"kind": "FILE", "name": name, "size": len(content), "source": _source(),
                              "purpose": data.get("purpose") or "ICEGATE flat file (BE amendment)"})
        der, cn, cert_der = sign_attached_bytes(content, pin)
        _record("FILE", name, True, cn, source=_source())
        LOG(f"[sign-file] {name} ({len(content)} bytes) signed by {cn}")
        return jsonify({"success": True, "signed_b64": base64.b64encode(der).decode("ascii"), "signer_cn": cn,
                        "certificate_b64": base64.b64encode(cert_der).decode("ascii")})
    except Exception as e:
        return _fail("FILE", name, e, bool(given))


PORT = int(os.environ.get("DSC_SIGNER_PORT", "5050"))


def run_console():
    """The old console signer (START_SIGNER.bat): PIN comes from EagleView, no window."""
    print("=" * 60)
    print(f"  EagleView - Local DSC Signer (console) {VERSION}")
    print(f"  Port: {PORT}")
    start_checks()
    print("  For the window / tray version use EagleViewSigner.exe")
    print("=" * 60)
    app.run(host=os.environ.get("DSC_SIGNER_HOST", "127.0.0.1"), port=PORT, debug=False, threaded=True)


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--probe":
        probe_main(sys.argv[2])
        sys.exit(0)
    run_console()
