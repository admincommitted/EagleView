import { useState } from 'react';
import { Navigation, Search } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import lookUpAwb from './FreightOpsParts/lookUpAwb';
import TrackingResult from './FreightOpsParts/TrackingResult';

const CARD = 'tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-6 tw:shadow-sm';

export default function TrackAndTrace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(null);

  const handleSearch = async (event) => {
    event.preventDefault();
    const number = String(searchQuery || '').trim();
    if (!number) return;
    setSearched(true);
    setLoading(true);
    setError('');
    setTracking(null);
    try {
      const found = await lookUpAwb(number);
      if (found) setTracking(found);
      else setError('No AWB / House AWB with that number');
    } catch (lookupError) {
      setError('Could not look that up: ' + errorMessage(lookupError));
    }
    setLoading(false);
  };

  return (
    <div className="tw:mx-auto tw:max-w-[1000px] tw:px-4 tw:py-10 tw:md:px-6">
      <div className="tw:mb-10 tw:text-center">
        <div className="tw:mb-4 tw:inline-flex tw:items-center tw:gap-3 tw:rounded-full tw:bg-primary/10 tw:px-6 tw:py-3 tw:text-[20px] tw:font-bold tw:text-head tw:md:text-[24px]">
          <Navigation className="tw:size-7" /> Logistics Track & Trace Portal
        </div>
        <p className="tw:text-[15px] tw:text-muted-foreground">Enter your AWB, BL, or Job Reference Number to get real-time tracking.</p>
      </div>

      <form onSubmit={handleSearch} className="tw:mx-auto tw:mb-10 tw:flex tw:max-w-[600px] tw:flex-col tw:gap-3 tw:sm:flex-row">
        <Input
          data-allow-text
          placeholder="Enter Tracking Number (e.g. 176-99887766)"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="tw:h-12 tw:flex-1 tw:rounded-lg tw:border-2 tw:px-5 tw:text-[16px]"
        />
        <Button type="submit" variant="default" size="lg" className="tw:h-12 tw:rounded-lg tw:px-8 tw:text-[16px] tw:font-bold">
          <Search className="tw:size-5" /> Track
        </Button>
      </form>

      {searched && loading && <div className={cn(CARD, 'tw:text-center tw:text-muted-foreground')}>Looking it up...</div>}
      {searched && !loading && error && (
        <div className={cn(CARD, 'tw:border-destructive/30 tw:bg-destructive/5 tw:text-center tw:text-destructive')}>{error}</div>
      )}
      {searched && !loading && tracking && (
        <div className={CARD}>
          <TrackingResult tracking={tracking} />
        </div>
      )}
    </div>
  );
}
