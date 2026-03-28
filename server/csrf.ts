import { Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "crypto";

declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
  }
}

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf-token";

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  return req.session.csrfToken;
}

export const getCsrfToken: RequestHandler = (req, res) => {
  const token = ensureCsrfToken(req);
  
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  res.json({ csrfToken: token });
};

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

const EXEMPT_PATHS = [
  "/api/login",
  "/api/register",
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/auth/apple",
  "/api/auth/apple/callback",
  "/api/forgot-password",
  "/api/reset-password",
  "/api/verify-email",
  "/api/csrf-token",
  "/api/webhooks/",
  "/api/whatsapp/",
  "/api/twilio/",
  "/api/email-agent/webhook",  // SendGrid inbound parse webhook
  "/api/correspondent-applications",  // Public reporter registration form
  "/api/accessibility/track",  // Accessibility tracking for anonymous users
  "/api/articles/",  // Article views for anonymous users
  "/api/en/articles/",  // English article views for anonymous users
  "/api/ur/articles/",  // Urdu article views for anonymous users
  "/api/native-ads/",  // Native ads tracking (impressions/clicks) for anonymous users
  "/api/store/auth/",  // Store customer authentication (login, register, etc.)
  "/api/store/cart",  // Store cart operations
  "/api/ai/chat",  // AI chatbot for public users
  "/api/en/chat",  // English AI chatbot
  "/api/ur/chat",  // Urdu AI chatbot
  "/api/test/",  // Test endpoints for development
  "/api/analytics/visitors/ping",  // Visitor heartbeat for anonymous users
  "/api/v1/",  // Mobile API (iOS/Android apps)
  "/api/angle-submissions",  // Public angle submission form (Muqtarab)
];

function isExemptPath(path: string, originalUrl: string): boolean {
  // Check both req.path and req.originalUrl since middleware mounting affects req.path
  return EXEMPT_PATHS.some(exempt => 
    path === exempt || path.startsWith(exempt) ||
    originalUrl === exempt || originalUrl.startsWith(exempt)
  );
}

export const validateCsrfToken: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  if (isExemptPath(req.path, req.originalUrl)) {
    return next();
  }

  if (!req.session) {
    console.warn("[CSRF] No session found for request:", req.path);
    return res.status(403).json({ 
      message: "الجلسة غير متوفرة. يرجى تحديث الصفحة والمحاولة مرة أخرى" 
    });
  }

  const sessionToken = req.session.csrfToken;
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!sessionToken) {
    console.warn("[CSRF] No session token for:", req.path);
    return res.status(403).json({ 
      message: "رمز الحماية غير متوفر. يرجى تحديث الصفحة والمحاولة مرة أخرى" 
    });
  }

  if (!headerToken) {
    console.warn("[CSRF] No X-CSRF-Token header for:", req.path);
    return res.status(403).json({ 
      message: "رمز الحماية مطلوب للعمليات الحساسة. يرجى تحديث الصفحة" 
    });
  }

  try {
    if (!crypto.timingSafeEqual(
      Buffer.from(sessionToken),
      Buffer.from(headerToken)
    )) {
      console.warn("[CSRF] Token mismatch for:", req.path);
      return res.status(403).json({ 
        message: "رمز الحماية غير صالح. يرجى تحديث الصفحة والمحاولة مرة أخرى" 
      });
    }
  } catch (error) {
    console.warn("[CSRF] Token comparison error for:", req.path, error);
    return res.status(403).json({ 
      message: "رمز الحماية غير صالح" 
    });
  }

  next();
};

export function regenerateCsrfToken(req: Request): string {
  req.session.csrfToken = generateCsrfToken();
  return req.session.csrfToken;
}
