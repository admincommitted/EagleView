import { useState } from 'react';
import { DateInput, Field, SelectBox } from '@/components/ui';
import { PERIOD_OPTIONS, PRESETS } from '../periods';

export function PeriodPicker({ from, to, onChange }) {
  const [preset, setPreset] = useState('thisFy');
  const pickPreset = (value) => {
    setPreset(value);
    if (PRESETS[value]) onChange(...PRESETS[value][1]());
  };
  const pickDate = (nextFrom, nextTo) => {
    setPreset('custom');
    onChange(nextFrom, nextTo);
  };
  return (
    <>
      <Field label="Period" layout="col"><SelectBox options={PERIOD_OPTIONS} value={preset} onValueChange={pickPreset} /></Field>
      <Field label="From Date" layout="col"><DateInput value={from} onValueChange={(value) => pickDate(value, to)} /></Field>
      <Field label="To Date" layout="col"><DateInput value={to} onValueChange={(value) => pickDate(from, value)} /></Field>
    </>
  );
}
