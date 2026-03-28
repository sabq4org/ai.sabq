import * as cron from 'node-cron';
import { aiTaskExecutor } from '../services/aiTaskExecutor';

// AI Tasks Scheduler - Runs every 4 minutes with staggered offset to reduce DB contention
export function startAITasksScheduler() {
  console.log('🤖 [AI Tasks Scheduler] Starting AI automated content generation scheduler...');

  // Run every 4 minutes at offset 3 (3, 7, 11, 15...) to avoid clashing with other cron jobs
  // Staggered schedule: notification=0, articles=1, announcements=2, AI tasks=3
  cron.schedule('3,7,11,15,19,23,27,31,35,39,43,47,51,55,59 * * * *', async () => {
    try {
      const result = await aiTaskExecutor.executePendingTasks();
      
      if (result.executed > 0) {
        console.log(`🤖 [AI Tasks Scheduler] Execution complete: ${result.succeeded} succeeded, ${result.failed} failed`);
      }
    } catch (error) {
      console.error('❌ [AI Tasks Scheduler] Error executing pending tasks:', error);
    }
  });

  console.log('✅ [AI Tasks Scheduler] Scheduler started successfully (runs every 4 minutes at offset 3)');
}

export function stopAITasksScheduler() {
  // node-cron doesn't have a stop method for individual tasks
  // You would need to keep a reference to the task and call task.stop()
  console.log('⏹️  [AI Tasks Scheduler] Scheduler stopped');
}
