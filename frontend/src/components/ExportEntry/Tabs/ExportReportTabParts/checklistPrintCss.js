// CSS of the S/B checklist when it is printed or mailed (12-Nov-2026).
// The print frame and the mail only get the report's own HTML, not the app's style sheet, so the checklist tables
// (8px on screen through index.css) came out at the browser's 16px while the text around them stayed 10px, and
// "keep together" never applied (ITEM DETAILS / DRAWBACK DETAILS headings were left alone at the foot of a page).
export const CHECKLIST_PRINT_CSS = `
.printable-checklist { font-size: 9.5px !important; line-height: 1.35 !important; max-width: none !important; }
.printable-checklist table { border-collapse: collapse; }
.printable-checklist table th, .printable-checklist table td { font-size: 9px !important; padding: 1px 3px !important; color: #000 !important; word-wrap: break-word; word-break: break-word; vertical-align: top; }
.printable-checklist tr, .printable-checklist .section-avoid-break { break-inside: avoid; page-break-inside: avoid; }
.printable-checklist thead { display: table-header-group; }
.printable-checklist p { margin: 3px 0; }
`;
