import { useEffect, useRef } from 'react';

// fired by the Save / Modify buttons of the SB Header tab
const SAVE_EVENT = 'export-save';
const FORM_CONTROLS = 'input, select, textarea, button';

// Ctrl+S and the SB Header Save / Modify buttons save the job on the screen.
export function useSaveShortcuts(saveDraft) {
  const latestSave = useRef(saveDraft);
  latestSave.current = saveDraft;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        latestSave.current();
      }
    };
    const onSaveEvent = () => latestSave.current();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(SAVE_EVENT, onSaveEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(SAVE_EVENT, onSaveEvent);
    };
  }, []);
}

// Enter moves to the next box of the page (not in a text area or on a button).
export function useEnterMovesFocus() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'BUTTON') return;
      event.preventDefault();
      const controls = Array.from(document.querySelectorAll(FORM_CONTROLS));
      const index = controls.indexOf(event.target);
      if (index > -1 && index < controls.length - 1) controls[index + 1].focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
