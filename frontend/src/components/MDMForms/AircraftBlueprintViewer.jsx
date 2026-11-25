const BLUEPRINT_KEYFRAMES = `
@keyframes aircraftNoseOpen {
  0%, 15% { transform: rotate(0deg); }
  30%, 85% { transform: translate(120px, 80px) rotate(70deg) translate(-120px, -80px); }
  100% { transform: rotate(0deg); }
}
@keyframes aircraftSlideNoseCargo {
  0%, 25% { transform: translateX(0); opacity: 0; }
  30% { transform: translateX(0); opacity: 1; }
  55%, 80% { transform: translateX(180px); opacity: 1; }
  85%, 100% { transform: translateX(180px); opacity: 0; }
}
@keyframes aircraftSlideSideCargo {
  0%, 25% { transform: translateX(0); opacity: 0; }
  30% { transform: translateX(0); opacity: 1; }
  55%, 80% { transform: translateX(150px); opacity: 1; }
  85%, 100% { transform: translateX(150px); opacity: 0; }
}
@keyframes aircraftSlideUpCargo {
  0%, 25% { transform: translateY(0); opacity: 0; }
  30% { transform: translateY(0); opacity: 1; }
  55%, 80% { transform: translateY(-50px); opacity: 1; }
  85%, 100% { transform: translateY(-50px); opacity: 0; }
}
@keyframes aircraftScanHolo {
  0% { transform: translateX(-150px); }
  50%, 100% { transform: translateX(950px); }
}`;

const NOSE_OPEN = 'tw:animate-[aircraftNoseOpen_10s_ease-in-out_infinite]';
const SLIDE_NOSE_CARGO = 'tw:animate-[aircraftSlideNoseCargo_10s_ease-in-out_infinite]';
const SLIDE_SIDE_CARGO = 'tw:animate-[aircraftSlideSideCargo_10s_ease-in-out_infinite]';
const SLIDE_UP_CARGO = 'tw:animate-[aircraftSlideUpCargo_10s_ease-in-out_infinite]';
const SCANNER_BEAM = 'tw:pointer-events-none tw:animate-[aircraftScanHolo_6s_cubic-bezier(0.4,0,0.2,1)_infinite]';

const DECK_LABEL = { fill: '#38bdf8', fontSize: '8', fontFamily: 'monospace', opacity: '0.9' };
const DOOR_LABEL = { fill: '#94a3b8', fontWeight: 'bold', textAnchor: 'middle', stroke: 'none', className: 'tw:text-shadow-none' };
const PASSENGER_WINDOW_X = Array.from({ length: 15 }, (_, index) => 340 + index * 14);
const MAIN_GEAR_WHEEL_X = [415, 430, 445, 460];
const WING_CANOES = [
  'M 525 145 L 550 145 C 554 145, 554 149, 550 149 L 526 149 Z',
  'M 545 155 L 570 155 C 574 155, 574 159, 570 159 L 546 159 Z',
  'M 565 165 L 590 165 C 594 165, 594 169, 590 169 L 566 169 Z',
  'M 585 175 L 610 175 C 614 175, 614 179, 610 179 L 586 179 Z',
];
const LOWER_DECK_ULDS = [
  'M 190 122 L 210 122 L 210 142 L 195 142 Z',
  'M 215 122 L 235 122 L 235 142 L 220 142 Z',
  'M 240 122 L 260 122 L 260 142 L 245 142 Z',
  'M 400 122 L 420 122 L 420 142 L 405 142 Z',
  'M 425 122 L 445 122 L 445 142 L 430 142 Z',
];

function Wheel({ cx }) {
  return (
    <g>
      <circle cx={cx} cy="200" r="7" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
      <circle cx={cx} cy="200" r="3" fill="#e2e8f0" stroke="none" />
      <circle cx={cx} cy="200" r="1" fill="#1e293b" stroke="none" />
    </g>
  );
}

function BlueprintDefs() {
  return (
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(203, 213, 225, 0.6)" strokeWidth="1" />
        <path d="M 20 0 L 20 40 M 0 20 L 40 20" fill="none" stroke="rgba(203, 213, 225, 0.3)" strokeWidth="0.5" />
      </pattern>
      <linearGradient id="glow-lower" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
        <stop offset="50%" stopColor="rgba(16, 185, 129, 0.8)" />
        <stop offset="100%" stopColor="rgba(16, 185, 129, 0.2)" />
      </linearGradient>
      <linearGradient id="glow-main" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="rgba(245, 158, 11, 0.2)" />
        <stop offset="50%" stopColor="rgba(245, 158, 11, 0.8)" />
        <stop offset="100%" stopColor="rgba(245, 158, 11, 0.2)" />
      </linearGradient>
      <linearGradient id="engine-fire" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="rgba(56, 189, 248, 0)" />
        <stop offset="100%" stopColor="rgba(56, 189, 248, 0.9)" />
      </linearGradient>

      <g id="ake-container">
        <path d="M 0 0 L 25 0 L 25 20 L 15 20 L 5 15 L 0 15 Z" fill="rgba(16,185,129,0.3)" stroke="#047857" strokeWidth="1.5" />
        <text x="12" y="10" fill="#000" fontSize="6" fontWeight="bold" textAnchor="middle" stroke="none">AKE</text>
        <line x1="2" y1="2" x2="23" y2="2" stroke="#047857" strokeWidth="0.5" />
        <line x1="2" y1="5" x2="23" y2="5" stroke="#047857" strokeWidth="0.5" />
      </g>
      <g id="pmc-pallet">
        <rect x="0" y="0" width="40" height="25" fill="rgba(245,158,11,0.3)" stroke="#b45309" strokeWidth="1.5" />
        <path d="M 0 0 L 40 25 M 40 0 L 0 25" stroke="rgba(245,158,11,0.6)" strokeWidth="1" strokeDasharray="2 2" />
        <rect x="0" y="20" width="40" height="5" fill="#f59e0b" />
        <text x="20" y="14" fill="#000" fontSize="8" fontWeight="bold" textAnchor="middle" stroke="none">PMC</text>
      </g>

      <linearGradient id="fuselage-shade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#f8fafc" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>
      <linearGradient id="engine-shade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#94a3b8" />
      </linearGradient>
      <linearGradient id="wing-shade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="100%" stopColor="#e2e8f0" stopOpacity="1" />
      </linearGradient>
      <linearGradient id="tarmac-fade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="glass-shade" x1="0%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#0f172a" />
        <stop offset="50%" stopColor="#334155" />
        <stop offset="65%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>
      <linearGradient id="scan-trail" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.15" />
      </linearGradient>
      <clipPath id="xray-mask">
        <rect x="-80" y="0" width="80" height="400" className={SCANNER_BEAM} />
      </clipPath>
    </defs>
  );
}

function Runway() {
  return (
    <g>
      <rect x="-100" y="207" width="1000" height="100" fill="#e2e8f0" />
      <rect x="-100" y="307" width="1000" height="80" fill="url(#tarmac-fade)" />
      <line x1="-100" y1="209" x2="1000" y2="209" stroke="#ffffff" strokeWidth="1.5" />
      <line x1="-100" y1="257" x2="1000" y2="257" stroke="#ffffff" strokeWidth="6" strokeDasharray="80 50" />
      <line x1="-100" y1="304" x2="1000" y2="304" stroke="#f59e0b" strokeWidth="3" />
    </g>
  );
}

function TailFin() {
  return (
    <>
      <path d="M 480 70 C 510 70, 530 65, 550 40 L 620 -20 L 660 -20 L 675 -12 L 650 90 C 600 90, 550 70, 480 70 Z" stroke="#1e293b" strokeWidth="2" fill="url(#fuselage-shade)" />
      <path d="M 625 -20 L 640 85" stroke="#94a3b8" strokeWidth="1" strokeDasharray="5 3" fill="none" />
      <path d="M 660 95 L 665 97 L 665 110 L 655 110" stroke="#94a3b8" strokeWidth="1" fill="none" />
    </>
  );
}

// hasNose: the 747-style body with the upper-deck hump and a nose door that swings open
function Fuselage({ hasNose }) {
  return (
    <path d={hasNose
      ? 'M 120 80 L 135 65 C 160 50, 190 48, 230 52 C 260 55, 290 70, 320 70 L 520 70 C 580 70, 620 75, 660 95 L 665 97 L 665 110 C 620 130, 570 150, 520 150 L 100 150 L 90 120 L 105 90 L 115 90 Z'
      : 'M 150 70 C 115 70, 90 80, 75 95 C 60 115, 60 150, 150 150 L 520 150 C 570 150, 620 130, 665 110 L 665 97 C 620 75, 580 70, 520 70 L 150 70 Z'}
    stroke="#1e293b" strokeWidth="2" fill="url(#fuselage-shade)" />
  );
}

function InternalDecks({ hasNose }) {
  return (
    <g>
      <line x1="130" y1="115" x2="620" y2="115" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.8" />
      <text x="380" y="110" letterSpacing="3" {...DECK_LABEL}>MAIN DECK</text>
      {hasNose && (
        <>
          <line x1="160" y1="75" x2="280" y2="75" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.8" />
          <text x="180" y="70" letterSpacing="2" {...DECK_LABEL}>UPPER DECK</text>
        </>
      )}
      <text x="380" y="130" letterSpacing="3" {...DECK_LABEL}>LOWER DECK (CARGO)</text>
      <line x1="380" y1="142" x2="550" y2="142" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
      <g fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="1">
        {LOWER_DECK_ULDS.map((uld) => <path key={uld} d={uld} />)}
      </g>
    </g>
  );
}

function OpeningNose() {
  return (
    <g className={NOSE_OPEN}>
      <path d="M 120 80 L 115 90 L 105 90 L 90 120 L 100 150 C 70 150, 45 140, 50 115 C 55 95, 80 85, 120 80 Z" stroke="#1e293b" strokeWidth="2" fill="url(#fuselage-shade)" />
      <path d="M 52 105 C 45 115, 50 135, 65 145" stroke="#94a3b8" strokeWidth="1" fill="none" />
      <path d="M 85 108 L 95 103 L 90 108 L 95 113 Z" fill="#94a3b8" />
      <path d="M 83 118 L 93 113 L 88 118 L 93 123 Z" fill="#94a3b8" />
    </g>
  );
}

function CockpitWindows({ hasNose }) {
  const panes = hasNose
    ? ['M 124 75 L 133 63 L 138 63 L 131 74 Z', 'M 139 62 L 148 51 L 153 51 L 146 61 Z', 'M 155 51 L 162 51 L 162 56 L 157 56 Z']
    : ['M 68 112 L 85 93 L 95 99 L 78 118 Z', 'M 88 91 L 110 83 L 115 89 L 98 98 Z', 'M 113 81 L 128 78 L 130 84 L 118 87 Z'];
  return (
    <g>
      {panes.map((pane) => <path key={pane} d={pane} fill="url(#glass-shade)" stroke="#1e293b" strokeWidth="0.5" />)}
    </g>
  );
}

function Doors({ hasNose }) {
  return (
    <>
      {hasNose ? (
        <g>
          <rect x="160" y="70" width="16" height="32" rx="2" stroke="#64748b" strokeWidth="1" fill="none" />
          <rect x="171" y="74" width="3" height="4.5" rx="1" fill="#1e293b" />
          <rect x="166" y="80" width="1.5" height="8" rx="0.5" fill="#475569" />
          <circle cx="166.75" cy="84" r="1.5" fill="#1e293b" />
          <line x1="158" y1="78" x2="162" y2="78" stroke="#94a3b8" strokeWidth="0.5" />
          <line x1="158" y1="94" x2="162" y2="94" stroke="#94a3b8" strokeWidth="0.5" />
        </g>
      ) : (
        <g>
          <rect x="155" y="75" width="20" height="50" rx="3" stroke="#64748b" strokeWidth="1" fill="none" />
          <rect x="167" y="80" width="4" height="6" rx="1" fill="#1e293b" />
        </g>
      )}
      <g>
        <rect x="540" y="85" width="16" height="32" rx="2" stroke="#64748b" strokeWidth="1" fill="none" />
        <rect x="551" y="89" width="3" height="4.5" rx="1" fill="#1e293b" />
        <rect x="546" y="95" width="1.5" height="8" rx="0.5" fill="#475569" />
        <circle cx="546.75" cy="99" r="1.5" fill="#1e293b" />
      </g>
    </>
  );
}

function LandingGears() {
  return (
    <g>
      <g>
        <path d="M 158 150 L 175 152 L 175 155 L 156 155 Z" fill="#f8fafc" stroke="#475569" strokeWidth="1" />
        <rect x="164" y="150" width="4" height="30" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
        <rect x="165" y="180" width="2" height="20" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
        <path d="M 145 155 L 165 180 L 165 185 L 140 160 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
        <Wheel cx="166" />
      </g>
      <g transform="translate(55, 0)">
        <path d="M 425 150 L 440 150 L 435 195 L 420 195 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
        <path d="M 445 150 L 455 150 L 450 195 L 440 195 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
        <path d="M 380 160 L 425 190" stroke="#475569" strokeWidth="2" />
        <path d="M 490 160 L 445 190" stroke="#475569" strokeWidth="2" />
        <rect x="410" y="193" width="60" height="6" rx="2" fill="#64748b" stroke="#1e293b" strokeWidth="1.5" />
        {MAIN_GEAR_WHEEL_X.map((cx) => <Wheel key={cx} cx={cx} />)}
      </g>
    </g>
  );
}

function InboardEngine({ hasNose }) {
  return (
    <g transform="translate(24, 0)">
      {hasNose ? (
        <g>
          <path d="M 410 135 L 435 130 L 430 145 L 400 145 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          <path d="M 350 142 L 425 145 C 435 146, 435 170, 425 171 L 350 174 C 338 174, 338 142, 350 142 Z" fill="url(#engine-shade)" stroke="#475569" strokeWidth="1.2" />
          <ellipse cx="347" cy="158" rx="5" ry="16" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
          <ellipse cx="349" cy="158" rx="3" ry="12" fill="#0f172a" />
          <line x1="349" y1="147" x2="349" y2="169" stroke="#475569" strokeWidth="0.8" strokeDasharray="1.5 1" />
          <path d="M 349 155 L 345 158 L 349 161 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" />
          <path d="M 429 152 L 442 154 L 442 163 L 429 165 Z" fill="#475569" stroke="#334155" strokeWidth="1" />
        </g>
      ) : (
        <g>
          <path d="M 390 140 L 420 135 L 415 150 L 380 150 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          <path d="M 350 145 L 415 147 C 425 148, 425 167, 415 168 L 350 170 C 340 170, 340 145, 350 145 Z" fill="url(#engine-shade)" stroke="#475569" strokeWidth="1.2" />
          <ellipse cx="347" cy="157.5" rx="4" ry="11" fill="#1e293b" />
          <polygon points="348,157.5 352,154 352,161" fill="#cbd5e1" />
          <path d="M 419 152 L 430 154 L 430 161 L 419 163 Z" fill="#475569" stroke="#334155" strokeWidth="1" />
        </g>
      )}
    </g>
  );
}

// the wing outline is left open at the root so it blends into the fuselage
function Wing() {
  return (
    <g transform="translate(10, 0)">
      <path d="M 360 130 L 500 130 L 600 180 L 500 180 Z" stroke="none" fill="url(#wing-shade)" />
      <path d="M 500 130 L 600 180 L 500 180 L 360 130" stroke="#1e293b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 365 130 L 505 180" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3 2" />
      <path d="M 480 130 L 580 180" stroke="#cbd5e1" strokeWidth="0.5" />
      {WING_CANOES.map((canoe) => <path key={canoe} d={canoe} fill="#94a3b8" stroke="#cbd5e1" strokeWidth="0.8" />)}
    </g>
  );
}

function CargoDoors({ isMain, isLower }) {
  return (
    <>
      {isMain && (
        <g stroke="#cbd5e1" strokeWidth="1.5" fill="none">
          <rect x="205" y="76" width="120" height="33" rx="4" fill="none" strokeDasharray="10 5" />
          <text x="265" y="96" fontSize="14" {...DOOR_LABEL}>MCD</text>
        </g>
      )}
      {isLower && (
        <g stroke="#cbd5e1" strokeWidth="1.5" fill="none">
          <rect x="210" y="116" width="80" height="28" rx="3" fill="none" strokeDasharray="10 5" />
          <text x="250" y="135" fontSize="13" {...DOOR_LABEL}>FWD</text>
          <rect x="440" y="116" width="80" height="28" rx="3" fill="none" strokeDasharray="10 5" />
          <text x="480" y="135" fontSize="13" {...DOOR_LABEL}>AFT</text>
          <rect x="525" y="116" width="55" height="26" rx="2" fill="none" strokeDasharray="10 5" />
          <text x="552.5" y="135" fontSize="11" {...DOOR_LABEL}>BULK</text>
        </g>
      )}
    </>
  );
}

function FuselageHighlight({ hasNose }) {
  return (
    <path d={hasNose
      ? 'M 135 65 C 160 50, 190 48, 230 52 C 260 55, 290 70, 320 70 L 520 70 C 580 70, 620 75, 660 95'
      : 'M 150 70 L 520 70 C 570 70, 600 75, 630 90'}
    stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.8" />
  );
}

// how the cargo goes in: lower-deck ULD lifted up, main-deck pallet through the side door, the nose or the tail ramp
function CargoLoading({ hasNose, hasTail, isMain, isLower }) {
  return (
    <>
      {hasTail && (
        <g className="tw:origin-[600px_150px]">
          <path d="M 600 150 L 680 150 L 680 160 L 600 160 Z" fill="rgba(245, 158, 11, 0.7)" stroke="#f59e0b" strokeWidth="2" />
        </g>
      )}
      {isLower && !isMain && (
        <g className={SLIDE_UP_CARGO}>
          <use href="#ake-container" x="240" y="200" />
          <path d="M 252 195 L 252 165 M 247 170 L 252 160 L 257 170" stroke="#047857" strokeWidth="2" fill="none" />
        </g>
      )}
      {isMain && !hasNose && !hasTail && (
        <g className={SLIDE_SIDE_CARGO}>
          <use href="#pmc-pallet" x="50" y="80" />
          <path d="M 100 92 L 180 92 M 170 87 L 180 92 L 170 97" stroke="#b45309" strokeWidth="2" fill="none" />
        </g>
      )}
      {hasNose && (
        <g className={SLIDE_NOSE_CARGO}>
          <use href="#pmc-pallet" x="-80" y="115" />
          <path d="M -25 127 L 110 127 M 100 122 L 110 127 L 100 132" stroke="#f43f5e" strokeWidth="2" fill="none" />
        </g>
      )}
      {hasTail && (
        <g>
          <use href="#pmc-pallet" x="750" y="115" />
          <path d="M 740 127 L 610 127 M 620 122 L 610 127 L 620 132" stroke="#b45309" strokeWidth="2" fill="none" />
        </g>
      )}
    </>
  );
}

function ScannerBeam() {
  return (
    <g className={SCANNER_BEAM}>
      <rect x="-80" y="0" width="80" height="400" fill="url(#scan-trail)" />
      <line x1="0" y1="0" x2="0" y2="400" stroke="#38bdf8" strokeWidth="2" opacity="0.8" />
      <line x1="0" y1="0" x2="0" y2="400" stroke="#ffffff" strokeWidth="1" strokeDasharray="5 15" opacity="0.9" />
      <circle cx="0" cy="207" r="4" fill="#38bdf8" opacity="0.8" />
      <circle cx="0" cy="115" r="3" fill="#38bdf8" opacity="0.6" />
    </g>
  );
}

// A side-view blueprint of the aircraft; deckType decides which cargo doors and loading animation show.
// tilt (degrees) pitches the aircraft for the weight & balance view.
const AircraftBlueprintViewer = ({ aircraft, tilt = 0 }) => {
  if (!aircraft) return null;

  const deck = (aircraft.deckType || '').toLowerCase();
  const hasNose = deck.includes('nose');
  const hasTail = deck.includes('tail');
  const isMain = deck.includes('main');
  const isLower = deck.includes('lower');

  return (
    <div className="tw:relative tw:h-[380px] tw:w-full tw:overflow-hidden tw:rounded-lg tw:border tw:border-slate-300 tw:bg-white tw:font-[Inter,Segoe_UI,Roboto,Helvetica,Arial,sans-serif] tw:shadow-[inset_0_0_100px_rgba(226,232,240,0.5)]">
      <style>{BLUEPRINT_KEYFRAMES}</style>
      <svg width="100%" height="100%" className="tw:absolute tw:top-0 tw:left-0 tw:filter-none">
        <BlueprintDefs />
        <Runway />
        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(40, 80) rotate(${tilt}, 350, 150)`} className="tw:transition-transform tw:duration-500 tw:ease-[cubic-bezier(0.34,1.56,0.64,1)]">
          <TailFin />
          <Fuselage hasNose={hasNose} />
          <InternalDecks hasNose={hasNose} />
          <path d="M 590 105 C 630 102, 670 102, 700 105 L 705 107 L 590 114 Z" stroke="#334155" strokeWidth="1" fill="#64748b" />
          {hasNose && <OpeningNose />}
          <CockpitWindows hasNose={hasNose} />
          <Doors hasNose={hasNose} />
          <g fill="#94a3b8" stroke="none">
            {PASSENGER_WINDOW_X.map((x) => <rect key={x} x={x} y="95" width="4" height="6" rx="2" />)}
          </g>
          <circle cx="350" cy="70" r="2" fill="#ef4444" />
          <circle cx="350" cy="150" r="2" fill="#ef4444" />
          <LandingGears />
          <InboardEngine hasNose={hasNose} />
          <Wing />
          <CargoDoors isMain={isMain} isLower={isLower} />
          <FuselageHighlight hasNose={hasNose} />
          <CargoLoading hasNose={hasNose} hasTail={hasTail} isMain={isMain} isLower={isLower} />
        </g>

        <ScannerBeam />
      </svg>
    </div>
  );
};

export default AircraftBlueprintViewer;
