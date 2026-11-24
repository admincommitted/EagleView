import React, { useState, useEffect } from 'react';

const AddPartyModal = ({ isOpen, onClose, title, onSaved, prefillData }) => {
  const [uiModal, setUiModal] = useState({ isOpen: false, title: '', message: '', type: 'success', isComplete: false });
  const [savedData, setSavedData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    accountNumber: '',
    streetAddress: '',
    country: '',
    city: '',
    state: '',
    zipCode: '',
    phoneNumber: '',
    faxNumber: '',
      email: ''
  });


  useEffect(() => {
    if (isOpen && prefillData) {
        let city = prefillData.city || '';
        let state = prefillData.state || '';
        let country = prefillData.country || '';
        let zip = prefillData.zip || '';
        let street = prefillData.address || '';
        
        const countryMap = {
            "AFGHANISTAN": "AF", "ALBANIA": "AL", "ALGERIA": "DZ", "ANDORRA": "AD", "ANGOLA": "AO", "ARGENTINA": "AR", "ARMENIA": "AM", "AUSTRALIA": "AU", "AUSTRIA": "AT", "AZERBAIJAN": "AZ",
            "BAHAMAS": "BS", "BAHRAIN": "BH", "BANGLADESH": "BD", "BARBADOS": "BB", "BELARUS": "BY", "BELGIUM": "BE", "BELIZE": "BZ", "BENIN": "BJ", "BHUTAN": "BT", "BOLIVIA": "BO", "BOSNIA": "BA",
            "BOTSWANA": "BW", "BRAZIL": "BR", "BRUNEI": "BN", "BULGARIA": "BG", "BURKINA FASO": "BF", "BURUNDI": "BI", "CAMBODIA": "KH", "CAMEROON": "CM", "CANADA": "CA", "CHAD": "TD", "CHILE": "CL",
            "CHINA": "CN", "COLOMBIA": "CO", "COMOROS": "KM", "CONGO": "CG", "COSTA RICA": "CR", "CROATIA": "HR", "CUBA": "CU", "CYPRUS": "CY", "CZECHIA": "CZ", "CZECH REPUBLIC": "CZ", "DENMARK": "DK",
            "DJIBOUTI": "DJ", "DOMINICA": "DM", "DOMINICAN REPUBLIC": "DO", "ECUADOR": "EC", "EGYPT": "EG", "EL SALVADOR": "SV", "EQUATORIAL GUINEA": "GQ", "ERITREA": "ER", "ESTONIA": "EE", "ESWATINI": "SZ",
            "ETHIOPIA": "ET", "FIJI": "FJ", "FINLAND": "FI", "FRANCE": "FR", "GABON": "GA", "GAMBIA": "GM", "GEORGIA": "GE", "GERMANY": "DE", "GHANA": "GH", "GREECE": "GR", "GRENADA": "GD", "GUATEMALA": "GT",
            "GUINEA": "GN", "GUYANA": "GY", "HAITI": "HT", "HONDURAS": "HN", "HUNGARY": "HU", "ICELAND": "IS", "INDIA": "IN", "INDONESIA": "ID", "IRAN": "IR", "IRAQ": "IQ", "IRELAND": "IE", "ISRAEL": "IL",
            "ITALY": "IT", "JAMAICA": "JM", "JAPAN": "JP", "JORDAN": "JO", "KAZAKHSTAN": "KZ", "KENYA": "KE", "KIRIBATI": "KI", "KOREA": "KR", "KUWAIT": "KW", "KYRGYZSTAN": "KG", "LAOS": "LA", "LATVIA": "LV",
            "LEBANON": "LB", "LESOTHO": "LS", "LIBERIA": "LR", "LIBYA": "LY", "LIECHTENSTEIN": "LI", "LITHUANIA": "LT", "LUXEMBOURG": "LU", "MADAGASCAR": "MG", "MALAWI": "MW", "MALAYSIA": "MY", "MALDIVES": "MV",
            "MALI": "ML", "MALTA": "MT", "MAURITANIA": "MR", "MAURITIUS": "MU", "MEXICO": "MX", "MOLDOVA": "MD", "MONACO": "MC", "MONGOLIA": "MN", "MONTENEGRO": "ME", "MOROCCO": "MA", "MOZAMBIQUE": "MZ",
            "MYANMAR": "MM", "NAMIBIA": "NA", "NEPAL": "NP", "NETHERLANDS": "NL", "NEW ZEALAND": "NZ", "NICARAGUA": "NI", "NIGER": "NE", "NIGERIA": "NG", "MACEDONIA": "MK", "NORWAY": "NO", "OMAN": "OM",
            "PAKISTAN": "PK", "PALAU": "PW", "PANAMA": "PA", "PARAGUAY": "PY", "PERU": "PE", "PHILIPPINES": "PH", "POLAND": "PL", "PORTUGAL": "PT", "QATAR": "QA", "ROMANIA": "RO", "RUSSIA": "RU", "RWANDA": "RW",
            "SAMOA": "WS", "SAN MARINO": "SM", "SAUDI ARABIA": "SA", "SENEGAL": "SN", "SERBIA": "RS", "SEYCHELLES": "SC", "SIERRA LEONE": "SL", "SINGAPORE": "SG", "SLOVAKIA": "SK", "SLOVENIA": "SI",
            "SOMALIA": "SO", "SOUTH AFRICA": "ZA", "SPAIN": "ES", "SRI LANKA": "LK", "SUDAN": "SD", "SURINAME": "SR", "SWEDEN": "SE", "SWITZERLAND": "CH", "SYRIA": "SY", "TAIWAN": "TW", "TAJIKISTAN": "TJ",
            "TANZANIA": "TZ", "THAILAND": "TH", "TOGO": "TG", "TONGA": "TO", "TRINIDAD": "TT", "TUNISIA": "TN", "TURKEY": "TR", "TURKMENISTAN": "TM", "UGANDA": "UG", "UKRAINE": "UA", "UAE": "AE", "UNITED ARAB EMIRATES": "AE",
            "UK": "GB", "UNITED KINGDOM": "GB", "USA": "US", "UNITED STATES": "US", "URUGUAY": "UY", "UZBEKISTAN": "UZ", "VANUATU": "VU", "VENEZUELA": "VE", "VIETNAM": "VN", "YEMEN": "YE", "ZAMBIA": "ZM", "ZIMBABWE": "ZW",
            "UNITED STATES OF AMERICA": "US"
        };
        if (country && country.length > 2) {
            let upperCountry = country.toUpperCase().trim();
            if (countryMap[upperCountry]) {
                country = countryMap[upperCountry];
            }
        }

        // Fallback: If AI only returned a raw address block, try to split it
        if (street && !city && !state && street.includes(',')) {
            const parts = street.split(',').map(s => s.trim());
            // Usually the last part is Country, second to last is State/Zip, third to last is City
            if (parts.length >= 3) {
                 const possibleCountry = parts.pop();
                 if (possibleCountry.length > 2) country = possibleCountry; // INDIA, etc
                 const possibleStateZip = parts.pop();
                 
                 // extract zip from state if combined (e.g. "UTTARAKHAND 247667")
                 const zipMatch = possibleStateZip.match(/(\d{5,6})/);
                 if (zipMatch) {
                     zip = zipMatch[1];
                     state = possibleStateZip.replace(zip, '').trim();
                 } else {
                     state = possibleStateZip;
                 }
                 
                 city = parts.pop();
                 street = parts.join(', ');
            }
        }
        
        setFormData(prev => ({
            ...prev,
            name: prefillData.name || '',
            streetAddress: street,
            city: city,
            state: state,
            country: country,
            zipCode: zip,
            phoneNumber: prefillData.phone || ''
        }));
    } else if (isOpen) {
        // Reset if open but no prefill
        handleClear();
    }
  }, [isOpen, prefillData]);

  const customAlert = (msg, isComplete = false) => {
    let title = 'INFORMATION';
    let type = 'success';
    if(msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('mandatory')) {
        title = 'ERROR';
        type = 'error';
    } else if (msg.toLowerCase().includes('success')) {
        title = 'SUCCESS';
        type = 'success';
    }
    setUiModal({ isOpen: true, title, message: String(msg ?? ''), type, isComplete });
    if (!isComplete) {
        setTimeout(() => setUiModal({ isOpen: false, title: '', message: '', type: 'success', isComplete: false }), 4000);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value.toUpperCase() });
  };

  const handleClear = () => {
    setFormData({
      name: '', accountNumber: '', streetAddress: '', country: '', city: '', state: '', zipCode: '', phoneNumber: '', faxNumber: '',
      email: ''
    });
  };

  const handleAdd = async () => {
    if (!formData.name || !formData.streetAddress || !formData.country || !formData.city) {
      customAlert("Name, Street Address, Country, and City are mandatory fields.");
      return;
    }

    // Determine party type from title (e.g., 'Add Shipper Details' -> 'SHIPPER')
    let pType = 'SHIPPER';
    const t = title.toUpperCase();
    if (t.includes('CONSIGNEE')) pType = 'CONSIGNEE';
    else if (t.includes('BUYER')) pType = 'BUYER';
    else if (t.includes('NOTIFY 1')) pType = 'NOTIFY 1';
    else if (t.includes('NOTIFY 2')) pType = 'NOTIFY 2';
    else if (t.includes('OVERSEAS')) pType = 'OVERSEAS AGENT';

    // Map to the Unified Party Master JSON structure
    const payload = {
      name: formData.name,
      partyType: pType,
        isShipper: pType === 'SHIPPER',
        isConsignee: pType === 'CONSIGNEE',
        isNotifyParty: pType.includes('NOTIFY'),
        isBuyer: pType === 'BUYER',
        isOverseasAgent: pType === 'OVERSEAS AGENT',
      street: (formData.streetAddress || '').substring(0, 70),
      city: (formData.city || '').substring(0, 17),
      stateProvince: formData.state || '',
      zipPostcode: (formData.zipCode || '').substring(0, 9),
      phoneNumber: formData.phoneNumber || ' ',
        email: formData.email || '',
      countryCode: formData.country,
      currencyCode: 'INR',
      salesRep: 'ADMIN',
      status: 'Active',
      isCustomer: true,
      branches: [
        {
          branch: 'HEAD OFFICE',
          defaultAddress: true,
          contactPerson: formData.name,
          address1: (formData.streetAddress || '').substring(0, 35),
            address2: (formData.streetAddress || '').length > 35 ? formData.streetAddress.substring(35, 70) : '',
          city: formData.city,
          state: formData.state,
          country: formData.country,
          pinCode: formData.zipCode,
          phone: formData.phoneNumber,
            email: formData.email
        }
      ]
    };

    try {
      const res = await fetch('/api/masters/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        customAlert("Party saved successfully to the Unified Party Master!");
        handleClear();
        if (onSaved) onSaved(data);
        onClose();
      } else {
        customAlert("Validation Error: " + (data.message || data.error || "Unknown error"));
      }
    } catch (err) {
      customAlert("Network Error");
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 20000000, backdropFilter: 'blur(2px)' }}>
      <div className="glass-panel" style={{ position: 'relative', width: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, border: '1px solid var(--border-highlight)', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Header */}
        <div style={{ backgroundColor: 'var(--primary-color)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', padding: '4px', fontSize: '14px' }}>&#10005;</button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
          
          {/* Name Details */}
          <div style={{ backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '4px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ color: 'var(--primary-color)', fontWeight: '700', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase' }}>Name Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input name="name" value={formData.name} onChange={handleChange} type="text" className="input-field" maxLength={35} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Account Number</label>
                <input name="accountNumber" value={formData.accountNumber} onChange={handleChange} type="text" className="input-field" maxLength={15} style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Address Details */}
          <div style={{ backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '4px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ color: 'var(--primary-color)', fontWeight: '700', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase' }}>Address Details</div>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Street Address <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea name="streetAddress" value={formData.streetAddress} onChange={handleChange} className="input-field" maxLength={70} rows={2} style={{ width: '100%', resize: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Country <span style={{ color: '#ef4444' }}>*</span></label>
                <input name="country" value={formData.country} onChange={handleChange} type="text" className="input-field" maxLength={2} style={{ width: '100%' }} placeholder="e.g. IN" />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>City <span style={{ color: '#ef4444' }}>*</span></label>
                <input name="city" value={formData.city} onChange={handleChange} type="text" className="input-field" maxLength={17} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>State</label>
                <input name="state" value={formData.state} onChange={handleChange} type="text" className="input-field" maxLength={9} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Zip / Postal</label>
                <input name="zipCode" value={formData.zipCode} onChange={handleChange} type="text" className="input-field" maxLength={9} style={{ width: '100%' }} />
              </div>
              <div style={{ fontSize: '10px', color: 'var(--primary-text, #0369a1)', fontStyle: 'italic', background: '#e0f2fe', padding: '6px 8px', borderRadius: '4px', border: '1px solid #000000' }}>
                Note: State & Zip are mandatory for local Customs in several regions.
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div style={{ backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '4px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ color: 'var(--primary-color)', fontWeight: '700', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase' }}>Contact Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Phone Number</label>
                <input name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} type="text" className="input-field" maxLength={25} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Fax Number</label>
                <input name="faxNumber" value={formData.faxNumber} onChange={handleChange} type="text" className="input-field" maxLength={25} style={{ width: '100%' }} />
              </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Email</label>
                  <input name="email" value={formData.email} onChange={handleChange} type="email" className="input-field" maxLength={100} style={{ width: '100%' }} />
                </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={handleClear} style={{ padding: '6px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>CLEAR</button>
          <button onClick={handleAdd} style={{ padding: '6px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', boxShadow: '0 1px 2px rgba(16,185,129,0.2)' }}>SAVE TO MASTER</button>
        </div>
        {uiModal.isOpen && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1.5rem', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{uiModal.type === 'error' ? '?' : '?'}</div>
              <h3 style={{ color: uiModal.type === 'error' ? '#ef4444' : '#10b981', margin: '0 0 1rem 0' }}>{uiModal.title}</h3>
              <p style={{ margin: '0 0 1.5rem 0', color: '#334155', fontWeight: 600, fontSize: '12px' }}>{uiModal.message}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddPartyModal;


