import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function ModernDatePicker({ id, name, value, onChange, className, style, disabled, ...props }) {
  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  const formatDateObj = (dateObj) => {
    if (!dateObj) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return (
    <DatePicker
      selected={parseDateString(value)}
      onChange={(date) => {
        const val = formatDateObj(date);
        if (onChange) {
          onChange({ target: { value: val, name: name } });
        }
      }}
      dateFormat="dd-MM-yyyy"
      placeholderText="DD-MM-YYYY"
      disabled={disabled}
      portalId="root"
      id={id}
      name={name}
      customInput={<input id={id} name={name} className={className} style={style} disabled={disabled} {...props} />}
    />
  );
}
