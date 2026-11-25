import { useState } from 'react';

const setterName = (flagName) => `set${flagName.charAt(0).toUpperCase()}${flagName.slice(1)}`;

// open / closed state for a fixed list of windows: ['showDgd'] gives { showDgd, setShowDgd } like useState(false)
export default function useWindowFlags(flagNames) {
  const [flags, setFlags] = useState({});

  const [setters] = useState(() => Object.fromEntries(flagNames.map((flagName) => [
    setterName(flagName),
    (value) => setFlags((previous) => {
      const current = previous[flagName] ?? false;
      const next = typeof value === 'function' ? value(current) : value;
      return Object.is(next, current) ? previous : { ...previous, [flagName]: next };
    }),
  ])));

  const values = Object.fromEntries(flagNames.map((flagName) => [flagName, flags[flagName] ?? false]));
  return { ...values, ...setters };
}
