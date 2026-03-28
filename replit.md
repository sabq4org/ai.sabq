# Sabq Smart News Platform

## Overview
Sabq Smart is an AI-powered, trilingual (Arabic, English, and Urdu) news platform designed to redefine news consumption. It leverages AI for summarization, personalized recommendations, content management, and viral social media distribution. The platform aims to deliver an advanced news experience through features like trilingual dashboards, independent content management per language, smart links, AI-powered SEO, one-click AI content generation, and detailed social sharing analytics, ultimately enhancing news consumption and achieving social media virality.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features an RTL-first design with custom light/dark theming, Arabic-optimized fonts, and a multi-section homepage. It includes a comprehensive publishing template system with Framer Motion animations, mobile responsiveness, and WCAG 2.1 AA accessibility. The system is trilingual with separate database schemas, language-specific dashboards, and an i18n system. The iFox AI Portal has a futuristic dark mode with glassmorphism effects and an animated AI mascot. The iFox Admin Dashboard is a mobile-responsive "portal within a portal" for content, media, scheduling, analytics, and settings management. The Visual AI Image Studio provides enterprise-grade AI image generation, professional infographic creation with Arabic RTL optimization, and automatic Google Cloud Storage uploads.

### Technical Implementations
The frontend uses Next.js 15, React 18, Vite, Wouter for routing, TypeScript, and TanStack Query. The backend is an Express.js server with TypeScript, exposing RESTful APIs. Authentication utilizes Passport.js. PostgreSQL (Neon serverless) is the database, accessed via Drizzle ORM. Google Cloud Storage handles file storage, and Server-Sent Events (SSE) provide real-time features. An image optimization pipeline includes WebP conversion, responsive sizing, thumbnail generation, blur placeholders, and optimized caching. Native mobile app support is achieved via Capacitor for iOS and Android.

### Feature Specifications
Key features include:
-   **AI Content Features:** AI article classification, multilingual SEO generation, AI ChatBot Assistant, Audio Summary, Daily Briefs, Smart Content Generation System, Deep Analysis Engine, AI Image Transparency System, and one-click AI Article Translation (Arabic→English with auto-publish).
-   **Content Management:** Full lifecycle management for articles, news, users, and categories, with an advanced WYSIWYG editor and Smart Media Library.
-   **Personalization:** AI-powered recommendations based on behavioral analysis.
-   **Real-Time & Notifications:** "Moment by Moment" Live News Desk with a breaking news ticker and an advanced Smart Notification System v2.0.
-   **Social Media & SEO:** Enterprise-grade viral distribution with click tracking, Social Crawler Middleware for Open Graph meta tags, Dynamic Metadata System, and comprehensive technical SEO (canonical URLs, hreflang, JSON-LD, sitemaps, IndexNow).
-   **Specialized Systems:** iFox Content Generator, Audio Newsletter System (ElevenLabs TTS), Intelligent Email Agent System (email-to-article publishing), WhatsApp Auto-Publish System, URL Content Extraction, Publisher/Agency Content Sales, Muqtarab (non-news content), and a Media Services Store with an Admin Dashboard.
-   **Advanced AI & Security:** AI Comment Moderation (GPT-4o-mini), Advanced Search (Arabic text normalization), Smart Auto-Format (GPT-5.1), and Full Role-Based Access Control (RBAC).
-   **Other:** Digital Credentials (Apple Wallet PassKit), Hierarchical Task Management, Native Ads Daily Budget System, Short URL System, Gulf Live Coverage (real-time attack tracking), Push Notification System (FCM), and a Unified Membership System.

### Performance & Caching
The platform uses a Stale-While-Revalidate (SWR) in-memory cache (`server/memoryCache.ts`) for high-traffic endpoints. Key TTLs are defined in the `CACHE_TTL` object (SHORT=2min, MEDIUM=5min, LONG=15min, HOMEPAGE=10min). **Important:** Never redeclare `CACHE_TTL` as a local variable in `server/routes.ts` — doing so shadows the imported object and breaks all SWR caching. Cache warmup on server start pre-loads homepage and categories. The `/api/keyword/:keyword` endpoint uses a GIN index with `@>` operator for fast jsonb keyword search. A 5-minute memory cache sits on top.

### System Design Choices
Core data models include Users, Articles, Categories, Comments, Reactions, Bookmarks, Reading History, and Media Library. AI integration leverages OpenAI GPT-5.1. The platform includes scope-aware theme management, a Content Import System, and a Smart Categories architecture. The Media Library provides centralized asset management with AI-powered keyword extraction. Drizzle ORM with versioned migrations manages database schema. The publisher content sales system uses a three-table architecture with RBAC and atomic credit deductions. Article ordering uses a hybrid approach of curated sections and chronological feeds. The iFox Category Management System uses a dedicated endpoint with server-side in-memory caching. The AI Tasks System integrates GPT-5.1 for structured JSON responses, atomic race condition prevention, and automated cleanup jobs. Performance optimizations include database pooling, leader election, Cloudflare CDN/Images integration, various caching mechanisms (session, RBAC, SEO, crawler), optimized database queries, and a bootstrap entry point for faster cold starts.

## External Dependencies

-   **Authentication & Identity:** Passport.js (`passport-local`, `passport-google-oauth20`, `passport-apple`), `express-session`, `connect-pg-simple`, `connect-redis`, `apple-signin-auth`
-   **Database & ORM:** `@neondatabase/serverless` (PostgreSQL), `drizzle-orm`, `drizzle-kit`
-   **Caching & Sessions:** `ioredis` + `connect-redis` (optional Redis via `REDIS_URL`, falls back to PostgreSQL)
-   **AI & Machine Learning:** OpenAI API (GPT-5.1), ElevenLabs API
-   **Email Service:** SendGrid
-   **Messaging Services:** Twilio API (WhatsApp Business API integration)
-   **File Storage:** `@google-cloud/storage`, Cloudflare Images, `@aws-sdk/client-s3` (Cloudflare R2 support)
-   **Content Processing:** `rss-parser`, `mammoth`, Puppeteer
-   **Digital Credentials:** `passkit-generator`
-   **Mobile App Development:** Capacitor
-   **Push Notifications:** Firebase Cloud Messaging (FCM)