import "dotenv/config";

process.env.ENABLE_BACKGROUND_WORKERS = "true";
process.env.SABQ_PROCESS_ROLE = process.env.SABQ_PROCESS_ROLE || "worker";

process.on("uncaughtException", (error) => {
  console.error("[Worker] Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled rejection:", reason);
});

console.log("[Worker] Starting SABQ background worker process...");

const { startBackgroundServices } = await import("./backgroundWorkers");

try {
  await startBackgroundServices({ enableBackgroundWorkers: true });
  console.log("[Worker] Background services initialized");
} catch (error) {
  console.error("[Worker] Failed to initialize background services:", error);
  process.exit(1);
}
