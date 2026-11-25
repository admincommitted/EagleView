import { useState } from 'react';
import { setItemFlag } from './itemForm';
import { asList, noItemSelected, patchItem } from './popupValues';

// A popup that edits a list of rows kept on the selected item (item[dataKey]) and sets its Y flag box on save
export default function useRowListPopup({ grid, dataKey, flagName, emptyForm }) {
  const { items, setItems, selectedRowId, selectedItem } = grid;
  const [show, setShow] = useState(false);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const openWith = (initialRows) => {
    if (noItemSelected(selectedRowId)) return;
    setRows(initialRows);
    setForm(emptyForm);
    setShow(true);
  };

  const open = () => openWith(asList(selectedItem[dataKey]));

  const addRow = (row) => {
    setRows([...rows, { ...row, id: Date.now() }]);
    setForm(emptyForm);
  };

  const removeRow = (id) => setRows(rows.filter((row) => row.id !== id));

  const save = () => {
    const flag = setItemFlag(flagName, rows.length > 0);
    setItems(patchItem(items, selectedRowId, { [dataKey]: rows, [flagName]: flag }));
    setShow(false);
  };

  return { show, setShow, rows, setRows, form, setForm, open, openWith, addRow, removeRow, save };
}
