// Bubble looks of the Status master (bubbleStyle). Its colours (colorCode = fill, textColor = ink) are data, so they
// reach the classes as CSS variables: --bubble-fill, --bubble-ink, --bubble-line (borders / glow), --bubble-edge.
const PRIMARY = 'var(--primary)';
const ON_PRIMARY = 'var(--primary-foreground)';
const FOREGROUND = 'var(--foreground)';
const CARD = 'var(--card)';
const SOFT_PRIMARY = 'color-mix(in srgb, var(--primary) 12%, var(--card))';
const faded = (colour, percent) => `color-mix(in srgb, ${colour} ${percent}%, transparent)`;

const BUBBLE_LOOKS = {
  LEFT_BORDER: ({ fill, ink, isMe, accent }) => ({
    className: 'tw:border tw:border-l-4 tw:border-[color:var(--bubble-edge)] tw:border-l-[color:var(--bubble-line)]',
    fill: fill || (isMe ? SOFT_PRIMARY : CARD),
    ink: ink || FOREGROUND,
    line: ink || accent,
    edge: ink ? faded(ink, 19) : (isMe ? faded(PRIMARY, 30) : 'var(--border)'),
  }),
  SOLID: ({ fill, ink }) => ({ className: '', fill: fill || PRIMARY, ink: ink || ON_PRIMARY, onColour: true }),
  OUTLINE: ({ fill, ink }) => ({ className: 'tw:bg-transparent tw:border-2 tw:border-[color:var(--bubble-line)]', ink: ink || FOREGROUND, line: fill || PRIMARY }),
  GLOW: ({ fill, ink }) => ({ className: '', fill: fill || 'black', ink: ink || 'white', line: ink || PRIMARY, onColour: true }),
  DASHED: ({ fill, ink }) => ({ className: 'tw:bg-transparent tw:border-2 tw:border-dashed tw:border-[color:var(--bubble-line)]', ink: ink || FOREGROUND, line: fill || PRIMARY }),
  GRADIENT: ({ fill, ink }) => ({
    className: 'tw:bg-[image:linear-gradient(135deg,var(--bubble-fill),color-mix(in_srgb,var(--bubble-fill)_50%,transparent))]',
    fill: fill || PRIMARY,
    ink: ink || ON_PRIMARY,
    onColour: true,
  }),
  BOTTOM_BORDER: ({ fill, ink }) => ({ className: 'tw:border-b-4 tw:border-b-[color:var(--bubble-line)]', fill: CARD, ink: ink || FOREGROUND, line: fill || PRIMARY }),
  SOFT_SHADOW: ({ fill, ink }) => ({ className: 'tw:border-l-4 tw:border-l-[color:var(--bubble-line)]', fill: CARD, ink: ink || FOREGROUND, line: fill || PRIMARY }),
  PILL: ({ fill, ink }) => ({
    className: 'tw:rounded-[30px] tw:border tw:border-[color:var(--bubble-edge)]',
    fill: fill || SOFT_PRIMARY,
    ink: ink || FOREGROUND,
    edge: faded(ink || PRIMARY, 19),
  }),
  GLASSMORPHISM: ({ fill, ink }) => ({
    className: 'tw:bg-[color:color-mix(in_srgb,var(--bubble-fill)_50%,transparent)] tw:backdrop-blur-md tw:border tw:border-[color:color-mix(in_srgb,var(--bubble-fill)_25%,transparent)]',
    fill: fill || 'white',
    ink: ink || FOREGROUND,
  }),
  MATERIAL_ACCENT: ({ fill, ink }) => ({ className: 'tw:rounded tw:border-l-[6px] tw:border-l-[color:var(--bubble-line)]', fill: 'var(--muted)', ink: ink || FOREGROUND, line: fill || PRIMARY }),
  NEUMORPHISM: ({ ink }) => ({ className: 'tw:rounded-xl', fill: 'var(--muted)', ink: ink || FOREGROUND }),
  FOLDED_RIBBON: ({ fill, ink }) => ({ className: 'tw:rounded-l-none tw:rounded-r-lg', fill: fill || PRIMARY, ink: ink || ON_PRIMARY, onColour: true }),
  HOLLOW_NEON: ({ ink }) => ({
    className: 'tw:border tw:border-[color:var(--bubble-line)]',
    fill: 'black',
    ink: ink || PRIMARY,
    line: ink || PRIMARY,
  }),
};

// -> { className, cssVariables, onColour } for one timeline entry; onColour = white text on a filled bubble
export function bubbleLook(status, { isMe, accent }) {
  const lookOf = BUBBLE_LOOKS[status?.bubbleStyle] || BUBBLE_LOOKS.LEFT_BORDER;
  const look = lookOf({ fill: status?.colorCode, ink: status?.textColor, isMe, accent });
  return {
    className: look.className,
    onColour: !!look.onColour,
    cssVariables: {
      '--bubble-fill': look.fill || 'transparent',
      '--bubble-ink': look.ink,
      '--bubble-line': look.line || 'transparent',
      '--bubble-edge': look.edge || 'transparent',
      '--bubble-chip': status?.colorCode || PRIMARY,
    },
  };
}
