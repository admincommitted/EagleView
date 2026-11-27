import { useMemo, useState } from 'react';
import { ComboInput, Input } from '@/components/ui';

// one letter matches thousands of ports: only the best matches are drawn
const MAX_PORT_ROWS = 60;

const matchRank = (port, query) => {
  const code = port.portCode?.toLowerCase() || '';
  const name = port.portName?.toLowerCase() || '';
  if (code === query) return 0;
  if (code.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  return code.includes(query) ? 3 : 4;
};

const bestPortMatches = (ports, typed) => {
  const query = typed.toLowerCase();
  return ports
    .filter((port) => port.portCode?.toLowerCase().includes(query) || port.portName?.toLowerCase().includes(query))
    .sort((a, b) => matchRank(a, query) - matchRank(b, query))
    .slice(0, MAX_PORT_ROWS);
};

// the port can be found by its code or by its name; either box fills both
export function RichPortSelect({ ports, jobData, setJobData, id }) {
  const [query, setQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const matches = useMemo(() => (query ? bestPortMatches(ports, query) : []), [ports, query]);
  const nameMatches = useMemo(() => (nameQuery ? bestPortMatches(ports, nameQuery) : []), [ports, nameQuery]);

  const selectPort = (port) => setJobData((prev) => ({ ...prev, locationName: port.portName, autoField_1: port.portName, portCode: port.portCode, autoField_2: port.portCode }));

  return (
    <>
      <ComboInput
        id={id}
        required
        placeholder="CODE"
        className="tw:w-[70px] tw:flex-none"
        listClassName="tw:min-w-72"
        options={matches}
        filter={() => true}
        limit={MAX_PORT_ROWS}
        getValue={(port) => port.portCode}
        getLabel={(port) => `${port.portName} (${port.category})`}
        value={jobData.portCode || jobData.autoField_2 || ''}
        onValueChange={setQuery}
        onFocus={() => setQuery('')}
        onSelect={selectPort}
      />
      <ComboInput
        upper
        placeholder="LOCATION NAME"
        listClassName="tw:min-w-72"
        options={nameMatches}
        filter={() => true}
        limit={MAX_PORT_ROWS}
        getValue={(port) => port.portName}
        getLabel={(port) => `${port.portCode} (${port.category})`}
        value={jobData.locationName || jobData.autoField_1 || ''}
        onValueChange={setNameQuery}
        onFocus={() => setNameQuery('')}
        onSelect={selectPort}
      />
    </>
  );
}
