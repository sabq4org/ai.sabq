/**
 * Database Connection - Neon Serverless PostgreSQL via Drizzle ORM
 * 
 * This module establishes a read-only connection to the existing Sabq database.
 * Phase 1: Only SELECT queries are used for the public-facing website.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);
