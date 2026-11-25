import { AlertTriangle, Clock, FileWarning, Unlink } from 'lucide-react';
import { AIRLINE_MASTER } from '../mastersData';
import { shortDateTime } from '../AirExportParts/airExport';

export const dateTimeOrDash = (value) => (value ? shortDateTime(value) : '-');

export const ago = (value) => {
  if (!value) return 'never';
  const minutes = Math.round((Date.now() - new Date(value)) / 60000);
  if (Number.isNaN(minutes)) return '-';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};

export const monthName = (monthKey) => {
  const [year, month] = String(monthKey).split('-');
  return new Date(+year, +month - 1, 1).toLocaleString(undefined, { month: 'short' }).toUpperCase();
};

export const percentChange = (current, previous) => (previous ? Math.round(((current - previous) / previous) * 100) : null);

export const route = (row) => `${row.origin} → ${row.destination}`;

export function airlineName(prefix, airlines) {
  const list = airlines?.length ? airlines : AIRLINE_MASTER;
  const airline = list.find((entry) => String(entry.prefix) === String(prefix));
  return airline ? `${prefix} ${airline.code2 || airline.code || ''} ${airline.name}`.replace(/\s+/g, ' ') : `${prefix}`;
}

export const ACTION_LABEL = {
  AWB_CREATED: 'Created',
  AWB_UPDATED: 'Updated',
  AWB_VOIDED: 'Voided',
  AWB_NUMBER_CHANGED: 'Number changed',
  AWB_DUPLICATED: 'Duplicated',
  HAWB_UNLINKED: 'HAWB unlinked',
  FWB_TRANSMITTED: 'FWB sent',
  FHL_TRANSMITTED: 'FHL sent',
};

export function insightAlerts(insights) {
  return [
    { key: 'due', icon: Clock, title: 'Flight today / tomorrow, FWB not sent', hint: 'Send before the airline cut-off', count: insights.dueFlights.length, tone: 'danger' },
    { key: 'stuck', icon: AlertTriangle, title: 'Stuck shipments', hint: `RCS > ${insights.rules.rcsToDepHours}h no DEP, DEP > ${insights.rules.depToArrHours}h no arrival`, count: insights.stuck.length, tone: 'warning' },
    { key: 'fhl', icon: FileWarning, title: 'FHL pending', hint: 'MAWB sent, some house FHL not sent', count: insights.fhlPending.length, tone: 'warning' },
    { key: 'orphan', icon: Unlink, title: 'HAWB without MAWB / empty MAWB', hint: `${insights.orphanCount} HAWB · ${insights.emptyMawbCount} MAWB`, count: insights.orphanCount + insights.emptyMawbCount, tone: 'primary' },
  ];
}
