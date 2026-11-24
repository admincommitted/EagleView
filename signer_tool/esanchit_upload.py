"""
e-Sanchit upload from EagleView Signer, the ICEGATE way (16-Nov-2026)

There is no public upload API for e-Sanchit, so the tool works in ICEGATE's own pages:
  1. EagleView lists the signed e-Sanchit PDFs of each job that have no IRN yet (/api/icegate/signer/upload-queue)
  2. the user picks a job; its documents go in batches of at most 5 (ICEGATE: 5 files per DRN, 2 MB per file)
  3. the tool opens ICEGATE in its own window; the user logs in there himself (user ID, password, CAPTCHA)
     and opens e-Sanchit (it stays in the same window)
  4. on ICEGATE's upload box the tool puts the batch's signed PDFs in, and fills the empty detail fields of each
     document from the job (issuing party, beneficiary, place / date of issue, document type ...)
  5. the user checks everything and presses Submit on ICEGATE himself - the tool never presses Submit or Recall
  6. the tool reads File Name / DRN / IRN from the ICEGATE page (upload page after submit, or the Search page) and
     saves each IRN on its job row in EagleView (/api/icegate/signer/irn); an IRN can also be typed in the tool
"""
import base64
import io
import json
import os
import re
import threading
import time
from datetime import datetime, timedelta

ICEGATE_LOGIN = "https://foservices.icegate.gov.in/#/login"
ESANCHIT_HOME = "https://www.icegate.gov.in/esanchit/home"
ESANCHIT_SEARCH = "https://www.icegate.gov.in/esanchit/search"
MAX_FILES = 5
MAX_BYTES = 2 * 1024 * 1024
CHUNK = 256 * 1024
TICK = 2.0
AUTO_WAIT = 4.0     # 17-Nov-2026: seconds on the dashboard after login before e-Sanchit is opened by itself
AUTO_TRIES = 8      # then given up (the user opens it: Services, eSANCHIT)


def norm(s):
    s = re.sub(r"\.(pdf|jpe?g|docx?)$", "", str(s or "").strip(), flags=re.I).lower()
    return re.sub(r"[^a-z0-9]", "", s)


def num_ok(n):
    """16 digits starting with a real date (YYYYMMDD) not far from today - as ICEGATE gives DRN / IRN."""
    n = str(n or "")
    if not re.fullmatch(r"\d{16}", n):
        return False
    try:
        d = datetime.strptime(n[:8], "%Y%m%d")
    except ValueError:
        return False
    return datetime.now() - timedelta(days=400) <= d <= datetime.now() + timedelta(days=2)


def check_signature(data):
    """What ICEGATE's "Digital Sign Validated" will look at: is there a signature, is the PDF unchanged since."""
    try:
        import logging
        logging.getLogger("pyhanko").setLevel(logging.CRITICAL)      # an untrusted root is normal here (no CA list)
        logging.getLogger("pyhanko_certvalidator").setLevel(logging.CRITICAL)
        from pyhanko.pdf_utils.reader import PdfFileReader
        from pyhanko.sign.validation import validate_pdf_signature
        from pyhanko_certvalidator import ValidationContext
        r = PdfFileReader(io.BytesIO(data), strict=False)
        sigs = r.embedded_signatures
        if not sigs:
            return {"ok": False, "text": "Not signed"}
        st = validate_pdf_signature(sigs[-1], ValidationContext(allow_fetching=False))
        try:
            who = st.signing_cert.subject.native.get("common_name") or st.signing_cert.subject.human_friendly
        except Exception:
            who = ""
        if not (st.intact and st.valid):
            return {"ok": False, "text": "Signature broken - the PDF was changed after signing", "who": who}
        try:
            end = st.signing_cert["tbs_certificate"]["validity"]["not_after"].native
            if end.timestamp() < time.time():
                return {"ok": False, "text": f"Certificate of {who} has expired", "who": who}
        except Exception:
            pass
        return {"ok": True, "text": f"Yes - {who}" if who else "Yes", "who": who}
    except Exception as e:
        return {"ok": False, "text": f"Could not check the signature: {e}"[:160]}


class Uploader:
    def __init__(self, ui_dir, get_ev, push, notify, log, add_history, data_dir=None):
        with open(os.path.join(ui_dir, "icegate_helper.js"), encoding="utf-8") as f:
            self.helper = f.read()
        # 17-Nov-2026: the open batch and the ICEGATE window size are kept here, so a restart of the tool or an ICEGATE
        # log-out does not lose the batch
        self.data_dir = data_dir or os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "EagleViewSigner")
        self.keep_file = os.path.join(self.data_dir, "esanchit_batch.json")
        self.sess = "closed"          # closed / login / dashboard / esanchit / expiring / busy / loggedout
        self.sess_since = time.time()
        self.win_size = None
        self.get_ev, self.push, self.notify, self.log, self.add_history = get_ev, push, notify, log, add_history
        self.lock = threading.RLock()
        self.jobs, self.at, self.error = [], "", ""
        self.access = {"import": True, "export": True}
        self.active = None            # {"job", "jobNo", "module", "party", "docs": [...], "started"}
        self.files = {}               # key -> signed PDF bytes
        self.checks = {}              # key -> {"ok", "text"}
        self.saved = {}               # key -> {"irn", "drn", "at", "via"}
        self.failed = {}              # (key, irn) -> error, so a bad read is not sent again every tick
        self.msg, self.good = "", False
        self.win = None
        self.page = {"id": "", "url": "", "title": "", "boxes": 0, "modal": False}
        self.sent = set()             # files already in the ICEGATE page (page id, key)
        self.hung = False
        self.panel_sig = None
        self.ice_user = None          # {"id", "name"}: the ICEGATE ID logged in (17-Nov-2026)
        self.auto_on = False          # e-Sanchit is opened by the user (17-Nov-2026 (2): auto-open switched off)
        self.auto = None              # this login's auto-open: {"since", "tries", "done", "failed"}
        self._load_kept()
        threading.Thread(target=self._loop, daemon=True).start()

    # ------------------------------------------------------------------ kept on disk (17-Nov-2026)
    def _load_kept(self):
        try:
            with open(self.keep_file, encoding="utf-8") as f:
                k = json.load(f) or {}
        except Exception:
            return
        a = k.get("active")
        if isinstance(a, dict) and isinstance(a.get("docs"), list) and a.get("docs"):
            self.active = a
            self.saved.update({d["key"]: k["saved"][d["key"]] for d in a["docs"] if d.get("key") in (k.get("saved") or {})})
            self.msg, self.good = "This batch was kept from before. Log in on ICEGATE, open e-Sanchit, then go on.", False
        ws = k.get("winSize")
        if isinstance(ws, list) and len(ws) == 2 and all(isinstance(x, int) for x in ws):
            self.win_size = ws

    def _keep(self):
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            a = self.active
            out = {"active": a, "saved": {d["key"]: self.saved[d["key"]] for d in (a or {}).get("docs", []) if d["key"] in self.saved},
                   "winSize": self.win_size, "autoEsn": getattr(self, "auto_on", True)}
            with open(self.keep_file + ".tmp", "w", encoding="utf-8") as f:
                json.dump(out, f)
            os.replace(self.keep_file + ".tmp", self.keep_file)
        except Exception as e:
            self.log(f"[e-sanchit] could not keep the batch on disk: {e}")

    def _get_files(self, docs):
        """The signed PDFs of the batch from EagleView (again after a restart) and their signature check."""
        ev = self.get_ev()
        for d in docs:
            if d["key"] not in self.files:
                try:
                    data = ev._req("GET", d["fileUrl"], raw=True, timeout=120)
                except Exception as e:
                    return f"{d['portalName']}: {e}"
                if not data[:1024].count(b"%PDF"):
                    return f"{d['portalName']}: EagleView did not send a PDF"
                self.files[d["key"]] = data
            if d["key"] not in self.checks:
                self.checks[d["key"]] = check_signature(self.files[d["key"]])
        return ""

    # ------------------------------------------------------------------ EagleView side
    def refresh(self):
        ev = self.get_ev()
        if not ev or not ev.token:
            with self.lock:
                self.jobs, self.at = [], ""
            return self.state()
        try:
            j = ev._req("GET", "/api/icegate/signer/upload-queue")
            with self.lock:
                self.jobs = j.get("jobs") or []
                self.access = j.get("access") or {"import": True, "export": True}   # the user's divisions (EagleView rights)
                self.at = datetime.now().strftime("%H:%M:%S")
                self.error = ""
        except Exception as e:
            with self.lock:
                self.error = str(e)
        return self.state()

    def _doc(self, key):
        if self.active:
            for d in self.active["docs"]:
                if d["key"] == key:
                    return d
        for j in self.jobs:
            for d in j["docs"]:
                if d["key"] == key:
                    return d
        return None

    def save_irn(self, key, irn, drn="", via="typed in EagleView Signer"):
        irn, drn = re.sub(r"\s", "", str(irn or "")), re.sub(r"\s", "", str(drn or ""))
        d = self._doc(key)
        if not d:
            return {"ok": False, "error": "This document is not in the list any more - refresh."}
        if not num_ok(irn):
            return {"ok": False, "error": "IRN is the 16-digit number from e-Sanchit, starting with the date (YYYYMMDD)."}
        if drn and not num_ok(drn):
            return {"ok": False, "error": "DRN is 16 digits, starting with the date (YYYYMMDD)."}
        with self.lock:
            other = next((k for k, v in self.saved.items() if v["irn"] == irn and k != key), None)
        if other:
            return {"ok": False, "error": f"IRN {irn} is already saved for another document."}
        try:
            r = self.get_ev()._req("POST", "/api/icegate/signer/irn", {"fileUrl": d["fileUrl"], "irn": irn, "drn": drn,
                                                                         "portalName": d.get("portalName", ""), "via": via})
        except Exception as e:
            return {"ok": False, "error": str(e)}
        if not r.get("success"):
            return {"ok": False, "error": r.get("error") or "EagleView did not save the IRN"}
        with self.lock:
            self.saved[key] = {"irn": irn, "drn": r.get("drn") or drn, "at": datetime.now().strftime("%H:%M:%S"), "via": via}
        self._keep()
        self.log(f"[e-sanchit] {d.get('portalName')} -> IRN {irn} saved in EagleView ({via})")
        self.add_history({"time": datetime.now().strftime("%d-%m-%Y %H:%M:%S"), "kind": "IRN", "name": f"{d.get('portalName', '')} - IRN {irn}",
                          "ok": True, "signer": "", "error": "", "source": "e-Sanchit upload"})
        self._batch_done_check()
        self.push("esnChanged", None)
        return {"ok": True, "irn": irn}

    # ------------------------------------------------------------------ batch
    def start(self, job_key, keys):
        job = next((j for j in self.jobs if j["key"] == job_key), None)
        if not job:
            return {"ok": False, "error": "The job is not in the list any more - refresh."}
        docs = [d for d in job["docs"] if d["key"] in set(keys or [])]
        if not docs:
            return {"ok": False, "error": "Choose the documents of the batch."}
        if len(docs) > MAX_FILES:
            return {"ok": False, "error": f"ICEGATE takes at most {MAX_FILES} files in one upload (one DRN)."}
        big = [d["portalName"] for d in docs if (d.get("size") or 0) > MAX_BYTES]
        if big:
            return {"ok": False, "error": "Over 2 MB (ICEGATE takes at most 2 MB per file): " + ", ".join(big)}
        if len({d["portalName"].lower() for d in docs}) != len(docs):
            return {"ok": False, "error": "Two files have the same name - ICEGATE needs unique file names."}
        err = self._get_files(docs)
        if err:
            return {"ok": False, "error": err}
        bad = [f"{d['portalName']} ({self.checks[d['key']]['text']})" for d in docs if not self.checks[d["key"]]["ok"]]
        if bad:
            return {"ok": False, "error": "ICEGATE uploads a file only when its digital signature verifies: " + "; ".join(bad)}
        with self.lock:
            self.active = {"job": job["key"], "jobNo": job["jobNo"], "module": job["module"], "party": job.get("party", ""),
                           "docs": [dict(d) for d in docs], "started": datetime.now().strftime("%d-%m-%Y %H:%M")}
            self.msg, self.good = "", False
            self.panel_sig = None
        self._keep()
        self.log(f"[e-sanchit] batch of {len(docs)} file(s) of job {job['jobNo']} started")
        if not self.win:
            self.open_ice("login")
        return {"ok": True, "state": self.state()}

    def stop(self):
        with self.lock:
            self.active = None
            self.msg = ""
            self.panel_sig = None
        self._keep()
        self._js("window.__ev && window.__ev.render(null); window.__ev && window.__ev.dropChunks(); 'ok'", 5)
        return self.state()

    def _batch_done_check(self):
        a = self.active
        if a and not a.get("done") and all(d["key"] in self.saved for d in a["docs"]):
            a["done"] = True
            self._keep()
            with self.lock:
                self.msg, self.good = f"All {len(a['docs'])} IRN(s) of job {a['jobNo']} are saved in EagleView.", True
                self.panel_sig = None
            self.notify("e-Sanchit done", f"Job {a['jobNo']}: {len(a['docs'])} IRN(s) saved in EagleView")

    # ------------------------------------------------------------------ ICEGATE window
    def open_ice(self, where="login"):
        # where: login (opens it; an open window is only brought up), relogin (the login page again), home / search
        # (e-Sanchit upload / search page), show (only brings the window up)
        url = {"login": ICEGATE_LOGIN, "relogin": ICEGATE_LOGIN, "home": ESANCHIT_HOME, "search": ESANCHIT_SEARCH}.get(where, ICEGATE_LOGIN)
        import webview
        # 17-Nov-2026: e-Sanchit logs in only through ICEGATE's own hand-over (dashboard: Services > eSANCHIT); its
        # address opened straight gives "Invalid login attempt". So the e-Sanchit pages are opened from here only
        # while e-Sanchit is already open in the window; otherwise the window is brought up and the user is told.
        if where in ("home", "search") and self.win and self.sess != "esanchit":
            self._front()
            return {"ok": False, "error": "Open e-Sanchit from the ICEGATE menu: Services, eSANCHIT (ICEGATE does not let it open straight)."
                    + (" Log in on ICEGATE first." if self.sess in ("login", "loggedout") else "")}
        if self.win:
            # 17-Nov-2026: the window open already - brought to the front (it was left behind the tool's window); a
            # window that no longer answers (closed without the "closed" event, or gone) is dropped and a new one opened
            win = self.win
            try:
                win.show()
                # 17-Nov-2026 (2): the ICEGATE window is kept maximised (full screen) - restore() made it a small window
                # again; maximize() also brings back a minimised or off-screen window
                win.maximize()
                win.on_top = True
                threading.Timer(1.5, lambda: setattr(win, "on_top", False)).start()
                if where in ("home", "search", "relogin") or (where != "show" and not (self.page.get("url") or "")):
                    win.load_url(url)
                return {"ok": True}
            except Exception as e:
                self.log(f"[e-sanchit] the ICEGATE window did not answer ({e}) - opening a new one")
                self.win = None
                self.page = {"id": "", "url": "", "title": "", "boxes": 0, "modal": False}
                self.sent.clear()
                self.hung = False
        # 17-Nov-2026: no x / y - placed by Windows like the tool's own window (x / y from the screen size put it off the
        # screen on a scaled display, so it "did not open")
        w, h = self.win_size or (1180, 800)                                      # the size the user left it at
        try:
            s = webview.screens[0]
            w, h = max(900, min(w, int(s.width) - 40)), max(600, min(h, int(s.height) - 60))
        except Exception:
            pass
        # opened maximised (17-Nov-2026: the user wants ICEGATE on the full screen); w / h is its size when un-maximised
        self.win = webview.create_window("ICEGATE e-Sanchit - EagleView Signer", url=url, width=w, height=h,
                                         min_size=(900, 600), text_select=True, background_color="#FFFFFF", maximized=True)
        self.win.events.closed += self._closed
        self.win.events.loaded += lambda: threading.Thread(target=self._inject, daemon=True).start()
        try:
            self.win.events.resized += self._resized
        except Exception:
            pass
        self._set_sess("login")
        self.log("[e-sanchit] ICEGATE window opened")
        self.push("esnChanged", None)
        return {"ok": True}

    def _closed(self):
        self.win = None
        self.ice_user, self.auto = None, None
        self.page = {"id": "", "url": "", "title": "", "boxes": 0, "modal": False}
        self.sent.clear()
        self._set_sess("closed")
        self.push("esnChanged", None)

    def _resized(self, width=None, height=None, *a):
        try:
            if width and height and int(width) >= 600 and int(height) >= 400:
                self.win_size = [int(width), int(height)]
                if not getattr(self, "_size_timer", None):                      # written once the user stops resizing
                    def later():
                        self._size_timer = None
                        self._keep()
                    self._size_timer = threading.Timer(2.0, later)
                    self._size_timer.start()
        except Exception:
            pass

    # ------------------------------------------------------------------ ICEGATE session (17-Nov-2026)
    # The tool never keeps the session alive by itself and never answers ICEGATE's messages. When ICEGATE warns that
    # the session ends, shows a message box, or has logged the user out, the ICEGATE window is brought to the front and
    # a tray message is shown - the user answers ICEGATE himself.
    SESS_ALERT = {
        "expiring": ("ICEGATE session ends in 2 minutes", "Press OK / Continue on ICEGATE to stay logged in."),
        "busy": ("ICEGATE has a message open", "Answer it in the ICEGATE window."),
        "loggedout": ("ICEGATE logged you out", "Log in again in the ICEGATE window - the batch is kept."),
    }

    def _set_sess(self, s):
        if s == self.sess:
            return
        prev, self.sess, self.sess_since = self.sess, s, time.time()
        if s in self.SESS_ALERT:
            title, text = self.SESS_ALERT[s]
            self.log(f"[e-sanchit] {title}")
            self._front()
            try:
                self.notify(title, text)
            except Exception:
                pass
        with self.lock:
            self.panel_sig = None
        self.push("esnChanged", None)

    def _front(self):
        win = self.win
        if not win:
            return
        try:
            win.show()
            win.maximize()                                                         # full screen, as it opens
            win.on_top = True
            threading.Timer(1.5, lambda: setattr(win, "on_top", False)).start()
        except Exception:
            pass

    @staticmethod
    def _sess_of(r):
        url = str(r.get("url") or "")
        s = r.get("sess") or ""
        if s in ("expiring", "loggedout", "login", "esnfail"):
            return s
        if re.search(r"^https?://[^/?#]+/esanchit(/|$)", url, re.I):
            return "esanchit"
        # 17-Nov-2026: the public ICEGATE site (www.icegate.gov.in, not e-Sanchit) is not a login - its page showed
        # "Logged in - now open e-Sanchit"
        if re.search(r"^https?://www\.icegate\.gov\.in(/|[?#]|$)", url, re.I):
            return "login"
        # 17-Nov-2026 (2): the OTP step after the password is still the login - the dashboard comes after it
        if re.search(r"#/?otp", url, re.I):
            return "login"
        if re.search(r"icegate\.gov\.in", url, re.I):
            return "dashboard"
        return "login"

    def _wrap(self, call):
        return ("(function(){try{if(!window.__ev||window.__ev.v!==6){" + self.helper + "}"
                "return JSON.stringify({r:(" + call + ")});}catch(e){return JSON.stringify({err:String(e&&e.message||e)});}})()")

    def _js(self, code, timeout=10):
        win = self.win
        if not win or self.hung:
            return None
        box = {}

        def run():
            try:
                try:
                    box["r"] = win.gui.evaluate_js(code, win.uid, True)
                except (AttributeError, TypeError):
                    box["r"] = win.evaluate_js(code)
            except Exception as e:
                box["e"] = e

        t = threading.Thread(target=run, daemon=True)
        t.start()
        t.join(timeout)
        if t.is_alive():                       # a "Leave site?" box or a busy page: wait until it answers again
            self.hung = True

            def wait():
                t.join()
                self.hung = False
            threading.Thread(target=wait, daemon=True).start()
            return None
        r = box.get("r")
        if isinstance(r, str):
            try:
                r = json.loads(r)
            except Exception:
                pass
        return r

    def call(self, js_expr, timeout=15):
        r = self._js(self._wrap(js_expr), timeout)
        if not isinstance(r, dict):
            return None, "The ICEGATE window did not answer (is a message box open there?)"
        if "err" in r:
            return None, "ICEGATE page: " + r["err"]
        return r.get("r"), ""

    def _inject(self):
        time.sleep(0.3)
        self.call("1", 8)
        self.panel_sig = None

    # ------------------------------------------------------------------ actions in the ICEGATE page
    def put_files(self):
        a = self.active
        if not a:
            return {"ok": False, "error": "Start a batch first."}
        if not self.win:
            return {"ok": False, "error": "Open the ICEGATE window first."}
        if self.sess != "esanchit":
            return self._said(False, {"login": "Log in on ICEGATE first, then open the e-Sanchit upload page.",
                                      "dashboard": "ICEGATE is not on e-Sanchit yet - on ICEGATE press Services, eSANCHIT.",
                                      "esnfail": "e-Sanchit did not open - on ICEGATE press Back to Home, then Services, eSANCHIT.",
                                      "expiring": "Answer ICEGATE's session message first.", "busy": "Answer the message open in the ICEGATE window first.",
                                      "loggedout": "ICEGATE logged you out - log in again, then open e-Sanchit."}.get(self.sess, "Open e-Sanchit on ICEGATE first."))
        err = self._get_files(a["docs"])
        if err:
            return self._said(False, err)
        pid = self.page.get("id")
        for d in a["docs"]:
            if (pid, d["key"]) in self.sent:
                continue
            b64 = base64.b64encode(self.files[d["key"]]).decode("ascii")
            parts = [b64[i:i + CHUNK] for i in range(0, len(b64), CHUNK)] or [""]
            for i, p in enumerate(parts):
                _, err = self.call(f"window.__ev.addChunk({json.dumps(d['portalName'])},{i},{len(parts)},{json.dumps(p)})", 20)
                if err:
                    return self._said(False, err)
            self.sent.add((pid, d["key"]))
        put_js = f"window.__ev.putFiles({json.dumps([d['portalName'] for d in a['docs']])}, true)"
        r, err = self.call(put_js, 15)
        if not err and r and r.get("why") == "no-box":
            # open ICEGATE's "Upload Documents" pop-up, then try again
            opened, err = self.call("window.__ev.openUpload()", 8)
            if opened:
                for _ in range(6):
                    time.sleep(0.5)
                    r, err = self.call(put_js, 15)
                    if err or not r or r.get("why") != "no-box":
                        break
        if err or not r:
            return self._said(False, err or "No answer from the ICEGATE page")
        if not r.get("ok"):
            return self._said(False, r.get("text") or "The files could not be put in")
        put = r.get("put") or []
        text = f"{len(put)} file(s) put in ICEGATE's file box."
        if r.get("single"):
            text = "ICEGATE's file box takes one file at a time: the first file is in. Upload it, then press \"Put the files\" again for the next."
        text += f" Pressed ICEGATE's \"{r['pressed']}\"." if r.get("pressed") else " Now press Upload on ICEGATE."
        text += " Then press \"Fill details\" for each document."
        a["putAt"] = datetime.now().strftime("%H:%M")
        self._keep()
        self.log(f"[e-sanchit] files put in ICEGATE: {', '.join(put)}")
        return self._said(True, text)

    def fill(self, key):
        d = self._doc(key)
        if not d:
            return {"ok": False, "error": "Not in the batch."}
        vals = {"docCode": d.get("docCode", ""), "docName": d.get("docName", ""), "issuer": d.get("issuer") or {}, "bene": d.get("bene") or {},
                "placeOfIssue": d.get("placeOfIssue", ""), "issueDate": d.get("issueDate", ""), "expiryDate": d.get("expiryDate", ""),
                "otherId": bool(d.get("otherId")), "icegateId": d.get("icegateId", "")}
        r, err = self.call(f"window.__ev.fill({json.dumps(vals)}, {json.dumps(d.get('portalName', ''))})", 15)
        if err or not r:
            return self._said(False, err or "No answer from the ICEGATE page")
        n = len(r.get("filled") or [])
        if not n and not r.get("kept"):
            return self._said(False, f"{d['portalName']}: no detail fields found on the ICEGATE page. Open the details of this document on ICEGATE (after Upload), then press Fill again.")
        text = f"{d['portalName']}: {n} field(s) filled"
        if r.get("kept"):
            text += f", {len(r['kept'])} already filled left as they are"
        nf = [x for x in (r.get("notFound") or [])]
        if nf:
            text += ". Not found, fill on ICEGATE: " + ", ".join(nf)
        text += ". Check the fields marked blue."
        self.log(f"[e-sanchit] details filled for {d['portalName']} ({r.get('scope')}): " + ", ".join(f"{x['field']}={x['value']}" for x in r.get("filled") or []))
        return self._said(True, text, extra={"filled": r.get("filled"), "kept": r.get("kept"), "notFound": nf})

    def read_now(self):
        r, err = self.call("window.__ev.read()", 15)
        if err:
            return self._said(False, err)
        got = self._take_rows(r or [])
        return self._said(True, f"{got} IRN(s) found and saved." if got else "No new IRN on this ICEGATE page yet (after Submit, or open e-Sanchit Search by date).")

    def _said(self, ok, text, extra=None):
        with self.lock:
            self.msg, self.good = text, ok and False
            self.panel_sig = None
        self.push("esnChanged", None)
        out = {"ok": ok, ("text" if ok else "error"): text}
        out.update(extra or {})
        return out

    def _take_rows(self, rows):
        """Match File Name / IRN rows of the ICEGATE page with our documents and save the IRNs."""
        docs = list(self.active["docs"]) if self.active else []
        seen = {d["key"] for d in docs}
        for j in self.jobs:
            docs += [d for d in j["docs"] if d["key"] not in seen]
        got = 0
        for row in rows:
            irn = str(row.get("irn") or "")
            if not num_ok(irn):
                continue
            rn = norm(row.get("file"))
            if len(rn) < 8:
                continue
            hits = [d for d in docs if norm(d.get("portalName")) == rn
                    or (len(norm(d.get("portalName"))) >= 12 and (norm(d.get("portalName")) in rn or rn in norm(d.get("portalName"))))]
            if len(hits) != 1:
                continue
            d = hits[0]
            if d["key"] in self.saved or (d["key"], irn) in self.failed:
                continue
            res = self.save_irn(d["key"], irn, row.get("drn") or "", via="read from the ICEGATE page")
            if res.get("ok"):
                got += 1
            else:
                self.failed[(d["key"], irn)] = res.get("error")
                self.log(f"[e-sanchit] IRN {irn} for {d.get('portalName')} not saved: {res.get('error')}")
        return got

    # ------------------------------------------------------------------ every 2 seconds while the ICEGATE window is open
    def _panel(self):
        a = self.active
        if not a:
            return None
        docs = []
        for d in a["docs"]:
            s = self.saved.get(d["key"])
            docs.append({"key": d["key"], "name": d["portalName"], "code": d.get("docCode", ""), "docName": d.get("docName", ""),
                         "irn": s["irn"] if s else "", "note": ("Missing in EagleView: " + ", ".join(d["missing"])) if d.get("missing") else ""})
        return {"job": a["jobNo"], "docs": docs, "done": sum(1 for d in docs if d["irn"]), "msg": self.msg, "good": self.good}

    def _loop(self):
        while True:
            time.sleep(TICK)
            if not self.win:
                continue
            if self.hung:
                self._set_sess("busy")                                           # a message box on ICEGATE (alert / "Leave site?")
                continue
            try:
                r, err = self.call("window.__ev.tick()", 8)
                if self.hung:
                    self._set_sess("busy")
                    continue
                if err or not isinstance(r, dict):
                    continue
                self._set_sess(self._sess_of(r))
                self._track_user(r)
                # 17-Nov-2026 (2): e-Sanchit is opened by the user (Services, eSANCHIT) - the auto-open started already on
                # the OTP page (ICEGATE keeps the ID there), gave up before the dashboard came, and the user wants it manual
                new_page = r.get("id") != self.page.get("id")
                self.page = {k: r.get(k) for k in ("id", "url", "title", "boxes", "modal")}
                if new_page:
                    self.panel_sig = None
                    self.push("esnChanged", None)
                for c in r.get("cmds") or []:
                    if c.get("c") == "put":
                        self.put_files()
                    elif c.get("c") == "fill":
                        self.fill(c.get("key"))
                    elif c.get("c") == "read":
                        self.read_now()
                if r.get("rows"):
                    self._take_rows(r["rows"])
                p = self._panel()
                sig = json.dumps(p, sort_keys=True)
                if sig != self.panel_sig or not r.get("panel"):
                    self.call(f"window.__ev.render({json.dumps(p)})", 8)
                    self.panel_sig = sig
            except Exception as e:
                self.log(f"[e-sanchit] {e}")

    # ------------------------------------------------------------------ ICEGATE ID and e-Sanchit opened by itself (17-Nov-2026)
    def _track_user(self, r):
        u = r.get("user") if self.sess in ("dashboard", "esanchit", "esnfail", "expiring", "busy") else None
        if isinstance(u, dict) and u.get("id"):
            u = {"id": str(u["id"])[:40], "name": str(u.get("name") or "")[:80]}
            if u != self.ice_user:
                self.ice_user = u
                self.log(f"[e-sanchit] ICEGATE ID logged in: {u['id']}" + (f" ({u['name']})" if u['name'] else ""))
                self.push("esnChanged", None)
        elif self.sess in ("login", "loggedout") and self.ice_user:
            self.ice_user = None
            self.push("esnChanged", None)

    def _auto_step(self, r):
        """Once after each login: a few seconds on the dashboard, then ICEGATE's Services > eSANCHIT is clicked for the
        user (helper goEsanchit). Only that menu - never a submit, never a message box, never a keep-alive."""
        if self.sess in ("login", "loggedout", "closed"):
            self.auto = None
            return
        a = self.auto
        if self.sess in ("esanchit", "esnfail"):
            if a and not a.get("done"):
                a["done"] = True
                self.push("esnChanged", None)
            return
        if not getattr(self, "auto_on", True) or self.sess != "dashboard" or not r.get("user"):
            return
        if a is None:
            self.auto = {"since": time.time(), "tries": 0, "done": False, "failed": False}
            self.push("esnChanged", None)
            return
        if a["done"] or time.time() - a["since"] < AUTO_WAIT:
            return
        res, err = self.call("window.__ev.goEsanchit()", 8)
        a["tries"] += 1
        if isinstance(res, dict) and res.get("ok"):
            a["done"] = True
            self.log("[e-sanchit] opening e-Sanchit by itself (ICEGATE: Services, eSANCHIT)")
        elif a["tries"] >= AUTO_TRIES:
            a["done"] = a["failed"] = True
            why = (res or {}).get("why") if isinstance(res, dict) else (err or "")
            self.log(f"[e-sanchit] could not open e-Sanchit by itself ({why}) - the user opens it: Services, eSANCHIT")
        self.push("esnChanged", None)

    def set_auto(self, on):
        self.auto_on = bool(on)
        if not self.auto_on and self.auto and not self.auto.get("done"):
            self.auto["done"] = True
        self._keep()
        self.push("esnChanged", None)
        return {"ok": True, "auto": self.auto_on}

    # ------------------------------------------------------------------ for the window
    def state(self):
        with self.lock:
            a = self.active
            act = None
            if a:
                act = {**{k: a[k] for k in ("job", "jobNo", "module", "party", "started")}, "putAt": a.get("putAt", ""), "done": bool(a.get("done")),
                       "docs": [{**d, "check": self.checks.get(d["key"]), "saved": self.saved.get(d["key"])} for d in a["docs"]]}
            ev = self.get_ev()
            return {"logged_in": bool(ev and ev.token), "jobs": self.jobs, "access": self.access, "at": self.at, "error": self.error, "active": act,
                    "checks": self.checks, "saved": self.saved, "msg": self.msg, "good": self.good,
                    "ice": {"open": bool(self.win), "url": self.page.get("url") or "", "title": self.page.get("title") or "",
                            "boxes": self.page.get("boxes") or 0, "busy": self.hung, "sess": self.sess if self.win else "closed",
                            "since": datetime.fromtimestamp(self.sess_since).strftime("%H:%M"),
                            "user": self.ice_user if self.win else None, "auto": self.auto_on,
                            "autoState": ("" if not self.auto else "failed" if self.auto.get("failed") else "done" if self.auto.get("done") else "waiting")}}
