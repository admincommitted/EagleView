"""
EagleView Signer - desktop tool for the DSC USB token (16-Nov-2026)

  - window (Token / Sign files / History / Settings) and a tray icon next to the clock
  - starts with Windows (optional), runs hidden in the tray
  - signs any file on this PC: PDF -> <name>_signed.pdf, other files -> <name>.sig (attached CMS)
  - EagleView signs through it (127.0.0.1:5050, same API as the old Local Signer); the PIN is asked in this window,
    so each user signs with the token of his own PC and the PIN never goes through the browser or the server
  - one copy per PC (a second start brings the window of the first)
  - e-Sanchit upload the ICEGATE way (esanchit_upload.py): ICEGATE opens in the tool's own window, the user logs in
    there himself, the tool puts a job's signed PDFs in (5 per DRN) and fills the details, the user presses Submit,
    and the IRNs read from the ICEGATE page are saved on the job in EagleView

Run:  EagleViewSigner.exe            (window)
      EagleViewSigner.exe --tray     (start hidden, as Windows auto start does)
      python eagleview_signer.py     (from source)
"""
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.request
from collections import deque
from datetime import datetime

# the exe answers driver probes of signer_core before anything else starts
if len(sys.argv) >= 3 and sys.argv[1] == "--probe":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import signer_core
    signer_core.probe_main(sys.argv[2])
    sys.exit(0)

import signer_core as core
import esanchit_upload
import job_folder
from flask import abort, jsonify, request, send_from_directory

APP_NAME = "EagleView Signer"
BASE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
UI_DIR = os.path.join(BASE, "ui")
DATA_DIR = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "EagleViewSigner")
os.makedirs(DATA_DIR, exist_ok=True)
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
LOG_FILE = os.path.join(DATA_DIR, "signer.log")

# ---------------------------------------------------------------------------------------------------------------
# settings / history / log
# ---------------------------------------------------------------------------------------------------------------
DEFAULT_SETTINGS = {"origins": core.DEFAULT_ORIGINS, "keep_pin_minutes": 5, "keep_pin_default": True,
                    "ev_server": "http://192.168.1.211:5001", "ev_user": "", "ev_token": "",
                    "jobs_root": r"D:\JOBS", "code_memory": {}}      # 17-Nov-2026: job folders (job_folder.py)


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, data):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1)
        os.replace(tmp, path)
    except Exception as e:
        log(f"[tool] could not save {os.path.basename(path)}: {e}")


SETTINGS = {**DEFAULT_SETTINGS, **load_json(SETTINGS_FILE, {})}
HISTORY = deque(load_json(HISTORY_FILE, []), maxlen=300)
LOG_LINES = deque(maxlen=400)
_hist_lock = threading.Lock()


def log(msg):
    line = datetime.now().strftime("%H:%M:%S ") + str(msg)
    LOG_LINES.append(line)
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 1_000_000:
            os.replace(LOG_FILE, LOG_FILE + ".old")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(datetime.now().strftime("%d-%m-%Y ") + line + "\n")
    except Exception:
        pass
    try:
        print(line)
    except Exception:
        pass


def add_history(rec):
    with _hist_lock:
        HISTORY.appendleft(rec)
        save_json(HISTORY_FILE, list(HISTORY))
    push("historyChanged", None)


core.LOG = log
core.ON_SIGNED.append(add_history)
core.ALLOWED_ORIGINS = list(SETTINGS.get("origins") or core.DEFAULT_ORIGINS)

# ---------------------------------------------------------------------------------------------------------------
# PIN: asked in the window; can be kept in memory for a few minutes (several PDFs of one job in a row)
# ---------------------------------------------------------------------------------------------------------------
_pin_keep = {"pin": None, "until": 0.0}
_pin_lock = threading.Lock()          # one PIN question at a time
_pin_wait = {}                        # id -> {"event", "pin"}
WINDOW = None
TRAY = None
_ui_ready = threading.Event()


def kept_pin():
    if _pin_keep["pin"] and time.time() < _pin_keep["until"]:
        return _pin_keep["pin"]
    _pin_keep["pin"] = None
    return None


def keep_pin(pin, keep):
    if keep and pin:
        _pin_keep["pin"] = pin
        _pin_keep["until"] = time.time() + 60 * max(1, int(SETTINGS.get("keep_pin_minutes") or 5))
    elif not keep:
        _pin_keep["pin"] = None


def forget_pin():
    _pin_keep["pin"] = None
    push("pinForgotten", None)


core.FORGET_PIN = forget_pin


def push(fn, data):
    """Call a JavaScript function of the window (if it is open)."""
    if WINDOW is None or not _ui_ready.is_set():
        return
    try:
        WINDOW.evaluate_js(f"window.evs && window.evs.{fn}({json.dumps(data)})")
    except Exception:
        pass


def show_window(on_top=False):
    if WINDOW is None:
        return
    try:
        WINDOW.show()
        WINDOW.restore()
        if on_top:
            WINDOW.on_top = True
            threading.Timer(1.5, lambda: setattr(WINDOW, "on_top", False)).start()
    except Exception as e:
        log(f"[tool] window not shown: {e}")


def ask_pin(meta):
    """Called by signer_core when EagleView asks to sign without a PIN. Blocks until answered (2 minutes)."""
    pin = kept_pin()
    if pin:
        return pin
    with _pin_lock:
        pin = kept_pin()                   # answered while this request waited
        if pin:
            return pin
        _ui_ready.wait(20)
        rid = "%d" % (time.time() * 1000)
        slot = {"event": threading.Event(), "pin": None}
        _pin_wait[rid] = slot
        show_window(on_top=True)
        push("askPin", {"id": rid, **meta, "keepDefault": bool(SETTINGS.get("keep_pin_default", True)),
                        "keepMinutes": int(SETTINGS.get("keep_pin_minutes") or 5)})
        notify("PIN needed", f"{meta.get('kind')}: {meta.get('name')}")
        slot["event"].wait(120)
        _pin_wait.pop(rid, None)
        push("pinClosed", {"id": rid})
        return slot["pin"]


core.ASK_PIN = ask_pin

# ---------------------------------------------------------------------------------------------------------------
# Windows: start with Windows, notifications
# ---------------------------------------------------------------------------------------------------------------
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"


def start_command():
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}" --tray'
    pyw = sys.executable.replace("python.exe", "pythonw.exe")
    return f'"{pyw}" "{os.path.abspath(__file__)}" --tray'


def autostart_get():
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
            v, _ = winreg.QueryValueEx(k, "EagleViewSigner")
            return bool(v)
    except Exception:
        return False


def autostart_set(on):
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
            if on:
                winreg.SetValueEx(k, "EagleViewSigner", 0, winreg.REG_SZ, start_command())
            else:
                try:
                    winreg.DeleteValue(k, "EagleViewSigner")
                except FileNotFoundError:
                    pass
        return True
    except Exception as e:
        log(f"[tool] start with Windows not changed: {e}")
        return False


def notify(title, text):
    try:
        if TRAY is not None and getattr(TRAY, "HAS_NOTIFICATION", False):
            TRAY.notify(text, f"{APP_NAME} - {title}")
    except Exception:
        pass


def message_box(text):
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, text, APP_NAME, 0x40)
    except Exception:
        print(text)

# ---------------------------------------------------------------------------------------------------------------
# EagleView login and the files waiting there (16-Nov-2026)
# The user logs in with his EagleView User ID / password (typed in this window, sent only to the EagleView server).
# Only the login token is kept - encrypted for this Windows user (DPAPI); the password is never stored.
# ---------------------------------------------------------------------------------------------------------------
import base64 as _b64
import urllib.error
import uuid


def _dpapi(data, protect):
    import ctypes
    from ctypes import wintypes

    class BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]
    buf = ctypes.create_string_buffer(data, len(data))
    src = BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    out = BLOB()
    fn = ctypes.windll.crypt32.CryptProtectData if protect else ctypes.windll.crypt32.CryptUnprotectData
    if not fn(ctypes.byref(src), None, None, None, None, 0x01, ctypes.byref(out)):
        raise OSError("DPAPI failed")
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out.pbData)


def seal(text):
    try:
        return "dp:" + _b64.b64encode(_dpapi(text.encode("utf-8"), True)).decode("ascii")
    except Exception:
        return ""          # not Windows / not available: the token stays in memory only


def unseal(text):
    try:
        if text and text.startswith("dp:"):
            return _dpapi(_b64.b64decode(text[3:]), False).decode("utf-8")
    except Exception:
        pass
    return ""


class EagleView:
    def __init__(self):
        self.server = str(SETTINGS.get("ev_server") or "").rstrip("/")
        self.user = SETTINGS.get("ev_user") or ""
        self.token = unseal(SETTINGS.get("ev_token") or "")
        self.queue = {"esanchit": [], "amendments": [], "at": ""}
        self.error = ""

    def save(self):
        SETTINGS["ev_server"] = self.server
        SETTINGS["ev_user"] = self.user
        SETTINGS["ev_token"] = seal(self.token) if self.token else ""
        save_json(SETTINGS_FILE, {k: SETTINGS[k] for k in DEFAULT_SETTINGS})

    def _req(self, method, path, body=None, ctype=None, raw=False, timeout=60, auth=True):
        url = self.server + path
        headers = {"Accept": "application/json", "X-Client": "EagleView-Signer"}
        if auth and self.token:
            headers["Authorization"] = "Bearer " + self.token
        data = None
        if body is not None:
            if ctype:
                data, headers["Content-Type"] = body, ctype
            else:
                data, headers["Content-Type"] = json.dumps(body).encode("utf-8"), "application/json"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                b = r.read()
                return b if raw else json.loads(b.decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            txt = e.read().decode("utf-8", "replace")
            try:
                j = json.loads(txt)
            except Exception:
                j = {"error": txt[:200] or str(e)}
            if e.code == 401 and auth:
                self.token = ""
                self.save()
                push("evLoggedOut", None)
                notify("Log in again", "The EagleView login has ended - log in again in EagleView Signer.")
                raise RuntimeError("The EagleView login has ended - log in again.")
            raise RuntimeError(j.get("error") or j.get("message") or f"EagleView answered {e.code}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"EagleView ({self.server}) cannot be reached: {e.reason}")

    def login(self, server, user, password):
        server = str(server or "").strip().rstrip("/")
        if not re.match(r"^https?://[^/\s]+$", server):
            raise RuntimeError("EagleView address like http://192.168.1.211:5001")
        self.server = server
        j = self._req("POST", "/api/auth/login", {"username": user, "password": password}, auth=False, timeout=30)
        if j.get("otpRequired"):
            return {"otp": True, "otpId": j.get("otpId"), "sentTo": j.get("sentTo") or ""}
        return self._took(j, user)

    def login_otp(self, otp_id, code):
        return self._took(self._req("POST", "/api/auth/login/otp", {"otpId": otp_id, "code": code}, auth=False, timeout=30), self.user)

    def _took(self, j, user):
        tok = j.get("token") or (j.get("data") or {}).get("token") or ""
        if not tok:
            raise RuntimeError(j.get("error") or "Login failed")
        self.token = tok
        self.user = ((j.get("user") or {}).get("username")) or user
        self.save()
        log(f"[eagleview] logged in as {self.user} on {self.server}")
        return {"ok": True, "user": self.user}

    def logout(self):
        if self.token:
            try:
                self._req("POST", "/api/auth/logout", {}, timeout=10)
            except Exception:
                pass
        self.token = ""
        self.queue = {"esanchit": [], "amendments": [], "at": ""}
        self.save()

    def refresh(self):
        if not self.token:
            return self.queue
        j = self._req("GET", "/api/icegate/signer/queue")
        self.queue = {"esanchit": j.get("esanchit") or [], "amendments": j.get("amendments") or [], "at": datetime.now().strftime("%H:%M:%S"),
                      "access": j.get("access") or {"import": True, "export": True}}   # the user's divisions (EagleView rights)
        self.error = ""
        return self.queue

    def multipart(self, fields, file_field, file_name, file_bytes, mime):
        bnd = "----EVSigner" + uuid.uuid4().hex
        parts = []
        for k, v in fields.items():
            parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8"))
        parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{file_name}"\r\nContent-Type: {mime}\r\n\r\n'.encode("utf-8"))
        parts.append(file_bytes)
        parts.append(f"\r\n--{bnd}--\r\n".encode("utf-8"))
        return b"".join(parts), "multipart/form-data; boundary=" + bnd


EV = None          # set in main() (needs the settings)
UP = None          # e-Sanchit upload (esanchit_upload.Uploader), set in main()
FOLDER = None      # job folders D:\JOBS\<job no> (job_folder.JobFolders), set in main()
_ev_seen = set()


def ev_poll():
    """Every minute while logged in: fetch the list, tell the user about new files."""
    while True:
        time.sleep(60)
        try:
            if EV and EV.token:
                q = EV.refresh()
                keys = {x["key"] for x in q["esanchit"]} | {x["key"] for x in q["amendments"]}
                new = keys - _ev_seen
                if _ev_seen and new:
                    notify("Files to sign", f"{len(new)} new file(s) waiting in EagleView")
                _ev_seen.clear()
                _ev_seen.update(keys)
                push("evQueue", None)
        except Exception as e:
            if EV:
                EV.error = str(e)


# ---------------------------------------------------------------------------------------------------------------
# Window API (called from ui/index.html through pywebview)
# ---------------------------------------------------------------------------------------------------------------
FILE_TYPES = ("All files (*.*)", "PDF files (*.pdf)", "ICEGATE files (*.be;*.sb;*.json;*.txt)")


def unique_path(path):
    if not os.path.exists(path):
        return path
    stem, ext = os.path.splitext(path)
    n = 2
    while os.path.exists(f"{stem} ({n}){ext}"):
        n += 1
    return f"{stem} ({n}){ext}"


def out_path_for(path):
    folder, name = os.path.split(path)
    stem, ext = os.path.splitext(name)
    if ext.lower() == ".pdf":
        return unique_path(os.path.join(folder, f"{stem}_signed.pdf"))
    return unique_path(os.path.join(folder, f"{name}.sig"))


class Api:
    def status(self):
        cert = next(iter(core.CERT_CACHE.values()), None) if core.TOKEN_INFO.get("token_present") else None
        return {
            "version": core.VERSION,
            "checking": core._checking,
            "dll_found": core.DLL_PATH is not None,
            "dll_path": core.DLL_PATH,
            "token_present": core.TOKEN_INFO.get("token_present", False),
            "token_labels": core.TOKEN_INFO.get("token_labels", []),
            "certificate": cert,
            "checked": [{"dll": t["dll"], "loads": t["loads"], "tokens": len(t["tokens"]), "error": t.get("error", "")}
                        for t in core.TOKEN_INFO.get("checked", [])],
            "pin_kept": bool(kept_pin()),
            "pin_kept_until": datetime.fromtimestamp(_pin_keep["until"]).strftime("%H:%M") if kept_pin() else "",
            "port": core.PORT,
            "data_dir": DATA_DIR,
        }

    def recheck(self):
        core.resolve_dll(force=True)
        if core.TOKEN_INFO.get("token_present"):
            core.CERT_CACHE.clear()
            core.read_certificate()
        return self.status()

    def pick_files(self):
        import webview
        paths = WINDOW.create_file_dialog(webview.FileDialog.OPEN, allow_multiple=True, file_types=FILE_TYPES)
        out = []
        for p in paths or []:
            try:
                out.append({"path": p, "name": os.path.basename(p), "size": os.path.getsize(p),
                            "kind": "PDF" if p.lower().endswith(".pdf") else "FILE",
                            "out": os.path.basename(out_path_for(p))})
            except Exception:
                pass
        return out

    def sign_files(self, paths, pin, keep):
        """Sign files chosen in the window. pin may be empty when a kept PIN is still valid."""
        pin = pin or kept_pin()
        if not pin:
            return {"ok": False, "error": "Type the token PIN."}
        results = []
        for p in paths or []:
            name = os.path.basename(p)
            try:
                with open(p, "rb") as f:
                    data = f.read()
                if p.lower().endswith(".pdf"):
                    out, cn = core.sign_pdf_bytes(data, pin)
                else:
                    out, cn, _ = core.sign_attached_bytes(data, pin)
                dest = out_path_for(p)
                with open(dest, "wb") as f:
                    f.write(out)
                keep_pin(pin, keep)
                rec = {"time": datetime.now().strftime("%d-%m-%Y %H:%M:%S"), "kind": "PDF" if p.lower().endswith(".pdf") else "FILE",
                       "name": name, "ok": True, "signer": cn, "error": "", "source": "This PC", "out": dest}
                add_history(rec)
                log(f"[file] {name} -> {os.path.basename(dest)} ({cn})")
                big = p.lower().endswith(".pdf") and len(out) > 2 * 1024 * 1024
                results.append({"path": p, "name": name, "ok": True, "out": dest, "outName": os.path.basename(dest),
                                "signer": cn, "size": len(out), "warn": "Over 2 MB - e-Sanchit takes at most 2 MB per file." if big else ""})
            except Exception as e:
                msg = str(e) if isinstance(e, core.SignError) else core.friendly(e)
                add_history({"time": datetime.now().strftime("%d-%m-%Y %H:%M:%S"), "kind": "PDF" if p.lower().endswith(".pdf") else "FILE",
                             "name": name, "ok": False, "signer": "", "error": msg, "source": "This PC"})
                results.append({"path": p, "name": name, "ok": False, "error": msg})
                if "Wrong PIN" in msg or "locked" in msg.lower():
                    forget_pin()
                    break                        # never try a wrong PIN again on the next file
        return {"ok": True, "results": results}

    def open_folder(self, path):
        try:
            if os.path.isfile(path):
                import subprocess
                subprocess.Popen(["explorer", "/select,", os.path.normpath(path)])
            elif os.path.isdir(path):
                os.startfile(path)
            return True
        except Exception as e:
            log(f"[tool] folder not opened: {e}")
            return False

    def open_file(self, path):
        try:
            os.startfile(path)
            return True
        except Exception:
            return False

    def history(self):
        return list(HISTORY)

    def clear_history(self):
        with _hist_lock:
            HISTORY.clear()
            save_json(HISTORY_FILE, [])
        return True

    def settings_get(self):
        return {**SETTINGS, "autostart": autostart_get(), "start_command": start_command(), "log": list(LOG_LINES)[-120:]}

    def settings_set(self, data):
        if "origins" in data:
            origins = [o.strip().rstrip("/") for o in data["origins"] if str(o).strip()]
            origins = [o for o in origins if o.startswith(("http://", "https://"))]
            SETTINGS["origins"] = origins
            core.ALLOWED_ORIGINS = list(origins)
        if "keep_pin_minutes" in data:
            SETTINGS["keep_pin_minutes"] = max(1, min(60, int(data["keep_pin_minutes"] or 5)))
        if "keep_pin_default" in data:
            SETTINGS["keep_pin_default"] = bool(data["keep_pin_default"])
        if "autostart" in data:
            autostart_set(bool(data["autostart"]))
        if "jobs_root" in data and str(data["jobs_root"] or "").strip():
            SETTINGS["jobs_root"] = os.path.normpath(str(data["jobs_root"]).strip())
        save_json(SETTINGS_FILE, {k: SETTINGS[k] for k in DEFAULT_SETTINGS})
        return self.settings_get()

    def pin_answer(self, rid, pin, keep):
        slot = _pin_wait.get(str(rid))
        if not slot:
            return False
        if pin:
            keep_pin(pin, keep)
        slot["pin"] = pin or None
        slot["event"].set()
        return True

    def forget_pin(self):
        forget_pin()
        return True

    def hide(self):
        if WINDOW is not None:
            WINDOW.hide()
        return True

    # ---- EagleView
    def ev_state(self):
        return {"server": EV.server, "user": EV.user, "logged_in": bool(EV.token), "queue": EV.queue, "error": EV.error}

    def ev_login(self, server, user, password):
        try:
            r = EV.login(server, str(user or "").strip(), str(password or ""))
            if r.get("ok"):
                self.ev_refresh()
            return r
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def ev_otp(self, otp_id, code):
        try:
            r = EV.login_otp(otp_id, str(code or "").strip())
            self.ev_refresh()
            return r
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def ev_logout(self):
        EV.logout()
        if UP:
            UP.stop()
            UP.jobs = []
        return self.ev_state()

    def ev_refresh(self):
        try:
            EV.refresh()
            _ev_seen.clear()
            _ev_seen.update({x["key"] for x in EV.queue["esanchit"]} | {x["key"] for x in EV.queue["amendments"]})
        except Exception as e:
            EV.error = str(e)
        return self.ev_state()

    def ev_sign(self, keys, pin, keep):
        """Sign the chosen EagleView files on this PC and send the signed copies back."""
        pin = pin or kept_pin()
        if not pin:
            return {"ok": False, "error": "Type the token PIN."}
        by_key = {x["key"]: x for x in EV.queue["esanchit"] + EV.queue["amendments"]}
        results = []
        for k in keys or []:
            it = by_key.get(k)
            if not it:
                results.append({"key": k, "ok": False, "error": "Not in the list any more - refresh."})
                continue
            name = it.get("fileName") or k
            try:
                if it["kind"] == "ESANCHIT_PDF":
                    src = EV._req("GET", it["fileUrl"], raw=True, timeout=120)
                    out, cn = core.sign_pdf_bytes(src, pin)
                    body, ctype = EV.multipart({"fileUrl": it["fileUrl"], "signer": cn}, "pdf", "signed.pdf", out, "application/pdf")
                    r = EV._req("POST", "/api/icegate/signer/esanchit", body, ctype=ctype, timeout=120)
                    if not r.get("success"):
                        raise RuntimeError(r.get("error") or "EagleView did not take the signed PDF")
                    warn = "Over 2 MB - e-Sanchit takes at most 2 MB per file." if r.get("over2mb") else ""
                else:
                    a = EV._req("GET", f"/api/icegate/signer/amend/{it['id']}")
                    der, cn, _ = core.sign_attached_bytes(_b64.b64decode(a["data_b64"]), pin)
                    r = EV._req("POST", f"/api/icegate/signer/amend/{it['id']}", {"signed_b64": _b64.b64encode(der).decode("ascii"), "signer_cn": cn, "fileMadeAt": a.get("fileMadeAt")})
                    if not r.get("success"):
                        raise RuntimeError(r.get("error") or "EagleView did not take the signed file")
                    warn = ""
                keep_pin(pin, keep)
                add_history({"time": datetime.now().strftime("%d-%m-%Y %H:%M:%S"), "kind": "PDF" if it["kind"] == "ESANCHIT_PDF" else "FILE",
                             "name": f"{it.get('jobNo', '')} {name}".strip(), "ok": True, "signer": cn, "error": "", "source": "EagleView list"})
                log(f"[eagleview] {it.get('jobNo')} {name} signed by {cn} and sent back")
                results.append({"key": k, "ok": True, "signer": cn, "warn": warn})
            except Exception as e:
                msg = str(e) if isinstance(e, (core.SignError, RuntimeError)) else core.friendly(e)
                add_history({"time": datetime.now().strftime("%d-%m-%Y %H:%M:%S"), "kind": "PDF" if it["kind"] == "ESANCHIT_PDF" else "FILE",
                             "name": f"{it.get('jobNo', '')} {name}".strip(), "ok": False, "signer": "", "error": msg, "source": "EagleView list"})
                results.append({"key": k, "ok": False, "error": msg})
                if "Wrong PIN" in msg or "locked" in msg.lower():
                    forget_pin()
                    break
                if "log in again" in msg:
                    break
        try:
            EV.refresh()
        except Exception as e:
            EV.error = str(e)
        return {"ok": True, "results": results, "state": self.ev_state()}

    # ---- add a document to a job from this PC (17-Nov-2026): PDF + job + details -> EagleView, as if attached on the job
    def add_jobs(self, module, text):
        try:
            from urllib.parse import urlencode
            j = EV._req("GET", "/api/icegate/signer/jobs?" + urlencode({"module": module, "q": str(text or "")[:40]}))
            return {"ok": True, "jobs": j.get("jobs") or []}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def add_codes(self):
        try:
            if not getattr(self, "_codes", None):
                self._codes = EV._req("GET", "/api/icegate/signer/doc-codes").get("codes") or []
            return {"ok": True, "codes": self._codes}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def add_pick(self):
        import webview
        paths = WINDOW.create_file_dialog(webview.FileDialog.OPEN, allow_multiple=False, file_types=("PDF files (*.pdf)",))
        if not paths:
            return None
        p = paths[0] if isinstance(paths, (list, tuple)) else paths
        try:
            return {"path": p, "name": os.path.basename(p), "size": os.path.getsize(p)}
        except Exception as e:
            return {"error": str(e)}

    def add_doc(self, module, job_id, row, path):
        try:
            with open(path, "rb") as f:
                data = f.read()
        except Exception as e:
            return {"ok": False, "error": f"Cannot read the file: {e}"}
        if not data.startswith(b"%PDF-"):
            return {"ok": False, "error": "This is not a PDF file (e-Sanchit takes PDF only)."}
        if len(data) > 12 * 1024 * 1024:
            return {"ok": False, "error": "The PDF is over 12 MB."}
        name = re.sub(r'[^A-Za-z0-9._ -]+', "_", os.path.basename(path)) or "document.pdf"
        try:
            body, ctype = EV.multipart({"module": module, "jobId": str(job_id), "row": json.dumps(row or {})}, "pdf", name, data, "application/pdf")
            r = EV._req("POST", "/api/icegate/signer/add-doc", body, ctype, timeout=120)
        except Exception as e:
            return {"ok": False, "error": str(e)}
        if not r.get("success"):
            return {"ok": False, "error": r.get("error") or "EagleView did not take the document"}
        log(f"[eagleview] {module} job {r.get('jobNo')}: document {r.get('docCode')} added ({r.get('fileName')})")
        add_history({"time": datetime.now().strftime("%d-%m-%Y %H:%M:%S"), "kind": "ADD", "name": f"{r.get('jobNo')} - {r.get('docCode')} - {os.path.basename(path)}",
                     "ok": True, "signer": "", "error": "", "source": "Added to EagleView"})
        try:
            EV.refresh()
        except Exception:
            pass
        return {"ok": True, **r}

    # ---- job folders (17-Nov-2026): D:\JOBS\<job no> - sign all its PDFs, upload them on ICEGATE, IRNs back
    def folder_find(self, text):
        acc = (EV.queue or {}).get("access") or (UP.access if UP else None) or {"import": True, "export": True}
        return FOLDER.find(text, acc)

    def folder_open(self, job):
        try:
            return FOLDER.open(job)
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def folder_state(self, refresh):
        try:
            return FOLDER.state(refresh=bool(refresh))
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def folder_close(self):
        return FOLDER.close()

    def folder_create(self):
        try:
            return FOLDER.create()
        except Exception as e:
            return {"ok": False, "error": f"Cannot make the folder: {e}"}

    def folder_show(self):
        return self.open_folder(FOLDER.folder()) if FOLDER.job else False

    def folder_code(self, name, code):
        return FOLDER.set_code(name, code)

    def folder_details(self, name, details):
        return FOLDER.set_details(name, details)

    def folder_sign(self, names, pin, keep):
        pin = pin or kept_pin()
        if not pin:
            return {"ok": False, "error": "Type the token PIN."}
        r = FOLDER.sign(names, pin)
        res = r.get("results") or []
        if any("Wrong PIN" in (x.get("error") or "") or "locked" in (x.get("error") or "").lower() for x in res):
            forget_pin()
        elif any(x.get("ok") for x in res):
            keep_pin(pin, keep)
        return r

    def folder_upload(self, names):
        try:
            return FOLDER.upload(names)
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ---- e-Sanchit upload on ICEGATE
    def esn_state(self):
        return UP.state()

    def esn_refresh(self):
        return UP.refresh()

    def esn_start(self, job_key, keys):
        try:
            return UP.start(job_key, keys)
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def esn_stop(self):
        return UP.stop()

    def esn_open(self, where):
        try:
            return UP.open_ice(where)
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def esn_put(self):
        return UP.put_files()

    def esn_auto(self, on):
        return UP.set_auto(on)

    def esn_fill(self, key):
        return UP.fill(key)

    def esn_read(self):
        return UP.read_now()

    def esn_irn(self, key, irn, drn):
        return UP.save_irn(key, irn, drn)


API = Api()

# ---------------------------------------------------------------------------------------------------------------
# Extra routes on the signer's web server: the window page, and "show yourself" for a second start
# ---------------------------------------------------------------------------------------------------------------


@core.app.route("/ui/")
@core.app.route("/ui/<path:name>")
def ui_files(name="index.html"):
    if request.headers.get("Origin") not in (None, "http://127.0.0.1:5050", "http://localhost:5050"):
        abort(403)
    return send_from_directory(UI_DIR, name)


@core.app.route("/tool/show", methods=["POST"])
def tool_show():
    if request.headers.get("Origin"):
        abort(403)
    show_window()
    return jsonify({"ok": True})

# ---------------------------------------------------------------------------------------------------------------
# start
# ---------------------------------------------------------------------------------------------------------------


def port_in_use(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0
    finally:
        s.close()


def other_copy(quiet=False):
    """Another signer on the port: our tool -> bring its window; the old console signer -> tell the user."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{core.PORT}/status", timeout=4) as r:
            st = json.loads(r.read().decode("utf-8"))
    except Exception:
        st = {}
    if st.get("tool"):
        if quiet:                                   # auto start / START_SIGNER.bat: already running, nothing to do
            return
        try:
            urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{core.PORT}/tool/show", data=b"", method="POST"), timeout=4)
        except Exception:
            pass
        return
    message_box(f"Port {core.PORT} is already used - most likely by the old signer window (START_SIGNER.bat).\n\n"
                f"Close that black window and start {APP_NAME} again.")


def run_server():
    from werkzeug.serving import make_server
    srv = make_server("127.0.0.1", core.PORT, core.app, threaded=True)
    log(f"[tool] listening on 127.0.0.1:{core.PORT}")
    srv.serve_forever()


def tray_image():
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((4, 4, 60, 60), radius=14, fill=(35, 70, 184, 255))
    d.line((18, 42, 30, 30, 46, 18), fill=(255, 255, 255, 255), width=6, joint="curve")   # pen stroke
    d.line((16, 50, 48, 50), fill=(255, 255, 255, 230), width=4)                           # signature line
    ok = core.TOKEN_INFO.get("token_present")
    d.ellipse((42, 38, 60, 56), fill=(18, 122, 85, 255) if ok else (180, 105, 14, 255), outline=(255, 255, 255, 255), width=2)
    return img


def start_tray():
    global TRAY
    try:
        import pystray
    except Exception as e:
        log(f"[tool] no tray icon: {e}")
        return

    def token_text(item):
        if core.TOKEN_INFO.get("token_present"):
            c = next(iter(core.CERT_CACHE.values()), None)
            return f"Token ready: {(c or {}).get('name') or ', '.join(core.TOKEN_INFO.get('token_labels') or [])}"
        return "Token: not plugged in" if core.DLL_PATH else "Token: driver not found"

    def quit_app(icon, item):
        icon.stop()
        os._exit(0)

    menu = pystray.Menu(
        pystray.MenuItem("Open EagleView Signer", lambda i, it: show_window(), default=True),
        pystray.MenuItem(token_text, None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Start with Windows", lambda i, it: autostart_set(not autostart_get()), checked=lambda it: autostart_get()),
        pystray.MenuItem("Quit (EagleView cannot sign until it runs again)", quit_app),
    )
    TRAY = pystray.Icon("EagleViewSigner", tray_image(), APP_NAME, menu)
    TRAY.run_detached()

    def refresh_icon():
        last = None
        while True:
            time.sleep(10)
            now = (core.TOKEN_INFO.get("token_present"), core.DLL_PATH)
            if now != last:
                last = now
                try:
                    TRAY.icon = tray_image()
                    TRAY.update_menu()
                except Exception:
                    pass
            if time.time() - core._last_check > 30:
                core.refresh_async()
    threading.Thread(target=refresh_icon, daemon=True).start()


def main():
    global WINDOW
    hidden = "--tray" in sys.argv
    if port_in_use(core.PORT):
        other_copy(quiet=hidden)
        return
    global EV
    log(f"[tool] {APP_NAME} {core.VERSION} starting")
    EV = EagleView()
    global UP
    UP = esanchit_upload.Uploader(UI_DIR, lambda: EV, push, notify, log, add_history, data_dir=DATA_DIR)
    global FOLDER
    FOLDER = job_folder.JobFolders(lambda: EV, SETTINGS, lambda: save_json(SETTINGS_FILE, {k: SETTINGS[k] for k in DEFAULT_SETTINGS}),
                                   core.sign_pdf_bytes, push, log, add_history, lambda: UP, core.friendly)
    if EV.token:
        threading.Thread(target=API.ev_refresh, daemon=True).start()
    threading.Thread(target=ev_poll, daemon=True).start()
    threading.Thread(target=run_server, daemon=True).start()
    threading.Thread(target=core.start_checks, daemon=True).start()
    if not os.path.exists(SETTINGS_FILE):          # first start: start with Windows on, settings written
        autostart_set(True)
        save_json(SETTINGS_FILE, {k: SETTINGS[k] for k in DEFAULT_SETTINGS})

    import webview
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = False   # ICEGATE opens e-Sanchit in a new tab: keep it in the tool's ICEGATE window
    WINDOW = webview.create_window(APP_NAME, url=f"http://127.0.0.1:{core.PORT}/ui/index.html", js_api=API,
                                   width=1040, height=700, min_size=(820, 560), hidden=hidden,
                                   background_color="#EEF2F6", text_select=True)

    def on_closing():
        # closing the window keeps the signer running in the tray
        WINDOW.hide()
        notify("still running", "EagleView can still sign - the signer is in the tray next to the clock.")
        return False

    WINDOW.events.closing += on_closing
    WINDOW.events.loaded += lambda: _ui_ready.set()
    for _ in range(40):                              # wait for the web server
        if port_in_use(core.PORT):
            break
        time.sleep(0.1)
    webview.start(start_tray, private_mode=True)


if __name__ == "__main__":
    main()
