import { startScheduler } from '../utils/integrations/WhatsappScheduler.js';

/** The daily WhatsApp notification batch (only when Settings > WhatsApp is in "scheduled" mode). */
export async function startWhatsappSchedulerJob() {
  try {
    await startScheduler();
  } catch (error) {
    console.warn('[WA Scheduler] Start warning:', error.message);
  }
}
