// Helpers and constants
// Split out of TactMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import html2pdf from 'html2pdf.js';

export const DgrLabel = ({ classCode, unNumber = '', properName = '', size = 32 }) => {
  if (!classCode) return null;
  const baseClass = classCode.toString().split(' ')[0].substring(0, 3);
  
  const isLithium = unNumber.includes('3480') || unNumber.includes('3481') || unNumber.includes('3090') || unNumber.includes('3091') || (properName && properName.toUpperCase().includes('LITHIUM'));

  const renderIcon = () => {
    const flame = <path d="M50 20 Q55 35 60 50 Q65 65 50 80 Q35 65 40 50 Q45 35 50 20 Z M50 40 Q45 55 50 70 Q55 55 50 40 Z" fill="currentColor" />;
    const cylinder = <path d="M40 30 L60 30 L60 20 Q50 15 40 20 Z M40 30 L40 70 A10 10 0 0 0 60 70 L60 30 Z" fill="currentColor" />;
    const skull = <g fill="currentColor"><path d="M50 25 A15 15 0 0 0 35 40 Q35 50 40 55 L40 60 L60 60 L60 55 Q65 50 65 40 A15 15 0 0 0 50 25 Z M42 40 A3 3 0 1 1 48 40 A3 3 0 1 1 42 40 Z M52 40 A3 3 0 1 1 58 40 A3 3 0 1 1 52 40 Z M47 55 L53 55 L53 50 L47 50 Z" /><path d="M30 65 L40 55 M70 65 L60 55 M30 35 L40 45 M70 35 L60 45" stroke="currentColor" strokeWidth="4" /></g>;
    const radioactive = <g fill="currentColor"><circle cx="50" cy="40" r="5" /><path d="M50 30 A15 15 0 0 0 35 20 L50 40 Z M50 30 A15 15 0 0 1 65 20 L50 40 Z M35 55 A15 15 0 0 0 65 55 L50 40 Z" /></g>;
    const corrosive = <g fill="currentColor"><rect x="35" y="45" width="30" height="5" /><path d="M30 20 L35 20 L35 40 L30 40 Z M40 40 L45 40 L45 20 L40 20 Z" /><circle cx="32" cy="45" r="2" /><circle cx="42" cy="45" r="2" /></g>;
    const biohazard = <g fill="none" stroke="currentColor" strokeWidth="3"><circle cx="50" cy="45" r="10" /><circle cx="40" cy="35" r="12" /><circle cx="60" cy="35" r="12" /><circle cx="50" cy="55" r="12" /></g>;
    const oxidizer = <g fill="currentColor"><circle cx="50" cy="65" r="15" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M50 15 Q55 35 60 45 Q65 65 50 75 Q35 65 40 45 Q45 35 50 15 Z" /></g>;
    const explosive = <g fill="currentColor"><circle cx="50" cy="45" r="12" /><path d="M50 20 L50 30 M80 45 L70 45 M50 70 L50 60 M20 45 L30 45 M25 25 L35 35 M75 25 L65 35 M75 65 L65 55 M25 65 L35 55" stroke="currentColor" strokeWidth="3" /></g>;
    const lithiumBatteryGroup = <g fill="currentColor"><rect x="30" y="60" width="15" height="25" rx="2" /><rect x="34" y="57" width="7" height="3" /><rect x="55" y="60" width="15" height="25" rx="2" /><rect x="59" y="57" width="7" height="3" /><path d="M40 70 L45 65 L45 75 Z" /><path d="M48 65 Q50 60 53 65 Q55 70 48 75 Z" /></g>; // Minimal representation of batteries catching fire
    
    if (baseClass.startsWith('1')) return explosive;
    if (baseClass.startsWith('2.1') || baseClass.startsWith('3') || baseClass.startsWith('4') || baseClass === '5.2') return flame;
    if (baseClass === '2.2') return cylinder;
    if (baseClass === '2.3') return skull;
    if (baseClass === '5.1') return oxidizer;
    if (baseClass.startsWith('6.1')) return skull;
    if (baseClass.startsWith('6.2')) return biohazard;
    if (baseClass.startsWith('7')) return radioactive;
    if (baseClass.startsWith('8')) return corrosive;
    if (baseClass.startsWith('9') && isLithium) return lithiumBatteryGroup;
    return null;
  };

  const renderBackground = () => {
    if (baseClass.startsWith('1')) return <polygon points="50,0 100,50 50,100 0,50" fill="#f97316" />;
    if (baseClass === '2.1' || baseClass === '3') return <polygon points="50,0 100,50 50,100 0,50" fill="#ef4444" />;
    if (baseClass === '2.2') return <polygon points="50,0 100,50 50,100 0,50" fill="#10b981" />;
    if (baseClass === '2.3') return <polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />;
    if (baseClass === '4.1') return (
      <g>
        <polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />
        <path d="M20,30 L40,10 M10,40 L60, -10 M0,50 L80,-30 M10,60 L100,-30 M20,70 L100,-10 M30,80 L100,10 M40,90 L100,30 M50,100 L100,50 M70,100 L100,70 M90,100 L100,90" stroke="#ef4444" strokeWidth="6" />
      </g>
    );
    if (baseClass === '4.2') return (
      <g>
        <polygon points="50,0 100,50 0,50" fill="#ffffff" />
        <polygon points="50,100 100,50 50,0" fill="#ef4444" />
        <polygon points="50,0 100,50 50,100 0,50" fill="none" stroke="transparent"/>
      </g>
    ); // Fix for 4.2: Upper half white, lower half red
    if (baseClass === '4.3') return <polygon points="50,0 100,50 50,100 0,50" fill="#3b82f6" />;
    if (baseClass === '5.1') return <polygon points="50,0 100,50 50,100 0,50" fill="#fde047" />;
    if (baseClass === '5.2') return (
      <g>
        <polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />
        <polygon points="50,0 100,50 0,50" fill="#ef4444" />
        <polygon points="50,100 100,50 0,50" fill="#fde047" />
      </g>
    ); // Fix for 5.2: Top red, bottom yellow
    if (baseClass.startsWith('6')) return <polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />;
    if (baseClass.startsWith('7')) return (
      <g>
        <polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />
        <polygon points="50,0 100,50 0,50" fill="#fde047" />
      </g>
    );
    if (baseClass.startsWith('8')) return (
      <g>
        <polygon points="50,0 100,50 50,100 0,50" fill="#000000" />
        <polygon points="50,0 100,50 0,50" fill="#ffffff" />
      </g>
    );
    if (baseClass.startsWith('9')) return (
      <g>
        <polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />
        <path d="M0,50 L50,0 L100,50 Z" fill="#ffffff" />
        <path d="M10,40 L10,0 M30,20 L30,0 M50,50 L50,0 M70,20 L70,0 M90,40 L90,0" stroke="#000000" strokeWidth="6" />
      </g>
    );
    return <polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />;
  };

  const labelText = baseClass.substring(0, 1);
  let iconColor = '#000000';
  if (['2.1', '3', '4.3'].includes(baseClass)) iconColor = '#ffffff';
  if (baseClass === '5.2') iconColor = '#ffffff'; // Flame on red is white
  
  let numColor = iconColor;
  if (baseClass.startsWith('8')) numColor = '#ffffff';
  if (baseClass === '5.2') numColor = '#000000'; // Number on yellow is black

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ margin: '4px', filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }}>
      {renderBackground()}
      <polygon points="50,2 98,50 50,98 2,50" fill="none" stroke={numColor} strokeWidth="2" />
      <g style={{ color: iconColor }}>
        {renderIcon()}
      </g>
      <text x="50" y="92" fontSize="18" fontWeight="900" fontFamily="Arial, sans-serif" fill={numColor} textAnchor="middle">{labelText}</text>
    </svg>
  );
};

export const generateLabelPdf = (item) => {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '800px';
  container.style.backgroundColor = '#ffffff';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.padding = '50px';
  container.style.fontFamily = 'Helvetica, Arial, sans-serif';
  container.style.boxSizing = 'border-box';
  
  const classCode = item.classDivision;
  const unNumber = item.unNumber;
  const properName = item.properShippingName;
  const baseClass = classCode.toString().split(' ')[0].substring(0, 3);
  let labelText = baseClass.substring(0, 1);
  const isLithium = unNumber.includes('3480') || unNumber.includes('3481') || unNumber.includes('3090') || unNumber.includes('3091') || (properName && properName.toUpperCase().includes('LITHIUM'));

  const flameSVG = `<path d="M50 20 Q55 35 60 50 Q65 65 50 80 Q35 65 40 50 Q45 35 50 20 Z M50 40 Q45 55 50 70 Q55 55 50 40 Z" fill="currentColor" />`;
  const cylinderSVG = `<path d="M40 30 L60 30 L60 20 Q50 15 40 20 Z M40 30 L40 70 A10 10 0 0 0 60 70 L60 30 Z" fill="currentColor" />`;
  const skullSVG = `<g fill="currentColor"><path d="M50 25 A15 15 0 0 0 35 40 Q35 50 40 55 L40 60 L60 60 L60 55 Q65 50 65 40 A15 15 0 0 0 50 25 Z M42 40 A3 3 0 1 1 48 40 A3 3 0 1 1 42 40 Z M52 40 A3 3 0 1 1 58 40 A3 3 0 1 1 52 40 Z M47 55 L53 55 L53 50 L47 50 Z" /><path d="M30 65 L40 55 M70 65 L60 55 M30 35 L40 45 M70 35 L60 45" stroke="currentColor" stroke-width="4" /></g>`;
  const radioactiveSVG = `<g fill="currentColor"><circle cx="50" cy="40" r="5" /><path d="M50 30 A15 15 0 0 0 35 20 L50 40 Z M50 30 A15 15 0 0 1 65 20 L50 40 Z M35 55 A15 15 0 0 0 65 55 L50 40 Z" /></g>`;
  const corrosiveSVG = `<g fill="currentColor"><rect x="35" y="45" width="30" height="5" /><path d="M30 20 L35 20 L35 40 L30 40 Z M40 40 L45 40 L45 20 L40 20 Z" /><circle cx="32" cy="45" r="2" /><circle cx="42" cy="45" r="2" /></g>`;
  const biohazardSVG = `<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="50" cy="45" r="10" /><circle cx="40" cy="35" r="12" /><circle cx="60" cy="35" r="12" /><circle cx="50" cy="55" r="12" /></g>`;
  const oxidizerSVG = `<g fill="currentColor"><circle cx="50" cy="65" r="15" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50 15 Q55 35 60 45 Q65 65 50 75 Q35 65 40 45 Q45 35 50 15 Z" /></g>`;
  const explosiveSVG = `<g fill="currentColor"><circle cx="50" cy="45" r="12" /><path d="M50 20 L50 30 M80 45 L70 45 M50 70 L50 60 M20 45 L30 45 M25 25 L35 35 M75 25 L65 35 M75 65 L65 55 M25 65 L35 55" stroke="currentColor" stroke-width="3" /></g>`;
  const lithiumBatterySVG = `<g fill="currentColor"><rect x="30" y="60" width="15" height="25" rx="2" /><rect x="34" y="57" width="7" height="3" /><rect x="55" y="60" width="15" height="25" rx="2" /><rect x="59" y="57" width="7" height="3" /><path d="M40 70 L45 65 L45 75 Z" /><path d="M48 65 Q50 60 53 65 Q55 70 48 75 Z" /></g>`;
  
  let iconSvg = '';
  if (baseClass.startsWith('1')) { iconSvg = explosiveSVG; labelText = '1'; }
  else if (baseClass.startsWith('2.1') || baseClass.startsWith('3') || baseClass.startsWith('4') || baseClass === '5.2') iconSvg = flameSVG;
  else if (baseClass.startsWith('2.2')) iconSvg = cylinderSVG;
  else if (baseClass === '2.3') iconSvg = skullSVG;
  else if (baseClass.startsWith('5.1')) iconSvg = oxidizerSVG;
  else if (baseClass.startsWith('6.1')) iconSvg = skullSVG;
  else if (baseClass.startsWith('6.2')) iconSvg = biohazardSVG;
  else if (baseClass.startsWith('7')) iconSvg = radioactiveSVG;
  else if (baseClass.startsWith('8')) iconSvg = corrosiveSVG;
  else if (baseClass.startsWith('9') && isLithium) iconSvg = lithiumBatterySVG;

  let bgSvg = '';
  if (baseClass.startsWith('1')) bgSvg = `<polygon points="50,0 100,50 50,100 0,50" fill="#f97316" />`;
  else if (baseClass === '2.1' || baseClass === '3') bgSvg = `<polygon points="50,0 100,50 50,100 0,50" fill="#ef4444" />`;
  else if (baseClass === '2.2') bgSvg = `<polygon points="50,0 100,50 50,100 0,50" fill="#10b981" />`;
  else if (baseClass === '2.3') bgSvg = `<polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />`;
  else if (baseClass === '4.1') bgSvg = `<g><polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" /><path d="M20,30 L40,10 M10,40 L60,-10 M0,50 L80,-30 M10,60 L100,-30 M20,70 L100,-10 M30,80 L100,10 M40,90 L100,30 M50,100 L100,50 M70,100 L100,70 M90,100 L100,90" stroke="#ef4444" stroke-width="6" /></g>`;
  else if (baseClass === '4.2') bgSvg = `<g><polygon points="50,0 100,50 0,50" fill="#ffffff" /><polygon points="50,100 100,50 50,0" fill="#ef4444" /></g>`;
  else if (baseClass === '4.3') bgSvg = `<polygon points="50,0 100,50 50,100 0,50" fill="#3b82f6" />`;
  else if (baseClass.startsWith('5.1')) bgSvg = `<polygon points="50,0 100,50 50,100 0,50" fill="#fde047" />`;
  else if (baseClass === '5.2') bgSvg = `<g><polygon points="50,0 100,50 0,50" fill="#ef4444" /><polygon points="50,100 100,50 0,50" fill="#fde047" /></g>`;
  else if (baseClass.startsWith('6')) bgSvg = `<polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />`;
  else if (baseClass.startsWith('7')) bgSvg = `<g><polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" /><polygon points="50,0 100,50 0,50" fill="#fde047" /></g>`;
  else if (baseClass.startsWith('8')) bgSvg = `<g><polygon points="50,0 100,50 50,100 0,50" fill="#000000" /><polygon points="50,0 100,50 0,50" fill="#ffffff" /></g>`;
  else if (baseClass.startsWith('9')) bgSvg = `<g><polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" /><path d="M0,50 L50,0 L100,50 Z" fill="#ffffff" /><path d="M10,40 L10,0 M30,20 L30,0 M50,50 L50,0 M70,20 L70,0 M90,40 L90,0" stroke="#000000" stroke-width="6" /></g>`;
  else bgSvg = `<polygon points="50,0 100,50 50,100 0,50" fill="#ffffff" />`;

  let iconColor = '#000000';
  if (['2.1', '3', '4.3'].includes(baseClass)) iconColor = '#ffffff';
  if (baseClass === '5.2') iconColor = '#ffffff';
  
  let numColor = iconColor;
  if (baseClass.startsWith('8')) numColor = '#ffffff';
  if (baseClass === '5.2') numColor = '#000000';

  container.innerHTML = `
    <div style="border: 2px dashed #94a3b8; padding: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; box-sizing: border-box;">
      <h1 style="font-size: 64px; font-weight: 900; color: #000; margin: 0 0 10px 0; text-align: center;">${item.unNumber}</h1>
      <h2 style="font-size: 32px; font-weight: bold; color: #334155; margin: 0 0 60px 0; text-align: center; text-transform: uppercase;">${item.properShippingName}</h2>
      
      <svg width="400" height="400" viewBox="0 0 100 100" style="filter: drop-shadow(0 10px 15px rgba(0,0,0,0.3)); display: block;">
        ${bgSvg}
        <polygon points="50,2 98,50 50,98 2,50" fill="none" stroke="${numColor}" stroke-width="2" />
        <g style="color: ${iconColor};">
          ${iconSvg}
        </g>
        <text x="50" y="92" font-size="18" font-weight="900" font-family="Arial, sans-serif" fill="${numColor}" text-anchor="middle">${labelText}</text>
      </svg>
      
      <p style="font-size: 24px; font-weight: bold; margin-top: 60px; color: #000;">CLASS: ${item.classDivision}</p>
      ${item.caoOnly.startsWith('Yes') || item.caoOnly.startsWith('Strictly') ? `<div style="margin-top: 20px; background-color: #ef4444; color: #fff; padding: 10px 30px; font-size: 24px; font-weight: bold; border-radius: 10px;">CARGO AIRCRAFT ONLY</div>` : ''}
    </div>
  `;
  
  document.body.appendChild(container);

  const opt = {
    margin:       0,
    filename:     `DGR_LABEL_${item.unNumber}.pdf`,
    image:        { type: 'jpeg', quality: 1 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'px', format: [800, 800], orientation: 'portrait' }
  };

  html2pdf().set(opt).from(container).outputPdf('blob').then((pdfBlob) => {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `DGR_LABEL_${item.unNumber}.pdf`;
    a.click();
    
    document.body.removeChild(container);
  });
};

export const getChargeName = (code) => {
  const chargeNames = {
    'AC': 'Animal Container',
    'AS': 'Assembly Service Fee',
    'AT': 'Attendant',
    'AW': 'Air Waybill Fee',
    'BA': 'Brokerage',
    'BL': 'Blacklist Certificate',
    'BR': 'Bank Release',
    'CA': 'Cartage (Origin)',
    'CB': 'Cartage (Destination)',
    'CC': 'Collect Charge Fee',
    'CD': 'Clearance and Handling (Dest)',
    'CG': 'Electronic Data Charge (e-AWB)',
    'CH': 'Clearance and Handling (Origin)',
    'DB': 'Disbursement Fee',
    'EA': 'Export Customs',
    'FC': 'Charges Collect Fee',
    'FD': 'Freight Forwarder Facility Fee',
    'FE': 'First Flight Out',
    'GT': 'Government Tax',
    'HR': 'Human Remains Handling',
    'IN': 'Insurance Premium',
    'LA': 'Live Animals Handling',
    'MA': 'Misc. Charge (Due Agent)',
    'MB': 'Misc. Charge (Due Dest)',
    'MC': 'Misc. Charge (Due Carrier)',
    'MY': 'Fuel Surcharge (FSC)',
    'PK': 'Packaging Charge',
    'PU': 'Pick-up Fee',
    'RA': 'Dangerous Goods Fee',
    'RC': 'Routing Charge',
    'SC': 'Security Surcharge (SSC)',
    'SD': 'Surface Transportation (Dest)',
    'SI': 'Stop in Transit',
    'SO': 'Storage Charge (Origin)',
    'SR': 'Storage Charge (Dest)',
    'SU': 'Surface Transportation (Origin)',
    'TX': 'Tax',
    'UD': 'Unitized Consignment',
    'XB': 'Security Screening',
    'XD': 'X-Ray Charge'
  };
  return chargeNames[code] || 'Other Charge';
};
