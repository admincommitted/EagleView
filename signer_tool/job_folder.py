"""
Job folder (17-Nov-2026) - the PDFs of a job kept on this PC in <jobs root>\\<job no> (default D:\\JOBS\\8543;
a job no. with "/" becomes NDL_AE_26_1045).

  - the tool lists the PDFs of the folder with a document code each (from the file name: a 6-character code at the
    start, a name learnt before, or a word like invoice / packing / COO / AWB ...; the user can change it)
  - the details (issuing party, place / date of issue, beneficiary) come from the job, as in "Add document", and can be
    changed per file
  - "Sign" signs all chosen PDFs with one PIN: a PDF over 2 MB is made smaller first (ICEGATE takes at most 2 MB), the
    PDF is added to the job in EagleView (as if attached on the job screen) and its signed copy sent back; the signed
    copy is also kept in <folder>\\signed
  - "Upload to ICEGATE" starts an e-Sanchit batch (5 per DRN) of the signed PDFs without an IRN; the user logs in and
    presses Submit on ICEGATE himself; the IRNs come back to the job and to <folder>\\irn.csv
The folder's own notes (code / details per file, what was added and signed) are in <folder>\\eagleview_signer.json.
"""
import csv
import io
import json
import os
import re
import time
from datetime import datetime

STATE_FILE = "eagleview_signer.json"
SIGNED_DIR = "signed"
IRN_CSV = "irn.csv"
MAX_BYTES = 2 * 1024 * 1024
FIT_BYTES = int(1.9 * 1024 * 1024)        # aim a little under ICEGATE's 2 MB


def folder_name(job_no):
    v = re.sub(r'[\\/:*?"<>|]+', "_", str(job_no or "").strip()).strip(" ._")
    return v or "JOB"


HOUSE_DOCS = {"703000", "714000"}                                            # house waybill, house bill of lading
MASTER_DOCS = {"700000", "704000", "705000", "709000", "710000", "711000", "740000", "741000"}


def transport_date(code, dates):
    """17-Nov-2026: issue date of a HAWB / MAWB type document = the job's HAWB / MAWB date ("" for other documents)."""
    dates = dates or {}
    c = str(code or "")
    if c in HOUSE_DOCS:
        return dates.get("house") or dates.get("master") or ""
    if c in MASTER_DOCS:
        return dates.get("master") or dates.get("house") or ""
    return ""


def number_part(job_no):
    """The number at the end of a job number: DEL-AI-1002 -> 1002 ('' when the job number is only that number)."""
    s = str(job_no or "").strip()
    m = re.search(r"(\d+)$", s)
    return m.group(1) if m and m.group(1) != s else ""


def folder_candidates(root, job_no):
    roots = []
    for r in (root, r"D:\JOBS", r"D:\JOB"):
        r = os.path.normpath(str(r or "")) if r else ""
        if r and r.lower() not in [x.lower() for x in roots]:
            roots.append(r)
    names = [folder_name(job_no)] + ([number_part(job_no)] if number_part(job_no) else [])
    return [os.path.join(r, n) for r in roots for n in names]


# ------------------------------------------------------------------------------------------------- document codes
NOISE = {"pdf", "signed", "sign", "copy", "scan", "scanned", "final", "page", "pages", "doc", "docs", "document", "new", "file", "img", "image"}


def name_key(name):
    """What a file name says without numbers / dates - the key under which a chosen code is remembered."""
    stem = re.sub(r"\.pdf$", "", os.path.basename(str(name or "")), flags=re.I).lower()
    toks = sorted({t for t in re.findall(r"[a-z]+", stem) if len(t) >= 2 and t not in NOISE})
    return " ".join(toks)


def _rules(module):
    lic = "911000" if module == "Import" else "811000"
    # (test on words / text, code) - first match wins, most specific first
    return [
        (lambda t, s: ("invoice" in s or "inv" in t) and ("packing" in s or "pl" in t), "331000"),
        (lambda t, s: "high sea" in s or "hss" in t, "315HS1"),
        (lambda t, s: "proforma" in s or "pi" in t, "325000"),
        (lambda t, s: "freight" in s and ("invoice" in s or "inv" in t), "780000"),
        (lambda t, s: "invoice" in s or "inv" in t or "ci" in t, "380000"),
        (lambda t, s: "packing" in s or "pl" in t, "271000"),
        (lambda t, s: "certificate of origin" in s or "coo" in t or "origin" in t, "861000"),
        (lambda t, s: "mawb" in t, "741000"),
        (lambda t, s: "hawb" in t, "703000"),
        (lambda t, s: "awb" in t or "airway" in s or "air waybill" in s or "airwaybill" in s, "740000"),
        (lambda t, s: "hbl" in t, "714000"),
        (lambda t, s: "bl" in t or "obl" in t or "bill of lading" in s, "705000"),
        (lambda t, s: "insurance" in s, "520000"),
        (lambda t, s: "lut" in t or "bond" in t, "165000"),
        (lambda t, s: "msds" in t or "sds" in t or "safety data" in s, "0530HZ"),
        (lambda t, s: "test report" in s, "004000"),
        (lambda t, s: "test" in t and ("certificate" in s or "cert" in t), "004001"),
        (lambda t, s: "coa" in t or "analysis" in s, "001000"),
        (lambda t, s: "purchase order" in s or "po" in t, "105000"),
        (lambda t, s: any(w in s for w in ("catalogue", "catalog", "brochure", "literature", "technical")), "006001"),
        (lambda t, s: "fumigation" in s, "2670PQ"),
        (lambda t, s: "phyto" in s, "8510FS"),
        (lambda t, s: "contract" in s or "agreement" in s, "315000"),
        (lambda t, s: "gatt" in t or "valuation" in s, "934000"),
        (lambda t, s: "authori" in s, "HAC001"),
        (lambda t, s: "iec" in t, "101001"),
        (lambda t, s: "licence" in s or "license" in s or "dgft" in t, lic),
    ]


def guess_code(name, module, codes, memory):
    """-> (code, how): 'name' (starts with a code), 'learnt' (chosen before for such a name), 'guess' (a word), '' """
    stem = re.sub(r"\.pdf$", "", os.path.basename(str(name or "")), flags=re.I)
    m = re.match(r"^([A-Za-z0-9]{6})(?=[\s_.\-]|$)", stem)
    if m and m.group(1).upper() in codes:
        return m.group(1).upper(), "name"
    k = name_key(name)
    if k and memory.get(k) in codes:
        return memory[k], "learnt"
    low = re.sub(r"[_\-.]+", " ", stem.lower())
    toks = set(re.findall(r"[a-z]+", low))
    for test, code in _rules(module):
        try:
            if test(toks, low) and (not codes or code in codes):
                return code, "guess"
        except Exception:
            pass
    return "", ""


# ------------------------------------------------------------------------------------------------- making a PDF smaller
def is_signed_pdf(data):
    return b"/ByteRange" in data and b"/Sig" in data


def compress_pdf(data, limit=FIT_BYTES):
    """A PDF under ICEGATE's 2 MB: first the pictures in it are made lighter (text stays text), else every page is
    turned into a lighter picture. Returns (bytes, how). Raises when it cannot get under the limit."""
    import pymupdf
    if is_signed_pdf(data):
        raise RuntimeError("it is already signed - making it smaller would break the signature; scan it smaller")
    best = data
    for dpi, q in ((150, 70), (120, 60), (96, 50)):
        doc = pymupdf.open(stream=data, filetype="pdf")
        try:
            doc.rewrite_images(dpi_threshold=dpi + 10, dpi_target=dpi, quality=q, lossy=True, lossless=True, bitonal=True, color=True, gray=True)
            out = doc.tobytes(garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True)
        finally:
            doc.close()
        if len(out) < len(best):
            best = out
        if len(out) <= limit:
            return out, f"pictures made lighter ({dpi} dpi)"
    # pages as pictures (last way)
    for dpi, q in ((110, 55), (90, 45), (72, 40)):
        src = pymupdf.open(stream=data, filetype="pdf")
        dst = pymupdf.open()
        try:
            for page in src:
                pix = page.get_pixmap(dpi=dpi)
                img = pix.tobytes("jpg", jpg_quality=q)
                p = dst.new_page(width=page.rect.width, height=page.rect.height)
                p.insert_image(p.rect, stream=img)
            out = dst.tobytes(garbage=4, deflate=True)
        finally:
            src.close()
            dst.close()
        if len(out) <= limit:
            return out, f"pages turned into lighter pictures ({dpi} dpi)"
        if len(out) < len(best):
            best = out
    raise RuntimeError(f"could not make it smaller than 2 MB (best {len(best) / 1048576:.2f} MB) - split it or scan it lighter")


# ------------------------------------------------------------------------------------------------- the folder page
class JobFolders:
    def __init__(self, get_ev, settings, save_settings, sign_pdf, push, log, add_history, get_up, friendly=str):
        self.friendly = friendly
        self.get_ev, self.settings, self.save_settings = get_ev, settings, save_settings
        self.sign_pdf, self.push, self.log, self.add_history, self.get_up = sign_pdf, push, log, add_history, get_up
        self.job = None          # the job (from /api/icegate/signer/jobs)
        self.codes = {}          # code -> name (e-Sanchit master)
        self.docs = []           # the job's rows in EagleView (/job-docs)
        self.busy = False

    # ---- where
    @property
    def root(self):
        return str(self.settings.get("jobs_root") or r"D:\JOBS")

    def folder(self):
        """17-Nov-2026: the job's folder is looked for under the set root and D:\\JOBS / D:\\JOB, by the full job number
        (DEL-AI-1002) and by its number alone (1002) - the first that exists is used; a new one is <root>\\<full job no>."""
        if not self.job:
            return ""
        jn = self.job["jobNo"]
        for p in folder_candidates(self.root, jn):
            if os.path.isdir(p):
                return p
        return os.path.join(self.root, folder_name(jn))

    def _state_path(self):
        return os.path.join(self.folder(), STATE_FILE)

    def _state(self):
        try:
            with open(self._state_path(), "r", encoding="utf-8") as f:
                return json.load(f) or {}
        except Exception:
            return {}

    def _save_state(self, st):
        try:
            os.makedirs(self.folder(), exist_ok=True)
            tmp = self._state_path() + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(st, f, indent=1)
            os.replace(tmp, self._state_path())
        except Exception as e:
            self.log(f"[folder] could not save {STATE_FILE}: {e}")

    # ---- EagleView
    def _codes(self):
        if not self.codes:
            try:
                self.codes = {c["code"]: c.get("name", "") for c in (self.get_ev()._req("GET", "/api/icegate/signer/doc-codes").get("codes") or [])}
            except Exception:
                self.codes = {}
        return self.codes

    def find(self, text, access):
        """Jobs whose number is the text (import and / or export, as the user's rights allow)."""
        from urllib.parse import urlencode
        text = str(text or "").strip()
        if not text:
            return {"ok": False, "error": "Type the job number."}
        found, errors = [], []
        for mod in ("Import", "Export"):
            if not access.get(mod.lower(), True):
                continue
            try:
                jobs = self.get_ev()._req("GET", "/api/icegate/signer/jobs?" + urlencode({"module": mod, "q": text})).get("jobs") or []
            except Exception as e:
                errors.append(str(e))
                continue
            t = text.upper()
            exact = [j for j in jobs if str(j.get("jobNo", "")).upper() == t or folder_name(j.get("jobNo")).upper() == folder_name(t).upper()]
            # 17-Nov-2026: "1002" also finds DEL-AI-1002 (the number alone, when no job is numbered exactly that)
            if not exact and t.isdigit():
                exact = [j for j in jobs if number_part(j.get("jobNo")) == t.lstrip("0") or number_part(j.get("jobNo")) == t]
            found += exact
        if not found:
            return {"ok": False, "error": errors[0] if errors else f"No job {text} in EagleView."}
        return {"ok": True, "jobs": found}

    def open(self, job):
        self.job = job
        self._codes()
        return self.state(refresh=True)

    def close(self):
        self.job, self.docs = None, []
        return {"ok": True}

    def _job_docs(self):
        j = self.job
        try:
            r = self.get_ev()._req("GET", f"/api/icegate/signer/job-docs?module={j['module']}&jobId={j['jobId']}")
            self.docs = r.get("docs") or []
        except Exception as e:
            self.log(f"[folder] job documents: {e}")
        return self.docs

    def _defaults(self, code=""):
        """The details of a new file, from the job (as Add document fills them).
        17-Nov-2026: a HAWB / MAWB type document is dated with the HAWB / MAWB date of the job, not the invoice date."""
        j = self.job or {}
        iss = (j.get("issuers") or [{}])[0]
        place = iss.get("place") or j.get("place") or ""
        return {"issuer": {k: iss.get(k, "") for k in ("name", "code", "addr1", "addr2", "city", "pin")},
                "bene": dict(j.get("bene") or {}), "placeOfIssue": place,
                "issueDate": transport_date(code, j.get("docDates")) or iss.get("date", ""), "expiryDate": "",
                "otherId": False, "icegateId": ""}

    def state(self, refresh=False):
        if not self.job:
            return {"ok": True, "job": None, "root": self.root}
        fld = self.folder()
        exists = os.path.isdir(fld)
        if refresh:
            self._job_docs()
        st = self._state()
        memory = self.settings.get("code_memory") or {}
        by_orig = {d["origUrl"]: d for d in self.docs}
        files, changed = [], False
        names = sorted([n for n in os.listdir(fld) if n.lower().endswith(".pdf") and os.path.isfile(os.path.join(fld, n))], key=str.lower) if exists else []
        for n in names:
            p = os.path.join(fld, n)
            size, mtime = os.path.getsize(p), int(os.path.getmtime(p))
            e = st.get(n) or {}
            if e and (e.get("size") != size or e.get("mtime") != mtime) and not e.get("origUrl"):
                e = {"code": e.get("code"), "details": e.get("details")}            # the file changed before it was used
            if not e.get("code"):
                code, how = guess_code(n, self.job["module"], self.codes, memory)
                e["code"], e["how"] = code, how
            e["size"], e["mtime"] = size, mtime
            if st.get(n) != e:
                st[n] = e
                changed = True
            doc = by_orig.get(e.get("origUrl") or "")
            status = "new"
            if doc and doc.get("irn"):
                status = "irn"
            elif doc and doc.get("signed"):
                status = "signed"
            elif doc:
                status = "added"
            elif e.get("origUrl"):
                status = "gone"                                                   # removed from the job in EagleView
            d = e.get("details") or self._defaults(e.get("code", ""))
            files.append({"name": n, "size": size, "code": e.get("code", ""), "how": e.get("how", ""), "codeName": self.codes.get(e.get("code", ""), ""),
                          "details": d, "ownDetails": bool(e.get("details")), "status": status, "irn": (doc or {}).get("irn", ""), "drn": (doc or {}).get("drn", ""),
                          "signedUrl": (doc or {}).get("fileUrl", "") if doc and doc.get("signed") else "", "note": e.get("note", ""), "error": e.get("error", ""),
                          "presigned": False, "big": size > MAX_BYTES})
        for n in [k for k in st if k not in names]:
            if not st[n].get("origUrl"):
                del st[n]
                changed = True
        if changed and exists:
            self._save_state(st)
        if exists:
            self._write_irn_csv(files)
        j = self.job
        return {"ok": True, "root": self.root, "folder": fld, "exists": exists, "busy": self.busy,
                "job": {k: j.get(k) for k in ("module", "jobId", "jobNo", "party", "no", "date", "branch", "issuers", "bene", "place", "docDates")}, "files": files,
                "codes": [{"code": c, "name": nm} for c, nm in sorted(self.codes.items())]}

    def _write_irn_csv(self, files):
        rows = [f for f in files if f.get("irn")]
        path = os.path.join(self.folder(), IRN_CSV)
        if not rows:
            return
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["File", "Document code", "DRN", "IRN", "Job"])
        for f in rows:
            w.writerow([f["name"], f["code"], f["drn"], f["irn"], self.job["jobNo"]])
        text = buf.getvalue()
        try:
            with open(path, "r", encoding="utf-8-sig") as fh:
                if fh.read() == text:
                    return
        except Exception:
            pass
        try:
            with open(path, "w", encoding="utf-8-sig", newline="") as fh:
                fh.write(text)
        except Exception as e:
            self.log(f"[folder] {IRN_CSV}: {e}")

    # ---- changes from the page
    def create(self):
        os.makedirs(self.folder(), exist_ok=True)
        return self.state()

    def set_code(self, name, code):
        code = str(code or "").strip().upper()
        if code and self.codes and code not in self.codes:
            return {"ok": False, "error": f"{code} is not an e-Sanchit document code"}
        st = self._state()
        e = st.get(name) or {}
        if e.get("origUrl"):
            return {"ok": False, "error": "This file is already on the job in EagleView - change its code on the job screen."}
        e["code"], e["how"] = code, "chosen"
        st[name] = e
        self._save_state(st)
        k = name_key(name)
        if k and code:
            mem = dict(self.settings.get("code_memory") or {})
            mem[k] = code
            self.settings["code_memory"] = mem
            self.save_settings()
        return self.state()

    def set_details(self, name, details):
        st = self._state()
        e = st.get(name) or {}
        if e.get("origUrl"):
            return {"ok": False, "error": "This file is already on the job in EagleView - change its details on the job screen."}
        e["details"] = details or None
        st[name] = e
        self._save_state(st)
        return self.state()

    # ---- sign all chosen
    def sign(self, names, pin):
        if self.busy:
            return {"ok": False, "error": "Already signing."}
        self.busy = True
        try:
            return self._sign(names, pin)
        finally:
            self.busy = False

    def _sign(self, names, pin):
        ev = self.get_ev()
        self._job_docs()
        by_orig = {d["origUrl"]: d for d in self.docs}
        st = self._state()
        results = []
        for n in names or []:
            e = st.get(n) or {}
            res = {"name": n, "ok": False}
            try:
                p = os.path.join(self.folder(), n)
                with open(p, "rb") as fh:
                    data = fh.read()
                doc = by_orig.get(e.get("origUrl") or "")
                if doc and doc.get("signed"):
                    res.update(ok=True, note="already signed")
                    results.append(res)
                    continue
                if not e.get("code"):
                    raise RuntimeError("choose the document code")
                if not data.startswith(b"%PDF-"):
                    raise RuntimeError("not a PDF")
                presigned = is_signed_pdf(data)
                note = ""
                if len(data) > FIT_BYTES:
                    self.push("folderProgress", {"name": n, "step": "Making it smaller..."})
                    data, how = compress_pdf(data)
                    note = f"made smaller to {len(data) / 1048576:.2f} MB - {how}"
                # 1. on the job in EagleView (once)
                if not doc:
                    self.push("folderProgress", {"name": n, "step": "Adding to the job..."})
                    d = e.get("details") or self._defaults(e["code"])
                    row = {"docCode": e["code"], "placeOfIssue": d.get("placeOfIssue", ""), "issueDate": d.get("issueDate", ""), "expiryDate": d.get("expiryDate", ""),
                           "otherId": bool(d.get("otherId")), "icegateId": d.get("icegateId", ""), "issuer": d.get("issuer") or {}, "bene": d.get("bene") or {}}
                    miss = [w for w, v in (("issuing party name", row["issuer"].get("name")), ("place of issue", row["placeOfIssue"]),
                                           ("issue date", row["issueDate"]), ("beneficiary name", row["bene"].get("name"))) if not str(v or "").strip()]
                    if miss:
                        raise RuntimeError("fill " + ", ".join(miss) + " (Details)")
                    safe = re.sub(r"[^A-Za-z0-9._ -]+", "_", n) or "document.pdf"
                    body, ctype = ev.multipart({"module": self.job["module"], "jobId": str(self.job["jobId"]), "row": json.dumps(row)}, "pdf", safe, data, "application/pdf")
                    r = ev._req("POST", "/api/icegate/signer/add-doc", body, ctype, timeout=120)
                    if not r.get("success"):
                        raise RuntimeError(r.get("error") or "EagleView did not take it")
                    e["origUrl"] = r["fileUrl"]
                    e["addedAt"] = datetime.now().isoformat(timespec="seconds")
                    st[n] = e
                    self._save_state(st)
                # 2. signed (a PDF that is already signed is used as it is)
                if presigned:
                    out, cn = data, "signed before"
                else:
                    self.push("folderProgress", {"name": n, "step": "Signing..."})
                    out, cn = self.sign_pdf(data, pin)
                os.makedirs(os.path.join(self.folder(), SIGNED_DIR), exist_ok=True)
                local = os.path.join(self.folder(), SIGNED_DIR, re.sub(r"\.pdf$", "", n, flags=re.I) + "_signed.pdf")
                with open(local, "wb") as fh:
                    fh.write(out)
                body, ctype = ev.multipart({"fileUrl": e["origUrl"], "signer": cn}, "pdf", "signed.pdf", out, "application/pdf")
                try:
                    ev._req("POST", "/api/icegate/signer/esanchit", body, ctype, timeout=120)
                except RuntimeError as x:
                    if "already signed" not in str(x):
                        raise
                e.update(signedAt=datetime.now().isoformat(timespec="seconds"), signer=cn, note=note, error="")
                st[n] = e
                self._save_state(st)
                res.update(ok=True, signer=cn, note=note, size=len(out), over=len(out) > MAX_BYTES)
                self.log(f"[folder] {self.job['jobNo']}/{n}: added and signed ({cn}){' - ' + note if note else ''}")
                self.add_history({"time": datetime.now().strftime("%d-%m-%Y %H:%M:%S"), "kind": "PDF", "name": f"{self.job['jobNo']} - {n}", "ok": True,
                                  "signer": cn, "error": "", "source": "Job folder"})
            except Exception as x:
                msg = str(x) if isinstance(x, RuntimeError) or type(x).__name__ == "SignError" else self.friendly(x)
                res["error"] = msg
                e["error"] = msg
                st[n] = e
                self._save_state(st)
                self.log(f"[folder] {n}: {msg}")
                if "Wrong PIN" in msg or "PIN is locked" in msg or "PIN is required" in msg:
                    results.append(res)
                    break                                                          # a wrong PIN: stop, do not lock the token
            results.append(res)
            self.push("folderProgress", {"name": n, "step": "done" if res["ok"] else res.get("error", "")})
        try:
            self.get_ev().refresh()
        except Exception:
            pass
        return {"ok": True, "results": results, "state": self.state(refresh=True)}

    # ---- upload the signed PDFs on ICEGATE (e-Sanchit upload page)
    def upload(self, names):
        s = self.state(refresh=True)
        files = [f for f in s["files"] if f["status"] == "signed" and (not names or f["name"] in names)]
        if not files:
            return {"ok": False, "error": "No signed PDF without an IRN in this folder - sign them first."}
        up = self.get_up()
        up.refresh()
        key = f"{self.job['module']}:{self.job['jobId']}"
        job = next((j for j in up.jobs if j["key"] == key), None)
        if not job:
            return {"ok": False, "error": "The signed PDFs of this job are not on the upload list yet - press Refresh."}
        want = {f["signedUrl"] for f in files}
        keys = [d["key"] for d in job["docs"] if d["key"] in want][:5]
        if not keys:
            return {"ok": False, "error": "The signed PDFs are not on the upload list - press Refresh."}
        r = up.start(key, keys)
        if r.get("ok"):
            r["more"] = max(0, len(want) - len(keys))
        return r
