// HRMS was separated from EDI on 22-Oct-2026. It is its own app now:
//   dev:        hrms-frontend  -> http://<host>:5174
//   production: hrms-backend serves the built UI -> http://<host>:5100
// Set VITE_HRMS_URL in frontend/.env to override (e.g. https://hrms.yourcompany.com).
import { useEffect } from 'react';

const base = () => {
  const fromEnv = import.meta.env.VITE_HRMS_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const port = import.meta.env.DEV ? 5174 : 5100;
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
};

export const hrmsUrl = (path = '/') => base() + path;

// Route element that forwards old in-app HR links to the HRMS app.
export function GoToHrms({ path = '/' }) {
  useEffect(() => { window.location.replace(hrmsUrl(path)); }, [path]);
  return <div style={{ padding: 24 }}>Opening HRMS…</div>;
}
