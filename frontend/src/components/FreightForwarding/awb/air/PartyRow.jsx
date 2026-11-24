// Shipper / consignee / notify party row with party-master search
// Split out of CreateAirWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import FieldAutocomplete from '../../../FieldAutocomplete';
import React from 'react';
import ReactDOM from 'react-dom';

const PartyRow = (props) => {
  const { title, hasSelf, hasSameAsCnee, isMandatory, onAddClick, data = {}, onChange, compact, forceOpen, onClose } = props;
  const inputBg = '#ffffff';
  const inputBorder = isMandatory ? '#ef4444' : 'var(--text-muted, var(--text-muted, #64748b))';

    const name = data.name || '';
    const setName = (val) => onChange && onChange({...data, name: val});
    const street = data.street || '';
    const setStreet = (val) => onChange && onChange({...data, street: val});
    const city = data.city || '';
    const setCity = (val) => onChange && onChange({...data, city: val});
    const state = data.state || '';
    const setState = (val) => onChange && onChange({...data, state: val});
    const country = data.country || '';
    const setCountry = (val) => onChange && onChange({...data, country: val});
    const zipCode = data.zip || '';
    const setZipCode = (val) => onChange && onChange({...data, zip: val});
    const phone = data.phone || '';
    const setPhone = (val) => onChange && onChange({...data, phone: val});
    const setAll = (newData) => { pickRef.current = true; return onChange && onChange({...data, ...newData}); };
  const [showDropdown, setShowDropdown] = React.useState(false);
    const [filteredParties, setFilteredParties] = React.useState([]);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const listRef = React.useRef(null);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (showDropdown && listRef.current && focusedIndex >= 0) {
      const activeEl = listRef.current.children[focusedIndex];
      if (activeEl) { activeEl.scrollIntoView({ block: 'nearest' }); }
    }
  }, [focusedIndex, showDropdown]);
  // Position dropdown directly via DOM after every render
  React.useLayoutEffect(() => {
    const updatePosition = () => {
      if (showDropdown && listRef.current && inputRef.current) {

      const rect = inputRef.current.getBoundingClientRect();
      const el = listRef.current;
      el.style.position = 'fixed';
      el.style.top    = (rect.bottom + 2) + 'px';
      el.style.left   = rect.left + 'px';
      el.style.width  = Math.max(rect.width, 380) + 'px';
      el.style.zIndex = '99';
    
      }
    };
    updatePosition();
    if (showDropdown) {
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showDropdown, filteredParties]);

  const handleSameAsCnee = (e) => {
      if (e.target.checked && props.cneeData) {
        setAll({
          name: props.cneeData.name || '',
          street: props.cneeData.street || '',
          city: props.cneeData.city || '',
          state: props.cneeData.state || '',
          country: props.cneeData.country || '',
          zip: props.cneeData.zip || '',
          phone: props.cneeData.phone || ''
        });
      } else {
        setAll({ name:'', street:'', city:'', state:'', country:'', zip:'', phone:'' });
      }
    };


    React.useEffect(() => {
    if (name.length >= 1) {
      let partyType = title.toUpperCase();
        
        fetch(`/api/masters/parties/search?q=${name}&type=${partyType}`)
        .then(res => res.json())
        .then(data => {
            const flat = [];
            if (Array.isArray(data)) {
                data.forEach(party => {
                    if (party.branches && party.branches.length > 0) {
                        party.branches.forEach(b => {
                            flat.push({
                                  ...party,
                                  regNo: b.regNo || '',
                                  ctxType: b.ctxType || '',
                                  gstin: b.gstin || '',
                                  name: party.name,
                                branch: b.branch,
                                address1: b.address1 || '',
                                address2: b.address2 || '',
                                city: b.city || '',
                                state: b.state || '',
                                country: b.country || party.countryCode || 'IN',
                                zip: b.pinCode || '',
                                phone: b.phone || ''
                            });
                        });
                    } else {
                        flat.push({ ...party, ctxType: '', name: party.name, branch: 'DEFAULT', address1: '', address2: '', city: '', state: '', country: party.countryCode || '', zip: '', phone: '' });
                    }
                });
            }
            setFilteredParties(flat);
              setFocusedIndex(-1);
        }).catch(err => {
            console.error(err);
            setFilteredParties([]);
        });
    } else {
        setFilteredParties([]);
    }
  }, [name, title]);
  // 18-Nov-2026 (option B look): a party picked from the master (or copied / loaded) shows as an address card with
  // Edit address / Change party; an optional party stays a one-line bar until it is used. Only the look changed - the
  // same fields, values, handlers and party search are used.
  const [editing, setEditing] = React.useState(() => !name);
  const [opened, setOpened] = React.useState(false);
  const [sameOn, setSameOn] = React.useState(false);
  const typedRef = React.useRef(false);
  const pickRef = React.useRef(false);
  const boxRef = React.useRef(null);
  React.useEffect(() => {
    if (!name) { setEditing(true); typedRef.current = false; pickRef.current = false; return; }
    if (pickRef.current) { pickRef.current = false; typedRef.current = false; setEditing(false); return; }
    if (typedRef.current) return;
    if (boxRef.current && boxRef.current.contains(document.activeElement)) return;
    setEditing(false);
  }, [name, street, city]);
  React.useEffect(() => { if (opened && editing && inputRef.current) inputRef.current.focus(); }, [opened]);
  React.useEffect(() => { if (forceOpen && inputRef.current) inputRef.current.focus(); }, [forceOpen]);
  const accent = 'var(--primary-color-start, #2563eb)';
  const reqEmpty = (v) => !!isMandatory && !String(v || '').trim();
  const fs = (v, extra) => ({ width: '100%', height: '28px', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box', border: `1px solid ${reqEmpty(v) ? '#ef4444' : '#64748b'}`, borderRadius: '4px', backgroundColor: '#ffffff', outline: 'none', textTransform: 'uppercase', color: '#0f172a', fontWeight: 600, ...(extra || {}) });
  const lab = { fontSize: '11px', fontWeight: 600, color: '#64748b' };
  const req = isMandatory ? <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span> : null;
  const linkBtn = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: accent, whiteSpace: 'nowrap' };
  const pill = { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#334155', border: '1px solid #94a3b8', borderRadius: '99px', padding: '2px 9px 2px 6px', cursor: 'pointer', whiteSpace: 'nowrap', background: '#fff' };
  const missing = isMandatory ? [['Street', street], ['City', city], ['State', state], ['Country', country], ['ZIP', zipCode]].filter(([, v]) => !String(v || '').trim()).map(([k]) => k) : [];
  const sameBar = !!hasSameAsCnee && sameOn && !!name && !editing;
  const collapsed = !isMandatory && !name && !opened && !forceOpen;
  const showCard = !!name && !editing && !sameBar;
  const showForm = !collapsed && !showCard && !sameBar;

  // 22-Nov-2026: with "compact" an optional party that is not in use draws nothing; the screen shows a
  // "+ Buyer / + Sub agent ..." line instead and opens the box from there (forceOpen).
  if (compact && collapsed) return null;

  return (
    <div ref={boxRef} style={{ minWidth: 0, alignSelf: (collapsed || sameBar) ? 'start' : 'stretch', display: 'flex', flexDirection: 'column', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(15,23,42,0.08)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px', padding: '8px 12px', borderBottom: (showForm || showCard) ? '1px solid #94a3b8' : 'none', minHeight: '38px', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{title}</span>
        {isMandatory && <span style={{ fontSize: '10px', fontWeight: 600, color: '#dc2626', background: '#fef2f2', borderRadius: '4px', padding: '2px 6px' }}>Required</span>}
        {collapsed && <span style={{ fontSize: '12px', color: '#64748b' }}>Not added</span>}
        {sameBar && <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', minWidth: 0, flex: '1 1 160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>&#10003; Same as consignee <span style={{ color: '#475569', fontWeight: 500 }}>- {name}</span></span>}
        <span style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: '6px 12px' }}>
          {hasSelf && <label style={pill}><input type="checkbox" style={{ cursor: 'pointer', margin: 0, accentColor: accent }} /> Self</label>}
          {hasSameAsCnee && !sameBar && <label style={pill}><input type="checkbox" checked={sameOn} style={{ cursor: 'pointer', margin: 0, accentColor: accent }} onChange={(e) => { setSameOn(e.target.checked); handleSameAsCnee(e); }} /> Same as consignee</label>}
          {sameBar && <button type="button" style={linkBtn} onClick={() => { setSameOn(false); setOpened(true); handleSameAsCnee({ target: { checked: false } }); }}>Use a different {title.toLowerCase()}</button>}
          {collapsed && <button type="button" style={linkBtn} onClick={() => setOpened(true)}>+ Add {title.toLowerCase()}</button>}
          {showForm && !!name && <button type="button" style={linkBtn} onClick={() => setEditing(false)}>Done</button>}
          {compact && showForm && !name && <button type="button" style={linkBtn} title={'Hide ' + title} onClick={() => { setOpened(false); setSameOn(false); if (onClose) onClose(); }}>Close</button>}
          {onAddClick && <button type="button" onClick={onAddClick} title={'Add a new party to the master (' + title + ')'} style={linkBtn}>+ New party</button>}
        </span>
      </div>

      {showCard && (
        <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ border: '1px solid #94a3b8', background: '#f7faff', borderRadius: '6px', padding: '9px 12px', fontSize: '12px', lineHeight: 1.55, overflowWrap: 'anywhere', color: '#0f172a', textTransform: 'uppercase' }}>
            <div style={{ fontWeight: 700, fontSize: '12.5px' }}>{name}</div>
            {street && <div style={{ color: '#475569' }}>{street}</div>}
            {(city || state || zipCode || country) && <div style={{ color: '#475569' }}>{[city, [state, zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}{country ? ' · ' + country : ''}</div>}
            {(phone || data.email) && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>{phone && <span>Phone {phone}</span>}{data.email && <span style={{ textTransform: 'none' }}>{data.email}</span>}</div>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px', marginTop: 'auto', paddingTop: '6px' }}>
            {missing.length > 0 ? <span style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626' }}>Missing: {missing.join(', ')}</span> : null}
            <span style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '4px 14px' }}>
              <button type="button" style={linkBtn} title="Edit the address" onClick={() => setEditing(true)}>Edit</button>
              <button type="button" style={linkBtn} title="Pick another party" onClick={() => { setEditing(true); setTimeout(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, 0); }}>Change</button>
            </span>
          </div>
        </div>
      )}

      <div className="party-row-container" data-title={title} onChangeCapture={() => { typedRef.current = true; }} style={{ padding: '10px 12px', display: showForm ? 'grid' : 'none', gridTemplateColumns: '64px minmax(0, 1fr)', gap: '6px 10px', alignItems: 'center' }}>
        {/* Hidden inputs to make DOM parsing easy for printLogic.js */}
        <input type="hidden" className="party-field-street" value={street} />
        <input type="hidden" className="party-field-city" value={city} />
        <input type="hidden" className="party-field-state" value={state} />
        <input type="hidden" className="party-field-country" value={country} />
        <input type="hidden" className="party-field-zip" value={zipCode} />
        <input type="hidden" className="party-field-phone" value={phone} />

        <label style={lab}>Name{req}</label>
        <div style={{ position: 'relative' }}>
            <input 
              type="text" autoComplete="off" 
              className="premium-input party-field-name"
              ref={inputRef} 
              maxLength={35} 
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowDropdown(e.target.value.length >= 1);
              }}
                onKeyDown={(e) => {
                  if (!showDropdown || filteredParties.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedIndex(prev => (prev < filteredParties.length - 1 ? prev + 1 : prev));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (focusedIndex >= 0 && focusedIndex < filteredParties.length) {
                      const p = filteredParties[focusedIndex];
                      setAll({
                          ...p,
                          name: p.name,
                          street: (p.address1 + ' ' + p.address2).trim(),
                          city: p.city,
                          state: p.state,
                          country: p.country,
                          zip: p.zip,
                          phone: p.phone,
                          email: p.email || ''
                        });
                      setShowDropdown(false);
                      setFocusedIndex(-1);
                    }
                  }
                }}
              onFocus={() => { if(name.length >= 1) setShowDropdown(true); }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              style={fs(name, { fontWeight: 700 })}
            />
            {showDropdown && filteredParties.length > 0 && ReactDOM.createPortal(
              <div ref={listRef} style={{
                position: 'fixed',
                top: 0, left: 0, width: 380,
                zIndex: 99,
                backgroundColor: 'white',
                border: '2px solid #1e3a8a',
                borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                maxHeight: '220px',
                overflowY: 'auto'
              }}>
                {filteredParties.map((p, idx) => (
                  <div key={idx}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #94a3b8', backgroundColor: focusedIndex === idx ? '#e0f2fe' : 'white' }}
                    onMouseDown={() => { setAll({ ...p, name: p.name, street: (p.address1 + ' ' + p.address2).trim(), city: p.city, state: p.state, country: p.country, zip: p.zip, phone: p.phone, email: p.email || '' }); setShowDropdown(false); }}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    onMouseLeave={() => setFocusedIndex(-1)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--text-main, #0f172a)' }}>{p.name}</span>
                      {p.branch && p.branch !== 'DEFAULT' && (
                        <span style={{ fontSize: '9px', backgroundColor: 'transparent', color: 'var(--text-muted, var(--text-muted, #475569))', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>{p.branch}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>
                      {[p.address1, p.address2, p.city, p.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                ))}
              </div>,
              document.body
            )}
        </div>

        <label style={lab}>Street{req}</label>
        <input type="text" autoComplete="off" className="premium-input" maxLength={70} value={street} onChange={e => setStreet(e.target.value)} placeholder="Street address (max 70)" style={fs(street)} />

        <label style={lab}>City{req}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
          <input type="text" autoComplete="off" className="premium-input" maxLength={35} value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={fs(city)} />
          <input type="text" autoComplete="off" className="premium-input" maxLength={35} value={state} onChange={e => setState(e.target.value)} placeholder="State / province" style={fs(state)} />
        </div>

        <label style={lab}>Country{req}</label>
        <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
          <FieldAutocomplete
            listType="country"
            value={country}
            onChange={e => setCountry(e.target.value.toUpperCase())}
            onSelect={opt => setCountry(opt.title)}
            placeholder="CC"
            maxLength={2}
            className="premium-input party-field-country"
            style={fs(country, { textAlign: 'center' })}
          />
          <input type="text" autoComplete="off" className="premium-input" maxLength={9} value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="ZIP / postcode" style={fs(zipCode)} />
          <input type="text" autoComplete="off" className="premium-input" maxLength={25} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" style={fs('x', { fontWeight: 500 })} />
        </div>

        <label style={lab}>Email</label>
        <input type="email" autoComplete="off" className="premium-input" maxLength={70} value={data.email || ''} onChange={e => onChange && onChange({...data, email: e.target.value})} placeholder="email@example.com" style={fs('x', { textTransform: 'none', fontWeight: 500 })} />
      </div>
    </div>
  );

};

export default PartyRow;
