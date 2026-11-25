import { getToken, getUser } from '@/services/session';

// the user of the login token: the backend writes the same name as the author ("user" is not always stored)
export function loggedInUserName() {
  try {
    const token = getToken();
    const name = token ? JSON.parse(atob(token.split('.')[1])).username : '';
    if (name) return name;
  } catch {
    // no readable token
  }
  return getUser().username || 'User';
}

// ICEGATE files give dates as YYYYMMDD
function toDate(value) {
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(String(value).trim());
  return compact ? new Date(+compact[1], +compact[2] - 1, +compact[3]) : new Date(value);
}

export function formatTimelineDate(value) {
  if (!value) return '-';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

export const formatTimelineDay = (value) => (value ? formatTimelineDate(value).split(' ').slice(0, 3).join(' ') : '');

export const isValidTime = (value) => value && !Number.isNaN(new Date(value).getTime());
