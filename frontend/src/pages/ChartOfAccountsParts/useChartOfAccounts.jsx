// State and logic
// Split out of ChartOfAccounts.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { ChevronDown, ChevronRight, Edit2, FileText, Folder, FolderOpen, Target, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

export default function useChartOfAccounts(ctx) {
  const [activeTab, setActiveTab] = useState(() => { try { return new URLSearchParams(window.location.search).get('tab') || 'groups'; } catch (e) { return 'groups'; } }); // ?tab=ledgers|tds from Accounts home
    const [searchQuery, setSearchQuery] = useState('');
    
    const [treeData, setTreeData] = useState([]);
    const [flatGroups, setFlatGroups] = useState([]);
    const [expandedKeys, setExpandedKeys] = useState(new Set());
    
    const [masterData, setMasterData] = useState({
        voucherTypes: [],
        costCategories: [],
        costCentresTree: [],
        costCentresFlat: [],
        currencies: [],
        tdsNatures: []
    });

    const [showForm, setShowForm] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [ledgerFormTab, setLedgerFormTab] = useState('general');
    
    // Forms
    const [groupForm, setGroupForm] = useState({ name: '', parentId: '', nature: 'Assets' });
    const [ledgerForm, setLedgerForm] = useState({ 
        name: '', groupId: '', openingBalance: 0, balanceType: 'Dr',
        maintainBillByBill: false, costCentresApplicable: false,
        address: '', state: '', pinCode: '', country: '', contactPerson: '', email: '', phone: '',
        gstin: '', pan: '', isGstApplicable: false, hsnSac: '', taxability: 'Taxable', gstRate: 0,
        isTdsApplicable: false, tdsNatureId: '', isTdsDeductible: false, deducteeType: 'Company',
        bankAccount: '', bankIfsc: '', bankName: '', creditLimit: 0, creditDays: 0
    });
    const [voucherForm, setVoucherForm] = useState({ name: '', baseType: 'Journal', numberingMethod: 'Automatic', prefix: '', suffix: '', startingNumber: 1 });
    const [categoryForm, setCategoryForm] = useState({ name: '', allocateRevenue: true, allocateNonRevenue: false });
    const [centreForm, setCentreForm] = useState({ name: '', categoryId: '', parentId: '' });
    const [currencyForm, setCurrencyForm] = useState({ symbol: '', formalName: '', decimalPlaces: 2, standardRate: 1.0000 });
    const [tdsForm, setTdsForm] = useState({ name: '', section: '', rate: 0, rateWithoutPan: 20, exemptionLimit: 0 });

    useEffect(() => {
        fetchAccounts();
        fetchMasters();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await axios.get('/api/accounts/tree');
            if (res.data.success) {
                setTreeData(res.data.data);
                const flatted = [];
                const extractGroups = (nodes, level = 0) => {
                    nodes.forEach(n => {
                        if (n.type === 'group') {
                            flatted.push({ ...n, level });
                            extractGroups(n.children || [], level + 1);
                        }
                    });
                };
                extractGroups(res.data.data);
                setFlatGroups(flatted);
                
                const initialExpanded = new Set();
                res.data.data.forEach(n => initialExpanded.add(n.id));
                setExpandedKeys(initialExpanded);
            }
        } catch (e) { console.error(e); }
    };

    const fetchMasters = async () => {
        try {
            const res = await axios.get('/api/accounting-masters/all');
            if (res.data.success) {
                setMasterData({
                    voucherTypes: res.data.data.voucherTypes || [],
                    costCategories: res.data.data.costCategories || [],
                    costCentresTree: res.data.data.costCentresTree || [],
                    costCentresFlat: res.data.data.costCentresFlat || [],
                    currencies: res.data.data.currencies || [],
                    tdsNatures: res.data.data.tdsNatures || []
                });
            }
        } catch (e) { console.error(e); }
    };

    const toggleExpand = (id, e) => {
        if(e) e.stopPropagation();
        const next = new Set(expandedKeys);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedKeys(next);
    };

    const resetForms = () => {
        setGroupForm({ name: '', parentId: '', nature: 'Assets' });
        setLedgerForm({ 
            name: '', groupId: '', openingBalance: 0, balanceType: 'Dr',
            maintainBillByBill: false, costCentresApplicable: false,
            address: '', state: '', pinCode: '', country: '', contactPerson: '', email: '', phone: '',
            gstin: '', pan: '', isGstApplicable: false, hsnSac: '', taxability: 'Taxable', gstRate: 0,
            isTdsApplicable: false, tdsNatureId: '', isTdsDeductible: false, deducteeType: 'Company',
            bankAccount: '', bankIfsc: '', bankName: '', creditLimit: 0, creditDays: 0
        });
        setVoucherForm({ name: '', baseType: 'Journal', numberingMethod: 'Automatic', prefix: '', suffix: '', startingNumber: 1 });
        setCategoryForm({ name: '', allocateRevenue: true, allocateNonRevenue: false });
        setCentreForm({ name: '', categoryId: '', parentId: '' });
        setCurrencyForm({ symbol: '', formalName: '', decimalPlaces: 2, standardRate: 1.0000 });
        setTdsForm({ name: '', section: '', rate: 0, rateWithoutPan: 20, exemptionLimit: 0 });
        setEditMode(false);
        setEditId(null);
        setLedgerFormTab('general');
    };

    const handleCreateNew = () => {
        resetForms();
        setShowForm(true);
    };

    const handleEdit = (type, item, e) => {
        if(e) e.stopPropagation();
        if(item.isBuiltIn) { alert("Cannot edit built-in system masters."); return; }
        
        resetForms();
        setEditMode(true);
        setEditId(item.id);
        
        if(type === 'group') setGroupForm({ name: item.name, parentId: item.parentId || '', nature: item.nature });
        if(type === 'ledger') setLedgerForm({ 
            name: item.name, groupId: item.groupId || '', openingBalance: item.openingBalance || 0, balanceType: item.balanceType || 'Dr', 
            maintainBillByBill: item.maintainBillByBill || false, costCentresApplicable: item.costCentresApplicable || false,
            address: item.address || '', state: item.state || '', pinCode: item.pinCode || '', country: item.country || '', 
            contactPerson: item.contactPerson || '', email: item.email || '', phone: item.phone || '',
            gstin: item.gstin || '', pan: item.pan || '', isGstApplicable: item.isGstApplicable || false, hsnSac: item.hsnSac || '', taxability: item.taxability || 'Taxable', gstRate: item.gstRate || 0,
            isTdsApplicable: item.isTdsApplicable || false, tdsNatureId: item.tdsNatureId || '', isTdsDeductible: item.isTdsDeductible || false, deducteeType: item.deducteeType || 'Company',
            bankAccount: item.bankAccount || '', bankIfsc: item.bankIfsc || '', bankName: item.bankName || '', creditLimit: item.creditLimit || 0, creditDays: item.creditDays || 0 
        });
        if(type === 'voucher') setVoucherForm({ name: item.name, baseType: item.baseType, numberingMethod: item.numberingMethod, prefix: item.prefix||'', suffix: item.suffix||'', startingNumber: item.startingNumber||1 });
        if(type === 'category') setCategoryForm({ name: item.name, allocateRevenue: item.allocateRevenue, allocateNonRevenue: item.allocateNonRevenue });
        if(type === 'centre') setCentreForm({ name: item.name, categoryId: item.categoryId || '', parentId: item.parentId || '' });
        if(type === 'currency') setCurrencyForm({ symbol: item.symbol, formalName: item.formalName, decimalPlaces: item.decimalPlaces, standardRate: item.standardRate });
        if(type === 'tds') setTdsForm({ name: item.name, section: item.section, rate: item.rate, rateWithoutPan: item.rateWithoutPan, exemptionLimit: item.exemptionLimit });
        
        setShowForm(true);
    };

    const handleDelete = async (type, item, e) => {
        if(e) e.stopPropagation();
        if(item.isBuiltIn) { alert("Cannot delete built-in system masters."); return; }
        if(!window.confirm(`Are you sure you want to delete ${item.name || item.symbol}?`)) return;

        try {
            let endpoint = '';
            if(type === 'group') endpoint = `/api/accounts/groups/${item.id}`;
            if(type === 'ledger') endpoint = `/api/accounts/ledgers/${item.id}`;
            if(type === 'voucher') endpoint = `/api/accounting-masters/vouchertypes/${item.id}`;
            if(type === 'category') endpoint = `/api/accounting-masters/categories/${item.id}`;
            if(type === 'centre') endpoint = `/api/accounting-masters/centres/${item.id}`;
            if(type === 'currency') endpoint = `/api/accounting-masters/currencies/${item.id}`;
            if(type === 'tds') endpoint = `/api/accounting-masters/tds-natures/${item.id}`;

            await axios.delete(endpoint);
            
            if(type === 'group' || type === 'ledger') fetchAccounts();
            else fetchMasters();
        } catch(err) {
            alert(err.response?.data?.error || "Error deleting item");
        }
    };

    const handleSave = async () => {
        try {
            const method = editMode ? 'put' : 'post';
            const suffix = editMode ? `/${editId}` : '';
            
            if (activeTab === 'groups') {
                const payload = { ...groupForm };
                if (!payload.parentId) payload.parentId = null;
                await axios[method](`/api/accounts/groups${suffix}`, payload);
                fetchAccounts();
            } else if (activeTab === 'ledgers') {
                const payload = { ...ledgerForm };
                if (!payload.groupId) payload.groupId = null;
                if (!payload.tdsNatureId) payload.tdsNatureId = null;
                await axios[method](`/api/accounts/ledgers${suffix}`, payload);
                fetchAccounts();
            } else if (activeTab === 'vouchers') {
                await axios[method](`/api/accounting-masters/vouchertypes${suffix}`, voucherForm);
                fetchMasters();
            } else if (activeTab === 'categories') {
                await axios[method](`/api/accounting-masters/categories${suffix}`, categoryForm);
                fetchMasters();
            } else if (activeTab === 'centres') {
                const payload = { ...centreForm };
                if (!payload.parentId) payload.parentId = null;
                if (!payload.categoryId) payload.categoryId = null;
                await axios[method](`/api/accounting-masters/centres${suffix}`, payload);
                fetchMasters();
            } else if (activeTab === 'currencies') {
                await axios[method](`/api/accounting-masters/currencies${suffix}`, currencyForm);
                fetchMasters();
            } else if (activeTab === 'tds') {
                await axios[method](`/api/accounting-masters/tds-natures${suffix}`, tdsForm);
                fetchMasters();
            }
            setShowForm(false);
        } catch(e) {
            alert(e.response?.data?.error || 'Error saving record');
        }
    };

    const renderActionButtons = (type, node) => {
        if(node.isBuiltIn) return null;
        return (
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', paddingLeft: '16px' }} className="action-buttons">
                <button onClick={(e) => handleEdit(type, node, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b', display: 'flex', alignItems: 'center' }} title="Edit"><Edit2 size={14}/></button>
                <button onClick={(e) => handleDelete(type, node, e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#ef4444', display: 'flex', alignItems: 'center' }} title="Delete"><Trash2 size={14}/></button>
            </div>
        );
    };

    const filterTree = (nodes, query) => {
        if (!query) return nodes;
        const lowerQ = query.toLowerCase();
        const filtered = [];
        for (const n of nodes) {
            let match = n.name.toLowerCase().includes(lowerQ);
            let children = [];
            if (n.children) {
                children = filterTree(n.children, query);
                if (children.length > 0) match = true;
            }
            if (match) filtered.push({ ...n, children });
        }
        return filtered;
    };

    const filteredTreeData = useMemo(() => filterTree(treeData, searchQuery), [treeData, searchQuery]);
    const filteredCentres = useMemo(() => filterTree(masterData.costCentresTree, searchQuery), [masterData.costCentresTree, searchQuery]);
    
    const renderAccountTree = (node, level = 0) => {
        const isGroup = node.type === 'group';
        const isExpanded = searchQuery ? true : expandedKeys.has(node.id);
        if (activeTab === 'groups' && !isGroup) return null;

        return (
            <div key={node.type + node.id} style={{ position: 'relative' }}>
                <div 
                    className="tree-row"
                    style={{ 
                        display: 'flex', alignItems: 'center', padding: '6px 8px', 
                        borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s',
                        position: 'relative', zIndex: 1
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                    {level > 0 && (
                        <div style={{ position: 'absolute', left: '-20px', top: '50%', width: '20px', borderTop: '1px dashed #94a3b8', zIndex: -1 }} />
                    )}
                    {isGroup ? (
                        <div onClick={(e) => toggleExpand(node.id, e)} style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '4px' }}>
                            {isExpanded ? <ChevronDown size={14} color="#64748b"/> : <ChevronRight size={14} color="#64748b"/>}
                        </div>
                    ) : <div style={{ width: '20px', marginRight: '4px' }} />}
                    
                    {isGroup ? (
                        isExpanded ? <FolderOpen size={16} style={{marginRight:'8px', color:'#f59e0b'}}/> : <Folder size={16} style={{marginRight:'8px', color:'#f59e0b'}}/>
                    ) : <FileText size={16} style={{marginRight:'8px', color:'#10b981'}}/>}
                    
                    <span style={{ fontSize: '14px', fontWeight: isGroup ? '600' : '400', color: isGroup ? '#0f172a' : '#475569' }}>{node.name}</span>
                    
                    {!isGroup && parseFloat(node.openingBalance) > 0 && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: node.balanceType === 'Cr' ? '#ef4444' : '#10b981' }}>₹ {parseFloat(node.openingBalance).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            <span style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold', background: node.balanceType === 'Cr' ? '#fee2e2' : '#d1fae5', color: node.balanceType === 'Cr' ? '#b91c1c' : '#047857' }}>{node.balanceType}</span>
                        </div>
                    )}
                    {!searchQuery && renderActionButtons(node.type, node)}
                </div>
                
                {isGroup && isExpanded && node.children && node.children.length > 0 && (
                    <div style={{ borderLeft: '1px dashed #94a3b8', marginLeft: '17px', paddingLeft: '20px', paddingBottom: '4px', paddingTop: '4px' }}>
                        {node.children.map(child => renderAccountTree(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const renderCentreTree = (nodes, level = 0) => {
        return nodes.map(node => {
            const isExpanded = searchQuery ? true : expandedKeys.has('cc'+node.id);
            return (
                <div key={node.id} style={{ position: 'relative' }}>
                    <div className="tree-row" style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', 
                        borderRadius: '4px', transition: 'all 0.2s', position: 'relative', zIndex: 1, cursor: 'pointer'
                    }} onMouseOver={e=>e.currentTarget.style.background='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                        {level > 0 && <div style={{ position: 'absolute', left: '-20px', top: '50%', width: '20px', borderTop: '1px dashed #94a3b8', zIndex: -1 }} />}
                        {node.children && node.children.length > 0 ? (
                            <div onClick={(e) => toggleExpand('cc'+node.id, e)} style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isExpanded ? <ChevronDown size={14} color="#64748b"/> : <ChevronRight size={14} color="#64748b"/>}
                            </div>
                        ) : <div style={{ width: '20px' }}/>}
                        <Target size={16} color="#3b82f6"/>
                        <div style={{ fontWeight: '500', color: '#1e293b', fontSize: '14px' }}>{node.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '12px' }}>[Cat: {masterData.costCategories.find(c=>c.id==node.categoryId)?.name || node.categoryId}]</div>
                        {!searchQuery && renderActionButtons('centre', node)}
                    </div>
                    {node.children && node.children.length > 0 && isExpanded && (
                        <div style={{ borderLeft: '1px dashed #94a3b8', marginLeft: '7px', paddingLeft: '20px', paddingBottom: '4px', paddingTop: '4px' }}>
                            {renderCentreTree(node.children, level + 1)}
                        </div>
                    )}
                </div>
            )
        });
    };
  return { activeTab, categoryForm, centreForm, currencyForm, editId, editMode, expandedKeys, fetchAccounts, fetchMasters, filterTree, filteredCentres, filteredTreeData, flatGroups, groupForm, handleCreateNew, handleDelete, handleEdit, handleSave, ledgerForm, ledgerFormTab, masterData, renderAccountTree, renderActionButtons, renderCentreTree, resetForms, searchQuery, setActiveTab, setCategoryForm, setCentreForm, setCurrencyForm, setEditId, setEditMode, setExpandedKeys, setFlatGroups, setGroupForm, setLedgerForm, setLedgerFormTab, setMasterData, setSearchQuery, setShowForm, setTdsForm, setTreeData, setVoucherForm, showForm, tdsForm, toggleExpand, treeData, voucherForm };
}
