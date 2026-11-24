import React, { useState, useEffect } from 'react';
import { Save, Search, Edit2, Trash2, Map, Plane } from "lucide-react";
import { askDelete } from './switchRow';

export default function CountryMasterForm() {
  const [uiModal, setUiModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [locations, setLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [citySearchTerm, setCitySearchTerm] = useState('');
    const [stats, setStats] = useState(null);
  
  // Selection states
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [expandedStates, setExpandedStates] = useState([]);

  const toggleState = (id) => {
      setExpandedStates(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  // Form states
  const [countryForm, setCountryForm] = useState({ id: '', code: '', name: '' });
  const [stateForm, setStateForm] = useState({ id: '', stateName: '', stateCode: '', taxCode: '' });
  
  // Notice we added stateId so the user can choose which state this location belongs to
  const [cityForm, setCityForm] = useState({ 
      id: '', stateId: '', cityName: '', airportName: '', iataCode: '', 
      portCode: '', portName: '', portCategory: 'AIR',
      chaCode: '', chaName: '', division: 'BOTH (IMP/EXP)', isActive: true, isSez: false
  });

  const customAlert = (title, msg, type = 'error') => {
    setUiModal({ isOpen: true, title, message: String(msg ?? ''), type });
  };

  const fetchLocations = async () => {
    try {
      fetch('/api/locations/stats').then(r => r.json()).then(data => setStats(data)).catch(err => console.error(err));
      const res = await fetch('/api/locations');
      const data = await res.json();
      setLocations(data);
      if (selectedCountry) {
        const updatedCountry = data.find(c => c.id === selectedCountry.id);
        setSelectedCountry(updatedCountry || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleSaveCountry = async () => {
    if (!countryForm.code || !countryForm.name) return customAlert('VALIDATION', 'Country Code and Name are required.');
    try {
      const url = countryForm.id ? `/api/masters/countries/${countryForm.id}` : '/api/masters/countries';
      const res = await fetch(url, {
        method: countryForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(countryForm)
      });
      if (res.ok) {
        setCountryForm({ id: '', code: '', name: '' });
        fetchLocations();
      } else {
        const err = await res.json();
        customAlert('ERROR', err.error || 'Failed to save country.');
      }
    } catch(err) { customAlert('NETWORK', 'Failed to save country.'); }
  };

  const handleSaveState = async () => {
      if (!selectedCountry) return customAlert('VALIDATION ERROR', 'Please select a country first.');
      if (!stateForm.stateName || !stateForm.stateCode || !stateForm.taxCode) {
          return customAlert('VALIDATION ERROR', 'State Name, State Code, and Tax Code are mandatory.');
      }
      const payload = { ...stateForm, countryId: selectedCountry.id };
      const url = stateForm.id ? `/api/locations/states/${stateForm.id}` : '/api/locations/states';
      try {
          const res = await fetch(url, { method: stateForm.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (res.ok) {
              setStateForm({ id: '', stateName: '', stateCode: '', taxCode: '' });
              fetchLocations();
          } else {
              const err = await res.json(); customAlert('ERROR', err.error || 'Failed to save state.');
          }
      } catch (err) { customAlert('NETWORK ERROR', 'Could not save state.'); }
  };

  const handleDeleteState = async (id) => {
      if (!(await askDelete('Delete this state and ALL its cities?'))) return;
      try {
          const res = await fetch(`/api/locations/states/${id}`, { method: 'DELETE' });
          if (res.ok) fetchLocations(); else { const e = await res.json().catch(() => ({})); window.alert('Not deleted: ' + (e.error || res.status)); }
      } catch (err) { window.alert('Not deleted: ' + err.message); }
  };

  const handleSaveCity = async () => {
      if (!selectedCountry) return customAlert('VALIDATION ERROR', 'Please select a country first.');
      if (!cityForm.stateId) return customAlert('VALIDATION ERROR', 'Please select a State for this location.');
      if (!cityForm.cityName) return customAlert('VALIDATION ERROR', 'City Name is mandatory.');
      
      const payload = { ...cityForm, countryId: selectedCountry.id };
      const url = cityForm.id ? `/api/locations/cities/${cityForm.id}` : '/api/locations/cities';
      try {
          const res = await fetch(url, { method: cityForm.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (res.ok) {
              setCityForm({ id: '', stateId: cityForm.stateId, cityName: '', airportName: '', iataCode: '', portCode: '', portName: '', portCategory: 'AIR', chaCode: '', chaName: '', division: 'BOTH (IMP/EXP)', isActive: true, isSez: false });
              fetchLocations();
          } else {
              const err = await res.json(); customAlert('ERROR', err.error || 'Failed to save location.');
          }
      } catch (err) { customAlert('NETWORK ERROR', 'Could not save location.'); }
  };

  const handleDeleteCity = async (id) => {
      if (!(await askDelete('Delete this city / location?'))) return;
      try {
          const res = await fetch(`/api/locations/cities/${id}`, { method: 'DELETE' });
          if (res.ok) fetchLocations(); else { const e = await res.json().catch(() => ({})); window.alert('Not deleted: ' + (e.error || res.status)); }
      } catch (err) { window.alert('Not deleted: ' + err.message); }
  };

  const filteredLocations = locations.filter(l => {
      const term = searchTerm.toLowerCase();
      if (l.name?.toLowerCase().includes(term) || l.code?.toLowerCase().includes(term)) return true;
      if (l.states) {
          for (const s of l.states) {
              if (s.stateName?.toLowerCase().includes(term)) return true;
              if (s.cities) {
                  for (const c of s.cities) {
                      if (c.cityName?.toLowerCase().includes(term) || c.airportName?.toLowerCase().includes(term) || c.iataCode?.toLowerCase().includes(term)) return true;
                  }
              }
          }
      }
      return false;
    });

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* LEFT SIDEBAR */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#3b82f6" /> COUNTRIES
          </h3>
          <input 
              type="text" 
              className="input-field" 
              placeholder="Search countries..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ marginBottom: '12px', width: '100%' }}
            />

          </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredLocations.map(country => (
              <li 
                key={country.id}
                onClick={() => {
                  setSelectedCountry(country);
                  setCountryForm(country);
                  setStateForm({ id: '', stateName: '', stateCode: '', taxCode: '' });
                  setCityForm({ id: '', stateId: '', cityName: '', airportName: '', iataCode: '', portCode: '', portName: '', portCategory: 'AIR', chaCode: '', chaName: '', division: 'BOTH (IMP/EXP)', isActive: true, isSez: false });
                }}
                style={{ 
                  padding: '12px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)', cursor: 'pointer',
                  background: selectedCountry?.id === country.id ? '#eff6ff' : 'transparent',
                  borderBottom: '1px solid var(--border-color, #cbd5e1)', borderLeft: selectedCountry?.id === country.id ? '4px solid #3b82f6' : '4px solid transparent', margin: '0 8px', borderRadius: selectedCountry?.id === country.id ? '6px' : '0', boxShadow: selectedCountry?.id === country.id ? '0 2px 6px rgba(59,130,246,0.15)' : 'none', transform: selectedCountry?.id === country.id ? 'scale(1.01)' : 'scale(1)'
                }}
              >
                <div style={{ fontWeight: 600, color: selectedCountry?.id === country.id ? 'var(--primary-color-end, #1d4ed8)' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src={`https://flagcdn.com/w20/${(country.code || 'xx').toLowerCase()}.png`} width="16" alt={country.code} style={{ borderRadius: '2px' }} onError={(e) => e.target.style.display = 'none'} />
                      {country.name}
                    </span>
                    <span style={{ fontSize: '10px', backgroundColor: selectedCountry?.id === country.id ? '#dbeafe' : 'var(--primary-bg-light, #e0f2fe)', padding: '2px 6px', borderRadius: '10px', color: selectedCountry?.id === country.id ? '#1e40af' : 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold', flexShrink: 0 }}>
                      {country.states?.reduce((acc, state) => acc + (state.cities?.length || 0), 0) || 0} PORTS
                    </span>
                  </div>
                  <div style={{ color: selectedCountry?.id === country.id ? 'var(--text-muted, var(--text-muted, #64748b))' : 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '11px', marginTop: '2px' }}>CODE: {country.code}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* RIGHT CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: '16px', gap: '1.5rem' }}>
        
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)' }}>{stats.countries}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Countries</div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{stats.airports}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Global Airports</div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.states}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mapped States</div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>{(stats.cities / 1000).toFixed(1)}k</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registered Cities</div>
            </div>
          </div>
        )}

        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '12px', fontWeight: 700, color: 'var(--primary-text, #0369a1)', textTransform: 'uppercase', borderBottom: '2px solid #0369a1', paddingBottom: '4px', display: 'inline-block' }}>
            {countryForm.id ? 'UPDATE COUNTRY' : 'ADD NEW COUNTRY'}
          </h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 150px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>COUNTRY CODE *</label>
              <input type="text" className="input-field" placeholder="E.G. IN" maxLength={2} style={{ textTransform: 'uppercase', padding: '6px 10px', fontSize: '12px' }} value={countryForm.code} onChange={(e) => setCountryForm({...countryForm, code: e.target.value.toUpperCase()})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>COUNTRY NAME *</label>
              <input type="text" className="input-field" placeholder="ENTER FULL COUNTRY NAME" style={{ textTransform: 'uppercase', padding: '6px 10px', fontSize: '12px' }} value={countryForm.name} onChange={(e) => setCountryForm({...countryForm, name: e.target.value.toUpperCase()})} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 700, height: '30px' }} onClick={() => {setCountryForm({id: '', code: '', name: ''}); setSelectedCountry(null);}}>CLEAR</button>
              <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 700, height: '30px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleSaveCountry}>
                <Save size={14}/> {countryForm.id ? 'UPDATE' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>

        {selectedCountry && (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: 'var(--primary-text, #0369a1)' }}>
              <Map size={20} /> <h3 style={{ margin: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>UNIFIED MASTER: {selectedCountry.name} <img src={`https://flagcdn.com/w40/${(selectedCountry.code || 'xx').toLowerCase()}.png`} width="24" alt={selectedCountry.code} style={{ borderRadius: '3px' }} onError={(e) => e.target.style.display = 'none'} /></h3>
            </div>
            
            <div style={{ backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #475569))', textTransform: 'uppercase' }}>1. State Registration</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '2 1 200px' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>STATE NAME *</label>
                        <input type="text" value={stateForm.stateName} onChange={e => setStateForm({...stateForm, stateName: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', padding: '6px', fontSize: '11px' }} placeholder="STATE NAME *" />
                    </div>
                    <div style={{ flex: '1 1 100px' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>STATE CODE *</label>
                        <input type="text" value={stateForm.stateCode} onChange={e => setStateForm({...stateForm, stateCode: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', padding: '6px', fontSize: '11px' }} placeholder="STATE CODE *" />
                    </div>
                    <div style={{ flex: '1 1 100px' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>TAX CODE *</label>
                        <input type="text" value={stateForm.taxCode} onChange={e => setStateForm({...stateForm, taxCode: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', padding: '6px', fontSize: '11px' }} placeholder="TAX CODE *" />
                    </div>
                    <button onClick={handleSaveState} style={{ padding: '6px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', height: '27px' }}>
                        {stateForm.id ? 'UPDATE STATE' : '+ ADD STATE'}
                    </button>
                </div>
            </div>

            <div style={{ backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '6px', border: '1px solid #000000', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: 'var(--primary-text, #0369a1)', textTransform: 'uppercase' }}>2. Location Registration</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1.5 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-text, #0369a1)', marginBottom: '4px' }}>SELECT STATE *</label>
                        <select value={cityForm.stateId} onChange={e => setCityForm({...cityForm, stateId: e.target.value})} className="input-field" style={{ width: '100%', padding: '6px', fontSize: '11px' }}>
                            <option value="">-- SELECT STATE --</option>
                            {(selectedCountry.states || []).map(s => <option key={s.id} value={s.id}>{s.stateName}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1.5 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-text, #0369a1)', marginBottom: '4px' }}>CITY NAME *</label>
                        <input type="text" value={cityForm.cityName} onChange={e => setCityForm({...cityForm, cityName: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', padding: '6px', fontSize: '11px' }} placeholder="CITY NAME" />
                    </div>
                    <div style={{ flex: '2 1 150px' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-text, #0369a1)', marginBottom: '4px' }}>FULL AIRPORT NAME</label>
                        <input type="text" value={cityForm.airportName || ''} onChange={e => setCityForm({...cityForm, airportName: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', padding: '6px', fontSize: '11px' }} placeholder="FULL AIRPORT NAME" />
                    </div>
                    <div style={{ flex: '1 1 60px' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-text, #0369a1)', marginBottom: '4px' }}>IATA CODE</label>
                        <input type="text" value={cityForm.iataCode || ''} onChange={e => setCityForm({...cityForm, iataCode: e.target.value.toUpperCase()})} maxLength={3} className="input-field" style={{ width: '100%', padding: '6px', fontSize: '11px' }} placeholder="IATA CODE" />
                    </div>
                    <div style={{ flex: 1 }}></div>
                    <button onClick={handleSaveCity} style={{ padding: '6px 16px', backgroundColor: 'var(--primary-text, #0284c7)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', height: '27px' }}>
                        {cityForm.id ? 'UPDATE LOCATION' : '+ ADD LOCATION'}
                    </button>
                </div>
            </div>

            {/* FLAT UNIFIED GRID (LARGE WITH SCROLLBARS) */}
            <div style={{ 
                overflowX: 'auto', overflowY: 'auto', height: '600px',
                border: '1px solid var(--border-color)', 
                borderRadius: '6px', 
                backgroundColor: '#fff',
                boxShadow: 'inset 0 0 5px rgba(0,0,0,0.05)'
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 8px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-main, #0f172a)' }}>STATES & PORTS IN {selectedCountry.name}</h4>
                <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px' }}>
                    <Search size={14} color="#64748b" style={{ marginRight: '6px' }} />
                    <input type="text" placeholder="Search City, Airport or IATA..." value={citySearchTerm} onChange={e => setCitySearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', width: '220px', padding: '4px', background: 'transparent' }} />
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '800px' }}>
                <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', color: 'var(--text-muted, var(--text-muted, #475569))', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <tr style={{ borderBottom: '2px solid var(--border-color, #cbd5e1)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color, #e2e8f0)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.5px' }}>ACTION</th>
                    <th style={{ padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color, #e2e8f0)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.5px' }}>STATE NAME</th>
                    <th style={{ padding: '12px', textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color, #e2e8f0)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.5px' }}>TAX CODE</th>
                    <th style={{ padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color, #e2e8f0)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.5px' }}>CITY NAME</th>
                    <th style={{ padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color, #e2e8f0)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.5px' }}>FULL AIRPORT NAME</th>
                    <th style={{ padding: '12px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 800, fontSize: '10px', letterSpacing: '0.5px' }}>IATA CODE</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCountry.states || []).map(state => {
                        if (!state.cities) state.cities = [];
                        const term = citySearchTerm.toLowerCase();
                        // Filter cities if there's a search term
                        const filteredCities = term ? state.cities.filter(c => 
                            c.cityName?.toLowerCase().includes(term) || 
                            c.airportName?.toLowerCase().includes(term) || 
                            c.iataCode?.toLowerCase().includes(term)
                        ) : state.cities;
                        
                        // If searching and this state has no matching cities and state name doesn't match, hide state completely
                        if (term && filteredCities.length === 0 && !state.stateName?.toLowerCase().includes(term)) return [];
                        
                        return { ...state, filteredCities };
                    }).flat().flatMap(state => {
                        const citiesToRender = state.filteredCities || state.cities || [];
                        const locCount = citiesToRender.length;
                      
                      const stateRow = (
                          <tr key={`state-${state.id}`} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))' }}>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color, #e2e8f0)' }}>
                                <button onClick={() => setStateForm(state)} style={{ color: 'var(--primary-color-start, #0ea5e9)', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px', padding: '4px', borderRadius: '4px' }} title="Edit State" onMouseOver={e => e.currentTarget.style.backgroundColor='#e0f2fe'} onMouseOut={e => e.currentTarget.style.backgroundColor='transparent'}><Edit2 size={14}/></button>
                                <button onClick={() => handleDeleteState(state.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }} title="Delete State" onMouseOver={e => e.currentTarget.style.backgroundColor='#fee2e2'} onMouseOut={e => e.currentTarget.style.backgroundColor='transparent'}><Trash2 size={14}/></button>
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 'bold', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>{state.stateName}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color, #e2e8f0)', color: '#334155' }}>{state.taxCode}</td>
                            <td colSpan="3" style={{ padding: '8px 12px' }}>
                                {locCount > 0 ? (
                                    <span style={{ backgroundColor: 'var(--primary-bg-light, #e0f2fe)', color: 'var(--text-muted, var(--text-muted, #475569))', padding: '3px 10px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                        {locCount} LOCATION{locCount > 1 ? 'S' : ''} ADDED
                                    </span>
                                ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '10px', fontStyle: 'italic' }}>No locations added yet.</span>
                                )}
                            </td>
                          </tr>
                      );

                      if (locCount === 0) {
                          return [stateRow];
                      }
                      
                      const cityRows = citiesToRender.map((city, idx) => {
                          const isLast = idx === locCount - 1;
                          return (
                          <tr key={`city-${city.id}`} style={{ backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', transition: 'background-color 0.1s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='var(--bg-app, var(--bg-app, #f8fafc))'} onMouseOut={e => e.currentTarget.style.backgroundColor='var(--bg-panel, var(--bg-panel, #ffffff))'}>
                            <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', borderRight: 'none', borderBottom: isLast ? '1px solid var(--border-color, #cbd5e1)' : '1px solid var(--bg-input, #f1f5f9)', backgroundColor: '#fcfcfc' }}>
                                <button onClick={() => {
                                    setStateForm(state);
                                    setCityForm({ id: city.id, stateId: state.id, cityName: city.cityName, airportName: city.airportName||'', iataCode: city.iataCode||'' });
                                }} style={{ color: 'var(--primary-color-start, #0ea5e9)', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px', padding: '4px', borderRadius: '4px' }} title="Edit Location" onMouseOver={e => e.currentTarget.style.backgroundColor='#e0f2fe'} onMouseOut={e => e.currentTarget.style.backgroundColor='transparent'}><Edit2 size={13}/></button>
                                <button onClick={() => handleDeleteCity(city.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }} title="Delete Location" onMouseOver={e => e.currentTarget.style.backgroundColor='#fee2e2'} onMouseOut={e => e.currentTarget.style.backgroundColor='transparent'}><Trash2 size={13}/></button>
                            </td>
                            <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', borderRight: 'none', borderBottom: isLast ? '1px solid var(--border-color, #cbd5e1)' : '1px solid var(--bg-input, #f1f5f9)', color: 'var(--border-color, var(--border-color, #cbd5e1))', textAlign: 'right', backgroundColor: '#fcfcfc' }}>
                                <span style={{ fontSize: '14px' }}>?</span>
                            </td>
                            <td style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color, #e2e8f0)', borderBottom: isLast ? '1px solid var(--border-color, #cbd5e1)' : '1px solid var(--bg-input, #f1f5f9)', backgroundColor: '#fcfcfc' }}></td>
                            
                            <td style={{ padding: '6px 12px', fontWeight: 'bold', whiteSpace: 'nowrap', borderRight: '1px solid var(--bg-input, #f1f5f9)', borderBottom: isLast ? '1px solid var(--border-color, #cbd5e1)' : '1px solid var(--bg-input, #f1f5f9)', color: 'var(--primary-text, #0369a1)' }}>{city.cityName}</td>
                            <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', borderRight: '1px solid var(--bg-input, #f1f5f9)', borderBottom: isLast ? '1px solid var(--border-color, #cbd5e1)' : '1px solid var(--bg-input, #f1f5f9)', color: 'var(--text-muted, var(--text-muted, #475569))' }}>{city.airportName || '-'}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap', borderBottom: isLast ? '1px solid var(--border-color, #cbd5e1)' : '1px solid var(--bg-input, #f1f5f9)', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                                {city.iataCode ? <span style={{ backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)' }}>{city.iataCode}</span> : '-'}
                            </td>
                          </tr>
                          );
                      });

                      return [stateRow, ...cityRows];
                  })}
                  {(!selectedCountry.states || selectedCountry.states.length === 0) && (
                      <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '12px' }}>No data found. Please add a state first.</td></tr>
                  )}
                </tbody>
              </table>
</div>
  
          </div>
        )}
      </div>

      {/* Modal */}
      {uiModal.isOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                  <div style={{ padding: '16px', backgroundColor: uiModal.type === 'error' ? '#fff1f2' : '#f0fdf4', borderBottom: `1px solid ${uiModal.type === 'error' ? '#ffe4e6' : '#22c55e'}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: uiModal.type === 'error' ? '#e11d48' : '#16a34a', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>!</div>
                      <h3 style={{ margin: 0, color: uiModal.type === 'error' ? '#9f1239' : '#166534', fontSize: '14px', fontWeight: 'bold' }}>{uiModal.title}</h3>
                  </div>
                  <div style={{ padding: '24px', textAlign: 'center', color: '#334155', fontSize: '13px' }}>
                      {uiModal.message}
                  </div>
                  <div style={{ padding: '12px 24px', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => setUiModal({ ...uiModal, isOpen: false })} style={{ padding: '8px 24px', backgroundColor: 'var(--text-main, var(--text-main, #0f172a))', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>OK / DISMISS</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
