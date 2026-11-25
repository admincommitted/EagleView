export const slashDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (value || '');
};

export const dateColumn = (key, header) => ({ key, header, cell: (row) => slashDate(row[key]) });
