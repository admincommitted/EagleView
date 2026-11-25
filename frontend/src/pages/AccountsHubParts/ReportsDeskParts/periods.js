import { todayIso } from '../ui';

// period presets (financial year April - March)
const isoDay = (date) => date.toISOString().slice(0, 10);
const fyStartOf = (date) => new Date(Date.UTC(date.getUTCMonth() < 3 ? date.getUTCFullYear() - 1 : date.getUTCFullYear(), 3, 1));
const topBarYear = () => window.__acctx || {};

const thisMonth = () => {
  const now = new Date();
  return [isoDay(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))), todayIso()];
};
const lastMonth = () => {
  const now = new Date();
  return [isoDay(new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))), isoDay(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0)))];
};
const thisQuarter = () => {
  const now = new Date();
  const quarter = Math.floor(((now.getMonth() + 9) % 12) / 3);
  const yearStart = fyStartOf(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  return [isoDay(new Date(Date.UTC(yearStart.getUTCFullYear(), 3 + quarter * 3, 1))), todayIso()];
};
// the year picked in the top bar (to today while it is running)
const thisFy = () => {
  const { fyStart, fyEnd } = topBarYear();
  if (fyStart && fyEnd) {
    const end = String(fyEnd).slice(0, 10);
    return [String(fyStart).slice(0, 10), end < todayIso() ? end : todayIso()];
  }
  return [isoDay(fyStartOf(new Date())), todayIso()];
};
const lastFy = () => {
  const { fyStart } = topBarYear();
  const start = fyStart ? new Date(String(fyStart).slice(0, 10) + 'T00:00:00Z') : fyStartOf(new Date());
  return [isoDay(new Date(Date.UTC(start.getUTCFullYear() - 1, 3, 1))), isoDay(new Date(Date.UTC(start.getUTCFullYear(), 2, 31)))];
};

export const PRESETS = {
  thisMonth: ['This month', thisMonth],
  lastMonth: ['Last month', lastMonth],
  thisQuarter: ['This quarter', thisQuarter],
  thisFy: ['This financial year', thisFy],
  lastFy: ['Last financial year', lastFy],
};
export const PERIOD_OPTIONS = [...Object.entries(PRESETS).map(([value, [label]]) => ({ value, label })), { value: 'custom', label: 'Custom dates' }];
