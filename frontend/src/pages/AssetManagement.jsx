import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Package, Search } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import AssetDialog from './PurchaseParts/AssetDialogs';
import PageHeader from './PurchaseParts/PageHeader';
import { AssetDirectoryTable, AssetInwardTable } from './PurchaseParts/assetTables';
import { pendingInwardRows } from './PurchaseParts/purchaseFormat';

const TABS = [
  { value: 'GRN', label: 'Stock Inward (GRN)' },
  { value: 'DIRECTORY', label: 'Asset Directory', heading: 'ASSET DIRECTORY' },
  { value: 'DISCARDED', label: 'Discarded Assets', heading: 'DISCARDED ASSETS' },
];
const SEARCHED_KEYS = ['assetName', 'assetTag', 'assignedTo', 'description'];

function isOnTab(asset, tab) {
  if (tab === 'DIRECTORY') return asset.status !== 'DISCARDED';
  return asset.status === 'DISCARDED';
}

const matchesSearch = (asset, searchText) => !searchText
  || SEARCHED_KEYS.some((key) => asset[key] && asset[key].toLowerCase().includes(searchText.toLowerCase()));

export default function AssetManagement() {
  const [assets, setAssets] = useState([]);
  const [approvedPOs, setApprovedPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('GRN');
  const [assetSearch, setAssetSearch] = useState('');
  const [dialog, setDialog] = useState(null);

  const loadAssets = async () => {
    setLoading(true);
    try {
      setAssets(await purchaseApi.assets());
    } catch (error) {
      console.error(errorMessage(error));
    }
    setLoading(false);
  };

  const loadApprovedPOs = async () => {
    try {
      const purchaseOrders = await purchaseApi.purchaseOrders();
      setApprovedPOs(purchaseOrders.filter((po) => po.status === 'Approved'));
    } catch (error) {
      console.error(errorMessage(error));
    }
  };

  useEffect(() => {
    loadAssets();
    loadApprovedPOs();
  }, []);

  const receiveItem = async (item, po) => {
    try {
      await purchaseApi.receivePoItem(item.id);
      await purchaseApi.addAsset({
        assetName: item.itemName,
        description: `Received via PO: ${po.poNumber}`,
        purchaseValue: item.unitPrice,
        branch: po.branch || 'Head Office',
        category: po.category || 'General Admin',
        sourcePurchaseId: po.id,
      });
      toast.success('Asset Added to Stock successfully!');
      loadAssets();
      loadApprovedPOs();
      setActiveTab('DIRECTORY');
    } catch {
      toast.error('Error adding asset to stock');
    }
  };

  const dialogSaved = () => { setDialog(null); loadAssets(); };

  const inwardRows = pendingInwardRows(approvedPOs);
  const shownAssets = assets.filter((asset) => isOnTab(asset, activeTab) && matchesSearch(asset, assetSearch));
  const tab = TABS.find((entry) => entry.value === activeTab);

  return (
    <div className="tw:flex tw:min-h-screen tw:flex-col tw:gap-4 tw:bg-page tw:p-3 tw:md:p-5">
      <PageHeader icon={Package} title="Asset & Stock Management" subtitle="Goods Receipt Note (GRN) and Asset Assignment" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="tw:flex-wrap">
          {TABS.map((entry) => <TabsTrigger key={entry.value} value={entry.value} className="tw:font-bold">{entry.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {activeTab === 'GRN' && (
        <Card>
          <CardHeader><CardTitle>Pending Stock Inwards (Approved POs)</CardTitle></CardHeader>
          <CardContent>
            <AssetInwardTable rows={inwardRows} onReceive={receiveItem} />
            {approvedPOs.length > 0 && <div className="tw:text-right tw:font-bold tw:text-muted-foreground">Total Count: {inwardRows.length}</div>}
          </CardContent>
        </Card>
      )}

      {activeTab !== 'GRN' && (loading ? <div>Loading assets...</div> : (
        <>
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
            <div className="tw:flex tw:items-center tw:gap-3">
              <h3 className="tw:m-0 tw:text-sm tw:font-bold">{tab.heading}</h3>
              {shownAssets.length > 0 && <Badge variant="info" className="tw:text-[11px]">Total: {shownAssets.length}</Badge>}
            </div>
            <Input leftIcon={Search} data-allow-text="" className="tw:w-full tw:sm:w-[300px]" placeholder="Search Assets by Code, Name, Person..."
              value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} />
          </div>
          <Card>
            <CardContent className="tw:p-3 tw:md:p-5">
              <AssetDirectoryTable assets={shownAssets} onOpenDialog={(kind, asset) => setDialog({ kind, asset })} />
            </CardContent>
          </Card>
        </>
      ))}

      {dialog && <AssetDialog dialog={dialog} onClose={() => setDialog(null)} onSaved={dialogSaved} />}
    </div>
  );
}
