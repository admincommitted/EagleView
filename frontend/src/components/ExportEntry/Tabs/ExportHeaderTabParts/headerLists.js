export const FIELD_ROW = 'tw:flex tw:flex-col tw:gap-2 tw:lg:flex-row tw:lg:items-center tw:lg:gap-4';
export const FIVE_COLUMNS = 'tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-1.5 tw:sm:grid-cols-2 tw:lg:grid-cols-5 tw:lg:items-center';

export const includesText = (text, query) => String(text || '').toLowerCase().includes(String(query || '').toLowerCase());

// ComboInput settings of the master lists: the code is shown bold, the name beside it
export const COUNTRY_LIST = {
  getValue: (country) => country.code,
  getLabel: (country) => country.name,
  filter: (country, query) => includesText(country.name, query) || includesText(country.code, query),
};

export const PORT_LIST = {
  getValue: (port) => port.portCode,
  getLabel: (port) => `${port.portName} (${port.category})`,
  filter: (port, query) => includesText(port.portName, query) || includesText(port.portCode, query),
};

export const UQC_LIST = {
  getValue: (uqc) => uqc.uqcCode,
  getLabel: (uqc) => uqc.description,
  filter: (uqc, query) => includesText(uqc.uqcCode, query) || includesText(uqc.description, query),
};
