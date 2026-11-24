// State and logic
// Split out of PartyMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useState } from 'react';
import { planDgft, applyDgft, dgftMerc, mercView } from './dgftMatch';

export default function usePartyMasterForm(ctx) {
  const [uiModal, setUiModal] = React.useState({ isOpen: false, title: '', message: '', type: 'success' });
  const customAlert = (msg) => {
      let title = 'INFORMATION';
      let type = 'success';
      if(msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('mandatory') || msg.toLowerCase().includes('error')) {
          title = 'VALIDATION ERROR';
          type = 'error';
      } else if (msg.toLowerCase().includes('success')) {
          title = 'SUCCESS';
          type = 'success';
      }
      setUiModal({ isOpen: true, title, message: String(msg ?? ''), type });
  };
  const [partiesList, setPartiesList] = React.useState([]);
    const [globalLocations, setGlobalLocations] = React.useState([]);

  React.useEffect(() => {
      
        fetch('/api/locations/lite?_t=' + Date.now())
            .then(res => res.json())
            .then(data => setGlobalLocations(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));

        fetch('/api/masters/parties?_t=' + Date.now())
          .then(res => res.json())
          .then(data => {
              console.log('FETCHED PARTIES FROM API:', data);
                if (Array.isArray(data) && data.length > 0) {
                  const mappedData = data.map(d => ({
                      ...d,
                      addresses: d.branches ? d.branches.map((b, index) => ({ ...b, branchSrNo: b.branchSrNo || (index + 1).toString(), branch: b.branchName || b.branch, country: b.country || d.countryCode, zip: b.pinCode || b.zip, pinCode: b.pinCode || b.zip || '', email: b.email1 || b.email || '', default: b.isDefault !== undefined ? !!b.isDefault : !!b.default, gstin: b.regNo || b.gstin || '' })) : []
                  }));
                  setPartiesList(mappedData);
              }
          })
          .catch(err => console.error("Error fetching parties:", err));
  }, []);

  const [showKycVault, setShowKycVault] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, type: '', payload: null });
  const [selectedParty, setSelectedParty] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [addressFormData, setAddressFormData] = useState({});
  const [adCodeFormData, setAdCodeFormData] = useState({
      portCode: '', adCode: '', bankName: '', branchName: '', serialNo: '', forexCode: '', bankAddress: ''
  });
  const [drawbackFormData, setDrawbackFormData] = useState({
      adCode: '', bankName: '', ifscCode: '', accountNo: '', bankAddress: ''
  });

  const emptyFormData = {
    name: '', panNumber: '', taxId: '', address: '', city: '', state: '', country: '', zip: '',
    mobile: '', email: '',
    isShipper: false, isConsignee: false, isNotifyParty: false, isBuyer: false, isSubAgent: false, isOverseasAgent: false, isShipline: false, isIataAgent: false, isBank: false,
    kycApproved: false, extendedName: '', mercManuf: 'Manufacturer', rbiNumber: '',
    marketingPerson1: '', marketingPerson2: '', marketingPerson3: '',
    sezWarehouseCode: '', iecNoReqd: true, classType: 'Private', paymentDeferred: false,
    blackList: false, insuranceRate: '', remarks: '',
    aiImportRules: '', aiExportRules: ''
  };
  const [formData, setFormData] = useState(emptyFormData);
  const handleFormChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  React.useEffect(() => {
    if (selectedParty) {
      setFormData({
        name: selectedParty.name || '',
        panNumber: selectedParty.panNumber || '',
        taxId: selectedParty.taxId || '',
        address: selectedParty.address || selectedParty.addresses?.[0]?.street || '',
        city: selectedParty.city || selectedParty.addresses?.[0]?.city || '',
        state: selectedParty.state || selectedParty.addresses?.[0]?.state || '',
        country: selectedParty.country || selectedParty.countryCode || selectedParty.addresses?.[0]?.country || '',
        zip: selectedParty.zip || selectedParty.pinCode || selectedParty.addresses?.[0]?.zip || '',
        mobile: selectedParty.mobile || selectedParty.phone || '',
        email: selectedParty.email || '',
        isShipper: !!selectedParty.isShipper,
        isConsignee: !!selectedParty.isConsignee,
        isNotifyParty: !!selectedParty.isNotifyParty,
        isBuyer: !!selectedParty.isBuyer,
        isSubAgent: !!selectedParty.isSubAgent,
        isOverseasAgent: !!selectedParty.isOverseasAgent,
        isShipline: !!selectedParty.isShipline,
        isIataAgent: !!selectedParty.isIataAgent,
        isBank: !!selectedParty.isBank,
        kycApproved: !!selectedParty.kycApproved,
        extendedName: selectedParty.extendedName || '',
        mercManuf: selectedParty.mercManuf || 'Manufacturer',
        rbiNumber: selectedParty.rbiNumber || '',
        marketingPerson1: selectedParty.marketingPerson1 || '',
        marketingPerson2: selectedParty.marketingPerson2 || '',
        marketingPerson3: selectedParty.marketingPerson3 || '',
        sezWarehouseCode: selectedParty.sezWarehouseCode || '',
        iecNoReqd: selectedParty.iecNoReqd !== false,
        classType: selectedParty.classType || 'Private',
        paymentDeferred: !!selectedParty.paymentDeferred,
        blackList: !!selectedParty.blackList,
        insuranceRate: selectedParty.insuranceRate || '',
        remarks: selectedParty.remarks || '',
        aiImportRules: selectedParty.aiImportRules || '',
        aiExportRules: selectedParty.aiExportRules || ''
      });
    } else {
      setFormData(emptyFormData);
    }
  }, [selectedParty]);

  const handleConfirmDelete = () => {
      if (deleteConfirm.type === 'PARTY') {
          fetch(`/api/masters/parties/${deleteConfirm.payload}`, { method: 'DELETE' })
          .then(res => res.json())
          .then(data => {
              if (data.success || data.message) {
                  customAlert("PARTY DELETED SUCCESSFULLY");
                  setPartiesList(prev => prev.filter(p => p.id !== deleteConfirm.payload));
                  setSelectedParty(null);
              } else {
                  customAlert("FAILED TO DELETE: " + (data.error || "Unknown Error"));
              }
          })
          .catch(err => customAlert("NETWORK ERROR DURING DELETE"));
      } else if (deleteConfirm.type === 'ADDRESS') {
          const newAddresses = [...(selectedParty.addresses || [])];
          newAddresses.splice(deleteConfirm.payload, 1);
          setSelectedParty({ ...selectedParty, ...formData, addresses: newAddresses });
      }
      setDeleteConfirm({ isOpen: false, type: '', payload: null });
  };

  // 04-Nov-2026: type filter (Exporter ... Bank BRO); the list shows at most 500 rows (the master has ~30,000 parties from iCAFFE)
  const [typeFilter, setTypeFilter] = useState('');
  const TYPE_FLAG = { EXPORTER: 'isShipper', CONSIGNEE: 'isConsignee', SUBAGENT: 'isSubAgent', OVERSEAS_AGENT: 'isOverseasAgent', SHIPLINE: 'isShipline', BANK: 'isBank' };
  const matchedParties = partiesList.filter(p => {
    if (typeFilter && !p[TYPE_FLAG[typeFilter]]) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    // Search across all string/number fields of the party (Name, IEC, PAN, GST, City, Address, etc.)
    return Object.values(p).some(val => 
      val && String(val).toLowerCase().includes(term)
    );
  });
  const filteredParties = matchedParties.slice(0, 500);
  const matchedCount = matchedParties.length;

  // 08-Nov-2026: the iCAFFE party directory (1.25 lakh consignees / suppliers and the rest) is searched as well; a name picked
  // from it is copied into the Party master (with its addresses) and opened
  const DIR_TYPE = { EXPORTER: 'EXPORTER', CONSIGNEE: 'CONSIGNEE', SUBAGENT: 'SUBAGENT', OVERSEAS_AGENT: 'OVERSEAS_AGENT', SHIPLINE: 'SHIPLINE', BANK: 'BANK' };
  const [dirList, setDirList] = useState([]); const [dirBusy, setDirBusy] = useState(false);
  React.useEffect(() => {
    const term = String(searchTerm || '').trim();
    if (term.length < 2 && typeFilter !== 'CONSIGNEE') { setDirList([]); return; }
    const tm = setTimeout(() => {
      // 08-Nov-2026: all iCAFFE parties are now in the Party Master; the consignees not yet used are not in the list loaded
      // above (searchOnly) and are found here
      fetch('/api/masters/parties/find?limit=100&q=' + encodeURIComponent(term) + (typeFilter ? '&type=' + (DIR_TYPE[typeFilter] || '') : ''))
        .then(r => r.json()).then(rows => setDirList((Array.isArray(rows) ? rows : []).filter(r => r.searchOnly))).catch(() => setDirList([]));
    }, 300);
    return () => clearTimeout(tm);
  }, [searchTerm, typeFilter]);
  const mapParty = (d) => ({ ...d, addresses: d.branches ? d.branches.map((b, index) => ({ ...b, branchSrNo: b.branchSrNo || (index + 1).toString(), branch: b.branchName || b.branch, country: b.country || d.countryCode, zip: b.pinCode || b.zip, pinCode: b.pinCode || b.zip || '', email: b.email1 || b.email || '', default: b.isDefault !== undefined ? !!b.isDefault : !!b.default, gstin: b.regNo || b.gstin || '' })) : [] });
  const importDir = async (row) => {
    if (dirBusy) return; setDirBusy(true);
    try {
      const r = await fetch('/api/masters/parties/' + row.id + '/activate', { method: 'POST' }).then(x => x.json());
      if (!r || !r.id) throw new Error((r && r.error) || 'not found');
      const p = mapParty(r);
      setPartiesList(l => (l.some(x => x.id === p.id) ? l : [p, ...l])); setSelectedParty(p);
      setDirList(l => l.filter(x => x.id !== row.id));
    } catch (e) { alert('Could not open ' + row.name + ': ' + e.message); }
    setDirBusy(false);
  };

  const tabStyle = (isActive) => ({
    padding: '0.65rem 1.25rem',
    background: isActive ? '#f0f9ff' : 'transparent',
    color: isActive ? 'var(--primary-text, #0369a1)' : 'var(--text-muted)',
    borderBottom: isActive ? '2px solid #0369a1' : '2px solid transparent',
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center'
  });

  
  const handleFetchIecFromUlip = async (e) => {
      e.preventDefault();
      if (!formData.taxId) return customAlert("Please enter an IEC Number first.");
      try {
          // Fallback UI indication since we might not have toast
          const btn = e.currentTarget;
          const oldText = btn.innerHTML;
          btn.innerHTML = "Fetching...";
          btn.disabled = true;

          const res = await fetch('/api/ulip/dgft/iec', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ iec: formData.taxId })
          });
          const data = await res.json();
          
          btn.innerHTML = oldText;
          btn.disabled = false;

          if (data.success && data.data) {
              const dgft = data.data;
              setFormData(prev => ({
                  ...prev,
                  name: dgft.entityName || prev.name,
                  panNumber: dgft.pan && !dgft.pan.includes('*') ? dgft.pan : prev.panNumber, // DGFT often returns masked PAN
                  address: dgft.address1 || prev.address,
                  city: dgft.city || prev.city,
                  state: dgft.state || prev.state,
                  zip: dgft.pinCode ? String(dgft.pinCode) : prev.zip,
              }));
              customAlert(`Successfully fetched IEC data for ${dgft.entityName}`);
          } else {
              customAlert(data.error || "Failed to fetch IEC details.");
          }
      } catch (err) {
          console.error(err);
          customAlert("Network error calling ULIP API.");
      }
  };
  // 13-Nov-2026: Fetch from DGFT - the DGFT captcha is shown in a window here; the branches DGFT lists can be added to this party
  const [dgftOpen, setDgftOpen] = useState(false);
  const openDgft = (e) => {
      if (e) e.preventDefault();
      const iec = String(formData.taxId || '').trim().toUpperCase();
      if (!iec) return customAlert("Please enter an IEC Number first.");
      if (!/^[A-Z0-9]{10}$/.test(iec)) return customAlert("IEC Number must be 10 characters - error");
      if (String(formData.name || '').trim().length < 3) return customAlert("Enter the party name first (DGFT needs at least its first 3 letters).");
      setDgftOpen(true);
  };
  const addDgftBranches = (list, result, opt) => {
      const nm = opt && opt.name ? String(opt.name).trim().toUpperCase().slice(0, 50) : ''; // 14-Nov-2026: DGFT name when the window's box is ticked
      const m0 = dgftMerc(result && result.details && result.details['Category of Exporters']); // 14-Nov-2026: [R]Merc / [F]Manuf from DGFT
      const merc = m0 && m0 !== mercView(formData.mercManuf) ? m0 : '';
      // 13-Nov-2026: DGFT branch code = Sr No (no code = 0); a DGFT branch that matches an address here updates it (see dgftMatch.js)
      const current = (selectedParty && selectedParty.addresses) || [];
      const { next, updated, added, skipped } = applyDgft(planDgft(list, current), current);
      if (!updated && !added) {
          if (merc || nm) setFormData(prev => ({ ...prev, ...(merc ? { mercManuf: merc } : {}), ...(nm ? { name: nm } : {}) }));
          return customAlert((skipped.length ? `Sr No ${skipped.join(', ')} already used by other addresses in this party. No branch changed.` : "No branch to add or update.") + (merc ? ` [R]Merc / [F]Manuf set to ${merc}.` : '') + (nm ? ` Party name changed to ${nm}.` : '') + ((merc || nm) ? ' Save the party.' : ''));
      }
      const all = [...next];
      if (!all.some(a => a.default)) { const i = Math.max(0, all.findIndex(a => String(a.branchSrNo) === '0')); all[i] = { ...all[i], default: true, isDefault: true }; }
      setSelectedParty(prev => ({ ...(prev || {}), ...formData, ...(merc ? { mercManuf: merc } : {}), ...(nm ? { name: nm } : {}), addresses: all }));
      setDgftOpen(false);
      const noGst = all.filter(a => a.ctxType === 'GSTIN' && !a.regNo).length;
      const longAddr = (list || []).filter(b => b.overflow).map(b => { const c = String(b.branchCode || '').trim(); return /^\d+$/.test(c) ? String(parseInt(c, 10)) : (c || '0'); });
      customAlert(`DGFT: ${updated} branch${updated === 1 ? '' : 'es'} updated, ${added} added.` + (skipped.length ? ` Sr No ${skipped.join(', ')} skipped (already used here).` : '') + (merc ? ` [R]Merc / [F]Manuf set to ${merc}.` : '') + (nm ? ` Party name changed to ${nm}.` : '') + (noGst ? ` Type the GSTIN in ${noGst} of them,` : '') + (longAddr.length ? ` Address of Sr ${longAddr.join(', ')} is longer than ICEGATE's 35 + 35 - shorten it,` : '') + ' then save the party.');
  };
  const applyDgftName = (n) => { if (n) setFormData(prev => ({ ...prev, name: String(n).trim().toUpperCase().slice(0, 50) })); }; // ICEGATE name 50
  const fillPartyFromDgft = (r, opt) => {
      const nm = opt && opt.name ? String(opt.name).trim().toUpperCase().slice(0, 50) : '';
      const d = (r && r.details) || {}; const fa = (r && r.firmAddress) || {};
      const filled = [];
      setFormData(prev => {
          const n = { ...prev };
          const put = (k, v) => { if (v && !String(prev[k] || '').trim()) { n[k] = String(v).toUpperCase(); filled.push(k); } };
          put('name', d['Firm Name']);
          if (d['PAN Number'] && !/[X*]/i.test(d['PAN Number'].slice(3, 9))) put('panNumber', d['PAN Number']);
          put('address', fa.address1 ? [fa.address1, fa.address2].filter(Boolean).join(', ') : d.Address);
          put('city', fa.city); put('state', fa.state); put('zip', fa.pinCode);
          if (nm && nm !== prev.name) { n.name = nm; filled.push('name'); }
          const m = dgftMerc(d['Category of Exporters']); if (m && m !== mercView(prev.mercManuf)) { n.mercManuf = m; filled.push('mercManuf'); }
          return n;
      });
      setTimeout(() => { const m = filled.includes('mercManuf'); const other = filled.filter(k => k !== 'mercManuf' && k !== 'name').length; customAlert((other ? "Empty party fields were filled from DGFT. Existing values were kept." : "No empty party fields to fill. Existing values were kept.") + (m ? ` [R]Merc / [F]Manuf set to ${dgftMerc(d['Category of Exporters'])}.` : '') + (filled.includes('name') ? ` Party name changed to ${nm}.` : '') + " Save the party to keep it."); }, 0);
  };
  return { dirList, dirBusy, importDir, activeTab, adCodeFormData, addressFormData, customAlert, deleteConfirm, drawbackFormData, emptyFormData, filteredParties, formData, globalLocations, handleConfirmDelete, handleFetchIecFromUlip, dgftOpen, setDgftOpen, openDgft, addDgftBranches, fillPartyFromDgft, applyDgftName, handleFormChange, matchedCount, partiesList, searchTerm, setTypeFilter, typeFilter, selectedParty, setActiveTab, setAdCodeFormData, setAddressFormData, setDeleteConfirm, setDrawbackFormData, setFormData, setGlobalLocations, setPartiesList, setSearchTerm, setSelectedParty, setShowKycVault, setUiModal, showKycVault, tabStyle, uiModal };
}
