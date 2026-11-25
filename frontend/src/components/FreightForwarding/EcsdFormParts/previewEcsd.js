// Prints the form as it is on screen: a copy of the page with the typed values written into the copied boxes.
export function previewEcsd(formNode, awbNumber) {
  if (!formNode) return;
  const preview = window.open('', '_blank', 'width=900,height=700');
  if (!preview) {
    window.print();
    return;
  }
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((node) => node.outerHTML).join('');
  const copy = formNode.cloneNode(true);
  const sourceBoxes = formNode.querySelectorAll('input, textarea, select');
  copy.querySelectorAll('input, textarea, select').forEach((box, index) => {
    const source = sourceBoxes[index];
    if (!source) return;
    if (source.type === 'checkbox' || source.type === 'radio') {
      if (source.checked) box.setAttribute('checked', 'checked');
      else box.removeAttribute('checked');
    } else {
      box.setAttribute('value', source.value || '');
    }
    if (box.tagName === 'TEXTAREA') box.textContent = source.value || '';
  });
  preview.document.write(`<html><head><title>e-CSD ${awbNumber || ''}</title>${styles}</head><body>${copy.outerHTML}</body></html>`);
  preview.document.close();
  preview.focus();
  setTimeout(() => {
    preview.print();
    preview.close();
  }, 300);
}
