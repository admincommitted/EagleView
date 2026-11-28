import { useState } from 'react';
import { Activity, AlertTriangle, Anchor, Box, CheckCircle, Globe, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input, Slider } from '@/components/ui';
import AircraftBlueprintViewer from './AircraftBlueprintViewer';

const TABS = [
  { id: 'blueprint', label: 'HOLOGRAM BLUEPRINT', icon: Activity },
  { id: 'loadability', label: 'LOADABILITY CHECKER', icon: Box },
  { id: 'cg', label: 'WEIGHT & BALANCE', icon: Anchor },
  { id: 'esg', label: 'RANGE & ESG', icon: Globe },
];

const CARGO_FIELDS = [
  { name: 'length', label: 'LENGTH (CM)' },
  { name: 'width', label: 'WIDTH (CM)' },
  { name: 'height', label: 'HEIGHT (CM)' },
  { name: 'weight', label: 'WEIGHT PER PIECE (KG)' },
];
const EMPTY_CARGO = { length: '', width: '', height: '', weight: '' };

const CLEAR_TO_LOAD = 'CARGO CLEAR TO LOAD';
const INTERCONTINENTAL_KM = 15000;

function loadabilityMessage(cargo, aircraft) {
  if (!cargo.length || !cargo.width || !cargo.height || !cargo.weight) return '';
  const fitsDimensions = Number(cargo.length) <= aircraft.maxLengthCm && Number(cargo.width) <= aircraft.maxWidthCm && Number(cargo.height) <= aircraft.maxHeightCm;
  if (!fitsDimensions) return 'DIMENSIONS EXCEED AIRCRAFT LIMITS';
  const fitsWeight = Number(cargo.weight) <= aircraft.maxKgsPerPiece;
  if (!fitsWeight) return 'WEIGHT EXCEEDS MAX KGS/PIECE';
  return CLEAR_TO_LOAD;
}

const co2Grade = (emissionIndex) => {
  if (emissionIndex < 0.85) return { grade: 'A', tone: 'tw:text-emerald-500 tw:border-emerald-500' };
  if (emissionIndex < 1.0) return { grade: 'B', tone: 'tw:text-lime-500 tw:border-lime-500' };
  if (emissionIndex < 1.25) return { grade: 'C', tone: 'tw:text-amber-500 tw:border-amber-500' };
  return { grade: 'D', tone: 'tw:text-red-500 tw:border-red-500' };
};

const PANEL = 'tw:rounded-lg tw:bg-slate-100';

function StatTile({ label, value, accent, valueClassName = 'tw:text-lg' }) {
  return (
    <div className={cn(PANEL, 'tw:border-l-3 tw:p-[15px]', accent)}>
      <p className="tw:m-0 tw:text-[11px] tw:text-slate-600 tw:uppercase">{label}</p>
      <p className={cn('tw:m-0 tw:font-bold tw:text-slate-900', valueClassName)}>{value}</p>
    </div>
  );
}

function BlueprintTab({ aircraft }) {
  const stats = [
    { label: 'Max Payload', value: `${aircraft.maxPayloadTons} TONS`, accent: 'tw:border-l-amber-500' },
    { label: 'Volume Capacity', value: `${aircraft.maxVolumeCbm} CBM`, accent: 'tw:border-l-emerald-500' },
    { label: 'Max Door Size', value: aircraft.doorSize, accent: 'tw:border-l-sky-400', valueClassName: 'tw:text-base' },
    { label: 'Max Kgs/Piece', value: `${aircraft.maxKgsPerPiece} KG`, accent: 'tw:border-l-rose-500' },
  ];
  return (
    <div>
      <AircraftBlueprintViewer aircraft={aircraft} tilt={0} />
      <div className="tw:mt-5 tw:grid tw:grid-cols-2 tw:gap-[15px] tw:md:grid-cols-4">
        {stats.map((stat) => <StatTile key={stat.label} {...stat} />)}
      </div>
    </div>
  );
}

function LoadabilityTab({ aircraft, cargo, setCargo }) {
  const message = loadabilityMessage(cargo, aircraft);
  const limits = [`L: ${aircraft.maxLengthCm}cm`, `W: ${aircraft.maxWidthCm}cm`, `H: ${aircraft.maxHeightCm}cm`, `WGT: ${aircraft.maxKgsPerPiece}kg`];

  return (
    <div className="tw:flex tw:flex-col tw:gap-5 tw:md:flex-row">
      <div className={cn(PANEL, 'tw:flex-1 tw:p-5')}>
        <h3 className="tw:mt-0 tw:mb-[15px] tw:text-slate-900">CARGO DIMENSIONS</h3>
        <div className="tw:flex tw:flex-col tw:gap-[15px]">
          {CARGO_FIELDS.map((field) => (
            <Field key={field.name} label={field.label} layout="col" labelClassName="tw:text-entry tw:font-normal tw:text-slate-600">
              <Input type="number" value={cargo[field.name]} className="tw:mt-[5px] tw:h-auto tw:rounded tw:border-slate-300 tw:bg-white tw:p-2.5 tw:text-slate-900"
                onChange={(event) => setCargo((current) => ({ ...current, [field.name]: event.target.value }))} />
            </Field>
          ))}
        </div>
      </div>

      <div className="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-slate-300 tw:bg-slate-50 tw:p-5 tw:text-center">
        {!message && <div className="tw:text-slate-500">ENTER DIMENSIONS TO SCAN LOADABILITY</div>}
        {message === CLEAR_TO_LOAD && (
          <div className="tw:animate-[pulse_2s_infinite]">
            <CheckCircle size={80} className="tw:mx-auto tw:mb-[15px] tw:text-emerald-500" />
            <h3 className="tw:m-0 tw:text-emerald-500">CLEAR TO LOAD</h3>
            <p className="tw:text-[13px] tw:text-slate-600">Dimensions and weight are within {aircraft.aircraftType} limits.</p>
          </div>
        )}
        {message && message !== CLEAR_TO_LOAD && (
          <div className="tw:animate-[pulse_2s_infinite]">
            <AlertTriangle size={80} className="tw:mx-auto tw:mb-[15px] tw:text-red-500" />
            <h3 className="tw:m-0 tw:text-red-500">LOAD REJECTED</h3>
            <p className="tw:text-[13px] tw:font-bold tw:text-red-500">{message}</p>
          </div>
        )}

        <div className="tw:mt-[30px] tw:w-full tw:border-t tw:border-slate-300 tw:pt-[15px]">
          <p className="tw:mt-0 tw:mb-[5px] tw:text-left tw:text-[11px] tw:text-slate-600">AIRCRAFT LIMITS:</p>
          <div className="tw:flex tw:flex-wrap tw:justify-between tw:gap-2 tw:text-entry tw:text-slate-900">
            {limits.map((limit) => <span key={limit}>{limit}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function CgWarning({ tone, children }) {
  return (
    <div className={cn('tw:mt-[15px] tw:flex tw:items-center tw:gap-2.5 tw:rounded tw:border tw:p-2.5', tone)}>
      <AlertTriangle size={20} className="tw:shrink-0" />
      <strong>{children}</strong>
    </div>
  );
}

// 0 = all forward (nose heavy), 100 = all aft (tail-tipping risk)
function WeightBalanceTab({ aircraft, cgPosition, setCgPosition }) {
  const outOfRange = cgPosition > 70 || cgPosition < 30;

  return (
    <div>
      <AircraftBlueprintViewer aircraft={aircraft} tilt={(cgPosition - 50) * 0.4} />
      <div className={cn(PANEL, 'tw:mt-5 tw:p-5')}>
        <div className="tw:mb-2.5 tw:flex tw:flex-wrap tw:justify-between tw:gap-2 tw:text-entry tw:font-bold tw:text-slate-600">
          <span className={cgPosition < 30 ? 'tw:text-red-500' : 'tw:text-slate-400'}>FWD (NOSE HEAVY)</span>
          <span>CENTER OF GRAVITY (CG)</span>
          <span className={cgPosition > 70 ? 'tw:text-red-500' : 'tw:text-slate-400'}>AFT (TAIL TIP RISK)</span>
        </div>
        <Slider min={0} max={100} value={[cgPosition]} onValueChange={([position]) => setCgPosition(position)}
          className={outOfRange
            ? 'tw:[&_[data-slot=slider-range]]:bg-red-500 tw:[&_[data-slot=slider-thumb]]:border-red-500'
            : 'tw:[&_[data-slot=slider-range]]:bg-emerald-500 tw:[&_[data-slot=slider-thumb]]:border-emerald-500'} />
        {cgPosition > 75 && (
          <CgWarning tone="tw:border-red-500 tw:bg-red-500/20 tw:text-red-500">CRITICAL: TAIL-TIPPING RISK DETECTED. REDISTRIBUTE LOAD FORWARD.</CgWarning>
        )}
        {cgPosition < 25 && (
          <CgWarning tone="tw:border-amber-500 tw:bg-amber-500/20 tw:text-amber-500">WARNING: NOSE-HEAVY LOAD DETECTED. AIRCRAFT ROTATION MAY BE COMPROMISED.</CgWarning>
        )}
      </div>
    </div>
  );
}

function RangeEsgTab({ aircraft }) {
  const rangePercent = Math.min((aircraft.maxRangeKm / INTERCONTINENTAL_KM) * 100, 100);
  const co2 = co2Grade(aircraft.co2EmissionIndex || 1.0);

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:h-[380px] tw:md:grid-cols-2">
      <div className={cn(PANEL, 'tw:flex tw:flex-col tw:justify-center tw:p-[30px]')}>
        <h3 className="tw:mt-0 tw:mb-[5px] tw:text-slate-900">MAXIMUM RANGE</h3>
        <p className="tw:mt-0 tw:mb-[30px] tw:text-[13px] tw:text-slate-600">Flight capability at maximum payload.</p>
        <div className="tw:mb-2.5 tw:flex tw:items-end tw:gap-2.5">
          <span className="tw:text-[40px] tw:leading-none tw:font-bold tw:text-sky-400">{aircraft.maxRangeKm || 'N/A'}</span>
          <span className="tw:pb-[5px] tw:text-slate-600">KM</span>
        </div>
        <div className="tw:h-2.5 tw:w-full tw:overflow-hidden tw:rounded-[5px] tw:bg-white">
          <div className="tw:h-full tw:w-(--range-pct) tw:bg-linear-to-r tw:from-sky-400 tw:to-indigo-400" style={{ '--range-pct': `${rangePercent}%` }} />
        </div>
        <div className="tw:mt-2.5 tw:flex tw:justify-between tw:text-[11px] tw:text-slate-500">
          <span>0 KM</span>
          <span>INTERCONTINENTAL (15000+ KM)</span>
        </div>
      </div>

      <div className={cn(PANEL, 'tw:flex tw:flex-col tw:items-center tw:justify-center tw:p-[30px] tw:text-center')}>
        <Globe size={40} className={cn('tw:mb-[15px]', co2.tone)} />
        <h3 className="tw:mt-0 tw:mb-[5px] tw:text-slate-900">ESG CARBON RATING</h3>
        <p className="tw:mt-0 tw:mb-5 tw:text-[13px] tw:text-slate-600">Environmental Impact / Efficiency Index</p>
        <div className={cn('tw:mb-2.5 tw:flex tw:size-[100px] tw:items-center tw:justify-center tw:rounded-full tw:border-[5px] tw:text-[40px] tw:font-bold', co2.tone)}>
          {co2.grade}
        </div>
        <p className="tw:m-0 tw:text-sm tw:text-slate-900">Index Score: {aircraft.co2EmissionIndex}</p>
      </div>
    </div>
  );
}

const TAB_CONTENT = { blueprint: BlueprintTab, loadability: LoadabilityTab, cg: WeightBalanceTab, esg: RangeEsgTab };

const AircraftCommandCenter = ({ aircraft, onClose }) => {
  const [activeTab, setActiveTab] = useState('blueprint');
  const [cargo, setCargo] = useState(EMPTY_CARGO);
  const [cgPosition, setCgPosition] = useState(50);
  if (!aircraft) return null;
  const TabContent = TAB_CONTENT[activeTab];

  return (
    <div className="tw:fixed tw:inset-0 tw:z-[9999] tw:flex tw:items-center tw:justify-center tw:bg-white/85 tw:normal-case tw:backdrop-blur-[8px]">
      <div className="tw:flex tw:max-h-[calc(100vh-1rem)] tw:w-[calc(100%-1rem)] tw:max-w-[900px] tw:flex-col tw:overflow-y-auto tw:rounded-xl tw:border tw:border-slate-300 tw:bg-white">
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-slate-300 tw:bg-slate-50 tw:p-5">
          <div className="tw:flex tw:items-center tw:gap-[15px]">
            <Shield size={28} className="tw:shrink-0 tw:text-sky-400" />
            <div>
              <h2 className="tw:m-0 tw:text-xl tw:font-bold tw:text-slate-900 tw:uppercase">
                AIRCRAFT: {aircraft.aircraftType} <span className="tw:text-sky-400">({aircraft.iataCode})</span>
              </h2>
              <p className="tw:m-0 tw:mt-0.5 tw:text-[13px] tw:text-slate-600 tw:uppercase">
                {aircraft.make} • {aircraft.bodyType} • {aircraft.deckType}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="tw:size-8 tw:text-slate-400 tw:hover:bg-transparent">
            <X className="tw:size-6" />
          </Button>
        </div>

        <div className="tw:flex tw:flex-wrap tw:border-b tw:border-slate-300 tw:bg-white">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Button key={id} variant="ghost" onClick={() => setActiveTab(id)}
              className={cn('tw:h-auto tw:flex-1 tw:gap-2 tw:rounded-none tw:border-0 tw:border-b-2 tw:p-3 tw:text-[13px] tw:font-bold',
                activeTab === id ? 'tw:border-b-sky-600 tw:bg-slate-100 tw:text-sky-600 tw:hover:bg-slate-100' : 'tw:border-b-transparent tw:text-slate-500 tw:hover:bg-transparent')}>
              <Icon className="tw:size-4" /> {label}
            </Button>
          ))}
        </div>

        <div className="tw:flex-1 tw:bg-white tw:p-5">
          <TabContent aircraft={aircraft} cargo={cargo} setCargo={setCargo} cgPosition={cgPosition} setCgPosition={setCgPosition} />
        </div>
      </div>
    </div>
  );
};

export default AircraftCommandCenter;
