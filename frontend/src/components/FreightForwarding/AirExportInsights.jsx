import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Card } from '@/components/ui';
import { freightApi } from './freightApi';
import { ago, insightAlerts } from './AirExportInsightsParts/insights';
import { AlertBox, AlertDetails } from './AirExportInsightsParts/InsightAlerts';
import { ActivityPanel, ConnectionPanel, FreightValuePanel, StockPanel, TonnagePanel, TopListPanels } from './AirExportInsightsParts/InsightCards';

const REFRESH_EVERY_MS = 5 * 60 * 1000;

function useInsights() {
  const [insights, setInsights] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await freightApi.awbInsights();
      if (!data.success) throw new Error(data.error || 'Could not load');
      setInsights(data);
      setCurrency((current) => current || data.freightValue.byCurrency[0]?.currency || '');
      setLoadError('');
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { insights, loadError, loading, load, currency, setCurrency };
}

export default function AirExportInsights({ airlines }) {
  const { insights, loadError, loading, load, currency, setCurrency } = useInsights();
  const [openAlert, setOpenAlert] = useState('');

  if (!insights) {
    return (
      <Card className={cn('tw:p-3.5 tw:text-entry', loadError ? 'tw:text-destructive' : 'tw:text-muted-foreground')}>
        {loadError ? `Dashboard insights: ${loadError}` : 'Loading dashboard insights...'}
      </Card>
    );
  }

  const alerts = insightAlerts(insights);
  const shownAlert = alerts.find((alert) => alert.key === openAlert);

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <div className="tw:text-[13px] tw:font-black tw:text-foreground tw:uppercase">Needs attention</div>
        <Button onClick={load}><RefreshCw className={cn(loading && 'tw:animate-spin')} /> Updated {ago(insights.generatedAt)}</Button>
      </div>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] tw:gap-3">
        {alerts.map((alert) => (
          <AlertBox key={alert.key} alert={alert} open={openAlert === alert.key} onToggle={() => setOpenAlert((current) => (current === alert.key ? '' : alert.key))} />
        ))}
      </div>
      {shownAlert && <AlertDetails alert={shownAlert} insights={insights} />}

      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] tw:gap-3">
        <StockPanel stock={insights.stock} lowStock={insights.rules.lowStock} airlines={airlines} />
        <TonnagePanel tonnage={insights.tonnage} airlines={airlines} />
      </div>

      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] tw:gap-3">
        <TopListPanels insights={insights} />
        <FreightValuePanel byCurrency={insights.freightValue.byCurrency} currency={currency} onCurrencyChange={setCurrency} />
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <ActivityPanel activity={insights.activity} />
        <ConnectionPanel connection={insights.connection} />
      </div>
    </div>
  );
}
