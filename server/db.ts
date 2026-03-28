// Reference: javascript_database blueprint
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNodePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import ws from "ws";
import pg from "pg";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = "password";
neonConfig.coalesceWrites = true;
neonConfig.useSecureWebSocket = true;

const { Pool: NodePgPool } = pg;

type DatabasePool = InstanceType<typeof NeonPool> | InstanceType<typeof NodePgPool>;
type DatabaseClient = NeonDatabase<typeof schema> | NodePgDatabase<typeof schema>;
type PoolOptions = ReturnType<typeof getPoolOptions>;

// Graceful database connection with error handling
let pool: DatabasePool;
let db: DatabaseClient;
let _dbConnected = false;
let _dbLastError: string | null = null;
let _reconnectTimer: ReturnType<typeof setInterval> | null = null;
let _activePoolOptions: PoolOptions | null = null;

function normalizeDatabaseUrl(
  envName: "NEON_DATABASE_URL" | "DATABASE_URL",
  rawValue: string | undefined
): string | undefined {
  const trimmedValue = rawValue?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  if (/\$\{[^}]+\}/.test(trimmedValue)) {
    console.error(
      `[DB] ${envName} contains an unresolved placeholder: ${trimmedValue}`
    );
    console.error(
      `[DB] Replace it with a real PostgreSQL connection string before starting the server.`
    );
    return undefined;
  }

  try {
    new URL(trimmedValue);
    return trimmedValue;
  } catch {
    console.error(`[DB] ${envName} is not a valid URL: ${trimmedValue}`);
    return undefined;
  }
}

function getDatabaseUrl(): string | undefined {
  return (
    normalizeDatabaseUrl("NEON_DATABASE_URL", process.env.NEON_DATABASE_URL) ||
    normalizeDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL)
  );
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function readPoolNumberEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(`[DB] Invalid ${name}="${rawValue}". Falling back to ${fallback}.`);
    return fallback;
  }

  return parsed;
}

function getProcessRole(): "web" | "worker" {
  return process.env.SABQ_PROCESS_ROLE === "worker" ? "worker" : "web";
}

function getPoolOptions(databaseUrl: string) {
  const processRole = getProcessRole();
  const defaultMax = processRole === "worker" ? 5 : 10;

  return {
    connectionString: databaseUrl,
    max: readPoolNumberEnv("DB_POOL_MAX", defaultMax),
    min: readPoolNumberEnv("DB_POOL_MIN", 0),
    idleTimeoutMillis: readPoolNumberEnv("DB_POOL_IDLE_TIMEOUT_MS", 30000),
    connectionTimeoutMillis: readPoolNumberEnv("DB_POOL_CONNECTION_TIMEOUT_MS", 10000),
    allowExitOnIdle: true,
    maxUses: readPoolNumberEnv("DB_POOL_MAX_USES", 5000),
  };
}

function initPool(databaseUrl: string): void {
  const useLocalPostgres = isLocalDatabaseUrl(databaseUrl);
  const isExternalNeon = !!process.env.NEON_DATABASE_URL;
  const modeLabel = useLocalPostgres ? 'Local PostgreSQL' : (isExternalNeon ? 'External Neon' : 'Replit DB');
  const poolOptions = getPoolOptions(databaseUrl);
  _activePoolOptions = poolOptions;

  console.log(`[DB] Initializing connection (${modeLabel})...`);

  if (useLocalPostgres) {
    pool = new NodePgPool(poolOptions);
    db = drizzleNodePg({ client: pool as InstanceType<typeof NodePgPool>, schema });
  } else {
    pool = new NeonPool(poolOptions);
    db = drizzleNeon({ client: pool as InstanceType<typeof NeonPool>, schema });
  }
  
  pool.on('error', (err) => {
    console.error('[Pool] Unexpected client error:', err.message);
    _dbConnected = false;
    _dbLastError = err.message;
    startReconnectLoop();
  });
}

async function verifyConnection(): Promise<boolean> {
  try {
    if (!pool) return false;
    const start = Date.now();
    await pool.query('SELECT 1');
    const elapsed = Date.now() - start;
    _dbConnected = true;
    _dbLastError = null;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] Connection verified (${elapsed}ms)`);
    }
    return true;
  } catch (error: any) {
    _dbConnected = false;
    _dbLastError = error.message || 'Unknown error';
    console.error(`[DB] Connection verification failed: ${_dbLastError}`);
    return false;
  }
}

let _dbMaintenanceDone = false;

async function runStartupMaintenance(): Promise<void> {
  if (_dbMaintenanceDone) return;
  _dbMaintenanceDone = true;
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_articles_homepage_order ON articles (status, hide_from_homepage, display_order DESC, published_at DESC)`);
    console.log('[DB] Homepage order index ensured');
  } catch (err: any) {
    console.warn('[DB] Homepage order index creation skipped:', err.message);
  }
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_articles_breaking ON articles (status, hide_from_homepage, news_type, published_at DESC)`);
    console.log('[DB] Breaking news index ensured');
  } catch (err: any) {
    console.warn('[DB] Breaking news index creation skipped:', err.message);
  }
  setTimeout(async () => {
    try {
      await pool.query('ANALYZE articles');
      console.log('[DB] ANALYZE articles completed - query planner stats updated');
    } catch (err: any) {
      console.warn('[DB] ANALYZE articles skipped:', err.message);
    }
  }, 30000);
  // VACUUM to remove dead tuples from bulk search_vector UPDATE (runs once after 2 min)
  setTimeout(async () => {
    try {
      await pool.query('VACUUM articles');
      console.log('[DB] VACUUM articles completed - dead tuples removed');
    } catch (err: any) {
      console.warn('[DB] VACUUM articles skipped:', err.message);
    }
  }, 120000);
}

function startReconnectLoop(): void {
  if (_reconnectTimer) return;
  
  console.warn('[DB] Starting reconnection loop (every 10s)...');
  _reconnectTimer = setInterval(async () => {
    console.log('[DB] Attempting reconnection...');
    
    try {
      const connected = await verifyConnection();
      if (connected) {
        console.log('[DB] Reconnection successful');
        stopReconnectLoop();
        runStartupMaintenance();
      }
    } catch (error: any) {
      console.error(`[DB] Reconnection attempt failed: ${error.message}`);
    }
  }, 10000);
  _reconnectTimer.unref();
}

function stopReconnectLoop(): void {
  if (_reconnectTimer) {
    clearInterval(_reconnectTimer);
    _reconnectTimer = null;
    console.log('[DB] Reconnection loop stopped');
  }
}

try {
  const databaseUrl = getDatabaseUrl();
  
  if (!databaseUrl) {
    console.error("[DB] No database URL configured. Database features will be unavailable.");
    console.error("Please set NEON_DATABASE_URL (external) or DATABASE_URL in your deployment settings.");
    throw new Error("Database URL must be set. Did you forget to provision a database?");
  }

  initPool(databaseUrl);
  
  console.log("[DB] Pool initialized");
  if (_activePoolOptions) {
    console.log(
      `[DB] Pool config: role=${getProcessRole()}, max=${_activePoolOptions.max}, min=${_activePoolOptions.min}, idleTimeout=${Math.round(_activePoolOptions.idleTimeoutMillis / 1000)}s, connTimeout=${Math.round(_activePoolOptions.connectionTimeoutMillis / 1000)}s, allowExitOnIdle=true`
    );
  }
  
  const monitorInterval = process.env.NODE_ENV === 'production' ? 300000 : 60000;
  const monitorTimer = setInterval(() => {
    const stats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
    
    if (stats.waiting > 0 || stats.idle === 0) {
      console.warn(`[Pool Monitor] Connections: total=${stats.total}, idle=${stats.idle}, waiting=${stats.waiting}`);
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(`[Pool Monitor] Connections: total=${stats.total}, idle=${stats.idle}, waiting=${stats.waiting}`);
    }
  }, monitorInterval);
  monitorTimer.unref();
  
  console.log('[DB] Keep-alive disabled to allow Neon auto-suspend (cost optimization)');
  
  verifyConnection().then(async (connected) => {
    if (!connected) {
      startReconnectLoop();
    } else {
      runStartupMaintenance();
    }
  });
  
} catch (error: any) {
  console.error("[DB] Initialization error:", error.message);
  console.error("Please set NEON_DATABASE_URL or DATABASE_URL and restart.");
  
  if (process.env.NODE_ENV === 'production') {
    console.error("[PRODUCTION] Server will start without DB to serve static pages. API calls will return 503.");
    startReconnectLoop();
  } else {
    console.error("[DEV] Server cannot start without a valid database connection.");
    throw error;
  }
}

export function isDatabaseAvailable(): boolean {
  return pool !== undefined && db !== undefined && _dbConnected;
}

export function getDatabaseStatus(): { connected: boolean; lastError: string | null; reconnecting: boolean } {
  return {
    connected: _dbConnected,
    lastError: _dbLastError,
    reconnecting: _reconnectTimer !== null,
  };
}

// Slow query threshold in milliseconds
const SLOW_QUERY_THRESHOLD = 500;

// Helper function to wrap queries with timing and logging
export async function timedQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await queryFn();
    const elapsed = Date.now() - start;
    
    if (elapsed > SLOW_QUERY_THRESHOLD) {
      console.warn(`🐢 [Slow Query] ${queryName}: ${elapsed}ms (threshold: ${SLOW_QUERY_THRESHOLD}ms)`);
    } else if (process.env.NODE_ENV !== 'production' && elapsed > 100) {
      console.log(`⏱️ [Query] ${queryName}: ${elapsed}ms`);
    }
    
    return result;
  } catch (error) {
    const elapsed = Date.now() - start;
    console.error(`❌ [Query Error] ${queryName}: ${elapsed}ms`, error);
    throw error;
  }
}

// Pool stats helper for debugging
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

export { pool, db };
