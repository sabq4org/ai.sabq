import { startMessageAggregatorJob } from "./services/whatsappMessageAggregator";

const LEADER_ELECTION_INTERVAL_MS = 60000;
const BACKGROUND_JOB_DELAY_MS = 45000;

let backgroundServicesInitialized = false;
let leaderOnlyJobsStarted = false;
let jobQueueHandlersRegistered = false;

function scheduleDelayedJob(
  delayMs: number,
  label: string,
  start: () => Promise<void> | void,
) {
  setTimeout(async () => {
    try {
      await start();
    } catch (error) {
      console.error(`[Background] Error starting ${label}:`, error);
    }
  }, delayMs);
}

async function registerJobQueueHandlers() {
  if (jobQueueHandlersRegistered) {
    return;
  }

  jobQueueHandlersRegistered = true;

  try {
    const { jobQueue } = await import("./services/job-queue");
    const { getElevenLabsService } = await import("./services/elevenlabs");
    const { ObjectStorageService } = await import("./objectStorage");
    const { storage } = await import("./storage");

    jobQueue.onExecute(async (job) => {
      if (job.type === "generate-tts") {
        console.log(`[JobQueue] Executing TTS generation job ${job.id}`);

        const { newsletterId } = job.data;
        const newsletter = await storage.getAudioNewsletterById(newsletterId);

        if (!newsletter) {
          throw new Error("النشرة الصوتية غير موجودة");
        }

        await storage.updateAudioNewsletter(newsletter.id, {
          generationStatus: "processing",
          generationError: null,
        });

        const elevenLabs = getElevenLabsService();
        const objectStorage = new ObjectStorageService();

        if (!elevenLabs) {
          await storage.updateAudioNewsletter(newsletter.id, {
            generationStatus: "failed",
            generationError: "ElevenLabs service is not available - missing API key",
          });
          throw new Error("ElevenLabs service is not configured");
        }

        const articlesData =
          newsletter.articles?.map((na) => ({
            title: na.article?.title || "",
            excerpt: na.article?.excerpt || undefined,
            aiSummary: na.article?.aiSummary || undefined,
          })) || [];

        const script = elevenLabs.buildNewsletterScript({
          title: newsletter.title,
          description: newsletter.description || undefined,
          articles: articlesData,
        });

        console.log(`[JobQueue] Generating TTS for newsletter ${newsletter.id}`);
        console.log(`[JobQueue] Script length: ${script.length} characters`);

        const audioBuffer = await elevenLabs.textToSpeech({
          text: script,
          voiceId: newsletter.voiceId || undefined,
          model: newsletter.voiceModel || undefined,
          voiceSettings: newsletter.voiceSettings || undefined,
        });

        const audioPath = `audio-newsletters/${newsletter.id}.mp3`;
        const uploadedFile = await objectStorage.uploadFile(
          audioPath,
          audioBuffer,
          "audio/mpeg",
        );

        await storage.updateAudioNewsletter(newsletter.id, {
          audioUrl: uploadedFile.url,
          fileSize: audioBuffer.length,
          duration: Math.floor(audioBuffer.length / 16000),
          generationStatus: "completed",
          generationError: null,
        });

        console.log(`[JobQueue] Successfully generated audio for newsletter ${newsletter.id}`);
        return;
      }

      if (job.type === "generate-audio-brief") {
        console.log(`[JobQueue] Executing audio brief generation job ${job.id}`);

        const { briefId } = job.data;
        const brief = await storage.getAudioNewsBriefById(briefId);

        if (!brief) {
          throw new Error("الخبر الصوتي غير موجود");
        }

        await storage.updateAudioNewsBrief(briefId, {
          generationStatus: "processing",
        });

        const elevenLabs = getElevenLabsService();
        const objectStorage = new ObjectStorageService();

        if (!elevenLabs) {
          await storage.updateAudioNewsBrief(briefId, {
            generationStatus: "failed",
          });
          throw new Error("ElevenLabs service is not configured");
        }

        console.log(`[JobQueue] Generating TTS for audio brief ${briefId}`);
        console.log(`[JobQueue] Content length: ${brief.content.length} characters`);

        const audioBuffer = await elevenLabs.textToSpeech({
          text: brief.content,
          voiceId: brief.voiceId || undefined,
          voiceSettings: brief.voiceSettings || undefined,
        });

        const audioPath = `audio-briefs/brief_${briefId}_${Date.now()}.mp3`;
        const uploadedFile = await objectStorage.uploadFile(
          audioPath,
          audioBuffer,
          "audio/mpeg",
        );

        const wordCount = brief.content.split(/\s+/).length;
        const estimatedDuration = Math.ceil((wordCount / 150) * 60);

        await storage.updateAudioNewsBrief(briefId, {
          audioUrl: uploadedFile.url,
          duration: estimatedDuration,
          generationStatus: "completed",
        });

        console.log(`[JobQueue] Successfully generated audio for brief ${briefId}`);
      }
    });

    console.log("[Background] ✅ Job queue handlers registered successfully");
  } catch (error) {
    console.error("[Background] ⚠️ Error registering job queue handlers:", error);
    console.error("[Background] Worker will continue running without job queue");
  }
}

async function startLeaderOnlyJobs() {
  if (leaderOnlyJobsStarted) {
    console.log("[Background] Leader-only jobs already started");
    return;
  }

  leaderOnlyJobsStarted = true;

  try {
    const { startNotificationWorker } = await import("./notificationWorker");
    startNotificationWorker();
  } catch (error) {
    console.error("[Background] Error starting notification worker:", error);
  }

  try {
    const { startPushWorker } = await import("./jobs/pushWorker");
    startPushWorker();
  } catch (error) {
    console.error("[Background] Error starting push worker:", error);
  }

  try {
    startMessageAggregatorJob();
  } catch (error) {
    console.error("[Background] Error starting WhatsApp aggregator:", error);
  }

  setImmediate(() => {
    void registerJobQueueHandlers();
  });

  console.log(`[Background] 📅 Background jobs will start in ${BACKGROUND_JOB_DELAY_MS / 1000} seconds...`);

  scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS, "seasonal categories job", async () => {
    const { startSeasonalCategoriesJob } = await import("./jobs/seasonalCategoriesJob");
    startSeasonalCategoriesJob();
  });

  scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 5000, "dynamic categories job", async () => {
    const { startDynamicCategoriesJob } = await import("./jobs/dynamicCategoriesJob");
    startDynamicCategoriesJob();
  });

  scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 10000, "campaign daily reset job", async () => {
    const { startCampaignDailyResetJob } = await import("./jobs/campaignDailyResetJob");
    startCampaignDailyResetJob();
  });

  scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 15000, "native ads daily reset job", async () => {
    const { startNativeAdsDailyResetJob } = await import("./jobs/nativeAdsDailyResetJob");
    startNativeAdsDailyResetJob();
  });

  scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 20000, "audio newsletter jobs", async () => {
    const { initializeAudioNewsletterJobs } = await import("./jobs/audioNewsletterJob");
    initializeAudioNewsletterJobs();
    console.log("[Background] ✅ Audio newsletter jobs started successfully");
  });

  const enableNewsletterScheduler = process.env.ENABLE_NEWSLETTER_SCHEDULER !== "false";
  if (enableNewsletterScheduler) {
    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 25000, "newsletter scheduler", async () => {
      const { newsletterScheduler } = await import("./services/newsletterScheduler");
      newsletterScheduler.start();
      console.log("[Background] Newsletter scheduler started");
    });
  }

  const enableAiTasksScheduler = process.env.ENABLE_AI_TASKS_SCHEDULER !== "false";
  if (enableAiTasksScheduler) {
    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 30000, "AI tasks scheduler", async () => {
      const { startAITasksScheduler } = await import("./jobs/aiTasksJob");
      startAITasksScheduler();
    });

    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 40000, "AI tasks cleanup job", async () => {
      const { startAiTasksCleanupJob } = await import("./jobs/aiTasksCleanup");
      startAiTasksCleanupJob();
    });

    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 50000, "cleanup jobs", async () => {
      const { startArticleEditLocksCleanupJob } = await import("./jobs/articleEditLocksCleanup");
      startArticleEditLocksCleanupJob();
      const { startDatabaseCleanupJob } = await import("./jobs/databaseCleanupJob");
      startDatabaseCleanupJob();
    });

    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 60000, "iFox content generator job", async () => {
      const { startIfoxContentGeneratorJob } = await import("./jobs/ifoxContentGeneratorJob");
      startIfoxContentGeneratorJob();
    });

    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 70000, "world days reminder job", async () => {
      const { startWorldDaysReminderJob } = await import("./jobs/worldDaysReminder");
      startWorldDaysReminderJob();
    });

    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 80000, "staff communications scheduler", async () => {
      const { startStaffCommunicationsScheduler } = await import("./jobs/staffCommunicationsJob");
      startStaffCommunicationsScheduler();
    });

    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 85000, "foreign news job", async () => {
      const { startForeignNewsJob } = await import("./jobs/foreignNewsJob");
      startForeignNewsJob();
    });

    scheduleDelayedJob(BACKGROUND_JOB_DELAY_MS + 100000, "dashboard cache refresh", async () => {
      const { storage } = await import("./storage");
      const { memoryCache, CACHE_TTL } = await import("./memoryCache");

      const refreshDashboardCache = async () => {
        try {
          const stats = await storage.getAdminDashboardStats();
          const trimmedStats = {
            ...stats,
            recentArticles: stats.recentArticles.map((article: any) => ({
              id: article.id,
              title: article.title,
              slug: article.slug,
              englishSlug: article.englishSlug || undefined,
              status: article.status,
              publishedAt: article.publishedAt,
              views: article.views,
              author: article.author
                ? {
                    firstName: article.author.firstName,
                    lastName: article.author.lastName,
                    email: article.author.email,
                  }
                : undefined,
            })),
            topArticles: stats.topArticles.map((article: any) => ({
              id: article.id,
              title: article.title,
              slug: article.slug,
              englishSlug: article.englishSlug || undefined,
              status: article.status,
              publishedAt: article.publishedAt,
              views: article.views,
              category: article.category
                ? {
                    nameAr: article.category.nameAr,
                  }
                : undefined,
            })),
            recentComments: stats.recentComments.map((comment: any) => ({
              id: comment.id,
              content: comment.content ? comment.content.substring(0, 100) : "",
              status: comment.status,
              createdAt: comment.createdAt,
              user: comment.user
                ? {
                    firstName: comment.user.firstName,
                    lastName: comment.user.lastName,
                  }
                : undefined,
            })),
          };

          memoryCache.set("admin:dashboard:stats", trimmedStats, CACHE_TTL.MEDIUM);
          console.log("[Dashboard Cache] ✅ Cache refreshed successfully");
        } catch (error) {
          console.error("[Dashboard Cache] ⚠️ Refresh failed:", error);
        }
      };

      setInterval(refreshDashboardCache, 10 * 60 * 1000);
      console.log("[Background] ✅ Dashboard Cache Refresh job started (every 10 minutes)");
    });
  } else {
    console.log("[Background] AI Tasks Scheduler disabled (set ENABLE_AI_TASKS_SCHEDULER=true to enable)");
  }
}

export async function startBackgroundServices(options?: {
  enableBackgroundWorkers?: boolean;
}) {
  if (backgroundServicesInitialized) {
    console.log("[Background] Startup already initialized");
    return;
  }

  backgroundServicesInitialized = true;

  const enableBackgroundWorkers =
    options?.enableBackgroundWorkers ?? process.env.ENABLE_BACKGROUND_WORKERS === "true";

  if (!enableBackgroundWorkers) {
    console.log("[Background] Background workers disabled (ENABLE_BACKGROUND_WORKERS not set)");
    return;
  }

  const {
    tryBecomeLeader,
    isLeader,
    getPodId,
    startLeaderElectionLoop,
    onBecomeLeader,
  } = await import("./leaderElection");

  await tryBecomeLeader();
  startLeaderElectionLoop(LEADER_ELECTION_INTERVAL_MS);

  onBecomeLeader(() => {
    console.log("[Background] Starting background workers after leader failover...");
    void startLeaderOnlyJobs();
  });

  if (!isLeader()) {
    console.log(`[Background] Pod ${getPodId()} is NOT the leader — background jobs on leader only`);
    return;
  }

  console.log(`[Background] Pod ${getPodId()} is the LEADER — background jobs enabled`);
  await startLeaderOnlyJobs();
}
