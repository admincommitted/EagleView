import { useEffect, useRef, useState } from 'react';

// a mouse only passing over a trigger on its way somewhere else does not open it
const OPEN_DELAY_MS = 80;
// lets the mouse cross the gap between the trigger and the popup
const CLOSE_DELAY_MS = 150;

// Opens a popup while the mouse rests on its trigger or on the popup itself. Touch and keyboard still open it by
// click / Enter through the popup's own open state.
export function useHoverOpen() {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const setOpenAfter = (isOpen, delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(isOpen), delay);
  };

  const hoverProps = {
    onPointerEnter: (event) => { if (event.pointerType === 'mouse') setOpenAfter(true, OPEN_DELAY_MS); },
    onPointerLeave: (event) => { if (event.pointerType === 'mouse') setOpenAfter(false, CLOSE_DELAY_MS); },
  };

  const changeOpen = (isOpen) => {
    clearTimeout(timer.current);
    setOpen(isOpen);
  };

  return { open, setOpen: changeOpen, hoverProps };
}
