/**
 * Seasonal Categories Cron Job
 * وظيفة Cron لتحديث التصنيفات الموسمية تلقائياً
 * يتم تشغيلها كل 6 ساعات للتحقق من التصنيفات التي يجب تفعيلها أو تعطيلها
 */

import cron from "node-cron";
import { updateSeasonalCategories } from "../smartCategoriesEngine";

/**
 * جدولة وظيفة تحديث التصنيفات الموسمية
 * Schedule seasonal categories update job
 * Runs every 6 hours (cron: 0 star-slash-6 star star star)
 */
export function startSeasonalCategoriesJob() {
  // Run every 6 hours
  const job = cron.schedule("0 */6 * * *", async () => {
    try {
      console.log("[Seasonal Categories Job] 🔄 Starting seasonal categories update...");
      
      const { activated, deactivated } = await updateSeasonalCategories();
      
      console.log("[Seasonal Categories Job] ✅ Update complete:", {
        activated: activated.length,
        deactivated: deactivated.length,
        timestamp: new Date().toISOString(),
      });
      
      if (activated.length > 0) {
        console.log("[Seasonal Categories Job] 📍 Activated categories:", activated.join(", "));
      }
      
      if (deactivated.length > 0) {
        console.log("[Seasonal Categories Job] 📍 Deactivated categories:", deactivated.join(", "));
      }
    } catch (error) {
      console.error("[Seasonal Categories Job] ❌ Error:", error);
    }
  });
  
  // Also run immediately on startup
  setTimeout(async () => {
    try {
      console.log("[Seasonal Categories Job] 🚀 Running initial update on startup...");
      await updateSeasonalCategories();
    } catch (error) {
      console.error("[Seasonal Categories Job] ❌ Initial update error:", error);
    }
  }, 5000); // Wait 5 seconds after server start
  
  console.log("[Seasonal Categories Job] ⏰ Seasonal categories job scheduled (every 6 hours)");
  
  return job;
}
