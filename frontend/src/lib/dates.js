const YEAR_FIRST = /^(\d{4})-?(\d{2})-?(\d{2})(?:$|T|\s)/;
const DAY_FIRST = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
const pad = (part) => part.padStart(2, '0');

// The server sends dates as YYYY-MM-DD, YYYYMMDD, dd/mm/yyyy or ISO; all of them show as dd/mm/yyyy.
export function toDisplayDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const yearFirst = YEAR_FIRST.exec(text);
  if (yearFirst) return `${yearFirst[3]}/${yearFirst[2]}/${yearFirst[1]}`;
  const dayFirst = DAY_FIRST.exec(text);
  if (dayFirst) return `${pad(dayFirst[1])}/${pad(dayFirst[2])}/${dayFirst[3]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString('en-GB');
}

export function toIsoDay(value) {
  const text = String(value || '').trim();
  const yearFirst = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (yearFirst) return `${yearFirst[1]}-${yearFirst[2]}-${yearFirst[3]}`;
  const dayFirst = DAY_FIRST.exec(text);
  if (dayFirst) return `${dayFirst[3]}-${pad(dayFirst[2])}-${pad(dayFirst[1])}`;
  return text;
}

export function startOfIsoDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? new Date(+match[1], +match[2] - 1, +match[3]).getTime() : NaN;
}

export function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}
