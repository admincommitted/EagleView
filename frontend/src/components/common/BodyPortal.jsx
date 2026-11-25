import { createPortal } from 'react-dom';

// A position:fixed popup inside a panel with backdrop-filter / overflow:hidden is placed and clipped by that panel,
// not by the window, so popups of the entry screens are drawn at the end of <body>.
export default function BodyPortal({ children }) {
  if (typeof document === 'undefined' || !document.body) return children;
  return createPortal(children, document.body);
}
