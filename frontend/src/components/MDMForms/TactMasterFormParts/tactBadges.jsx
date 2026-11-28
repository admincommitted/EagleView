import { Plane } from 'lucide-react';
import { dgrLabelMarkup } from './helpers';

export function DgrLabel({ classCode, unNumber = '', properName = '', size = 32 }) {
  if (!classCode) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="tw:m-1"
      dangerouslySetInnerHTML={{ __html: dgrLabelMarkup(classCode, unNumber, properName) }} />
  );
}

const DEFAULT_BRAND_COLOR = '#475569';
const BRAND_COLORS = {
  Airbus: '#00205B',
  Boeing: '#0039A6',
  Embraer: '#00508F',
  ATR: '#0062A5',
  Bombardier: '#333333',
  'McDonnell Douglas': '#D3212D',
  Antonov: '#0055A4',
  Ilyushin: '#1d4ed8',
  'Lockheed Martin': '#475569',
  Cessna: '#0369a1',
  Saab: '#004B87',
  Fokker: '#F58220',
  Tupolev: '#b91c1c',
  'British Aerospace': '#1d4ed8',
  Beechcraft: '#0f172a',
  Fairchild: '#334155',
  'Short Brothers': '#0f766e',
  Convair: '#57534e',
};

export function MakerBadge({ make }) {
  if (!make || make === 'N/A') return <span className="tw:text-slate-400">N/A</span>;
  return (
    <div className="tw:flex tw:items-center tw:gap-2" style={{ '--brand': BRAND_COLORS[make] || DEFAULT_BRAND_COLOR }}>
      <div className="tw:flex tw:size-5 tw:items-center tw:justify-center tw:rounded tw:bg-(--brand)">
        <Plane size={12} className="tw:rotate-45 tw:text-white" />
      </div>
      <span className="tw:text-sm tw:font-bold tw:text-(color:--brand)">{make.toUpperCase()}</span>
    </div>
  );
}
