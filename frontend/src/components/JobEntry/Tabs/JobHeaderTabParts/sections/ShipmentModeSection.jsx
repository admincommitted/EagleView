// Screen section: Shipment Mode
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
// CTX type: ICEGATE code from either the code or the label saved on older jobs (same table as the backend builder)
export const CTX_CODES = { GSTIN: 'G', GSTN: 'G', 'INCOME TAX PAN': 'P', PAN: 'P', AADHAR: 'A', AADHAAR: 'A', PASSPORT: 'I', 'TIN NO': 'T', TIN: 'T', VAT: 'V', CST: 'C', 'SALES TAX REGISTRATION NO': 'S', 'SALES TAX': 'S', 'GST GOVERNMENT': 'O', 'GST GOVERNMENT (UIN)': 'O', 'GST DIPLOMAT': 'D', 'GST DIPLOMAT (UIN)': 'D', 'NOT REGISTERED': 'N', NONE: 'N' };
export const ctxCode = (v) => { const t = String(v || '').trim().toUpperCase(); if (!t || t === 'SELECT') return ''; if (/^[VCSGPAITDON]$/.test(t)) return t; return CTX_CODES[t] || CTX_CODES[t.replace(/^[A-Z] - /, '')] || ''; };
import RichAutocomplete from '../../../../../components/common/RichAutocomplete';
import { RichPartySelect } from '../RichPartySelect';
import { RichPortSelect } from '../helpers';
import { loadForeignPorts } from '../../../../../utils/foreignPorts';
import ModernDatePicker from '../../../../common/ModernDatePicker';
import toast from 'react-hot-toast';
// 17-Nov-2026: IATA airport codes (Cities.iataCode via /api/locations/airports), loaded once per page
let airportCache = null;
const loadAirportCodes = () => {
  if (!airportCache) {
    airportCache = fetch('/api/locations/airports').then(r => (r.ok ? r.json() : [])).then(rows => {
      const seen = new Set();
      return (Array.isArray(rows) ? rows : []).map(a => ({ portCode: String(a.iataCode || '').trim().toUpperCase(), portName: String(a.cityName || a.airportName || '').trim().toUpperCase(), extra: String(a.airportName || '').trim().toUpperCase(), countryCode: a.countryCode, category: 'AIRPORT' }))
        .filter(a => /^[A-Z]{3}$/.test(a.portCode) && !seen.has(a.portCode) && seen.add(a.portCode));
    }).catch(() => { airportCache = null; return []; });
  }
  return airportCache;
};

export default function ShipmentModeSection({ ctx }) {
  const { chaList = [], beType, handleChange, handleImporterBranchChange, importerBranches, jobData, masters, parties, ports, setBeType, setIsBondModalOpen, setIsCertModalOpen, setIsWarehouseModalOpen, setJobData, setSubAgent, setTransportMode, subAgent, subagentBranches = [], handleSubagentBranchChange, transportMode } = ctx;
  // date box wants yyyy-mm-dd; a WH BE date may come as YYYYMMDD or dd/mm/yyyy
  const isoDate = (v) => { const t = String(v || '').trim(); let m; if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`; if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return ''; };
  // a job read from a file has only the codes: show the names from the masters
  const cName = (c) => { const x = (masters?.countries || []).find(k => String(k.code || '').toUpperCase() === String(c || '').toUpperCase()); return c ? (x ? x.name : '') : ''; };
  // 04-Nov-2026: Origin / Shipment Port also offer the UN/LOCODE list (45,000 foreign ports) read from iCAFFE
  const [locodes, setLocodes] = React.useState([]);
  React.useEffect(() => { loadForeignPorts().then(setLocodes); }, []);
  // 17-Nov-2026: an Air BE files the 3-letter airport code as Origin / Shipment Port (every iCAFFE air job: BKK, HKG,
  // SHA ...; the BE check warns on anything longer) - the list offered only UN/LOCODEs (THBKK). Air jobs now get the
  // airports first; the UN/LOCODEs stay below them.
  const [airports, setAirports] = React.useState([]);
  React.useEffect(() => { if (transportMode === 'A') loadAirportCodes().then(setAirports); }, [transportMode]);
  const portOptions = React.useMemo(() => {
    const air = transportMode === 'A' ? airports : [];
    const airHave = new Set(air.map(p => p.portCode));
    const base = (ports || []).filter(p => !airHave.has(String(p.portCode || '').toUpperCase()));
    const have = new Set(air.map(p => p.portCode).concat(base.map(p => String(p.portCode || '').toUpperCase())));
    return air.concat(base).concat(locodes.filter(p => !have.has(p.portCode)));
  }, [ports, locodes, airports, transportMode]);
  const pName = (c) => { const x = portOptions.find(k => String(k.portCode || '').toUpperCase() === String(c || '').toUpperCase()); return c ? (x ? x.portName : '') : ''; };
  // 30-Oct-2026: typing in a name box (without picking) used to leave the old CODE behind - and the code is what is
  // filed. Now the code follows the text: an exact country / port name or code keeps the code, anything else blanks it.
  const u = (v) => String(v || '').trim().toUpperCase();
  const countryCodeFor = (v) => { const t = u(v); if (!t) return ''; const x = (masters?.countries || []).find(k => u(k.name) === t || u(k.code) === t); return x ? x.code : ''; };
  const portCodeFor = (v) => { const t = u(v); if (!t) return ''; const x = portOptions.find(k => u(k.portName) === t || u(k.portCode) === t); return x ? x.portCode : ''; };
  // 22-Nov-2026: the port lists know the country. Origin Port and Shipment Port offer the ports of the Country of
  // Consignment first, then those of the Country of Origin, then the rest; Indian ports come last (an import comes from
  // abroad). A port picked while Country of Consignment is blank fills that country (the goods' Country of Origin is
  // never guessed from a port - it decides the duty). A note under the line, which stops nothing: an Indian port, or an
  // Origin Port that is in neither of the two countries entered.
  const portCountry = (p) => {
    if (!p) return '';
    if (p.countryCode) return u(p.countryCode);
    const m = /\(([A-Z]{2})\)\s*$/.exec(u(p.country));
    if (m) return m[1];
    const c = u(p.portCode);
    return c.length === 5 || (c.length === 6 && c.startsWith('IN')) ? c.slice(0, 2) : '';
  };
  const coCode = u(jobData.countryOfOrigin || jobData.autoField_20);
  const cnCode = u(jobData.countryOfConsignment || jobData.autoField_21);
  const portsByCountry = React.useMemo(() => { const a = [], b2 = [], mid = [], last = []; for (const p of portOptions) { const k = portCountry(p); if (cnCode && k === cnCode) a.push(p); else if (coCode && k === coCode) b2.push(p); else if (k === 'IN') last.push(p); else mid.push(p); } return a.concat(b2, mid, last); }, [portOptions, cnCode, coCode]);
  const originOptions = portsByCountry;
  const shipOptions = portsByCountry;
  const originCode = u(jobData.portOfOrigin || jobData.autoField_22);
  const shipCode = u(jobData.portOfShipment);
  const portNotes = React.useMemo(() => {
    const out = [];
    const cOf = (code) => (code ? portCountry(portOptions.find(k => u(k.portCode) === code)) : '');
    const nm = (cc) => cName(cc) || cc;
    const oc = cOf(originCode), sc = cOf(shipCode);
    if (oc === 'IN') out.push('Origin Port ' + originCode + ' is an Indian port - an import comes from a port abroad.');
    else if (oc && (coCode || cnCode) && oc !== coCode && oc !== cnCode) out.push('Origin Port ' + originCode + ' is in ' + nm(oc) + ' - not the Country of Origin' + (coCode ? ' (' + nm(coCode) + ')' : '') + ' or of Consignment' + (cnCode ? ' (' + nm(cnCode) + ')' : '') + '.');
    if (sc === 'IN') out.push('Shipment Port ' + shipCode + ' is an Indian port.');
    return out;
  }, [portOptions, originCode, shipCode, coCode, cnCode, masters]);
  return (
    <>
    {/* TOP JOB DETAILS */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 600, color: 'var(--primary-text)', fontSize: '11px', whiteSpace: 'nowrap' }}>Shipment Mode</label>
            <select className="input-field mandatory-field" value={transportMode} onChange={e => setTransportMode(e.target.value)} style={{ width: '120px', fontWeight: 'bold', color: '#0f172a', border: '1px solid #f87171' }}>
              <option value="S">SEA</option>
              <option value="A">AIR</option>
              <option value="L">LAND</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 600, color: 'var(--primary-text)', fontSize: '11px', whiteSpace: 'nowrap' }}>BE Type [H/W/X]</label>
            <select className="input-field mandatory-field" value={beType} onChange={e => { setBeType(e.target.value); if (e.target.value.toUpperCase() === 'W') setIsWarehouseModalOpen(true); }} style={{ width: '120px', fontWeight: 'bold', color: '#0f172a', border: '1px solid #f87171' }}>
              <option value="H">HOME (H)</option>
              <option value="W">WAREHOUSE (W)</option>
              <option value="X">EX-BOND (X)</option>
            </select>
          </div>
          {/* 22-Nov-2026: Job Date was set to the day of entry with no box to see or change it (a BE keyed in a day late) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 600, color: 'var(--primary-text)', fontSize: '11px', whiteSpace: 'nowrap' }}>Job Date</label>
            <ModernDatePicker name="jobDate" className="input-field mandatory-field" style={{ width: '130px', color: '#0f172a', border: '1px solid #f87171' }} value={isoDate(jobData.jobDate)}
              onChange={e => { const v = e.target.value; const t = new Date(Date.now() + 19800000).toISOString().slice(0, 10); if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '2015-01-01')) return; /* half-typed date */ if (v && v > t) { toast.error('Job Date cannot be after today'); return; } setJobData(prev => ({ ...prev, jobDate: v || t })); }} />
          </div>
        </div>
        {/* Ex-Bond: the warehouse BE it clears (filled by "Select WH BE", or typed for a WH BE filed elsewhere). 28-Oct-2026 */}
        {beType === 'X' && (
          <div style={{ padding: '0 8px 8px', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#6d28d9', fontSize: '11px' }}>Ex-Bond of WH BE{jobData.inBondJobNo ? ` (job ${jobData.inBondJobNo})` : ''}</span>
            {[['warehouseBENo', 'WH BE No', 'text', 7], ['warehouseBEDate', 'WH BE Date', 'date'], ['warehouseCode', 'Warehouse Code', 'text', 8], ['warehouseCustomSiteId', 'WH Custom Site', 'text', 6]].map(([k, l, t, max]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', whiteSpace: 'nowrap' }}>{l}
                {t === 'date' ? <ModernDatePicker name={k} className="input-field mandatory-field" style={{ width: '130px', color: '#0f172a', border: '1px solid #f87171' }} value={isoDate(jobData[k])} onChange={e => setJobData(prev => ({ ...prev, [k]: e.target.value }))} />
                : <input name={k} type={t} maxLength={max} className="input-field mandatory-field" style={{ width: t === 'date' ? '130px' : '110px', color: '#0f172a', border: '1px solid #f87171' }}
                  value={t === 'date' ? isoDate(jobData[k]) : (jobData[k] || '')}
                  onChange={e => { const v = t === 'date' ? e.target.value : e.target.value.toUpperCase(); setJobData(prev => ({ ...prev, [k]: k === 'warehouseBENo' ? v.replace(/\D/g, '') : v })); }} />}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* IMPORTER DETAILS */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>Importer Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '120px' }}>Location</label>
                <RichPortSelect ports={ports} jobData={jobData} setJobData={setJobData} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>Govt. IEC</label>
                <select name="autoField_46" className="input-field" style={{ width: '60px', color: '#0f172a', border: '1px solid var(--primary-border)' }} value={jobData["autoField_46"] || "N"} onChange={handleChange}><option>N</option><option>Y</option></select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 2 }}>
                <label style={{ width: '80px' }}>CHA Details</label>
                <input name="chaCode" type="text" list="cha-master-list" placeholder="Select from CHA Master" title="CHA Master (Settings) - NAME - CODE" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={(jobData["chaCode"] || (jobData["chaCode"] || jobData["autoField_3"])) || ""} onChange={handleChange} />
                <datalist id="cha-master-list">{chaList.map(c => <option key={c.id || c.chaCode} value={`${c.chaName} - ${c.chaCode}`} />)}</datalist>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '120px' }}>IEC Name</label>
                <RichPartySelect parties={parties} jobData={jobData} setJobData={setJobData} masters={masters} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>IEC Code</label>
                <input name="iecCode" type="text" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={(jobData["iecCode"] || (jobData["iecCode"] || jobData["autoField_5"])) || ""} onChange={handleChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '120px', minWidth: '100px', whiteSpace: 'nowrap' }}>Branch Sr. No.</label>
                  <select name="branchSrNo" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }} value={[jobData["branchSrNo"], jobData["autoField_48"]].map(v => (v === null || v === undefined ? '' : String(v))).find(v => v !== '') || ""} onChange={handleImporterBranchChange}>
                    <option value="">Select Branch</option>
                    {importerBranches.map(b => (
                        <option key={b.branchSrNo} value={b.branchSrNo}>{b.branchSrNo} - {b.branchName || b.city}</option>
                    ))}
                    {/* 17-Nov-2026: a saved Sr. No. that is not among the party's branches is still shown (it was a blank box) */}
                    {(() => { const cur = [jobData["branchSrNo"], jobData["autoField_48"]].map(v => (v === null || v === undefined ? '' : String(v))).find(v => v !== '') || ''; return cur && !importerBranches.some(b => String(b.branchSrNo) === cur) ? <option value={cur}>{cur} (on this job)</option> : null; })()}
                  </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '120px' }}>Address 1</label>
              <input name="address1" type="text" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={(jobData["address1"] || (jobData["address1"] || jobData["autoField_6"])) || ""} onChange={handleChange} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '80px' }}>Address 2</label>
              <input name="address2" type="text" className="input-field" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }}  value={(jobData["address2"] || (jobData["address2"] || jobData["autoField_7"])) || ""} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Left 50% */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '120px' }}>City</label>
                <input name="city" type="text" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={(jobData["city"] || (jobData["city"] || jobData["autoField_8"])) || ""} onChange={handleChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '40px' }}>State</label>
                <input list="state-list" name="state" type="text" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={(jobData["state"] || (jobData["state"] || jobData["autoField_9"])) || ""} onChange={handleChange} />
              </div>
            </div>
            {/* Right 50% */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>Pin</label>
                <input name="pin" type="text" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={(jobData["pin"] || (jobData["pin"] || jobData["autoField_10"])) || ""} onChange={handleChange} />
                <PinSuggest jobData={jobData} handleChange={handleChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>AD Code</label>
                <div style={{ display: 'flex', flex: 1, border: '1px solid #f87171', borderRadius: '2px', overflow: 'hidden', background: '#fff' }}>
                  <input type="text" name="aeoCode" className="input-field input-field-borderless" style={{ flex: 1, color: '#0f172a', border: 'none', background: 'transparent', paddingLeft: '8px' }} value={(jobData["aeoCode"] || (jobData["aeoCode"] || jobData["autoField_49"])) || ""} onChange={handleChange} />
                  <span title="This code is filled from the party / branch master when you pick the importer" style={{ background: '#fef3c7', padding: '0 4px', borderLeft: '1px solid #f87171', color: '#1d4ed8', display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Left 50% */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '120px' }}>CTX Type</label>
                {/* 30-Oct-2026: the value is the ICEGATE CTX code (schema: V|C|S|G|P|A|I|T|D|O|N); the old label values
                    saved on earlier jobs are shown through ctxCode(), and "Select" is blank, not a word that gets filed */}
                <select name="autoField_50" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }} value={ctxCode(jobData["autoField_50"])} onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="G">G - GSTIN</option>
                  <option value="P">P - Income Tax PAN</option>
                  <option value="A">A - Aadhar</option>
                  <option value="I">I - Passport</option>
                  <option value="T">T - TIN No</option>
                  <option value="V">V - VAT</option>
                  <option value="C">C - CST</option>
                  <option value="S">S - Sales Tax Registration No</option>
                  <option value="O">O - GST Government (UIN)</option>
                  <option value="D">D - GST Diplomat (UIN)</option>
                  <option value="N">N - Not registered</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '70px', minWidth: '70px', whiteSpace: 'nowrap' }}>CTX State</label>
                <input list="state-list" name="autoField_11" type="text" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={jobData["autoField_11"] || ""} onChange={handleChange} />
              </div>
            </div>
            {/* Right 50% */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>State Code</label>
                <input list="state-taxcode-list" name="autoField_12" type="text" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={jobData["autoField_12"] || ""} onChange={handleChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>Registration No</label>
                <input name="autoField_13" type="text" className="input-field mandatory-field" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }}  value={jobData["autoField_13"] || ""} onChange={handleChange} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SUBAGENT DETAILS */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>SubAgent Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '150px', minWidth: '150px', whiteSpace: 'nowrap' }}>SubAgent Details [Y/N]</label>
              <select className="input-field" value={subAgent} onChange={e => setSubAgent(e.target.value)} style={{ width: '60px', color: '#0f172a', border: '1px solid var(--primary-border)' }}><option value="N">N</option><option value="Y">Y</option></select>
            </div>
            <div style={{ flex: 1 }}></div>
          </div>
          {subAgent === 'Y' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '4px', borderTop: '1px solid var(--primary-border)', paddingTop: '8px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ width: '150px', minWidth: '150px', whiteSpace: 'nowrap' }}>SubAgent Name</label>
                <RichPartySelect parties={parties} jobData={jobData} setJobData={setJobData} type="SUBAGENT" masters={masters} />
              </div>
              {/* 30-Oct-2026: a sub-agent with more than one branch had no way to pick which one - the branch (and its
                  address) only came from the party pick, and the handler that reads the choice was never on a box. */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ width: '110px', minWidth: '110px', whiteSpace: 'nowrap' }}>SubAgent Branch</label>
                <select name="subagentBranchSrNo" className="input-field" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }}
                  value={jobData.subagentBranchSrNo || ''} onChange={handleSubagentBranchChange}
                  title={subagentBranches.length ? 'Branch of the sub-agent as in its party master' : 'Pick the sub-agent first - its branches come from the party master'}>
                  <option value="">Select Branch</option>
                  {subagentBranches.map(b => (
                    <option key={b.branchSrNo} value={b.branchSrNo}>{b.branchSrNo} - {b.branchName || b.city}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>SubAgent Address</label>
                <div style={{ display: 'flex', flex: 1, border: '1px solid #f87171', borderRadius: '2px', overflow: 'hidden' }}>
                  <input name="subagentAddress" type="text" className="input-field input-field-borderless" placeholder="SUBAGENT ADDRESS" style={{ flex: 1, color: '#0f172a', border: 'none', background: '#fef9c3' }} value={jobData["subagentAddress"] || ""} onChange={handleChange} />
                  <span title="This code is filled from the party / branch master when you pick the importer" style={{ background: '#fef3c7', padding: '0 4px', borderLeft: '1px solid #f87171', color: '#1d4ed8', display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SHIPMENT DETAILS */}
      <div style={{ border: '1px solid var(--primary-border)', background: 'transparent', marginBottom: '4px' }}>
        <div style={{ padding: '4px 8px', background: 'var(--primary-bg-light)', color: 'var(--primary-text)', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid var(--primary-border)', textTransform: 'uppercase' }}>Shipment Details</div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '165px', minWidth: '165px', whiteSpace: 'nowrap' }}>User Job No</label>
              <input name="userJobNo" type="text" className="input-field" placeholder="USER JOB NO" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }} value={jobData["userJobNo"] || ""} onChange={handleChange} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>Port Code</label>
                <input list="port-code-list" name="portCode" type="text" className="input-field mandatory-field" placeholder="PORT CODE" style={{ flex: 1, color: '#0f172a', border: '1px solid #f87171' }} value={jobData["portCode"] || ""} onChange={handleChange} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>Trans. Mode</label>
                <input name="trans" type="text" className="input-field" placeholder="TRANS" style={{ flex: 1, color: '#0f172a', border: '1px solid var(--primary-border)' }} value={jobData["trans"] || ""} onChange={handleChange} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '165px', minWidth: '165px', whiteSpace: 'nowrap' }}>Country Of Origin</label>
              <RichAutocomplete 
                  options={masters?.countries || []}
                  value={jobData["countryOfOriginName"] ?? cName(jobData.countryOfOrigin || jobData.autoField_20)}
                  onChange={v => setJobData(prev => ({...prev, countryOfOriginName: v, countryOfOrigin: countryCodeFor(v), autoField_20: countryCodeFor(v)}))}
                  onSelect={c => setJobData(prev => ({...prev, countryOfOriginName: c.name, countryOfOrigin: c.code, autoField_20: c.code}))}
                  searchFilter={(c, q) => c.name?.toLowerCase()?.includes(q?.toLowerCase()) || c.code?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={c => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start)', fontSize: '11px' }}>{c.code}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{c.name}</div>
                    </>
                  )}
                  placeholder="COUNTRY OF ORIGIN"
                  inputStyle={{ border: '1px solid #f87171' }}
                />
                <input name="countryOfOrigin" type="text" className="input-field mandatory-field" placeholder="CODE" style={{ width: '70px', color: '#0f172a', border: '1px solid #f87171', background: '#f1f5f9' }} value={(jobData["countryOfOrigin"] || jobData["autoField_20"]) || ""} readOnly />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '80px' }}>Origin Port</label>
              <RichAutocomplete 
                  options={originOptions}
                  value={jobData["portOfOriginName"] ?? pName(jobData.portOfOrigin || jobData.autoField_22)}
                  onChange={v => setJobData(prev => ({...prev, portOfOriginName: v, portOfOrigin: portCodeFor(v), autoField_22: portCodeFor(v)}))}
                  onSelect={p => setJobData(prev => { const cc = portCountry(p); const fill = cc && cc !== 'IN' && !(prev.countryOfConsignment || prev.autoField_21) && cName(cc) ? { countryOfConsignmentName: cName(cc), countryOfConsignment: cc, autoField_21: cc } : {}; return {...prev, ...fill, portOfOriginName: p.portName, portOfOrigin: p.portCode, autoField_22: p.portCode}; })}
                  searchFilter={(p, q) => p.portName?.toLowerCase()?.includes(q?.toLowerCase()) || p.portCode?.toLowerCase()?.includes(q?.toLowerCase()) || (p.extra || '').toLowerCase().includes(q?.toLowerCase())}
                  renderOption={p => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start)', fontSize: '11px' }}>{p.portCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.portName}{p.extra && p.extra !== p.portName ? ' - ' + p.extra : ''}</div>
                    </>
                  )}
                  placeholder="PORT OF ORIGIN"
                  inputStyle={{ border: '1px solid #f87171' }}
                />
                <input name="portOfOrigin" type="text" className="input-field mandatory-field" placeholder="CODE" style={{ width: '70px', color: '#0f172a', border: '1px solid #f87171', background: '#f1f5f9' }} value={(jobData["portOfOrigin"] || jobData["autoField_22"]) || ""} readOnly />
            </div>
            {/* 30-Oct-2026: Port of Shipment had no box of its own - the BE carried the Origin Port in both fields.
                In ICES the origin port is where the goods come from, the shipment port is where they were loaded. */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '110px', minWidth: '110px', whiteSpace: 'nowrap' }}>Shipment Port</label>
              <RichAutocomplete
                  options={shipOptions}
                  value={jobData["portOfShipmentName"] ?? pName(jobData.portOfShipment)}
                  onChange={v => setJobData(prev => ({ ...prev, portOfShipmentName: v, portOfShipment: portCodeFor(v) }))}
                  onSelect={p => setJobData(prev => { const cc = portCountry(p); const fill = cc && cc !== 'IN' && !(prev.countryOfConsignment || prev.autoField_21) && cName(cc) ? { countryOfConsignmentName: cName(cc), countryOfConsignment: cc, autoField_21: cc } : {}; return { ...prev, ...fill, portOfShipmentName: p.portName, portOfShipment: p.portCode }; })}
                  searchFilter={(p, q) => p.portName?.toLowerCase()?.includes(q?.toLowerCase()) || p.portCode?.toLowerCase()?.includes(q?.toLowerCase()) || (p.extra || '').toLowerCase().includes(q?.toLowerCase())}
                  renderOption={p => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start)', fontSize: '11px' }}>{p.portCode}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.portName}{p.extra && p.extra !== p.portName ? ' - ' + p.extra : ''}</div>
                    </>
                  )}
                  placeholder="PORT OF SHIPMENT"
                  inputStyle={{ border: '1px solid var(--primary-border)' }}
                />
                <input name="portOfShipment" type="text" className="input-field" placeholder="CODE" title="Blank = the Origin Port is filed as the port of shipment" maxLength={6} style={{ width: '70px', color: '#0f172a', border: '1px solid var(--primary-border)', textTransform: 'uppercase' }} value={jobData.portOfShipment || ''} onChange={e => setJobData(prev => ({ ...prev, portOfShipment: e.target.value.toUpperCase(), portOfShipmentName: pName(e.target.value.toUpperCase()) }))} />
            </div>
          </div>
          {portNotes.length > 0 && (
            <div className="port-country-note" style={{ fontSize: '11px', color: '#b45309', textTransform: 'none', padding: '0 0 2px 2px' }}>{portNotes.join('  ')}</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ width: '165px', minWidth: '165px', whiteSpace: 'nowrap' }}>Country Of Consignment</label>
              <RichAutocomplete 
                  options={masters?.countries || []}
                  value={jobData["countryOfConsignmentName"] ?? cName(jobData.countryOfConsignment || jobData.autoField_21)}
                  onChange={v => setJobData(prev => ({...prev, countryOfConsignmentName: v, countryOfConsignment: countryCodeFor(v), autoField_21: countryCodeFor(v)}))}
                  onSelect={c => setJobData(prev => ({...prev, countryOfConsignmentName: c.name, countryOfConsignment: c.code, autoField_21: c.code}))}
                  searchFilter={(c, q) => c.name?.toLowerCase()?.includes(q?.toLowerCase()) || c.code?.toLowerCase()?.includes(q?.toLowerCase())}
                  renderOption={c => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start)', fontSize: '11px' }}>{c.code}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{c.name}</div>
                    </>
                  )}
                  placeholder="COUNTRY OF CONSIGNMENT"
                  inputStyle={{ border: '1px solid #f87171' }}
                />
                <input name="countryOfConsignment" type="text" className="input-field mandatory-field" placeholder="CODE" style={{ width: '70px', color: '#0f172a', border: '1px solid #f87171', background: '#f1f5f9' }} value={(jobData["countryOfConsignment"] || jobData["autoField_21"]) || ""} readOnly />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>Bond</label>
                <select className="input-field" value={jobData.bond || 'N'} onChange={e => { setJobData(prev => ({...prev, bond: e.target.value})); if (e.target.value === 'Y') setIsBondModalOpen(true); }} style={{ width: '60px', color: '#0f172a', border: '1px solid var(--primary-border)' }}><option value="N">N</option><option value="Y">Y</option></select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                <label style={{ width: '80px' }}>Certificate</label>
                <select className="input-field" value={jobData.certificate || 'N'} onChange={e => { setJobData(prev => ({...prev, certificate: e.target.value})); if (e.target.value === 'Y') setIsCertModalOpen(true); }} style={{ width: '60px', color: '#0f172a', border: '1px solid var(--primary-border)' }}><option value="N">N</option><option value="Y">Y</option></select>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* BILL OF ENTRY SPECIFICATION */}
    </>
  );
}

// 16-Nov-2026: 537 BE jobs loaded from iCAFFE came without the importer PIN (ICEGATE: "PIN is mandatory"). When the box is
// empty or not 6 digits, this offers the PINs known for the same IEC + branch: Party master branches and other BE jobs
// (how many used it, and whether the address was the same). The user picks one - nothing is filled on its own, because
// iCAFFE's own data sometimes has two PINs for one address.
function PinSuggest({ jobData, handleChange }) {
  const pin = String(jobData.pin || jobData.autoField_10 || '').trim();
  const iec = String(jobData.iecCode || jobData.autoField_5 || '').trim();
  const br = String(jobData.branchSrNo ?? jobData.autoField_48 ?? '').trim();
  const addr = String(jobData.address1 || jobData.autoField_6 || '').trim();
  const st = String(jobData.state || jobData.autoField_9 || '').trim();
  const need = !/^[1-9]\d{5}$/.test(pin) && !!iec;
  const [list, setList] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!need) { setList([]); return undefined; }
    let gone = false;
    const qs = new URLSearchParams({ iec, branchSrNo: br || '0', address1: addr, state: st, jobId: String(jobData.id || '') });
    fetch('/api/import-jobs/pin-suggest?' + qs.toString()).then(r => r.json()).then(d => { if (!gone) setList(d && d.success && Array.isArray(d.data) ? d.data : []); }).catch(() => { if (!gone) setList([]); });
    return () => { gone = true; };
  }, [need, iec, br, addr, st, jobData.id]);
  if (!need || !list.length) return null;
  const use = (p) => { handleChange({ target: { name: 'pin', value: p } }); setOpen(false); };
  return (
    <span style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)} title="PINs used before for this importer and branch" aria-expanded={open}
        style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Known PINs ({list.length})
      </button>
      {open && (
        <span role="listbox" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 50, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 8px 20px rgba(15,23,42,0.15)', minWidth: '260px', padding: '4px', display: 'block' }}>
          {list.map(x => (
            <button key={x.pin} type="button" role="option" aria-selected="false" onClick={() => use(x.pin)}
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: '10px', padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', textAlign: 'left', color: '#0f172a' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <b>{x.pin}</b>
              <span style={{ color: x.stateOk === false ? '#b91c1c' : '#64748b' }}>{[x.stateOk === false ? `not a ${st || 'state'} PIN` : '', x.master ? 'Party master' : '', x.jobs ? `${x.jobs} job${x.jobs > 1 ? 's' : ''}` : '', x.sameAddress ? `${x.sameAddress} same address` : ''].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
          <span style={{ display: 'block', padding: '4px 8px', fontSize: '10px', color: '#64748b' }}>Check the PIN against the importer branch address before filing.</span>
        </span>
      )}
    </span>
  );
}
