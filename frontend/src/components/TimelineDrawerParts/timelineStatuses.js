// used until the Status master has rows for the module
const FALLBACK_STATUSES = {
  EXPORT: ['DRAFT', 'JOB CREATED', 'SUBMITTED TO ICEGATE', 'TD DONE', 'XRAY DONE', 'LEO RECEIVED', 'GATE PASS ISSUED', 'HANDOVER TO AIRLINE', 'DEPARTED', 'DELIVERED', 'CANCELLED'],
  IMPORT: ['DRAFT', 'JOB CREATED', 'SUBMITTED TO ICEGATE', 'QUERY RAISED', 'REPLY FILED', 'ASSESSMENT DONE', 'DUTY PENDING', 'DUTY PAID', 'OOC PENDING', 'OOC ISSUED', 'GATE PASS ISSUED', 'DELIVERED', 'CANCELLED'],
};

const codeList = (text) => (text ? text.split(',').map((code) => code.trim().toUpperCase()) : []);

// The statuses offered next, in Status master sequence: a status another one "enables" is hidden until that one
// was reached, and a status "disabled" by one already reached is hidden.
export function offeredStatuses(statusRows, logs, module) {
  if (!statusRows.length) return module === 'EXPORT' ? FALLBACK_STATUSES.EXPORT : FALLBACK_STATUSES.IMPORT;
  const enabledLater = new Set(statusRows.flatMap((status) => codeList(status.enables)));
  const pastMessages = logs.map((log) => (log.message || '').toUpperCase().trim());
  const reached = statusRows.filter((status) => pastMessages.includes(status.code.toUpperCase()));
  const disabled = new Set(reached.flatMap((status) => codeList(status.disables)));
  const enabled = new Set(reached.flatMap((status) => codeList(status.enables)));
  return statusRows
    .filter((status) => {
      const code = status.code.toUpperCase();
      if (disabled.has(code)) return false;
      return !enabledLater.has(code) || enabled.has(code);
    })
    .map((status) => status.code);
}

// the Status master row named in a message (the longest code wins: "OOC ISSUED" before "OOC")
export function statusOfMessage(statusRows, message) {
  const text = (message || '').toUpperCase().trim();
  return [...statusRows]
    .sort((first, second) => (second.code?.length || 0) - (first.code?.length || 0))
    .find((status) => text.includes(status.code.toUpperCase()));
}

export function accentOfMessage(message) {
  const text = (message || '').toUpperCase().trim();
  if (text.includes('PENDING') || text.includes('DRAFT')) return 'var(--warning)';
  if (['PAID', 'ISSUED', 'DELIVERED', 'DONE', 'RECEIVED'].some((word) => text.includes(word))) return 'var(--success)';
  if (text.includes('QUERY')) return 'var(--destructive)';
  return 'var(--muted-foreground)';
}
