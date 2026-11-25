import { useCallback, useState } from 'react';

/** A message that clears itself after `durationMs`: [notice ({ msg, type } | null), showNotice(msg, type)]. */
export function useTimedNotice(durationMs) {
  const [notice, setNotice] = useState(null);
  const showNotice = useCallback((msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), durationMs);
  }, [durationMs]);
  return [notice, showNotice];
}
