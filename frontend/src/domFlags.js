// Two marker classes kept up to date by script, so that index.css does not need :has() on big parts of the page
// (22-Nov-2026). With `.main-content:has(.premium-input) ...` and the message-box rules written with :has(), every
// key typed made the browser work out the style of the whole screen again (typing felt stuck on big lists).
//   .main-content.has-premium   the screen has AWB-style boxes (.premium-input)
//   .msg-box / .msg-head        a message window: overlay > box > head (round icon + h2 / h3)
//   .awb-sec / .awb-agent       AWB screens: a section box (first child is the heading band) / the IATA agent box
//   .job-strip-wrap             the block that holds the job line (.job-strip) of the entry screens
// The marks are set before the next paint after nodes are added or removed, so nothing shows unstyled.
const OVERLAY = 'div[style*="position: fixed"][style*="rgba("]';

function mark() {
  document.querySelectorAll('.main-content').forEach((mc) => {
    const on = !!mc.querySelector('.premium-input');
    if (mc.classList.contains('has-premium') !== on) mc.classList.toggle('has-premium', on);
    if (on) mc.querySelectorAll('div[style*="border: 1px solid rgb(148, 163, 184)"][style*="overflow: hidden"]').forEach((d) => {
      const first = d.firstElementChild;
      const fs = (first && first.tagName === 'DIV' && first.getAttribute('style')) || '';
      const sec = /border-left:\s*4px solid/.test(fs);
      const agent = /min-height:\s*38px/.test(fs) && /border-radius:\s*6px/.test(d.getAttribute('style') || '');
      if (d.classList.contains('awb-sec') !== sec) d.classList.toggle('awb-sec', sec);
      if (d.classList.contains('awb-agent') !== agent) d.classList.toggle('awb-agent', agent);
    });
  });
  document.querySelectorAll('.job-strip').forEach((js) => { const w = js.parentElement; if (w && !w.classList.contains('job-strip-wrap')) w.classList.add('job-strip-wrap'); });
  document.querySelectorAll(OVERLAY).forEach((ov) => {
    const st = ov.getAttribute('style') || '';
    if (!(/inset:\s*0/.test(st) || (/top:\s*0px/.test(st) && /left:\s*0px/.test(st)))) return;
    for (const box of ov.children) {
      if (box.tagName !== 'DIV') continue;
      const head = box.firstElementChild;
      const is = !!(head && head.tagName === 'DIV' && head.querySelector(':scope > div[style*="border-radius: 50%"] + :is(h2, h3)'));
      if (box.classList.contains('msg-box') !== is) box.classList.toggle('msg-box', is);
      if (head && head.classList.contains('msg-head') !== is) head.classList.toggle('msg-head', is);
    }
  });
}

let queued = false;
function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; try { mark(); } catch (e) { /* never break the screen for a look */ } });
}

export function startDomFlags() {
  if (typeof MutationObserver === 'undefined' || !document.body) return;
  mark();
  // nodes added / removed anywhere, and a class written again on .main-content (React rewrites it on a route change)
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'childList' || (m.target && m.target.classList && m.target.classList.contains('main-content'))) { queue(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}
