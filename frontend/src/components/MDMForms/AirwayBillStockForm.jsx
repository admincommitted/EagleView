import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { useAwbStock } from './AirwayBillStockFormParts/useAwbStock';
import AwbStockSection from './AirwayBillStockFormParts/sections/AwbStockSection';
import HawbStockSection from './AirwayBillStockFormParts/sections/HawbStockSection';
import IssueStockSection from './AirwayBillStockFormParts/sections/IssueStockSection';
import ReturnStockSection from './AirwayBillStockFormParts/sections/ReturnStockSection';
import QueryDetailSection from './AirwayBillStockFormParts/sections/QueryDetailSection';

const STOCK_TABS = [
  { value: 'AWB', label: 'AirWayBill Stock', Section: AwbStockSection },
  { value: 'HAWB', label: 'HAWB Stock', Section: HawbStockSection },
  { value: 'ISSUE', label: 'Issue Stock to SubAgent', Section: IssueStockSection },
  { value: 'RETURN', label: 'Return Stock', Section: ReturnStockSection },
];

export default function AirwayBillStockForm() {
  const stock = useAwbStock();

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:gap-2 tw:overflow-y-auto tw:p-2 tw:normal-case">
      <Tabs value={stock.activeTab} onValueChange={stock.changeTab} className="tw:gap-2">
        <TabsList className="tw:overflow-x-auto">
          {STOCK_TABS.map((tab) => <TabsTrigger key={tab.value} value={tab.value} className="tw:uppercase">{tab.label}</TabsTrigger>)}
        </TabsList>
        {STOCK_TABS.map(({ value, Section }) => (
          <TabsContent key={value} value={value}><Section stock={stock} /></TabsContent>
        ))}
      </Tabs>
      <QueryDetailSection stock={stock} />
    </div>
  );
}
