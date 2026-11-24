import { createPortal } from 'react-dom';

// Renders a popup at the end of <body>. The export / import screens sit inside panels with backdrop-filter and
// overflow:hidden; a position:fixed popup inside such a panel is placed and clipped by the panel, not by the window
// (the e-Sanchit window went off the screen on the Items tab). 29-Oct-2026
export default function BodyPortal({ children }) {
  if (typeof document === 'undefined' || !document.body) return children;
  return createPortal(children, document.body);
}
