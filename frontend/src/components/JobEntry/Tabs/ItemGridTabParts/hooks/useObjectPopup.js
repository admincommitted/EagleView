import { useState } from 'react';
import { setItemFlag } from './itemForm';
import { hasAnyValue, noItemSelected, patchItem } from './popupValues';

// A popup that edits one set of values kept on the selected item and sets its Y flag box on save.
// readValues(item) gives what the popup opens with; savedFields(values) what is written on the item.
export default function useObjectPopup({ grid, emptyValue, flagName, readValues, savedFields }) {
  const { items, setItems, selectedRowId, selectedItem } = grid;
  const [show, setShow] = useState(false);
  const [values, setValues] = useState(emptyValue);

  const open = () => {
    if (noItemSelected(selectedRowId)) return;
    setValues(readValues(selectedItem));
    setShow(true);
  };

  const save = () => {
    const flag = setItemFlag(flagName, hasAnyValue(values));
    setItems(patchItem(items, selectedRowId, { ...savedFields(values), [flagName]: flag }));
    setShow(false);
  };

  return { show, setShow, values, setValues, open, save };
}
