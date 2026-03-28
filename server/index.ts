import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { uploadsRootDir } from "./uploadsDir";

process.on('uncaughtException', (error) => {
  console.error('[CRITICAL] Uncaught Exception:', error.message);
  console.error('[CRITICAL] Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise);
  console.error('[CRITICAL] Reason:', reason);
});

const app = express();
app.set("trust proxy", 1);

if ((globalThis as any).__sabqAttachExpress) {
  (globalThis as any).__sabqAttachExpress(app);
}

// Serve ads.txt and app-ads.txt BEFORE any SPA/Vite middleware
app.get('/ads.txt', (_req, res) => {
  const filePath = path.resolve(process.cwd(), 'public', 'ads.txt');
  if (fs.existsSync(filePath)) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

app.get('/app-ads.txt', (_req, res) => {
  const filePath = path.resolve(process.cwd(), 'public', 'app-ads.txt');
  if (fs.existsSync(filePath)) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

// Track server readiness state
let isServerReady = false;
let hasStartupFailed = false;
let startupErrorMessage: string | null = null;
let areCoreRoutesRegistered = false;

app.get("/health", async (_req, res) => {
  let dbReady = false;
  try {
    const { isDatabaseAvailable } = await import("./db");
    dbReady = isDatabaseAvailable();
  } catch {}

  const isHealthy =
    !hasStartupFailed &&
    areCoreRoutesRegistered &&
    isServerReady &&
    dbReady;

  const databaseStatus = dbReady
    ? "connected"
    : (areCoreRoutesRegistered ? "disconnected" : "warming-up");

  res.status(isHealthy ? 200 : 503).json({ 
    status: isHealthy ? "ok" : (hasStartupFailed ? "error" : "degraded"),
    server: hasStartupFailed ? "startup-error" : (isServerReady ? "ready" : "starting"),
    routes: areCoreRoutesRegistered ? "registered" : "registering",
    timestamp: new Date().toISOString(),
    database: databaseStatus,
    ...(startupErrorMessage && process.env.NODE_ENV !== "production"
      ? { error: startupErrorMessage }
      : {}),
  });
});

app.get("/ready", async (_req, res) => {
  try {
    if (hasStartupFailed) {
      res.status(503).json({ 
        status: "failed",
        server: "startup-error",
        database: "unknown",
        error: startupErrorMessage,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Only mark ready if server has finished basic initialization
    if (!isServerReady) {
      let dbReady = false;
      try {
        const { isDatabaseAvailable } = await import("./db");
        dbReady = isDatabaseAvailable();
      } catch {}

      res.status(503).json({ 
        status: dbReady ? "starting" : "unavailable",
        server: areCoreRoutesRegistered ? "running" : "initializing",
        database: dbReady ? "warming-up" : "disconnected",
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Verify database connectivity with a quick ping
    const { pool } = await import("./db");
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    res.status(200).json({ 
      status: "ready",
      server: "running",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Ready Check] Database ping failed:", error);
    res.status(503).json({ 
      status: "unavailable",
      server: "running",
      database: "disconnected",
      timestamp: new Date().toISOString()
    });
  }
});

// CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || [])
  .concat(
    (process.env.REPLIT_DOMAINS?.split(',') || []).map(domain => 
      domain.trim().startsWith('http') ? domain.trim() : `https://${domain.trim()}`
    )
  )
  .concat(['http://localhost:5000', 'http://localhost:5001', 'http://127.0.0.1:5000', 'http://127.0.0.1:5001'])
  .concat(['https://appleid.apple.com']) // Allow Apple OAuth callback
  .filter(origin => origin && origin.trim().length > 0) // Remove empty strings
  .map(origin => origin.trim());

app.use((req: Request, res: Response, next: NextFunction) => {
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        // Allow no-origin in development (curl, Postman, etc.)
        // In production, allow only for mobile app requests (Capacitor/native apps)
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        // Mobile native apps and server-to-server don't send Origin header
        const userAgent = req.headers['user-agent'] || '';
        const isMobileApp = userAgent.includes('Sabq') || userAgent.includes('Capacitor') || userAgent.includes('okhttp') || userAgent.includes('CFNetwork');
        const isServerRequest = userAgent.includes('node-fetch') || userAgent.includes('axios') || !userAgent;
        if (isMobileApp || isServerRequest) {
          return callback(null, true);
        }
        console.warn(`[CORS] Blocked no-origin request in production. UA: ${userAgent.substring(0, 100)}`);
        return callback(null, true); // Still allow but log - gradual enforcement
      }
      
      const normalizedOrigin = origin.replace(/:5000$/, '').replace(/:5001$/, '');
      
      const isAllowed = allowedOrigins.includes(origin) || 
                        allowedOrigins.includes(normalizedOrigin) ||
                        allowedOrigins.some(allowed => allowed.replace(/:5000$/, '').replace(/:5001$/, '') === normalizedOrigin);
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`);
        console.warn(`[CORS] Allowed origins:`, allowedOrigins);
        callback(new Error('غير مسموح بالوصول من هذا المصدر'));
      }
    },
    credentials: true, // Allow cookies and authentication headers
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })(req, res, next);
});

// Security headers with Helmet.js - 'unsafe-inline' and 'unsafe-eval' needed for Swagger UI
const isDevelopment = process.env.NODE_ENV !== "production";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isDevelopment 
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "blob:"]
          : ["'self'", "'unsafe-inline'", "https:", "blob:"],
        connectSrc: ["'self'", "https:", "ws:", "wss:"],
        frameSrc: ["'self'", "https:"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        fontSrc: ["'self'", "data:", "https:"],
        mediaSrc: ["'self'", "data:", "https:", "blob:"],
        objectSrc: ["'none'"],
        workerSrc: ["'self'", "blob:"],
        baseUri: ["'self'"],
        formAction: ["'self'", "https://appleid.apple.com"],
        upgradeInsecureRequests: isDevelopment ? null : [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  })
);

// Enable Gzip compression for all responses
app.use(compression({
  filter: (req, res) => {
    // Don't compress if the request includes a Cache-Control: no-transform directive
    if (req.headers['cache-control']?.includes('no-transform')) {
      return false;
    }
    // Compress everything else
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9, default is 6)
  threshold: 1024, // Only compress responses larger than 1KB
}));

app.use((req: any, res: any, next: any) => {
  req._startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - req._startTime;
    if (duration > 5000) {
      console.warn(`[Perf] Slow request: ${req.method} ${req.path} took ${duration}ms (status: ${res.statusCode})`);
    }
  });
  
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Increased for base64 image uploads
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use('/uploads', express.static(uploadsRootDir));
console.log(`[Server] ✅ Static uploads directory configured: ${uploadsRootDir}`);

// Serve static files from public directory (for branding, logos, etc.)
const publicDir = path.join(process.cwd(), 'public');
app.use('/branding', express.static(path.join(publicDir, 'branding')));
console.log(`[Server] ✅ Static branding directory configured: ${publicDir}/branding`);

// Rate limiting configurations - use Cloudflare's real IP header
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // 10000 requests per IP per window (high-traffic site behind CDN)
  message: { message: "تم تجاوز حد الطلبات. يرجى المحاولة مرة أخرى بعد قليل" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false, keyGeneratorIpFallback: false },
  // Use Cloudflare's real visitor IP instead of proxy IP
  keyGenerator: (req) => {
    const cfIp = req.headers['cf-connecting-ip'] as string;
    const xForwardedFor = req.headers['x-forwarded-for'] as string;
    const realIp = cfIp || xForwardedFor?.split(',')[0]?.trim() || req.ip || 'unknown';
    return realIp;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path.startsWith("/health") || req.path.startsWith("/ready")) return true;
    // Skip rate limiting for authenticated admin users
    if (req.path.startsWith("/api/admin") && (req as any).isAuthenticated?.()) return true;
    // Skip rate limiting for ALL public GET endpoints
    if (req.method === "GET") return true;
    return false;
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: { message: "تم تجاوز حد محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window for sensitive operations
  message: { message: "تم تجاوز حد الطلبات للعمليات الحساسة. يرجى المحاولة بعد قليل" },
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "تم تجاوز حد طلبات الكتابة. يرجى المحاولة بعد قليل" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false, keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const cfIp = req.headers['cf-connecting-ip'] as string;
    const xForwardedFor = req.headers['x-forwarded-for'] as string;
    return cfIp || xForwardedFor?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  skip: (req) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true;
    return false;
  },
});

// Smart caching middleware - must come before routes
app.use((req, res, next) => {
  const path = req.path;
  
  // Hashed assets (Vite generates files like main-abc123.js)
  // Cache aggressively with immutable flag - s-maxage for Cloudflare CDN
  if (/\/assets\/.*\.(js|css)$/.test(path) && /[-_][a-f0-9]{8,}/.test(path)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
  }
  // Images and fonts - cache for 1 year (CDN and browser)
  else if (/\.(jpg|jpeg|png|gif|svg|webp|avif|ico|woff|woff2|ttf|eot)$/i.test(path)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400');
  }
  // HTML files - NEVER cache to prevent stale chunk references
  // This is critical for SPA deployments where JS chunks have content hashes
  else if (path.endsWith('.html') || path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store'); // CDN-specific (Cloudflare)
    res.setHeader('CDN-Cache-Control', 'no-store'); // Alternative CDN header
  }
  // API routes - cache is now controlled per-endpoint in routes.ts via cacheControl middleware
  // No default cache headers set here to allow individual routes to opt-in
  
  next();
});

// Apply general rate limiter to all API routes
app.use("/api", generalApiLimiter);
app.use("/api", writeLimiter);

// ============================================
// APM (Application Performance Monitoring) Middleware
// ============================================
const APM_BUFFER_SIZE = 1000;
const apmResponseBuffer = new Float64Array(APM_BUFFER_SIZE);
let apmBufferIndex = 0;
let apmBufferCount = 0;

const apmStats = {
  requests: { total: 0, success: 0, errors: 0 },
  slowRequests: [] as { path: string; method: string; duration: number; timestamp: Date }[],
  errorPaths: new Map<string, number>(),
};

// APM stats endpoint
app.get("/api/apm/stats", (req, res) => {
  const samplesCount = apmBufferCount;
  let avgResponseTime = 0;
  if (samplesCount > 0) {
    let sum = 0;
    for (let i = 0; i < samplesCount; i++) sum += apmResponseBuffer[i];
    avgResponseTime = sum / samplesCount;
  }

  const sortedTimes = Array.from(apmResponseBuffer.subarray(0, samplesCount)).sort((a, b) => a - b);
  const p95Index = Math.floor(samplesCount * 0.95);
  const p95ResponseTime = sortedTimes[p95Index] || 0;
  
  res.json({
    requests: apmStats.requests,
    performance: {
      avgResponseTime: Math.round(avgResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      samplesCount,
    },
    slowRequests: apmStats.slowRequests.slice(-10), // Last 10 slow requests
    topErrorPaths: Array.from(apmStats.errorPaths.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// Reset APM stats (for testing)
app.post("/api/apm/reset", (req, res) => {
  apmStats.requests = { total: 0, success: 0, errors: 0 };
  apmResponseBuffer.fill(0);
  apmBufferIndex = 0;
  apmBufferCount = 0;
  apmStats.slowRequests = [];
  apmStats.errorPaths.clear();
  res.json({ message: "APM stats reset successfully" });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // APM tracking for API routes
    if (path.startsWith("/api") && !path.includes("/apm/")) {
      apmStats.requests.total++;
      
      if (res.statusCode >= 200 && res.statusCode < 400) {
        apmStats.requests.success++;
      } else if (res.statusCode >= 400) {
        apmStats.requests.errors++;
        // Normalize path to avoid memory leak from dynamic IDs
        // Convert /api/articles/123 to /api/articles/:id
        const normalizedPath = path.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/gi, '/:uuid');
        const errorCount = apmStats.errorPaths.get(normalizedPath) || 0;
        apmStats.errorPaths.set(normalizedPath, errorCount + 1);
        // Cap error paths to prevent unbounded growth
        if (apmStats.errorPaths.size > 100) {
          const oldestKey = apmStats.errorPaths.keys().next().value;
          if (oldestKey) apmStats.errorPaths.delete(oldestKey);
        }
      }
      
      apmResponseBuffer[apmBufferIndex % APM_BUFFER_SIZE] = duration;
      apmBufferIndex++;
      if (apmBufferCount < APM_BUFFER_SIZE) apmBufferCount++;
      
      // Track slow requests (>1000ms)
      if (duration > 1000) {
        apmStats.slowRequests.push({
          path,
          method: req.method,
          duration,
          timestamp: new Date(),
        });
        if (apmStats.slowRequests.length > 50) {
          apmStats.slowRequests = apmStats.slowRequests.slice(-50);
        }
        console.warn(`[APM] ⚠️ Slow request: ${req.method} ${path} took ${duration}ms`);
      }
      
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      if (process.env.NODE_ENV !== 'production') console.log(logLine);
    }
  });

  next();
});

const isProduction = process.env.NODE_ENV === "production";
const port = (globalThis as any).__sabqPort || parseInt(process.env.PORT || '5000', 10);
const server = (globalThis as any).__sabqServer || createServer(app);

server.on("error", (error: any) => {
  console.error("[Server] ❌ Server error:", error);
  if (error.code === "EADDRINUSE") {
    console.error(`[Server] Port ${port} is already in use`);
  }
  process.exit(1);
});

async function startServerListening(): Promise<void> {
  if ((globalThis as any).__sabqServer || server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("error", onError);
      reject(error);
    };

    server.once("error", onError);
    server.listen({ port, host: "0.0.0.0" }, () => {
      server.off("error", onError);
      console.log(`[Server] ✅ Listening on port ${port}`);
      resolve();
    });
  });
}

function getDatabaseEnvStatus():
  | { status: "ok"; envName: "NEON_DATABASE_URL" | "DATABASE_URL" }
  | { status: "missing" }
  | { status: "invalid"; envName: "NEON_DATABASE_URL" | "DATABASE_URL"; value: string } {
  const candidates: Array<["NEON_DATABASE_URL" | "DATABASE_URL", string | undefined]> = [
    ["NEON_DATABASE_URL", process.env.NEON_DATABASE_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ];

  for (const [envName, rawValue] of candidates) {
    const value = rawValue?.trim();
    if (!value) {
      continue;
    }

    if (/\$\{[^}]+\}/.test(value)) {
      return { status: "invalid", envName, value };
    }

    try {
      new URL(value);
      return { status: "ok", envName };
    } catch {
      return { status: "invalid", envName, value };
    }
  }

  return { status: "missing" };
}

(async () => {
  try {
    console.log("[Server] Starting full initialization...");
    console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`[Server] Port: ${port}`);
    
    if (isProduction) {
      const databaseEnvStatus = getDatabaseEnvStatus();

      if (databaseEnvStatus.status === "missing") {
        console.error("[Server] ⚠️  WARNING: Missing required environment variable: DATABASE_URL or NEON_DATABASE_URL");
        console.error("[Server] Server will start but database features will not work");
      } else if (databaseEnvStatus.status === "invalid") {
        console.error(
          `[Server] ⚠️  WARNING: ${databaseEnvStatus.envName} is set but invalid: ${databaseEnvStatus.value}`
        );
        console.error("[Server] Replace it with a real PostgreSQL connection string before deploying");
      } else {
        console.log(`[Server] ✅ Database environment variable is present: ${databaseEnvStatus.envName}`);
      }
    }

    const { registerRoutes } = await import("./routes");
    const { edgeExistsHandler } = await import("./routes/edgeExistsRoute");
    app.get("/api/edge-exists", edgeExistsHandler);

    const audioNewsletterRoutes = await import("./routes/audioNewsletterRoutes");
    app.use("/api/audio-newsletters", audioNewsletterRoutes.default);
    console.log("[Server] ✅ Audio Newsletter routes registered (priority)");

    const mobileApiRoutes = (await import("./routes/mobileApiRoutes")).default;
    app.use("/api/v1", mobileApiRoutes);
    console.log("[Server] ✅ Mobile API routes registered (v1)");

    await registerRoutes(app, server);
    areCoreRoutesRegistered = true;
    console.log("[Server] ✅ Routes registered successfully");
    
    const { setupSwagger } = await import("./swagger");
    setupSwagger(app);
    console.log("[Server] ✅ Swagger documentation available at /api-docs");

    const nanoBananaRoutes = (await import("./routes/nanoBananaRoutes")).default;
    app.use("/api/nano-banana", nanoBananaRoutes);
    console.log("[Server] ✅ Nano Banana Pro routes registered");
    
    const notebookLmRoutes = (await import("./routes/notebookLmRoutes")).default;
    app.use("/api/notebooklm", notebookLmRoutes);
    console.log("[Server] ✅ NotebookLM routes registered");
    
    const visualAiRoutes = (await import("./routes/visualAiRoutes")).default;
    app.use("/api/visual-ai", visualAiRoutes);
    console.log("[Server] ✅ Visual AI routes registered");
    
    const autoImageRoutes = (await import("./routes/autoImageRoutes")).default;
    app.use("/api/auto-image", autoImageRoutes);
    console.log("[Server] ✅ Auto Image Generation routes registered");
    
    // Register Thumbnail routes
    const thumbnailRoutes = await import("./routes/thumbnailRoutes");
    app.use("/api/thumbnails", thumbnailRoutes.default);
    console.log("[Server] ✅ Thumbnail routes registered");
    
    // Register Story Cards routes
    const { storyCardsRouter } = await import("./routes/storyCardsRoutes");
    app.post("/api/story-cards/generate", storyCardsRouter.post["/generate"]);
    app.post("/api/story-cards/instagram-carousel", storyCardsRouter.post["/instagram-carousel"]);
    app.post("/api/story-cards/linkedin-document", storyCardsRouter.post["/linkedin-document"]);
    app.get("/api/story-cards/article/:articleId", storyCardsRouter.get["/article/:articleId"]);
    app.patch("/api/story-cards/:cardId", storyCardsRouter.patch["/:cardId"]);
    app.delete("/api/story-cards/:cardId", storyCardsRouter.delete["/:cardId"]);
    console.log("[Server] ✅ Story Cards routes registered");

    const rssFeedRoutes = (await import("./routes/rssFeedRoutes")).default;
    app.use("/api/rss", rssFeedRoutes);
    console.log("[Server] ✅ RSS Feed routes registered");
    
    const aiTasksRoutes = (await import("./routes/aiTasksRoutes")).default;
    app.use("/api/ai-tasks", aiTasksRoutes);
    console.log("[Server] ✅ AI Tasks routes registered");
    
    const advancedAnalyticsRoutes = (await import("./routes/advancedAnalytics")).default;
    app.use("/api/advanced-analytics", advancedAnalyticsRoutes);
    console.log("[Server] ✅ Advanced Analytics routes registered");
    
    const mediaStoreRoutes = (await import("./routes/mediaStoreRoutes")).default;
    app.use("/api/media-store", mediaStoreRoutes);
    console.log("[Server] ✅ Media Store routes registered");
    
    const quizRoutes = (await import("./quiz-routes")).default;
    app.use(quizRoutes);
    console.log("[Server] ✅ Quiz routes registered");

    const foreignNewsRoutes = (await import("./routes/foreignNewsRoutes")).default;
    app.use("/api/foreign-news", foreignNewsRoutes);
    console.log("[Server] ✅ Foreign News Monitoring routes registered");

    const smartClassificationRoutes = (await import("./routes/smartClassificationRoutes")).default;
    app.use("/api/smart-classification", smartClassificationRoutes);
    console.log("[Server] ✅ Smart Classification routes registered");

    // Social media crawler middleware - MUST come before Vite/static setup
    // This intercepts crawler requests and serves static HTML with proper meta tags
    const { socialCrawlerMiddleware } = await import("./socialCrawler");
    app.use(socialCrawlerMiddleware);
    console.log("[Server] ✅ Social crawler middleware registered");

    // SEO meta tag injection middleware - Injects dynamic title, OG, Twitter, canonical, JSON-LD
    // into the SPA HTML for all browsers (not just crawlers) to fix SEO indexing
    const { seoInjectorMiddleware } = await import("./seoInjector");
    app.use(seoInjectorMiddleware);
    console.log("[Server] ✅ SEO injector middleware registered (dynamic meta tags)");

    // Legacy URL redirects middleware - Redirects old URLs to new URLs
    // Uses legacy_redirects table for 301/302 redirects
    const { legacyRedirectMiddleware } = await import("./legacyRedirectMiddleware");
    app.use(legacyRedirectMiddleware);
    console.log("[Server] ✅ Legacy redirect middleware registered");

    // Content existence middleware - Returns HTTP 404 for non-existent articles/categories
    // This checks the database for content and sets 404 status for SEO (Googlebot, etc.)
    // The SPA HTML is still served, but with proper 404 status code
    const { contentExistenceMiddleware } = await import("./contentExistenceMiddleware");
    app.use(contentExistenceMiddleware);
    console.log("[Server] ✅ Content existence middleware registered (SEO 404)");

    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error(`[Server] Error: ${status} - ${message}`, err);
      
      const urlPath = req.path;
      if (urlPath.startsWith('/assets/') || urlPath.endsWith('.js') || urlPath.endsWith('.css') || urlPath.endsWith('.map')) {
        return res.status(status).type('text/plain').send('Server error');
      }
      
      if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
        if (process.env.NODE_ENV === 'production' && status >= 500) {
          res.status(status).json({ message: 'خطأ داخلي في الخادم', code: 'INTERNAL_SERVER_ERROR' });
        } else {
          res.status(status).json({ message });
        }
      } else {
        res.status(status).type('text/html').send(`<h1>Error ${status}</h1>`);
      }
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    
    const isProductionMode = process.env.NODE_ENV === "production" || 
                        process.env.REPLIT_DEPLOYMENT === "1" ||
                        fs.existsSync(path.resolve(import.meta.dirname, "public"));
    
    const { isValidSpaRoute } = await import("./utils/spaRouteMatcher");
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      const urlPath = req.path;
      
      if (urlPath.startsWith('/api/') || 
          urlPath.startsWith('/@') || 
          urlPath.startsWith('/node_modules/') ||
          urlPath.startsWith('/src/') ||
          urlPath.includes('.')) {
        return next();
      }
      
      if (!isValidSpaRoute(urlPath)) {
        // In production, serve index.html with proper 404 status
        const distPath = path.resolve(import.meta.dirname, "public");
        const indexPath = path.resolve(distPath, "index.html");
        
        if (fs.existsSync(indexPath)) {
          // Production mode: serve index.html with 404 status
          return res.status(404).sendFile(indexPath);
        }
        // Development mode: just set status (Vite will override but GA will track it)
        res.status(404);
      }
      
      next();
    });
    console.log("[Server] ✅ SEO-friendly 404 middleware registered");
    
    // Production-only: Intercept missing static asset requests before SPA fallback
    // This prevents returning index.html for missing JS/CSS chunks (MIME type errors)
    if (isProductionMode || app.get("env") !== "development") {
      const distPath = path.resolve(import.meta.dirname, "public");
      const staticExtensions = ['.js', '.css', '.map', '.mjs', '.cjs', '.woff', '.woff2', '.ttf', '.eot', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.json', '.xml', '.txt'];
      
      app.use((req: Request, res: Response, next: NextFunction) => {
        const urlPath = req.path;
        
        if (!urlPath.startsWith('/assets/') && !urlPath.startsWith('/branding/') && !urlPath.startsWith('/fixtures/')) {
          const isStaticAsset = staticExtensions.some(ext => urlPath.toLowerCase().endsWith(ext));
          if (!isStaticAsset) {
            return next();
          }
        }
        
        const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
        const filePath = path.join(distPath, safePath);
        
        if (!fs.existsSync(filePath)) {
          if (urlPath !== '/service-worker.js') {
            console.warn(`[Static 404] Missing asset: ${urlPath}`);
          }
          return res.status(404).type('text/plain').send('Not found');
        }
        
        next();
      });
      console.log("[Server] ✅ Static asset 404 guard registered");
    }
    
    // Middleware to set public caching headers for HTML pages
    // This overrides express-session's "no-store, private" for public pages
    // s-maxage allows Cloudflare edge caching, max-age=0 forces browser revalidation
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Only apply to HTML page requests (not API, assets, etc.)
      const acceptHeader = req.headers.accept || '';
      const isHtmlRequest = acceptHeader.includes('text/html') && 
                            !req.path.startsWith('/api/') && 
                            !req.path.startsWith('/uploads/') &&
                            !req.path.includes('.');
      
      if (isHtmlRequest) {
        // Override writeHead to set our cache headers last
        const originalWriteHead = res.writeHead.bind(res);
        res.writeHead = function(statusCode: number, ...args: any[]) {
          res.removeHeader('Cache-Control');
          res.removeHeader('cache-control');
          res.removeHeader('CDN-Cache-Control');
          // HTML must NEVER be cached by CDN or browser.
          // After every deploy, Vite renames JS chunks (content hash).
          // If old HTML is cached, browser requests old chunks → 404 → chunk mismatch crash.
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          res.setHeader('CDN-Cache-Control', 'no-store');
          res.setHeader('Surrogate-Control', 'no-store');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Vary', 'Accept-Encoding');
          return originalWriteHead(statusCode, ...args);
        } as typeof res.writeHead;
      }
      next();
    });
    console.log("[Server] ✅ Public HTML cache headers middleware registered");
    
    if (!isProductionMode && app.get("env") === "development") {
      console.log("[Server] Starting in DEVELOPMENT mode with Vite");
      const viteModulePath = `./${"vite"}`;
      const { setupVite } = await import(viteModulePath);
      await setupVite(app, server);
      console.log("[Server] ✅ Vite setup completed");
    } else {
      console.log("[Server] Starting in PRODUCTION mode with static files");
      const { serveStaticWithRocketLoaderFix } = await import("./rocketLoaderFix");
      serveStaticWithRocketLoaderFix(app);
      console.log("[Server] ✅ Static files setup with Cloudflare Rocket Loader fix");
    }

    console.log("[Server] ✅ Full initialization complete — all routes registered");

    let databaseWarmedUp = false;

    try {
      const { pool } = await import("./db");
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      databaseWarmedUp = true;
    } catch (error) {
      console.error("[Server] ⚠️  Database warmup failed; server will stay unready:", error);

      if (
        process.env.NODE_ENV === "production" &&
        process.env.ALLOW_PARTIAL_STARTUP !== "true"
      ) {
        throw error;
      }
    }

    await startServerListening();

    if (databaseWarmedUp) {
      isServerReady = true;
      if ((globalThis as any).__sabqMarkReady) {
        (globalThis as any).__sabqMarkReady();
      }
      console.log(`[Server] ✅ Database warmed up, server is now READY`);

      // Warm up dashboard stats cache in background (non-blocking)
      setImmediate(async () => {
        try {
          const { storage } = await import("./storage");
          const { memoryCache, CACHE_TTL } = await import("./memoryCache");
          console.log(`[Cache Warmup] 🔄 Pre-loading dashboard stats cache...`);
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
              author: article.author ? {
                firstName: article.author.firstName,
                lastName: article.author.lastName,
                email: article.author.email,
              } : undefined,
            })),
            topArticles: stats.topArticles.map((article: any) => ({
              id: article.id,
              title: article.title,
              slug: article.slug,
              englishSlug: article.englishSlug || undefined,
              status: article.status,
              publishedAt: article.publishedAt,
              views: article.views,
              category: article.category ? {
                nameAr: article.category.nameAr,
              } : undefined,
            })),
            recentComments: stats.recentComments.map((comment: any) => ({
              id: comment.id,
              content: comment.content ? comment.content.substring(0, 100) : '',
              status: comment.status,
              createdAt: comment.createdAt,
              user: comment.user ? {
                firstName: comment.user.firstName,
                lastName: comment.user.lastName,
              } : undefined,
            })),
          };
          memoryCache.set('admin:dashboard:stats', trimmedStats, CACHE_TTL.MEDIUM);
          console.log(`[Cache Warmup] ✅ Dashboard stats cache loaded successfully`);
        } catch (error) {
          console.error("[Cache Warmup] ⚠️  Dashboard stats cache warmup failed:", error);
        }
      });

      // Warm up critical caches in background (non-blocking)
      setImmediate(async () => {
        try {
          const port = parseInt(process.env.PORT || '5000', 10);
          console.log(`[Cache Warmup] 🔄 Pre-loading homepage cache...`);
          const [homepageRes, categoriesRes] = await Promise.all([
            fetch(`http://localhost:${port}/api/homepage-lite`),
            fetch(`http://localhost:${port}/api/categories`),
          ]);
          if (homepageRes.ok) {
            console.log(`[Cache Warmup] ✅ Homepage cache loaded successfully`);
          } else {
            console.error(`[Cache Warmup] ⚠️  Homepage cache warmup failed: HTTP ${homepageRes.status}`);
          }
          if (categoriesRes.ok) {
            console.log(`[Cache Warmup] ✅ Categories cache loaded successfully`);
          } else {
            console.error(`[Cache Warmup] ⚠️  Categories cache warmup failed: HTTP ${categoriesRes.status}`);
          }
        } catch (error) {
          console.error("[Cache Warmup] ⚠️  Cache warmup failed:", error);
        }
      });
    } else {
      console.warn("[Server] ⚠️  Listening in degraded mode; /ready will stay 503 until the database is healthy");
    }
      
      // Image migration PAUSED — re-enable when ready by restoring the auto-start block
      console.log("[Server] 🖼️ Image migration auto-start is DISABLED (paused manually)");

      const enableBackgroundWorkers = process.env.ENABLE_BACKGROUND_WORKERS === "true";
      
      const { tryBecomeLeader, isLeader, getPodId, startLeaderElectionLoop, onBecomeLeader } = await import("./leaderElection");
      await tryBecomeLeader();
      startLeaderElectionLoop(60000);
      
      if (enableBackgroundWorkers) {
        onBecomeLeader(async () => {
          console.log("[Server] Starting background workers after leader failover...");
          try {
            const { startNotificationWorker } = await import("./notificationWorker");
            startNotificationWorker();
          } catch (error) {
            console.error("[Server] Error starting notification worker after failover:", error);
          }
          try {
            const { startPushWorker } = await import("./jobs/pushWorker");
            startPushWorker();
          } catch (error) {
            console.error("[Server] Error starting push worker after failover:", error);
          }
        });
      }
      
      const shouldRunBackgroundJobs = enableBackgroundWorkers && isLeader();
      
      if (!enableBackgroundWorkers) {
        console.log("[Server] Background workers disabled (ENABLE_BACKGROUND_WORKERS not set)");
      } else if (!isLeader()) {
        console.log(`[Server] Pod ${getPodId()} is NOT the leader — background jobs on leader only`);
      } else {
        console.log(`[Server] Pod ${getPodId()} is the LEADER — background jobs enabled`);
      }
      
      if (shouldRunBackgroundJobs) {
        setImmediate(async () => {
          try {
            const { startNotificationWorker } = await import("./notificationWorker");
            startNotificationWorker();
          } catch (error) {
            console.error("[Server] Error starting notification worker:", error);
          }
        });

        setImmediate(async () => {
          try {
            const { startPushWorker } = await import("./jobs/pushWorker");
            startPushWorker();
          } catch (error) {
            console.error("[Server] Error starting push worker:", error);
          }
        });
      }

      // Register job queue handlers for TTS generation
      if (shouldRunBackgroundJobs) {
        setImmediate(async () => {
          try {
            const { jobQueue } = await import("./services/job-queue");
            const { getElevenLabsService } = await import("./services/elevenlabs");
            const { ObjectStorageService } = await import("./objectStorage");
            const { storage } = await import("./storage");

          jobQueue.onExecute(async (job) => {
            if (job.type === 'generate-tts') {
              console.log(`[JobQueue] Executing TTS generation job ${job.id}`);
              
              const { newsletterId } = job.data;
              const newsletter = await storage.getAudioNewsletterById(newsletterId);

              if (!newsletter) {
                throw new Error('النشرة الصوتية غير موجودة');
              }

              // Update status to processing
              await storage.updateAudioNewsletter(newsletter.id, {
                generationStatus: 'processing',
                generationError: null,
              });

              const elevenLabs = getElevenLabsService();
              const objectStorage = new ObjectStorageService();

              if (!elevenLabs) {
                await storage.updateAudioNewsletter(newsletter.id, {
                  generationStatus: 'failed',
                  generationError: 'ElevenLabs service is not available - missing API key',
                });
                throw new Error('ElevenLabs service is not configured');
              }

              // Build script from articles
              const articlesData = newsletter.articles?.map(na => ({
                title: na.article?.title || '',
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

              // Generate audio
              const audioBuffer = await elevenLabs.textToSpeech({
                text: script,
                voiceId: newsletter.voiceId || undefined,
                model: newsletter.voiceModel || undefined,
                voiceSettings: newsletter.voiceSettings || undefined,
              });

              // Upload to object storage
              const audioPath = `audio-newsletters/${newsletter.id}.mp3`;
              const uploadedFile = await objectStorage.uploadFile(
                audioPath,
                audioBuffer,
                'audio/mpeg'
              );

              // Update newsletter with audio details
              await storage.updateAudioNewsletter(newsletter.id, {
                audioUrl: uploadedFile.url,
                fileSize: audioBuffer.length,
                duration: Math.floor(audioBuffer.length / 16000), // Rough estimate
                generationStatus: 'completed',
                generationError: null,
              });

              console.log(`[JobQueue] Successfully generated audio for newsletter ${newsletter.id}`);
            } else if (job.type === 'generate-audio-brief') {
              console.log(`[JobQueue] Executing audio brief generation job ${job.id}`);
              
              const { briefId } = job.data;
              const brief = await storage.getAudioNewsBriefById(briefId);

              if (!brief) {
                throw new Error('الخبر الصوتي غير موجود');
              }

              // Update status to processing
              await storage.updateAudioNewsBrief(briefId, {
                generationStatus: 'processing',
              });

              const elevenLabs = getElevenLabsService();
              const objectStorage = new ObjectStorageService();

              if (!elevenLabs) {
                await storage.updateAudioNewsBrief(briefId, {
                  generationStatus: 'failed',
                });
                throw new Error('ElevenLabs service is not configured');
              }

              console.log(`[JobQueue] Generating TTS for audio brief ${briefId}`);
              console.log(`[JobQueue] Content length: ${brief.content.length} characters`);

              // Generate audio
              const audioBuffer = await elevenLabs.textToSpeech({
                text: brief.content,
                voiceId: brief.voiceId || undefined,
                voiceSettings: brief.voiceSettings || undefined,
              });

              // Upload to object storage
              const audioPath = `audio-briefs/brief_${briefId}_${Date.now()}.mp3`;
              const uploadedFile = await objectStorage.uploadFile(
                audioPath,
                audioBuffer,
                'audio/mpeg'
              );

              // Get audio duration (rough estimate: ~150 words per minute for Arabic)
              const wordCount = brief.content.split(/\s+/).length;
              const estimatedDuration = Math.ceil((wordCount / 150) * 60);

              // Update brief with audio details
              await storage.updateAudioNewsBrief(briefId, {
                audioUrl: uploadedFile.url,
                duration: estimatedDuration,
                generationStatus: 'completed',
              });

              console.log(`[JobQueue] Successfully generated audio for brief ${briefId}`);
            }
          });

            console.log("[Server] ✅ Job queue handlers registered successfully");
          } catch (error) {
            console.error("[Server] ⚠️  Error registering job queue handlers:", error);
            console.error("[Server] Server will continue running without job queue");
          }
        });
      }

      // ============================================
      // DELAYED BACKGROUND JOBS - تأخير الوظائف الخلفية
      // Wait 45 seconds before starting heavy jobs to allow traffic to be served first
      // This reduces deployment downtime significantly
      // ============================================
      const BACKGROUND_JOB_DELAY = 45000; // 45 seconds delay after server starts
      
      console.log(`[Server] 📅 Background jobs will start in ${BACKGROUND_JOB_DELAY / 1000} seconds...`);
      
      if (shouldRunBackgroundJobs) {
        setTimeout(async () => {
          try {
            const { startSeasonalCategoriesJob } = await import("./jobs/seasonalCategoriesJob");
            startSeasonalCategoriesJob();
          } catch (error) {
            console.error("[Server] Error starting seasonal categories job:", error);
          }
        }, BACKGROUND_JOB_DELAY);
      }

      if (shouldRunBackgroundJobs) {
        setTimeout(async () => {
          try {
            const { startDynamicCategoriesJob } = await import("./jobs/dynamicCategoriesJob");
            startDynamicCategoriesJob();
          } catch (error) {
            console.error("[Server] Error starting dynamic categories job:", error);
          }
        }, BACKGROUND_JOB_DELAY + 5000);
      }

      if (shouldRunBackgroundJobs) {
        setTimeout(async () => {
          try {
            const { startCampaignDailyResetJob } = await import("./jobs/campaignDailyResetJob");
            startCampaignDailyResetJob();
          } catch (error) {
            console.error("[Server] Error starting campaign daily reset job:", error);
          }
        }, BACKGROUND_JOB_DELAY + 10000);
      }

      if (shouldRunBackgroundJobs) {
        setTimeout(async () => {
          try {
            const { startNativeAdsDailyResetJob } = await import("./jobs/nativeAdsDailyResetJob");
            startNativeAdsDailyResetJob();
          } catch (error) {
            console.error("[Server] Error starting native ads daily reset job:", error);
          }
        }, BACKGROUND_JOB_DELAY + 15000);
      }
      
      // Start Audio Newsletter Jobs (scheduled generation and retries) - delayed
      if (shouldRunBackgroundJobs) {
        setTimeout(async () => {
          try {
            const { initializeAudioNewsletterJobs } = await import("./jobs/audioNewsletterJob");
            initializeAudioNewsletterJobs();
            console.log("[Server] ✅ Audio newsletter jobs started successfully");
          } catch (error) {
            console.error("[Server] ⚠️  Error starting audio newsletter jobs:", error);
            console.error("[Server] Server will continue running without audio newsletter automation");
          }
        }, BACKGROUND_JOB_DELAY + 20000); // +20s stagger
      }

      const enableNewsletterScheduler = process.env.ENABLE_NEWSLETTER_SCHEDULER !== 'false';
      
      if (shouldRunBackgroundJobs && enableNewsletterScheduler) {
        setTimeout(async () => {
          try {
            const { newsletterScheduler } = await import("./services/newsletterScheduler");
            newsletterScheduler.start();
            console.log("[Server] Newsletter scheduler started");
          } catch (error) {
            console.error("[Server] Error starting newsletter scheduler:", error);
          }
        }, BACKGROUND_JOB_DELAY + 25000);
      }
      
      const enableAITasksScheduler = process.env.ENABLE_AI_TASKS_SCHEDULER !== 'false';
      
      if (shouldRunBackgroundJobs && enableAITasksScheduler) {
        setTimeout(async () => {
          try {
            const { startAITasksScheduler } = await import("./jobs/aiTasksJob");
            startAITasksScheduler();
          } catch (error) {
            console.error("[Server] Error starting AI tasks scheduler:", error);
          }
        }, BACKGROUND_JOB_DELAY + 30000);
        
        setTimeout(async () => {
          try {
            const { startAiTasksCleanupJob } = await import("./jobs/aiTasksCleanup");
            startAiTasksCleanupJob();
          } catch (error) {
            console.error("[Server] Error starting AI tasks cleanup:", error);
          }
        }, BACKGROUND_JOB_DELAY + 40000);
        
        setTimeout(async () => {
          try {
            const { startArticleEditLocksCleanupJob } = await import("./jobs/articleEditLocksCleanup");
            startArticleEditLocksCleanupJob();
            const { startDatabaseCleanupJob } = await import("./jobs/databaseCleanupJob");
            startDatabaseCleanupJob();
          } catch (error) {
            console.error("[Server] Error starting cleanup jobs:", error);
          }
        }, BACKGROUND_JOB_DELAY + 50000);
        
        setTimeout(async () => {
          try {
            const { startIfoxContentGeneratorJob } = await import("./jobs/ifoxContentGeneratorJob");
            startIfoxContentGeneratorJob();
          } catch (error) {
            console.error("[Server] Error starting iFox generator:", error);
          }
        }, BACKGROUND_JOB_DELAY + 60000);
        
        setTimeout(async () => {
          try {
            const { startWorldDaysReminderJob } = await import("./jobs/worldDaysReminder");
            startWorldDaysReminderJob();
          } catch (error) {
            console.error("[Server] Error starting world days reminder:", error);
          }
        }, BACKGROUND_JOB_DELAY + 70000);
        
        setTimeout(async () => {
          try {
            const { startStaffCommunicationsScheduler } = await import("./jobs/staffCommunicationsJob");
            startStaffCommunicationsScheduler();
          } catch (error) {
            console.error("[Server] Error starting staff comms scheduler:", error);
          }
        }, BACKGROUND_JOB_DELAY + 80000);
        
        setTimeout(async () => {
          try {
            const { startForeignNewsJob } = await import("./jobs/foreignNewsJob");
            startForeignNewsJob();
          } catch (error) {
            console.error("[Server] Error starting foreign news job:", error);
          }
        }, BACKGROUND_JOB_DELAY + 85000);
        
        // Missing Thumbnails Regeneration - DISABLED for performance
        // TODO: Re-enable when missing images are fixed
        // setTimeout(async () => {
        //   try {
        //     const thumbnailService = await import('./services/thumbnailService');
        //     console.log("[Thumbnail Job] 🖼️ Starting missing thumbnails regeneration...");
        //     thumbnailService.generateMissingThumbnails(10).then(() => {
        //       console.log("[Thumbnail Job] ✅ Initial thumbnail regeneration completed");
        //     }).catch((err: any) => {
        //       console.error("[Thumbnail Job] ⚠️ Thumbnail regeneration error:", err);
        //     });
        //   } catch (error) {
        //     console.error("[Server] ⚠️ Error starting thumbnail job:", error);
        //   }
        // }, BACKGROUND_JOB_DELAY + 90000);
        console.log("[Thumbnail Job] ⏸️ Disabled for performance optimization");
        
        // Dashboard Stats Cache Refresh - runs every 4 minutes to keep cache warm
        setTimeout(async () => {
          try {
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
                    author: article.author ? {
                      firstName: article.author.firstName,
                      lastName: article.author.lastName,
                      email: article.author.email,
                    } : undefined,
                  })),
                  topArticles: stats.topArticles.map((article: any) => ({
                    id: article.id,
                    title: article.title,
                    slug: article.slug,
                    englishSlug: article.englishSlug || undefined,
                    status: article.status,
                    publishedAt: article.publishedAt,
                    views: article.views,
                    category: article.category ? {
                      nameAr: article.category.nameAr,
                    } : undefined,
                  })),
                  recentComments: stats.recentComments.map((comment: any) => ({
                    id: comment.id,
                    content: comment.content ? comment.content.substring(0, 100) : '',
                    status: comment.status,
                    createdAt: comment.createdAt,
                    user: comment.user ? {
                      firstName: comment.user.firstName,
                      lastName: comment.user.lastName,
                    } : undefined,
                  })),
                };
                memoryCache.set('admin:dashboard:stats', trimmedStats, CACHE_TTL.MEDIUM);
                console.log("[Dashboard Cache] ✅ Cache refreshed successfully");
              } catch (error) {
                console.error("[Dashboard Cache] ⚠️ Refresh failed:", error);
              }
            };
            
            setInterval(refreshDashboardCache, 10 * 60 * 1000);
            console.log("[Server] ✅ Dashboard Cache Refresh job started (every 10 minutes)");
          } catch (error) {
            console.error("[Server] ⚠️ Error starting dashboard cache refresh:", error);
          }
        }, BACKGROUND_JOB_DELAY + 100000);
        
      } else if (!shouldRunBackgroundJobs) {
        console.log("[Server] AI Tasks Scheduler skipped (background workers disabled or not leader)");
      } else {
        console.log("[Server] AI Tasks Scheduler disabled (set ENABLE_AI_TASKS_SCHEDULER=true to enable)");
      }

  } catch (error) {
    hasStartupFailed = true;
    startupErrorMessage = error instanceof Error ? error.message : String(error);
    isServerReady = false;
    areCoreRoutesRegistered = false;
    console.error("[Server] Fatal error during route initialization:", error);
    console.error("[Server] Stack trace:", error instanceof Error ? error.stack : "No stack trace available");
    console.error("[Server] Health/ready endpoints now report startup failure");

    const shouldFailFast =
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_PARTIAL_STARTUP !== "true";

    if (shouldFailFast) {
      console.error("[Server] Startup failed in production — shutting down process");
      server.close(() => process.exit(1));
      const forceExitTimer = setTimeout(() => process.exit(1), 5000);
      forceExitTimer.unref();
    }
  }
})();


if (!(globalThis as any).__sabqServer) {
  process.on("SIGTERM", () => {
    console.log("[Server] SIGTERM signal received: closing HTTP server");
    process.exit(0);
  });
  process.on("SIGINT", () => {
    console.log("[Server] SIGINT signal received: closing HTTP server");
    process.exit(0);
  });
}
