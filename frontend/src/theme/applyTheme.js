import { backgroundThemes, colorPalettes } from './themePalettes';

const DARK_BACKGROUNDS = ['midnight', 'dark'];

/** Puts the chosen background and theme colour on the page (CSS variables on <html>). */
export function applyTheme(settings) {
  const backgroundName = settings.appBackground || (settings.theme === 'dark' ? 'midnight' : 'slate');
  const background = backgroundThemes[backgroundName] || backgroundThemes.slate;
  const palette = colorPalettes[settings.primaryColor] || colorPalettes.blue;
  const root = document.documentElement;

  root.style.filter = 'none';
  root.style.background = background.app;
  Object.entries({
    '--bg-app': background.app,
    '--bg-panel': background.panel,
    '--bg-input': background.input,
    '--input-text': DARK_BACKGROUNDS.includes(backgroundName) ? '#ffffff' : '#000000',
    '--text-main': background.textMain,
    '--text-muted': background.textMuted,
    '--border-color': background.border,
    '--primary-color-start': palette.start,
    '--primary-color-end': palette.end,
    '--primary-shadow': palette.shadow,
    '--primary-text': palette.text,
    '--primary-border': palette.border,
    '--primary-bg-light': palette.bgLight,
  }).forEach(([name, value]) => root.style.setProperty(name, value));
  document.getElementById('dark-mode-fixes')?.remove();
}
