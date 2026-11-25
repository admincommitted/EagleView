// The item form is uncontrolled: every box is an input with name="..." and defaultValue={selectedItem[...]} inside
// <form id="item-form">, which ItemGridTab re-keys per selected row (so the boxes re-mount with the row's values).
// SAVE / MODIFY read the boxes with new FormData(form) by name; lookups and popups write them with element.value.
// Always go through the item form, never the page: name="qty", "rate", "flag" and "uqc" also exist in the popups.
export const ITEM_FORM_ID = 'item-form';

export const getItemForm = () => document.getElementById(ITEM_FORM_ID);

export const itemFieldValue = (name, form = getItemForm()) => (form && form.elements[name] ? form.elements[name].value : '') || '';

export const itemFieldText = (name, form = getItemForm()) => String(itemFieldValue(name, form)).trim();

export const setItemField = (name, value) => {
  const element = document.querySelector(`#${ITEM_FORM_ID} [name="${name}"]`);
  if (element) element.value = value;
};

// After a popup is saved, its flag box on the item form shows Y (or blank when the popup was emptied)
export const setItemFlag = (name, on) => {
  const flag = on ? 'Y' : '';
  setItemField(name, flag);
  return flag;
};
