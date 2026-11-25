import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { askConfirm } from '@/components/common/askConfirm';
import { accountsApi } from '../AccountsHubParts/accountsApi';
import { chartTabOf } from './chartTabs';

const BLANK_GROUP = { name: '', parentId: '', nature: 'Assets' };
const BLANK_LEDGER = {
  name: '', groupId: '', openingBalance: 0, balanceType: 'Dr',
  maintainBillByBill: false, costCentresApplicable: false,
  address: '', state: '', pinCode: '', country: '', contactPerson: '', email: '', phone: '',
  gstin: '', pan: '', isGstApplicable: false, hsnSac: '', taxability: 'Taxable', gstRate: 0,
  isTdsApplicable: false, tdsNatureId: '', isTdsDeductible: false, deducteeType: 'Company',
  bankAccount: '', bankIfsc: '', bankName: '', creditLimit: 0, creditDays: 0,
};
const BLANK_VOUCHER = { name: '', baseType: 'Journal', numberingMethod: 'Automatic', prefix: '', suffix: '', startingNumber: 1 };
const BLANK_CATEGORY = { name: '', allocateRevenue: true, allocateNonRevenue: false };
const BLANK_CENTRE = { name: '', categoryId: '', parentId: '' };
const BLANK_CURRENCY = { symbol: '', formalName: '', decimalPlaces: 2, standardRate: 1.0000 };
const BLANK_TDS = { name: '', section: '', rate: 0, rateWithoutPan: 20, exemptionLimit: 0 };
const EMPTY_MASTERS = { voucherTypes: [], costCategories: [], costCentresTree: [], costCentresFlat: [], currencies: [], tdsNatures: [] };

const ENDPOINT = {
  group: '/accounts/groups',
  ledger: '/accounts/ledgers',
  voucher: '/accounting-masters/vouchertypes',
  category: '/accounting-masters/categories',
  centre: '/accounting-masters/centres',
  currency: '/accounting-masters/currencies',
  tds: '/accounting-masters/tds-natures',
};
const ACCOUNT_TREE_ENTRIES = ['group', 'ledger'];

const startTab = () => new URLSearchParams(window.location.search).get('tab') || 'groups';

const ledgerFormOf = (item) => {
  const form = {};
  Object.entries(BLANK_LEDGER).forEach(([key, blank]) => { form[key] = item[key] || blank; });
  form.name = item.name;
  return form;
};

function filterTree(nodes, query) {
  if (!query) return nodes;
  const typed = query.toLowerCase();
  const kept = [];
  for (const node of nodes) {
    const children = node.children ? filterTree(node.children, query) : [];
    if (node.name.toLowerCase().includes(typed) || children.length > 0) kept.push({ ...node, children });
  }
  return kept;
}

function flattenGroups(nodes, level = 0, out = []) {
  nodes.forEach((node) => {
    if (node.type !== 'group') return;
    out.push({ ...node, level });
    flattenGroups(node.children || [], level + 1, out);
  });
  return out;
}

export default function useChartOfAccounts() {
  const [activeTab, setActiveTab] = useState(startTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [treeData, setTreeData] = useState([]);
  const [flatGroups, setFlatGroups] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [masterData, setMasterData] = useState(EMPTY_MASTERS);

  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [ledgerFormTab, setLedgerFormTab] = useState('general');

  const [groupForm, setGroupForm] = useState(BLANK_GROUP);
  const [ledgerForm, setLedgerForm] = useState(BLANK_LEDGER);
  const [voucherForm, setVoucherForm] = useState(BLANK_VOUCHER);
  const [categoryForm, setCategoryForm] = useState(BLANK_CATEGORY);
  const [centreForm, setCentreForm] = useState(BLANK_CENTRE);
  const [currencyForm, setCurrencyForm] = useState(BLANK_CURRENCY);
  const [tdsForm, setTdsForm] = useState(BLANK_TDS);

  const fetchAccounts = async () => {
    try {
      const response = await accountsApi.ledgerTree();
      if (!response.success) return;
      setTreeData(response.data);
      setFlatGroups(flattenGroups(response.data));
      setExpandedKeys(new Set(response.data.map((node) => node.id)));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMasters = async () => {
    try {
      const response = await accountsApi.accountingMasters();
      if (!response.success) return;
      const masters = response.data;
      setMasterData({
        voucherTypes: masters.voucherTypes || [],
        costCategories: masters.costCategories || [],
        costCentresTree: masters.costCentresTree || [],
        costCentresFlat: masters.costCentresFlat || [],
        currencies: masters.currencies || [],
        tdsNatures: masters.tdsNatures || [],
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchMasters();
  }, []);

  const reloadFor = (entry) => (ACCOUNT_TREE_ENTRIES.includes(entry) ? fetchAccounts() : fetchMasters());

  const toggleExpand = (id, event) => {
    event?.stopPropagation();
    const next = new Set(expandedKeys);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedKeys(next);
  };

  const resetForms = () => {
    setGroupForm(BLANK_GROUP);
    setLedgerForm(BLANK_LEDGER);
    setVoucherForm(BLANK_VOUCHER);
    setCategoryForm(BLANK_CATEGORY);
    setCentreForm(BLANK_CENTRE);
    setCurrencyForm(BLANK_CURRENCY);
    setTdsForm(BLANK_TDS);
    setEditMode(false);
    setEditId(null);
    setLedgerFormTab('general');
  };

  const changeTab = (tab) => { setActiveTab(tab); setShowForm(false); setSearchQuery(''); };

  const handleCreateNew = () => {
    resetForms();
    setShowForm(true);
  };

  const handleEdit = (entry, item, event) => {
    event?.stopPropagation();
    if (item.isBuiltIn) { toast.error('Cannot edit built-in system masters.'); return; }
    resetForms();
    setEditMode(true);
    setEditId(item.id);
    if (entry === 'group') setGroupForm({ name: item.name, parentId: item.parentId || '', nature: item.nature });
    if (entry === 'ledger') setLedgerForm(ledgerFormOf(item));
    if (entry === 'voucher') setVoucherForm({ name: item.name, baseType: item.baseType, numberingMethod: item.numberingMethod, prefix: item.prefix || '', suffix: item.suffix || '', startingNumber: item.startingNumber || 1 });
    if (entry === 'category') setCategoryForm({ name: item.name, allocateRevenue: item.allocateRevenue, allocateNonRevenue: item.allocateNonRevenue });
    if (entry === 'centre') setCentreForm({ name: item.name, categoryId: item.categoryId || '', parentId: item.parentId || '' });
    if (entry === 'currency') setCurrencyForm({ symbol: item.symbol, formalName: item.formalName, decimalPlaces: item.decimalPlaces, standardRate: item.standardRate });
    if (entry === 'tds') setTdsForm({ name: item.name, section: item.section, rate: item.rate, rateWithoutPan: item.rateWithoutPan, exemptionLimit: item.exemptionLimit });
    setShowForm(true);
  };

  const handleDelete = async (entry, item, event) => {
    event?.stopPropagation();
    if (item.isBuiltIn) { toast.error('Cannot delete built-in system masters.'); return; }
    const confirmed = await askConfirm({ title: 'Delete', message: `Are you sure you want to delete ${item.name || item.symbol}?`, okLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    try {
      await accountsApi.chartDeleteEntry(ENDPOINT[entry], item.id);
      reloadFor(entry);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error deleting item');
    }
  };

  const payloadFor = (entry) => {
    if (entry === 'group') return { ...groupForm, parentId: groupForm.parentId || null };
    if (entry === 'ledger') return { ...ledgerForm, groupId: ledgerForm.groupId || null, tdsNatureId: ledgerForm.tdsNatureId || null };
    if (entry === 'voucher') return voucherForm;
    if (entry === 'category') return categoryForm;
    if (entry === 'centre') return { ...centreForm, parentId: centreForm.parentId || null, categoryId: centreForm.categoryId || null };
    if (entry === 'currency') return currencyForm;
    return tdsForm;
  };

  const handleSave = async () => {
    const entry = chartTabOf(activeTab).kind;
    try {
      await accountsApi.chartSaveEntry(ENDPOINT[entry], editMode ? editId : null, payloadFor(entry));
      reloadFor(entry);
      setShowForm(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving record');
    }
  };

  const filteredTreeData = useMemo(() => filterTree(treeData, searchQuery), [treeData, searchQuery]);
  const filteredCentres = useMemo(() => filterTree(masterData.costCentresTree, searchQuery), [masterData.costCentresTree, searchQuery]);

  return {
    activeTab, changeTab, searchQuery, setSearchQuery, masterData, flatGroups, expandedKeys, toggleExpand,
    filteredTreeData, filteredCentres,
    showForm, setShowForm, editMode, ledgerFormTab, setLedgerFormTab,
    groupForm, setGroupForm, ledgerForm, setLedgerForm, voucherForm, setVoucherForm, categoryForm, setCategoryForm,
    centreForm, setCentreForm, currencyForm, setCurrencyForm, tdsForm, setTdsForm,
    handleCreateNew, handleEdit, handleDelete, handleSave,
  };
}
