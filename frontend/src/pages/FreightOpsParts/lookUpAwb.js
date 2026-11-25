import { freightOpsApi } from './freightOpsApi';

const toDocument = (file) => ({
  name: file.originalName || file.fileName || 'document',
  size: file.size ? Math.round(file.size / 1024) + ' KB' : '',
  type: (file.mimeType || '').split('/').pop().toUpperCase() || 'FILE',
  path: file.filePath || '',
});

const toTimelineStep = (event) => ({
  date: event.eventAt ? new Date(event.eventAt).toLocaleString('en-GB') : '',
  event: event.name || event.code,
  location: [event.station, event.flight].filter(Boolean).join(' · '),
  status: 'done',
});

const NO_TRACKING = { events: [], tracking: null, airlineUrl: '' };

// the AWB's milestones; without them the AWB still shows
async function trackingOf(awbNumber) {
  try {
    const answer = await freightOpsApi.awbTrackingEvents(awbNumber);
    return answer.success ? { events: answer.events || [], tracking: answer.tracking || null, airlineUrl: answer.airlineTrackingUrl || '' } : NO_TRACKING;
  } catch {
    return NO_TRACKING;
  }
}

// the AWB's attachments; no pouch is not an error
async function documentsOf(awb) {
  try {
    const files = await freightOpsApi.awbDocuments(String(awb.id || ''), awb.type || 'MAWB');
    return (Array.isArray(files) ? files : []).map(toDocument);
  } catch {
    return [];
  }
}

// null when no AWB / House AWB has this number
export default async function lookUpAwb(number) {
  let awb;
  try {
    awb = await freightOpsApi.findAwb(number);
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
  const awbNumber = awb.awbNumber || number;
  const { events, tracking, airlineUrl } = await trackingOf(awbNumber);
  const documents = await documentsOf(awb);
  return {
    awb: awbNumber,
    client: awb.shipperName || awb.consigneeName || '',
    origin: awb.origin || tracking?.origin || '',
    dest: awb.destination || tracking?.destination || '',
    status: tracking?.status || awb.status || 'No milestone yet',
    flight: awb.flightNumber || awb.flightNo || '',
    pieces: awb.pieces || awb.noOfPieces || '',
    weight: awb.grossWeight ? awb.grossWeight + ' kg' : '',
    airlineUrl,
    timeline: events.map(toTimelineStep),
    documents,
  };
}
