// Reports are styled with tw: classes. The print frame and the e-mail body do not have the app's stylesheets, so the
// Tailwind part of them is copied into the frame, and the e-mail gets every look written inline.

const isRuleOf = (rule, typeName) => typeof window[typeName] === 'function' && rule instanceof window[typeName];

const isTailwindRule = (rule) =>
  isRuleOf(rule, 'CSSLayerBlockRule') || isRuleOf(rule, 'CSSLayerStatementRule') || isRuleOf(rule, 'CSSPropertyRule');

function rootVariables(rule) {
  if (!isRuleOf(rule, 'CSSStyleRule') || rule.selectorText !== ':root') return '';
  const declarations = [...rule.style].filter((name) => name.startsWith('--')).map((name) => `${name}: ${rule.style.getPropertyValue(name)};`);
  return declarations.length ? `:root { ${declarations.join(' ')} }` : '';
}

function readableRules(sheet) {
  try {
    return [...sheet.cssRules];
  } catch {
    return []; // a stylesheet from another site (web fonts) cannot be read
  }
}

// Tailwind's layers (theme variables, the tw: utilities), its @property defaults and the :root colour variables -
// the same in dev (Vite <style> tags) and in the build (one hashed .css file). The old global rules of index.css are
// left out, so a printed report looks the same as before.
export function tailwindStylesheet() {
  return [...document.styleSheets]
    .flatMap(readableRules)
    .map((rule) => (isTailwindRule(rule) ? rule.cssText : rootVariables(rule)))
    .filter(Boolean)
    .join('\n');
}

import { COLOR_PROPERTIES, withRgbColors } from '@/lib/cssColors';

export { COLOR_PROPERTIES, withRgbColors };

const MAIL_BASE_CSS = 'body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; }';
const INHERITED_PROPERTIES = ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'text-align', 'text-transform', 'letter-spacing', 'white-space', 'border-collapse'];
const SPACING_PROPERTIES = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'];
const BORDER_SIDES = ['top', 'right', 'bottom', 'left'];
const LAYOUT_DISPLAYS = ['flex', 'inline-flex', 'grid', 'inline-grid', 'inline-block', 'none'];
const SIZE_CLASSES = [['width', /(?:^|\s)tw:w-(full|\[[^\]\s]+\])(?=\s|$)/], ['max-width', /(?:^|\s)tw:max-w-(full|\[[^\]\s]+\])(?=\s|$)/]];

const sizeFromClass = (match) => (match[1] === 'full' ? '100%' : match[1].slice(1, -1).replace(/_/g, ' '));

function mailDeclarations(element, style, parentStyle) {
  const declarations = [];
  const add = (name, value) => declarations.push(`${name}: ${withRgbColors(value)}`);
  INHERITED_PROPERTIES.forEach((name) => {
    const value = style.getPropertyValue(name);
    if (value !== parentStyle.getPropertyValue(name) && !value.startsWith('-')) add(name, value);
  });
  const background = style.getPropertyValue('background-color');
  if (background !== 'rgba(0, 0, 0, 0)') add('background-color', background);
  SPACING_PROPERTIES.forEach((name) => { if (style.getPropertyValue(name) !== '0px') add(name, style.getPropertyValue(name)); });
  BORDER_SIDES.forEach((side) => {
    const lineStyle = style.getPropertyValue(`border-${side}-style`);
    const width = style.getPropertyValue(`border-${side}-width`);
    if (lineStyle !== 'none' && width !== '0px') add(`border-${side}`, `${width} ${lineStyle} ${style.getPropertyValue(`border-${side}-color`)}`);
  });
  const verticalAlign = style.getPropertyValue('vertical-align');
  if (verticalAlign !== 'baseline' && verticalAlign !== 'middle') add('vertical-align', verticalAlign);
  const display = style.getPropertyValue('display');
  if (LAYOUT_DISPLAYS.includes(display)) {
    add('display', display);
    if (display.includes('flex')) ['flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap'].forEach((name) => add(name, style.getPropertyValue(name)));
  }
  const classes = element.getAttribute('class') || '';
  SIZE_CLASSES.forEach(([name, pattern]) => { const match = pattern.exec(classes); if (match) add(name, sizeFromClass(match)); });
  if (/(?:^|\s)tw:mx-auto(?=\s|$)/.test(classes)) { add('margin-left', 'auto'); add('margin-right', 'auto'); }
  return declarations.join('; ');
}

// The report as e-mail HTML: screen-only parts removed and every look written inline (as the printed report shows it).
export function reportMailHtml(el) {
  const copy = el.cloneNode(true);
  copy.querySelectorAll('.no-print, style').forEach((node) => node.remove());
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', left: '-20000px', top: '0', width: '900px', height: '600px', border: '0', visibility: 'hidden' });
  document.body.appendChild(frame);
  try {
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${tailwindStylesheet()}</style><style>${MAIL_BASE_CSS}</style></head><body>${copy.outerHTML}</body></html>`);
    doc.close();
    const root = doc.body.firstElementChild;
    const elements = [...root.querySelectorAll('*')];
    const view = frame.contentWindow;
    const styles = elements.map((element) => mailDeclarations(element, view.getComputedStyle(element), view.getComputedStyle(element.parentElement)));
    elements.forEach((element, index) => {
      element.removeAttribute('class');
      if (styles[index]) element.setAttribute('style', styles[index]);
      else element.removeAttribute('style');
    });
    return root.innerHTML;
  } finally {
    frame.remove();
  }
}
