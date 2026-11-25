// props that tie a box on the Shipment tab to one field of the shipment ('data.x' = a field kept under data)
export const textProps = (form, path, { upper } = {}) => ({
  value: form.getValue(path) ?? '',
  onChange: (event) => form.setValue(path, upper ? event.target.value.toUpperCase() : event.target.value),
});

// SelectBox, DateInput and NumberInput hand over the value itself
export const valueProps = (form, path) => ({
  value: form.getValue(path) ?? '',
  onValueChange: (value) => form.setValue(path, value),
});

// a "Select" first entry that leaves the field blank
export const blankable = { clearable: true, clearLabel: 'Select', placeholder: 'Select' };
