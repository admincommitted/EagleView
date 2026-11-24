import { useEffect } from 'react';

export function useGlobalHotkeys({ onSave, onNew }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      if (e.ctrlKey) {
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (onSave) onSave();
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          if (onNew) onNew();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onNew]);
}
