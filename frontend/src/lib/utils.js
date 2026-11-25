import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  prefix: 'tw',
  extend: {
    theme: { shadow: ['soft', 'lift', 'popup'] },
    classGroups: { 'font-size': [{ text: ['entry', 'btn'] }] },
  },
});

/** Join class names; a later Tailwind class wins over an earlier one of the same kind. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
