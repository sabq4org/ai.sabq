import { foreignNewsService } from '../services/foreignNewsService';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let isInitialized = false;

const FETCH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;
  
  try {
    await foreignNewsService.ensureDefaultKeywords();
    console.log('[ForeignNewsJob] Default Saudi keywords initialized');
    isInitialized = true;
  } catch (error) {
    console.error('[ForeignNewsJob] Failed to initialize keywords:', error);
  }
}

async function runForeignNewsFetch(): Promise<void> {
  if (isRunning) {
    console.log('[ForeignNewsJob] Previous fetch still running, skipping...');
    return;
  }

  isRunning = true;
  console.log('[ForeignNewsJob] Starting RSS fetch cycle...');

  // Ensure default keywords are initialized
  await ensureInitialized();

  try {
    const results = await foreignNewsService.ingestAllActiveFeeds();
    const totalNew = results.reduce((sum, r) => sum + r.itemsIngested, 0);
    const totalSaudi = results.reduce((sum, r) => sum + r.saudiRelatedItems, 0);
    const errorCount = results.filter(r => r.errors.length > 0).length;
    
    console.log(`[ForeignNewsJob] Fetch complete: ${totalNew} new items, ${totalSaudi} Saudi-related from ${results.length} sources`);
    
    if (errorCount > 0) {
      console.log(`[ForeignNewsJob] ${errorCount} sources had errors`);
    }
    
    // Always process pending Saudi-related items (not just when new ones found)
    // This ensures previously pending items don't get stuck
    const processed = await foreignNewsService.processPendingSaudiRelatedItems(10);
    if (processed.length > 0) {
      console.log(`[ForeignNewsJob] Processed ${processed.length} Saudi-related items`);
    }
  } catch (error) {
    console.error('[ForeignNewsJob] Error during fetch:', error);
  } finally {
    isRunning = false;
  }
}

export function startForeignNewsJob(): void {
  console.log('[ForeignNewsJob] Starting scheduler...');
  
  // Run immediately on startup
  setTimeout(() => {
    runForeignNewsFetch().catch(console.error);
  }, 5000);

  // Schedule recurring fetches
  intervalId = setInterval(() => {
    runForeignNewsFetch().catch(console.error);
  }, FETCH_INTERVAL_MS);

  console.log(`[ForeignNewsJob] Scheduled to run every ${FETCH_INTERVAL_MS / 60000} minutes`);
}

export function stopForeignNewsJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  console.log('[ForeignNewsJob] Stopped');
}
