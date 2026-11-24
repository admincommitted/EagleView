import React, { useState, useEffect } from 'react';
import { Save, PlusCircle, MapPin, Map, Globe, Trash2, Edit2 } from 'lucide-react';

export default function LocationMasterForm() {
    const [uiModal, setUiModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
    const [locations, setLocations] = useState([]);
    const [selectedCountryId, setSelectedCountryId] = useState('');
    const [selectedState, setSelectedState] = useState(null);
    
    // Forms state
    const [stateForm, setStateForm] = useState({ id: '', stateName: '', stateCode: '', taxCode: '' });
    const [cityForm, setCityForm] = useState({ id: '', cityName: '', unlocCode: '' });

    const customAlert = (title, msg, type = 'error') => {
        setUiModal({ isOpen: true, title, message: String(msg ?? ''), type });
    };

    const fetchLocations = async () => {
        try {
            const res = await fetch('/api/locations');
            const data = await res.json();
            setLocations(data);
        } catch (err) {
            console.error("Failed to fetch locations", err);
        }
    };

    useEffect(() => {
        fetchLocations();
    }, []);

    const selectedCountry = locations.find(c => c.id.toString() === selectedCountryId);

    // STATE OPERATIONS
    const handleSaveState = async () => {
        if (!selectedCountryId) return customAlert('VALIDATION ERROR', 'Please select a country first.');
        if (!stateForm.stateName || !stateForm.stateCode || !stateForm.taxCode) {
            return customAlert('VALIDATION ERROR', 'State Name, State Code, and Tax Code are mandatory.');
        }

        const payload = { ...stateForm, countryId: parseInt(selectedCountryId) };
        const method = stateForm.id ? 'PUT' : 'POST';
        const url = stateForm.id ? `/api/locations/states/${stateForm.id}` : '/api/locations/states';

        try {
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (res.ok) {
                customAlert('SUCCESS', `State ${stateForm.id ? 'updated' : 'added'} successfully.`, 'success');
                setStateForm({ id: '', stateName: '', stateCode: '', taxCode: '' });
                fetchLocations();
            } else {
                const err = await res.json();
                customAlert('ERROR', err.error || 'Failed to save state.');
            }
        } catch (err) {
            customAlert('NETWORK ERROR', 'Could not save state.');
        }
    };

    const handleDeleteState = async (id) => {
        
        try {
            const res = await fetch(`/api/locations/states/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (selectedState && selectedState.id === id) setSelectedState(null);
                fetchLocations();
            }
        } catch (err) {
            console.error(err);
        }
    };

    // CITY OPERATIONS
    const handleSaveCity = async () => {
        if (!selectedState) return customAlert('VALIDATION ERROR', 'Please select a state first from the grid.');
        if (!cityForm.cityName) return customAlert('VALIDATION ERROR', 'City Name is mandatory.');

        const payload = { ...cityForm, stateId: selectedState.id, countryId: parseInt(selectedCountryId) };
        const method = cityForm.id ? 'PUT' : 'POST';
        const url = cityForm.id ? `/api/locations/cities/${cityForm.id}` : '/api/locations/cities';

        try {
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (res.ok) {
                customAlert('SUCCESS', `City ${cityForm.id ? 'updated' : 'added'} successfully.`, 'success');
                setCityForm({ id: '', cityName: '', unlocCode: '' });
                fetchLocations();
                // update selected state context
                const updatedCountry = locations.find(c => c.id.toString() === selectedCountryId);
                // The refresh will update the grid, but we need to ensure selectedState refetches cities
            } else {
                const err = await res.json();
                customAlert('ERROR', err.error || 'Failed to save city.');
            }
        } catch (err) {
            customAlert('NETWORK ERROR', 'Could not save city.');
        }
    };

    const handleDeleteCity = async (id) => {
        
        try {
            const res = await fetch(`/api/locations/cities/${id}`, { method: 'DELETE' });
            if (res.ok) fetchLocations();
        } catch (err) {
            console.error(err);
        }
    };
    
    // Sync selected state's cities after refetch
    const activeState = selectedState && selectedCountry ? selectedCountry.states.find(s => s.id === selectedState.id) : null;

    return (
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', minHeight: '100%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #0f172a))', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={20} /> Geographic Location Master
            </h2>

            {/* COUNTRY SELECTION */}
            <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '12px' }}>1. Select Country</h3>
                <select 
                    className="input-field" 
                    value={selectedCountryId} 
                    onChange={(e) => { setSelectedCountryId(e.target.value); setSelectedState(null); }}
                    style={{ width: '300px', border: '1px solid #000000', borderRadius: '4px', padding: '6px 12px' }}
                >
                    <option value="">-- SELECT COUNTRY --</option>
                    {locations.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                </select>
                {!selectedCountryId && <p style={{ fontSize: '12px', color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '8px' }}>Select a country to manage its states and cities.</p>}
            </div>

            {selectedCountry && (
                <div style={{ display: 'flex', gap: '16px' }}>
                    {/* STATE MANAGEMENT */}
                    <div style={{ flex: 1, backgroundColor: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Map size={16} /> Manage States for {selectedCountry.name}
                            </h3>
                        </div>
                        
                        <div style={{ padding: '16px' }}>
                            {/* State Form */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 2 }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))' }}>STATE NAME *</label>
                                    <input type="text" value={stateForm.stateName} onChange={e => setStateForm({...stateForm, stateName: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }} placeholder="e.g. MAHARASHTRA" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))' }}>STATE CODE *</label>
                                    <input type="text" value={stateForm.stateCode} onChange={e => setStateForm({...stateForm, stateCode: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }} placeholder="e.g. MH" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))' }}>TAX CODE *</label>
                                    <input type="text" value={stateForm.taxCode} onChange={e => setStateForm({...stateForm, taxCode: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }} placeholder="e.g. 27" />
                                </div>
                                <button onClick={handleSaveState} style={{ padding: '6px 12px', backgroundColor: 'var(--primary-text, #0284c7)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Save size={14} /> {stateForm.id ? 'UPDATE' : 'ADD'}
                                </button>
                                {stateForm.id && <button onClick={() => setStateForm({id: '', stateName: '', stateCode: '', taxCode: ''})} style={{ padding: '6px 12px', backgroundColor: 'var(--border-color, var(--border-color, #cbd5e1))', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>CANCEL</button>}
                            </div>

                            {/* State Grid */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                                        <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Action</th>
                                        <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>State Name</th>
                                        <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Code</th>
                                        <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Tax Code</th>
                                        <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Cities</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(selectedCountry.states || []).map(state => (
                                        <tr key={state.id} 
                                            style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', backgroundColor: selectedState?.id === state.id ? '#e0f2fe' : 'transparent', cursor: 'pointer' }}
                                            onClick={() => setSelectedState(state)}
                                        >
                                            <td style={{ padding: '8px' }}>
                                                <button onClick={(e) => { e.stopPropagation(); setStateForm(state); }} style={{ color: 'var(--primary-color-start, #0ea5e9)', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}><Edit2 size={14}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteState(state.id); }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                            </td>
                                            <td style={{ padding: '8px', fontWeight: '500', color: '#334155' }}>{state.stateName}</td>
                                            <td style={{ padding: '8px' }}>{state.stateCode}</td>
                                            <td style={{ padding: '8px' }}>{state.taxCode}</td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <span style={{ backgroundColor: '#3b82f6', color: '#1e40af', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>{(state.cities || []).length}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!selectedCountry.states || selectedCountry.states.length === 0) && (
                                        <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No states configured for this country.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* CITY MANAGEMENT */}
                    <div style={{ flex: 1, backgroundColor: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <MapPin size={16} /> Cities {activeState ? `in ${activeState.stateName}` : ''}
                            </h3>
                        </div>

                        {activeState ? (
                            <div style={{ padding: '16px' }}>
                                {/* City Form */}
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))' }}>CITY NAME *</label>
                                        <input type="text" value={cityForm.cityName} onChange={e => setCityForm({...cityForm, cityName: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }} placeholder="e.g. MUMBAI" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))' }}>UNLOC CODE</label>
                                        <input type="text" value={cityForm.unlocCode} onChange={e => setCityForm({...cityForm, unlocCode: e.target.value.toUpperCase()})} className="input-field" style={{ width: '100%', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px' }} placeholder="e.g. IN BOM" />
                                    </div>
                                    <button onClick={handleSaveCity} style={{ padding: '6px 12px', backgroundColor: 'var(--primary-text, #0284c7)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Save size={14} /> {cityForm.id ? 'UPDATE' : 'ADD'}
                                    </button>
                                    {cityForm.id && <button onClick={() => setCityForm({id: '', cityName: '', unlocCode: ''})} style={{ padding: '6px 12px', backgroundColor: 'var(--border-color, var(--border-color, #cbd5e1))', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>CANCEL</button>}
                                </div>

                                {/* City Grid */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                                            <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>Action</th>
                                            <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>City Name</th>
                                            <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>UNLOC Code</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(activeState.cities || []).map(city => (
                                            <tr key={city.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                                                <td style={{ padding: '8px' }}>
                                                    <button onClick={() => setCityForm(city)} style={{ color: 'var(--primary-color-start, #0ea5e9)', background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}><Edit2 size={14}/></button>
                                                    <button onClick={() => handleDeleteCity(city.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                                </td>
                                                <td style={{ padding: '8px', fontWeight: '500', color: '#334155' }}>{city.cityName}</td>
                                                <td style={{ padding: '8px' }}>{city.unlocCode}</td>
                                            </tr>
                                        ))}
                                        {(!activeState.cities || activeState.cities.length === 0) && (
                                            <tr><td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No cities added for this state yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                <MapPin size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                                Select a state from the left to view and manage its cities.
                            </div>
                        )}
                    </div>
                </div>
            )}

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
