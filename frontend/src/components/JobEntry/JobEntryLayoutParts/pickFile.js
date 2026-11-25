// Opens the browser's file dialog; resolves the chosen file, or null. The picker lives outside React: inside the
// ACTIONS menu it was removed when the menu closed while the dialog was open, and the chosen file was never read.
export function pickFile(accept) {
  return new Promise((resolve) => {
    const picker = Object.assign(document.createElement('input'), { type: 'file', accept, hidden: true });
    const finish = (file) => {
      picker.remove();
      resolve(file);
    };
    picker.addEventListener('change', () => finish(picker.files[0] || null));
    picker.addEventListener('cancel', () => finish(null));
    document.body.appendChild(picker);
    picker.click();
  });
}
