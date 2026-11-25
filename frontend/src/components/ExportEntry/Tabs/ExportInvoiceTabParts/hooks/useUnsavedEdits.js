import { useEffect, useRef } from 'react';

const snapshot = (value) => {
  try {
    return JSON.stringify(value, (key, part) => (part instanceof Blob ? undefined : part));
  } catch {
    return '';
  }
};

/**
 * Changes typed in a form that were not put in with Save / Modify. The form as it was at the first touch is kept as
 * the base; the form is "edited" when it differs from it. Values the screen works out by itself change only after a
 * touch, so they never count on their own. A touch inside [data-nodirty] (the list) is not a touch of the form.
 */
export default function useUnsavedEdits({ current, area, describe, registerPendingEdits }) {
  const currentRef = useRef(current);
  currentRef.current = current;
  const baseRef = useRef(null);

  const markTouched = (event) => {
    if (baseRef.current !== null) return;
    if (event?.target?.closest?.('[data-nodirty]')) return;
    baseRef.current = { ...currentRef.current };
  };
  const isEdited = () => baseRef.current !== null && snapshot(currentRef.current) !== snapshot(baseRef.current);
  const clearEdits = () => { baseRef.current = null; };

  useEffect(() => registerPendingEdits?.(area, () => (isEdited() ? describe(currentRef.current) : '')));

  return { baseRef, currentRef, markTouched, isEdited, clearEdits };
}
