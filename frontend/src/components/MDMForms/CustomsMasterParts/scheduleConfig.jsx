// Shared bits of the CBIC / DGFT schedule masters (drawback, RoDTEP, RoSCTL, export policy ...)

export const ALL_ROWS = { all: 1 };
export const SCHEDULE_SEARCH_FIELDS = ['tariffItem', 'description'];

export const SCHEDULE_LIST = {
  title: 'Search',
  searchPlaceholder: 'Search Tariff Item or Desc...',
  primaryText: (row) => row.tariffItem,
  secondaryText: (row) => row.description,
};

export const DGFT_POLICIES = ['FREE', 'RESTRICTED', 'PROHIBITED', 'STE'];

// a new row is posted without the blank id
export const withoutBlankId = (form) => {
  if (form.id) return form;
  const { id: _blankId, ...newRow } = form;
  return newRow;
};

export const toDashDate = (value) => {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? `${text.slice(8, 10)}-${text.slice(5, 7)}-${text.slice(0, 4)}` : text;
};

export const tariffItemColumn = {
  key: 'tariffItem',
  header: 'Tariff Item',
  cell: (row) => (
    <>
      <div className="tw:font-bold tw:text-primary">{row.tariffItem}</div>
      {row.schemeCode && <div className="tw:text-[10px] tw:font-bold tw:text-head">{row.schemeCode}</div>}
    </>
  ),
};

export const descriptionColumn = { key: 'description', header: 'Description', className: 'tw:font-semibold tw:text-muted-foreground tw:whitespace-normal' };

export const centeredColumn = (key, header, format = (row) => row[key]) => ({ key, header, align: 'center', className: 'tw:font-bold', cell: format });
