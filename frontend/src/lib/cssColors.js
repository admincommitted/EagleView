// html2canvas (PDF files) and mail programs only read rgb() / hex colours; Tailwind and the theme give oklch(),
// oklab() and color(srgb ...) colours. These helpers turn them into rgb().
const MODERN_COLOR = /\b(?:oklch|oklab|lch|lab|hwb|color)\([^()]*\)/g;
const rgbCache = new Map();
let colorProbe = null;

function toRgb(color) {
  if (!rgbCache.has(color)) {
    colorProbe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    colorProbe.clearRect(0, 0, 1, 1);
    colorProbe.fillStyle = '#000';
    colorProbe.fillStyle = color;
    colorProbe.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = colorProbe.getImageData(0, 0, 1, 1).data;
    rgbCache.set(color, alpha === 255 ? `rgb(${red}, ${green}, ${blue})` : `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(3)})`);
  }
  return rgbCache.get(color);
}

export const withRgbColors = (value) => value.replace(MODERN_COLOR, toRgb);

export const COLOR_PROPERTIES = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'text-decoration-color', '-webkit-text-stroke-color', 'box-shadow', 'text-shadow', 'background-image', 'outline-color', 'fill', 'stroke'];

// Writes every element's colours under `root` as rgb() inline styles (read first, then write, so a parent's change
// does not alter what its children report).
export function convertColorsToRgb(root, view = window) {
  const elements = [root, ...root.querySelectorAll('*')];
  const readings = elements.map((element) => {
    const style = view.getComputedStyle(element);
    return COLOR_PROPERTIES.map((name) => style.getPropertyValue(name));
  });
  elements.forEach((element, index) => {
    COLOR_PROPERTIES.forEach((name, position) => {
      const value = readings[index][position];
      const rgbValue = withRgbColors(value);
      if (rgbValue !== value) element.style.setProperty(name, rgbValue, 'important');
    });
  });
}

// Pass as `html2canvas: { ...yourOptions, ...rgbColorsForHtml2canvas }` to every html2pdf / html2canvas call.
export const rgbColorsForHtml2canvas = {
  onclone: (clonedDocument) => convertColorsToRgb(clonedDocument.body, clonedDocument.defaultView),
};
