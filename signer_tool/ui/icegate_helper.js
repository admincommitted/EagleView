// EagleView Signer - helper put into the ICEGATE pages opened in the tool's own ICEGATE window (16-Nov-2026).
// It never presses Submit / Recall and never types a password: the user logs in on ICEGATE himself (with the CAPTCHA)
// and presses Submit himself. It only:
//   - keeps ICEGATE pages in this one window (e-Sanchit opens from the dashboard in a new tab otherwise)
//   - puts the signed PDFs of the chosen batch into ICEGATE's file box (and presses its Upload button when asked)
//   - fills the empty detail fields of one document with the values from EagleView
//   - reads File Name / DRN / IRN from the tables on the page, so the tool can save the IRNs on the job
//   - shows a small EagleView panel with the batch and buttons (the tool reads the button presses every 2 seconds)
(function () {
  if (window.__ev && window.__ev.v === 6) return;
  var ev = window.__ev = { v: 6, id: Math.random().toString(36).slice(2), cmds: [], chunks: {}, state: null, lastFill: null };
  var onIcegate = /(^|\.)icegate\.gov\.in$/i.test(location.hostname);

  // ---------------------------------------------------------------- one window
  if (onIcegate) {
    var nav = function (u) { try { location.assign(new URL(String(u), location.href).href); } catch (e) { /* bad url */ } };
    var realOpen = window.open;
    window.open = function (u) {
      if (u && typeof u === 'string' && !/^\s*javascript:/i.test(u)) { nav(u); return window; }
      if (!u) { // window.open('') then w.location = ... : go there in this window
        var fake = { closed: false, focus: function () {}, close: function () {}, blur: function () {}, document: document, opener: window };
        var loc = { assign: nav, replace: nav };
        Object.defineProperty(loc, 'href', { set: nav, get: function () { return location.href; } });
        Object.defineProperty(fake, 'location', { set: nav, get: function () { return loc; } });
        return fake;
      }
      return realOpen.apply(window, arguments);
    };
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[target]') : null;
      if (a && a.target && a.target !== '_self' && a.href && !/^\s*javascript:/i.test(a.getAttribute('href') || '')) a.target = '_self';
    }, true);
    document.addEventListener('submit', function (e) { var f = e.target; if (f && f.target && f.target !== '_self') f.target = '_self'; }, true);
    try {
      var realSubmit = HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit = function () { if (this.target && this.target !== '_self') this.target = '_self'; return realSubmit.call(this); };
    } catch (e) { /* read only */ }
  }

  // ---------------------------------------------------------------- helpers
  var txt = function (el) { return el ? String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  var visible = function (el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    var s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || '1') > 0.05;
  };
  var norm = function (s) { return String(s || '').toLowerCase().replace(/\.(pdf|jpe?g|docx?)$/i, '').replace(/[^a-z0-9]/g, ''); };
  function openModal() {
    var list = Array.prototype.slice.call(document.querySelectorAll('.modal.show, .modal.in, .modal[style*="block"], [role="dialog"], .ui-dialog, .popup, .modal-dialog'));
    list = list.filter(visible);
    return list.length ? list[list.length - 1] : null;
  }
  function fire(el, type) { try { el.dispatchEvent(new Event(type, { bubbles: true })); } catch (e) { /* old page */ } }
  function jq(el) { try { if (window.jQuery) window.jQuery(el).trigger('change'); } catch (e) { /* no jQuery */ } }
  function setValue(el, v) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, 'value');
    try { el.focus({ preventScroll: true }); } catch (e) { /* not focusable */ }
    if (d && d.set) d.set.call(el, v); else el.value = v;
    fire(el, 'input'); fire(el, 'change'); fire(el, 'keyup'); jq(el); fire(el, 'blur');
  }

  // ---------------------------------------------------------------- files
  ev.addChunk = function (name, i, n, part) {
    var c = ev.chunks[name] || (ev.chunks[name] = { n: n, parts: [] });
    c.parts[i] = part; c.n = n;
    return 'ok';
  };
  ev.dropChunks = function () { ev.chunks = {}; return 'ok'; };
  function fileOf(name) {
    var c = ev.chunks[name];
    if (!c) return null;
    for (var i = 0; i < c.n; i++) if (typeof c.parts[i] !== 'string') return null;
    var bin = atob(c.parts.join('')); var bytes = new Uint8Array(bin.length);
    for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    return new File([bytes], name, { type: 'application/pdf', lastModified: Date.now() });
  }
  function fileBoxes() {
    var all = Array.prototype.slice.call(document.querySelectorAll('input[type="file"]')).filter(function (x) { return !x.disabled; });
    var m = openModal();
    var inModal = m ? all.filter(function (x) { return m.contains(x); }) : [];
    var shown = all.filter(function (x) { return visible(x) || visible(x.parentElement); });
    return inModal.length ? inModal : shown; // not a file box of a closed pop-up
  }
  // ICEGATE's "Upload Documents" button (id "modal") opens the upload pop-up with the file box
  ev.openUpload = function () {
    var b = document.getElementById('modal');
    if (!b || !visible(b) || !/upload\s*documents?/i.test(txt(b))) {
      b = Array.prototype.slice.call(document.querySelectorAll('button, input[type="button"], a.btn')).filter(function (x) {
        return visible(x) && /^upload\s*documents?$/i.test((x.tagName === 'INPUT' ? x.value : txt(x)).trim());
      })[0];
    }
    if (!b) return false;
    b.click();
    return true;
  };
  ev.putFiles = function (names, pressUpload) {
    var boxes = fileBoxes();
    if (!boxes.length) return { ok: false, why: 'no-box', text: 'ICEGATE has no file box open. Press "Upload Documents" on ICEGATE first.' };
    var box = boxes[0];
    var files = []; var missing = [];
    names.forEach(function (n) { var f = fileOf(n); if (f) files.push(f); else missing.push(n); });
    if (missing.length) return { ok: false, why: 'missing', text: 'Files did not reach the ICEGATE window: ' + missing.join(', ') };
    var put = box.multiple ? files : files.slice(0, 1);
    var dt = new DataTransfer(); put.forEach(function (f) { dt.items.add(f); });
    box.files = dt.files;
    fire(box, 'input'); fire(box, 'change'); jq(box);
    var res = { ok: true, put: put.map(function (f) { return f.name; }), single: !box.multiple && files.length > 1, pressed: '' };
    if (pressUpload) {
      var scope = box.closest('.modal, [role="dialog"], .ui-dialog, form') || null;
      var btns = Array.prototype.slice.call((scope || document).querySelectorAll('button, input[type="button"], input[type="submit"], a.btn'))
        .filter(function (b) { return visible(b) && !b.disabled; });
      var label = function (b) { return (b.tagName === 'INPUT' ? b.value : txt(b)).trim(); };
      var hit = btns.filter(function (b) { var t = label(b); return scope ? /^upload( files?)?$/i.test(t) : /^upload$/i.test(t); })[0];
      if (hit && !/submit|recall|delete/i.test(label(hit))) {
        setTimeout(function () { hit.click(); }, 400);
        res.pressed = label(hit);
      }
    }
    return res;
  };

  // ---------------------------------------------------------------- details of one document
  function labelOf(el) {
    var parts = [];
    if (el.id) { try { var l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) parts.push(txt(l)); } catch (e) { /* bad id */ } }
    var pl = el.closest('label'); if (pl) parts.push(txt(pl));
    ['aria-label', 'placeholder', 'title', 'name', 'id', 'formcontrolname', 'ng-model', 'data-name'].forEach(function (a) {
      var v = el.getAttribute(a); if (v) parts.push(v.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' '));
    });
    var td = el.closest('td, th');
    if (td) {
      var prev = td.previousElementSibling; if (prev && !prev.querySelector('input, select, textarea')) parts.push(txt(prev));
      var table = td.closest('table'); var tr = td.parentElement;
      if (table && tr) {
        var idx = Array.prototype.indexOf.call(tr.children, td);
        var head = table.querySelector('thead tr') || table.querySelector('tr');
        if (head && head !== tr && head.children[idx]) parts.push(txt(head.children[idx]));
      }
    }
    var p = el.parentElement;
    for (var k = 0; p && k < 3 && parts.join('').length < 3; k++, p = p.parentElement) {
      var lab = p.querySelector('label'); if (lab && !lab.contains(el)) parts.push(txt(lab));
    }
    var sib = el.previousElementSibling; if (sib && /^(LABEL|SPAN|B|STRONG|DIV|P)$/.test(sib.tagName) && txt(sib).length < 60) parts.push(txt(sib));
    return parts.join(' | ').slice(0, 300);
  }
  function sectionOf(el, label) {
    var own = label + ' ' + (el.name || '') + ' ' + (el.id || '');
    if (/issu/i.test(own)) return 'issuer';
    if (/benef|\bbene\b|bene[A-Z_]|\bbenf|benf[A-Z_]/i.test(own)) return 'bene';   // ICEGATE e-Sanchit: benfCode_N, benfName_N
    var node = el;
    for (var up = 0; node && up < 12; up++, node = node.parentElement) {
      var s = node.previousElementSibling;
      for (var k = 0; s && k < 8; k++, s = s.previousElementSibling) {
        if (s.querySelector && s.querySelector('input, select, textarea') && txt(s).length > 80) continue;
        var t = txt(s); if (!t || t.length > 80) continue;
        if (/issu/i.test(t)) return 'issuer';
        if (/benef|\bbenf/i.test(t)) return 'bene';
      }
      var hd = node.querySelector && node.querySelector(':scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > .card-header, :scope > .panel-heading');
      if (hd) { var h = txt(hd); if (/issu/i.test(h)) return 'issuer'; if (/benef/i.test(h)) return 'bene'; }
    }
    return '';
  }
  var SPECS = [
    { k: 'docType', rx: /doc(ument)?\s*type|doctype|type\s*of\s*doc|document\s*code/i, sel: true },
    { k: 'issuer.code', rx: /\bcode\b|\biec\b|code$/i, sec: 'issuer', not: /doc(ument)?\s*(type|code)|pin|postal/i },
    { k: 'issuer.name', rx: /name/i, sec: 'issuer', not: /file|user/i },
    { k: 'issuer.addr1', rx: /addr(ess)?\s*(line)?\s*1\b|address1|addr1|address$/i, sec: 'issuer' },
    { k: 'issuer.addr2', rx: /addr(ess)?\s*(line)?\s*2\b|address2|addr2/i, sec: 'issuer' },
    { k: 'issuer.city', rx: /city/i, sec: 'issuer' },
    { k: 'issuer.pin', rx: /\bpin\b|pin\s*code|pincode|postal|zip/i, sec: 'issuer' },
    { k: 'bene.code', rx: /\bcode\b|\biec\b|code$/i, sec: 'bene', not: /doc(ument)?\s*(type|code)|pin|postal/i },
    { k: 'bene.name', rx: /name/i, sec: 'bene', not: /file|user/i },
    { k: 'bene.addr1', rx: /addr(ess)?\s*(line)?\s*1\b|address1|addr1|address$/i, sec: 'bene' },
    { k: 'bene.addr2', rx: /addr(ess)?\s*(line)?\s*2\b|address2|addr2/i, sec: 'bene' },
    { k: 'bene.city', rx: /city/i, sec: 'bene' },
    { k: 'bene.pin', rx: /\bpin\b|pin\s*code|pincode|postal|zip/i, sec: 'bene' },
    { k: 'placeOfIssue', rx: /place\s*of\s*issue|issue\s*place|place\s*issue|placeofissue|issuing\s*place/i },
    { k: 'issueDate', rx: /issue\s*date|date\s*of\s*issue|issuedate|dateofissue|doc(ument)?\s*date/i, date: true, not: /expir/i },
    { k: 'expiryDate', rx: /expir|valid\s*(up)?\s*to|validity\s*date/i, date: true },
    { k: 'icegateId', rx: /icegate\s*(user)?\s*id|icegateid/i, only: 'otherId' },
  ];
  function get(o, k) { return k.split('.').reduce(function (a, p) { return a == null ? a : a[p]; }, o); }
  function dateFor(el, ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); if (!m) return '';
    if (el.type === 'date') return ymd;
    var hint = (el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('data-date-format') || '') + ' ' + (el.getAttribute('title') || '');
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1];
    if (/mm\s*\/\s*dd/i.test(hint)) return m[2] + '/' + m[3] + '/' + m[1];
    if (/yyyy\s*-\s*mm/i.test(hint)) return ymd;
    if (/mmm/i.test(hint)) return m[3] + '-' + mon + '-' + m[1];
    if (/dd\s*-\s*mm/i.test(hint)) return m[3] + '-' + m[2] + '-' + m[1];
    return m[3] + '/' + m[2] + '/' + m[1];
  }
  function pickOption(sel, want, alt) {
    var w = String(want || '').trim().toLowerCase(); var a = String(alt || '').trim().toLowerCase();
    if (!w && !a) return null;
    var opts = Array.prototype.slice.call(sel.options);
    var t = function (o) { return String(o.text || '').trim().toLowerCase(); };
    var v = function (o) { return String(o.value || '').trim().toLowerCase(); };
    return opts.filter(function (o) { return w && (v(o) === w || t(o) === w); })[0]
      || opts.filter(function (o) { return w && (t(o).indexOf(w + ' ') === 0 || t(o).indexOf(w + '-') === 0 || t(o).indexOf(w + ' -') === 0 || v(o).indexOf(w) === 0); })[0]
      || opts.filter(function (o) { return a && t(o) === a; })[0]
      || opts.filter(function (o) { return w && w.length >= 4 && t(o).indexOf(w) >= 0; })[0] || null;
  }
  function fields(root) {
    return Array.prototype.slice.call(root.querySelectorAll('input, select, textarea')).filter(function (el) {
      if (el.disabled) return false;
      if (el.tagName === 'INPUT' && /^(hidden|file|checkbox|radio|button|submit|reset|image|password)$/i.test(el.type || '')) return false;
      if (el.tagName === 'SELECT') { var nx = el.nextElementSibling; return visible(el) || (nx && /select2|chosen|bootstrap-select/.test(nx.className || '')); }
      return visible(el);
    });
  }
  // the form of one document: the table row that shows its file name, else the dialog open on top, else the page
  function scopeFor(fileName) {
    var n = norm(fileName);
    if (n) {
      var rows = Array.prototype.slice.call(document.querySelectorAll('tr')).filter(function (tr) { return norm(txt(tr)).indexOf(n) >= 0 && tr.querySelector('input, select, textarea'); });
      if (rows.length === 1) return { root: rows[0], kind: 'row' };
    }
    var m = openModal(); if (m && fields(m).length) return { root: m, kind: 'dialog' };
    return { root: document.body, kind: 'page' };
  }
  ev.fill = function (vals, fileName) {
    var sc = scopeFor(fileName); var els = fields(sc.root);
    var info = els.map(function (el) { var l = labelOf(el); return { el: el, label: l, sec: sectionOf(el, l), used: false }; });
    var out = { scope: sc.kind, filled: [], kept: [], notFound: [], fields: els.length };
    SPECS.forEach(function (sp) {
      if (sp.only && !vals[sp.only]) return;
      var want = sp.k === 'docType' ? vals.docCode : get(vals, sp.k);
      if (want == null || String(want).trim() === '') return;
      var cand = info.filter(function (f) {
        if (f.used || !sp.rx.test(f.label) || (sp.not && sp.not.test(f.label))) return false;
        if (sp.sel && f.el.tagName !== 'SELECT' && !/doc(ument)?\s*(type\s*)?code/i.test(f.label)) return false;
        if (sp.sec) return f.sec === sp.sec;
        return sp.k === 'docType' || sp.k === 'placeOfIssue' || sp.date || sp.k === 'icegateId' ? true : !f.sec;
      });
      var f = cand[0];
      if (!f) { out.notFound.push(sp.k); return; }
      f.used = true;
      var el = f.el; var shown = String(want);
      if (el.tagName === 'SELECT') {
        var o = pickOption(el, want, sp.k === 'docType' ? vals.docName : '');
        if (!o) { out.notFound.push(sp.k + ' (no such choice: ' + want + ')'); return; }
        if (el.value === o.value && el.selectedIndex > 0) { out.kept.push({ field: sp.k, label: f.label, value: o.text }); return; }
        setValue(el, o.value); shown = o.text;
      } else {
        var v = sp.date ? dateFor(el, want) : String(want);
        if (String(el.value || '').trim()) { out.kept.push({ field: sp.k, label: f.label, value: el.value }); return; }
        if (el.maxLength > 0 && v.length > el.maxLength) v = v.slice(0, el.maxLength);
        setValue(el, v); shown = v;
      }
      try { el.style.outline = '2px solid #2346B8'; el.style.outlineOffset = '1px'; } catch (e) { /* style */ }
      out.filled.push({ field: sp.k, label: f.label.slice(0, 60), value: shown });
    });
    ev.lastFill = { at: Date.now(), file: fileName, n: out.filled.length };
    return out;
  };

  // ---------------------------------------------------------------- File Name / DRN / IRN on the page
  ev.read = function () {
    var out = [];
    Array.prototype.slice.call(document.querySelectorAll('table')).forEach(function (t) {
      var head = t.querySelector('thead tr') || t.querySelector('tr');
      if (!head) return;
      var hs = Array.prototype.slice.call(head.children).map(function (c) { return txt(c).toLowerCase(); });
      var col = function (rx) { for (var i = 0; i < hs.length; i++) if (rx.test(hs[i])) return i; return -1; };
      var ci = { file: col(/file\s*name|^file$/), drn: col(/\bdrn\b/), irn: col(/\birn\b/), type: col(/doc(ument)?\s*type/), date: col(/date/) };
      if (ci.irn < 0 && ci.drn < 0) return;
      var rows = Array.prototype.slice.call(t.querySelectorAll('tr')).filter(function (r) { return r !== head && r.children.length >= hs.length - 1; });
      rows.forEach(function (r) {
        var cell = function (i) {
          if (i < 0 || !r.children[i]) return '';
          var c = r.children[i]; var v = txt(c);
          Array.prototype.slice.call(c.querySelectorAll('input')).forEach(function (x) { if (x.value) v += ' ' + x.value; });
          return v.trim();
        };
        var num = function (s) { var m = /\b(\d{16})\b/.exec(s); return m ? m[1] : ''; };
        var rec = { file: cell(ci.file), drn: num(cell(ci.drn)), irn: num(cell(ci.irn)), type: cell(ci.type).slice(0, 80), date: cell(ci.date).slice(0, 30) };
        if (rec.file || rec.irn || rec.drn) out.push(rec);
      });
    });
    return out;
  };

  // ---------------------------------------------------------------- the EagleView panel
  var host = null, shadow = null, small = false;
  function panelRoot() {
    if (host && document.documentElement.contains(host)) return shadow;
    host = document.createElement('div'); host.id = 'eagleview-signer-panel';
    host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;';
    shadow = host.attachShadow({ mode: 'open' });
    (document.body || document.documentElement).appendChild(host);
    shadow.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.c === 'min') { small = !small; ev.render(ev.state); return; }
      ev.cmds.push({ c: b.dataset.c, key: b.dataset.key || '' });
      b.disabled = true; b.textContent = 'Working...';
    });
    return shadow;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  ev.render = function (st) {
    ev.state = st || null;
    if (!st || !st.docs) { if (host) host.remove(); host = null; return 'none'; }
    var r = panelRoot();
    var css = '<style>:host{all:initial}*{box-sizing:border-box;font:13px/1.4 "Segoe UI",system-ui,sans-serif}' +
      '.p{width:390px;max-height:70vh;overflow:auto;background:#fff;color:#0E1B2C;border:1px solid #C9D3E0;border-left:5px solid #2346B8;border-radius:10px;box-shadow:0 14px 40px rgba(14,27,44,.28)}' +
      '.h{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#F3F6FB;border-bottom:1px solid #DCE3EC;position:sticky;top:0}' +
      '.h b{flex:1}.m{color:#5B6B7F;font-size:12px}button{cursor:pointer;border:1px solid #C9D3E0;background:#fff;border-radius:6px;padding:4px 9px;font-weight:600}' +
      'button.pr{background:#2346B8;border-color:#2346B8;color:#fff}button:disabled{opacity:.55;cursor:default}' +
      '.r{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:8px 12px;border-bottom:1px solid #EDF1F6}.r small{color:#5B6B7F}' +
      '.ok{color:#127A55;font-weight:700}.bad{color:#B3261E}.msg{padding:8px 12px;background:#FDF1DF;color:#6b3d06}.msg.g{background:#E3F4EC;color:#0b5137}' +
      '.f{padding:8px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.warn{padding:8px 12px;color:#7a1a14;background:#FBE9E7;font-size:12px}</style>';
    if (small) { r.innerHTML = css + '<div class="p" style="width:auto"><div class="h"><b>EagleView</b><span class="m">' + esc(st.done + '/' + st.docs.length + ' IRN') + '</span><button data-c="min">Open</button></div></div>'; return 'small'; }
    var rows = st.docs.map(function (d) {
      var right = d.irn ? '<span class="ok">IRN ' + esc(d.irn) + '</span>' : '<button data-c="fill" data-key="' + esc(d.key) + '">Fill details</button>';
      return '<div class="r"><div><b>' + esc(d.name) + '</b><br><small>' + esc(d.code + ' ' + (d.docName || '')) + '</small>' + (d.note ? '<br><small class="bad">' + esc(d.note) + '</small>' : '') + '</div><div>' + right + '</div></div>';
    }).join('');
    r.innerHTML = css + '<div class="p"><div class="h"><b>EagleView - job ' + esc(st.job) + '</b><span class="m">' + esc(st.done + ' of ' + st.docs.length + ' IRN') + '</span><button data-c="min">Hide</button></div>' +
      (st.msg ? '<div class="msg' + (st.good ? ' g' : '') + '">' + esc(st.msg) + '</div>' : '') +
      '<div class="f"><button class="pr" data-c="put">Put the files in ICEGATE</button><button data-c="read">Read IRN now</button></div>' + rows +
      '<div class="warn">Check each document on ICEGATE. EagleView never presses Submit - press it yourself when everything is right.</div></div>';
    return 'shown';
  };

  // 17-Nov-2026: where the ICEGATE session stands, read from what the page shows (the tool only tells the user - it
  // never answers ICEGATE's messages and never keeps the session alive by itself)
  ev.session = function () {
    var shown = '';
    try { shown = String(document.body ? document.body.innerText || '' : '').slice(0, 60000); } catch (e) { shown = ''; }
    if (/session\s+(will|is\s+going\s+to|is\s+about\s+to)\s+expire/i.test(shown)) return 'expiring';
    // e-Sanchit opened without ICEGATE's hand-over (only Services > eSANCHIT on the dashboard logs it in)
    if (/invalid\s+login\s+attempt/i.test(shown)) return 'esnfail';
    if (/session\s+(has\s+)?(expired|timed\s*out)|session\s+is\s+(expired|over|invalid)|invalid\s+session|please\s+log\s*-?\s*in\s+again/i.test(shown)) return 'loggedout';
    var pwd = Array.prototype.slice.call(document.querySelectorAll('input[type=password]')).some(visible);
    if (/#\/?login/i.test(location.hash || '') || pwd) return 'login';
    return '';
  };
  // 17-Nov-2026 (v6): the ICEGATE ID logged in - ICEGATE's own dashboard keeps it in sessionStorage (icegateId,
  // userName) on foservices.icegate.gov.in; nothing is read on other sites
  ev.who = function () {
    try {
      if (!/(^|\.)foservices\.icegate\.gov\.in$/i.test(location.hostname)) return null;
      var id = String(sessionStorage.getItem('icegateId') || '').trim();
      if (!id) return null;
      return { id: id, name: String(sessionStorage.getItem('userName') || '').trim() };
    } catch (e) { return null; }
  };
  // The user's own two clicks on the ICEGATE dashboard, done for him once after login (the tool asks for it): open the
  // "Services" box, then click its "eSANCHIT" entry. ICEGATE then makes the e-Sanchit hand-over itself
  // (esanchitDynamicUrl) and e-Sanchit opens in this window. Nothing is typed, nothing is submitted.
  ev.goEsanchit = function () {
    if (!ev.who()) return { ok: false, why: 'not-logged-in' };
    var leaf = Array.prototype.slice.call(document.querySelectorAll('mat-tree-node a, .mat-tree-node a')).filter(function (a) { return /^\s*e-?sanchit\s*$/i.test(a.textContent || ''); });
    if (leaf.length) { leaf[0].click(); return { ok: true, step: 'esanchit' }; }
    var head = Array.prototype.slice.call(document.querySelectorAll('mat-expansion-panel-header')).filter(function (h) {
      return !!h.querySelector('img[alt="services"]') || /^\s*services\s*$/i.test(h.textContent || '');
    })[0];
    if (!head) return { ok: false, why: 'no-services-box' };
    var panel = head.closest ? head.closest('mat-expansion-panel') : null;
    var open = head.getAttribute('aria-expanded') === 'true' || !!(panel && /mat-expanded/.test(panel.className || ''));
    if (!open) { head.click(); return { ok: false, why: 'services-opened', step: 'services' }; }
    return { ok: false, why: 'waiting-for-services' };
  };
  ev.tick = function () {
    var c = ev.cmds; ev.cmds = [];
    var hasPanel = !!(host && document.documentElement.contains(host));
    return { id: ev.id, url: location.href, title: document.title, cmds: c, rows: ev.read(), boxes: fileBoxes().length, panel: hasPanel || !ev.state, modal: !!openModal(), sess: ev.session(), user: ev.who() };
  };
})();
