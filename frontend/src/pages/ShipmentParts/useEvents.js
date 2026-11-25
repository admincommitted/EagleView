import { useCallback, useEffect, useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { shipmentApi } from './shipmentApi';

// the docket's events (received papers, status, activities, due dates) and a reload
export default function useEvents(shipmentId) {
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    if (!shipmentId) return;
    try {
      setEvents(await shipmentApi.events(shipmentId));
    } catch {
      setEvents([]);
    }
  }, [shipmentId]);

  useEffect(() => { load(); }, [load]);
  return [events, load];
}

// asks first; afterRemove reloads what the tab shows
export async function removeEvent(shipmentId, event, question, afterRemove) {
  const goAhead = await askConfirm({ title: 'Remove', message: question, okLabel: 'Remove', tone: 'danger' });
  if (!goAhead) return;
  await shipmentApi.deleteEvent(shipmentId, event.id);
  afterRemove();
}
