# تقرير تحليل أداء موقع sabq.org

**التاريخ:** 31 مارس 2026  
**الموقع:** https://sabq.org  
**البنية التحتية:** React 18 + Vite 6 (SPA) → Express 4 → PostgreSQL (Neon) → Google Cloud Run (Autoscale) → Cloudflare CDN

---

## الملخص التنفيذي

الموقع يعاني من **بطء شديد في التحميل الأولي** بسبب ثلاث مشاكل رئيسية:
1. **TTFB مرتفع جداً (1.9 - 8.5 ثانية)** بسبب Cold Start في Cloud Run وضعف كاش Cloudflare
2. **عدم وجود SSR** - الموقع SPA بالكامل، المستخدم يشوف skeleton حتى يتحمل JS ويجلب البيانات
3. **حزمة JS رئيسية كبيرة (495KB / 150KB gzip)** بدون تقسيم مُحسّن

---

## نتائج القياسات

### TTFB (Time To First Byte)

```
مع DNS كامل:
  DNS: 6.76s | Connect: 6.88s | TLS: 7.83s | TTFB: 8.57s | Total: 8.61s

مع DNS محلول مسبقاً:
  DNS: 0.00s | Connect: 0.08s | TLS: 0.84s | TTFB: 7.55s | Total: 7.56s

طلبات متتالية (بعد تسخين الاتصال):
  Request 1: TTFB = 2.47s
  Request 2: TTFB = 1.87s
  Request 3: TTFB = 3.07s
```

**الاستنتاج:** حتى بدون DNS، السيرفر نفسه يأخذ 1.9 - 7.5 ثانية. هذا يدل على Cold Start في Cloud Run.

### أحجام الملفات

| الملف | حجم غير مضغوط | حجم مضغوط (gzip) |
|-------|---------------|-----------------|
| HTML الرئيسي | 22.5 KB | ~8 KB |
| JS الرئيسي (`index-DeTvI3OX.js`) | 495 KB | 150 KB |
| CSS الرئيسي (`index-DGK5GSN_.css`) | 384 KB | 49 KB |
| **إجمالي Assets** | **15 MB** | - |
| **عدد ملفات JS** | **593 ملف** (11.6 MB) | - |
| **عدد ملفات CSS** | **5 ملفات** (476 KB) | - |

### Headers الاستجابة

```
cf-cache-status: DYNAMIC          ← Cloudflare لا يخزن الـ HTML
cache-control: no-store, no-cache, must-revalidate, max-age=0
via: 1.1 google                   ← يمر عبر Google Cloud proxy
server: cloudflare
```

### API Homepage

```
TTFB: 1.27s | Size: ~113 KB (full response)
```

---

## المشاكل التفصيلية والحلول

---

### المشكلة 1: TTFB بطيء بسبب Cold Start + كاش Edge قصير جداً

**الملف:** `server/cacheMiddleware.ts`

**الوضع الحالي:**
```typescript
export const AUTOSCALE_CACHE = {
  HOMEPAGE: { maxAge: 0, sMaxAge: 15, staleWhileRevalidate: 15 },
  FEEDS: { maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 300 },
  ARTICLE: { maxAge: 120, sMaxAge: 600, staleWhileRevalidate: 300 },
  STATIC: { maxAge: 3600, sMaxAge: 7200, staleWhileRevalidate: 3600 },
  DASHBOARD: { maxAge: 0, sMaxAge: 180, staleWhileRevalidate: 300 },
};
```

**المشكلة:** `s-maxage: 15` للصفحة الرئيسية يعني أن Cloudflare يرمي الكاش كل 15 ثانية ويرجع للسيرفر الأصلي. إذا السيرفر في حالة Cold Start، المستخدم ينتظر 3-8 ثواني.

**الحل:**
```typescript
export const AUTOSCALE_CACHE = {
  // زيادة s-maxage إلى 60 ثانية مع stale-while-revalidate كبير
  // هذا يخلي Cloudflare يقدم المحتوى القديم فوراً بينما يجدد من السيرفر بالخلفية
  HOMEPAGE: { maxAge: 0, sMaxAge: 60, staleWhileRevalidate: 120 },
  FEEDS: { maxAge: 60, sMaxAge: 600, staleWhileRevalidate: 600 },
  ARTICLE: { maxAge: 120, sMaxAge: 900, staleWhileRevalidate: 600 },
  STATIC: { maxAge: 3600, sMaxAge: 14400, staleWhileRevalidate: 7200 },
  DASHBOARD: { maxAge: 0, sMaxAge: 300, staleWhileRevalidate: 600 },
};
```

**حل إضافي - Cloud Run Minimum Instances:**
في إعدادات Google Cloud Run، اضبط `minimum instances = 1` لمنع Cold Start نهائياً. هذا يزيد التكلفة قليلاً لكن يمنع أي تأخير Cold Start.

**الأثر المتوقع:** تقليل TTFB من 2-8 ثواني إلى أقل من 500ms لمعظم الطلبات.

---

### المشكلة 2: لا يوجد Server-Side Rendering (SSR)

**الملف:** `client/index.html`

**الوضع الحالي:** الـ HTML يرجع هيكل فاضي بـ skeleton loader:
```html
<div id="root">
  <div class="instant-loader">
    <div class="header">
      <div class="skeleton" style="width: 120px; height: 40px;"></div>
      ...
    </div>
  </div>
</div>
<script type="module" src="/src/main.tsx"></script>
```

**المشكلة:** المستخدم لازم ينتظر سلسلة متتالية (waterfall):
1. ⏳ تحميل HTML (22KB) — **1.9 - 8.5 ثانية**
2. ⏳ تحميل JS الرئيسي (150KB gzip) — **0.7 ثانية**
3. ⏳ تشغيل React — **~0.5 ثانية**
4. ⏳ جلب بيانات API — **~1.3 ثانية**
5. ✅ عرض المحتوى الفعلي

**الإجمالي التقريبي: 4.4 - 11 ثانية حتى يشوف المستخدم المحتوى**

**الحل المقترح (خيارات):**

**الخيار أ - Pre-rendering HTML في Cloudflare Worker (أسهل):**

الملف `cloudflare-worker/` موجود أصلاً. يمكن تحويل الـ Worker ليعمل pre-render للصفحات العامة:

```typescript
// cloudflare-worker/src/index.ts
// عند طلب الصفحة الرئيسية، يجلب البيانات من API
// ويحقن HTML المحتوى مباشرة في الاستجابة بدل skeleton
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // للصفحات العامة فقط (غير المسجلين)
    if (isPublicPage(url.pathname) && !hasAuthCookie(request)) {
      const [htmlShell, apiData] = await Promise.all([
        env.ASSETS.fetch(request), // HTML الأصلي
        fetch(`${env.ORIGIN}/api/homepage`), // بيانات الصفحة
      ]);
      
      const html = await htmlShell.text();
      const data = await apiData.json();
      
      // حقن المحتوى كـ JSON في window.__INITIAL_DATA__
      // وحقن HTML مُسبق العرض بدل skeleton
      const prerenderedHtml = injectPrerenderedContent(html, data);
      
      return new Response(prerenderedHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }
    
    return env.ASSETS.fetch(request);
  },
};
```

**الخيار ب - تفعيل SSR مع Vite SSR (أقوى لكن أصعب):**

يتطلب إضافة `server/ssr.ts` وتحويل `client/src/App.tsx` ليدعم `renderToString` من React.

**الخيار ج - Static Site Generation للصفحة الرئيسية:**

إنشاء cron job يولد HTML ثابت كل دقيقة ويرفعه لـ Cloudflare KV أو R2.

**الأثر المتوقع:** تقليل وقت عرض المحتوى من 4-11 ثانية إلى 1-2 ثانية.

---

### المشكلة 3: حزمة JS رئيسية كبيرة بدون تقسيم مُحسّن

**الملف:** `vite.config.ts`

**الوضع الحالي:**
```typescript
export default defineConfig({
  plugins: [react(), runtimeErrorOverlay()],
  resolve: { alias: { /* ... */ } },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
```

**المشكلة:** لا يوجد `build.rollupOptions.output.manualChunks`، فـ Vite يقسم الكود بشكل افتراضي مما ينتج 600 ملف صغير وحزمة رئيسية كبيرة (495KB).

**الحل:**
```typescript
export default defineConfig({
  plugins: [react(), runtimeErrorOverlay()],
  resolve: { alias: { /* ... */ } },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // فصل React و React DOM عن الكود الرئيسي
          'vendor-react': ['react', 'react-dom', 'react-dom/client'],
          // فصل مكتبات الـ routing والـ data fetching
          'vendor-core': ['wouter', '@tanstack/react-query'],
          // فصل Radix UI components
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
          ],
          // فصل مكتبات الرسوم البيانية (ثقيلة)
          'vendor-charts': ['recharts', 'apexcharts', 'react-apexcharts'],
          // فصل محرر النصوص (ثقيل)
          'vendor-editor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-image',
            '@tiptap/extension-link',
          ],
          // فصل Framer Motion
          'vendor-motion': ['framer-motion'],
        },
      },
    },
    // تقليل حجم CSS
    cssMinify: 'lightningcss',
    // تحسين حجم الـ chunks
    chunkSizeWarningLimit: 500,
  },
});
```

**الأثر المتوقع:** 
- الحزمة الرئيسية تنزل من ~495KB إلى ~150KB
- مكتبات الـ vendor تتخزن لفترة أطول في المتصفح لأنها لا تتغير كثيراً
- تحميل أسرع بـ 30-40%

---

### المشكلة 4: لا يوجد Module Preload

**الملف:** `client/index.html` (أو يحتاج تعديل في Vite config)

**الوضع الحالي:** لا يوجد `<link rel="modulepreload">` في HTML المنتج. المتصفح يكتشف الـ chunks واحد واحد (waterfall).

**الحل:** Vite يضيف `modulepreload` تلقائياً في البناء. تأكد أن Vite يعمل بشكل صحيح في البناء. إذا لم يُضف، أضف في `vite.config.ts`:

```typescript
build: {
  modulePreload: {
    polyfill: true, // يضيف polyfill للمتصفحات القديمة
  },
}
```

**حل إضافي - إضافة preload يدوي في `server/index.ts` أو Cloudflare Worker:**

في السيرفر، عند إرجاع HTML، أضف `Link` headers لأهم الملفات:
```typescript
// في middleware خاص بإرجاع HTML
app.get('*', (req, res, next) => {
  // أضف Early Hints أو Link headers لأهم الـ chunks
  res.setHeader('Link', [
    '</assets/vendor-react-HASH.js>; rel=modulepreload',
    '</assets/vendor-core-HASH.js>; rel=modulepreload',
    '</assets/index-HASH.css>; rel=preload; as=style',
  ].join(', '));
  next();
});
```

**الأثر المتوقع:** تقليل وقت تحميل JS بـ 200-500ms لأن المتصفح يبدأ تحميل كل الـ chunks بالتوازي.

---

### المشكلة 5: ثلاث عائلات خطوط (10 أوزان)

**الملف:** `client/index.html`

**الوضع الحالي:**
```html
<link id="google-fonts"
  href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700&family=Inter:wght@400;500;600&display=swap"
  rel="stylesheet" media="print">
```

**المشكلة:** تحميل 3 عائلات بـ 10 أوزان = ~300-500KB من بيانات الخطوط.

**الحل:**
```html
<!-- تقليل إلى عائلتين فقط بأوزان أقل -->
<link id="google-fonts"
  href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;600&display=swap"
  rel="stylesheet" media="print">
```

أو الأفضل: **استضافة الخطوط محلياً** بدل Google Fonts:
1. حمّل ملفات الخطوط بصيغة `woff2`
2. ضعها في `/public/fonts/`
3. استخدم `@font-face` في CSS مع `font-display: swap`

```css
@font-face {
  font-family: 'IBM Plex Sans Arabic';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/ibm-plex-sans-arabic-400.woff2') format('woff2');
}
```

**الأثر المتوقع:** توفير 100-300ms + إزالة اعتماد خارجي على Google Fonts.

---

### المشكلة 6: Cloudflare لا يخزن HTML

**الملف:** `server/index.ts` (سطر 278+)

**الوضع الحالي:** الـ HTML يرجع بـ:
```
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
cf-cache-status: DYNAMIC
```

**المشكلة:** لأن الاستجابة فيها `Set-Cookie` (session)، Cloudflare لا يخزنها حتى مع `s-maxage`.

**الحل:** في `server/index.ts`، عند إرجاع HTML للزوار غير المسجلين، لا ترسل `Set-Cookie`:

```typescript
// أضف middleware قبل static file serving
app.use((req, res, next) => {
  const isHtmlRequest = req.accepts('html') && !req.path.startsWith('/api/');
  const isAuthenticated = req.isAuthenticated?.();
  
  if (isHtmlRequest && !isAuthenticated) {
    // للزوار الجدد، لا ترسل session cookie مع HTML
    // حتى Cloudflare يقدر يخزن الاستجابة
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = function(name: string, value: any) {
      if (name.toLowerCase() === 'set-cookie') return res;
      return originalSetHeader(name, value);
    };
    
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.removeHeader('Surrogate-Control');
  }
  next();
});
```

أو استخدم **Cloudflare Page Rule**:
```
URL Pattern: sabq.org/
Cache Level: Cache Everything
Edge Cache TTL: 60 seconds
```

**الأثر المتوقع:** معظم الزوار يحصلون على HTML من Cloudflare Edge مباشرة بدون ما يوصل الطلب للسيرفر = TTFB أقل من 100ms.

---

### المشكلة 7: عدم وجود Compression مُحسّن (Brotli)

**الملف:** `server/index.ts`

**الوضع الحالي:**
```typescript
app.use(compression({
  level: 6,
  threshold: 1024,
}));
```

يستخدم **gzip** فقط. Brotli يوفر ضغط أفضل بـ 15-25%.

**الحل:** أضف `shrink-ray-current` أو استخدم Cloudflare's auto Brotli:

```bash
npm install shrink-ray-current
```

```typescript
import shrinkRay from 'shrink-ray-current';

// بدل compression العادي
app.use(shrinkRay({
  brotli: { quality: 4 }, // 4 للسرعة، 11 لأقصى ضغط
  zlib: { level: 6 },
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['cache-control']?.includes('no-transform')) return false;
    return true;
  },
}));
```

أو الأسهل: فعّل **Brotli في Cloudflare Dashboard** (Speed → Optimization → Content Optimization → Brotli = ON).

**الأثر المتوقع:** تقليل حجم النقل بـ 15-25%.

---

### المشكلة 8: عدم تحسين الصور (Image Optimization)

**الملفات:** `server/services/imageOptimizationService.ts`, `client/src/components/OptimizedImage.tsx`

**الوضع الحالي:** يوجد خدمة تحسين صور لكن تأكد من:

**الحل - تأكد من التالي:**
1. كل الصور تُقدم بصيغة WebP/AVIF
2. الصور فيها `width` و `height` attributes (لمنع Layout Shift)
3. الصور في above-the-fold فيها `loading="eager"` و `fetchpriority="high"`
4. باقي الصور فيها `loading="lazy"`
5. استخدم `srcset` و `sizes` لتقديم أحجام مختلفة حسب الشاشة

```tsx
// مثال لمكون صورة مُحسّن
<img
  src="/api/image/optimized?url=ORIGINAL&w=800&format=webp"
  srcSet="/api/image/optimized?url=ORIGINAL&w=400&format=webp 400w,
         /api/image/optimized?url=ORIGINAL&w=800&format=webp 800w,
         /api/image/optimized?url=ORIGINAL&w=1200&format=webp 1200w"
  sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
  width={800}
  height={450}
  loading="lazy"
  decoding="async"
  alt="وصف الصورة"
/>
```

---

### المشكلة 9: Third-party Scripts تأثر على الأداء

**الملف:** `client/index.html`

**الوضع الحالي (جيد نسبياً):**
- Google Analytics مؤجل 5 ثواني ✅
- GPT/GTM مؤجلة حتى تفاعل المستخدم ✅

**تحسينات إضافية:**
```html
<!-- أضف dns-prefetch لكل الـ third-party domains -->
<link rel="dns-prefetch" href="https://www.googletagmanager.com">
<link rel="dns-prefetch" href="https://securepubads.g.doubleclick.net">
<link rel="dns-prefetch" href="https://www.google-analytics.com">

<!-- أضف resource hints للموارد المهمة -->
<link rel="preload" href="/assets/index-HASH.js" as="script" crossorigin>
<link rel="preload" href="/assets/index-HASH.css" as="style">
```

---

### المشكلة 10: Memory Cache قد يكون غير كافي

**الملف:** `server/memoryCache.ts`

**الحل:** تأكد من أن الـ memory cache يخزن نتائج الـ API الثقيلة:
- `/api/homepage` — يجب أن يُخزن لمدة 30-60 ثانية على الأقل
- `/api/articles/:slug` — يجب أن يُخزن لمدة 2-5 دقائق
- `/api/categories` — يجب أن يُخزن لمدة ساعة

تأكد أن `memoryCache` و `withCache` و `withSWR` مُستخدمة في كل الـ routes الثقيلة.

---

## خطة التنفيذ (مرتبة حسب الأولوية والسهولة)

### المرحلة 1 — تغييرات سريعة (يوم واحد)

| # | المهمة | الملف | الأثر |
|---|--------|-------|-------|
| 1.1 | زيادة `s-maxage` للـ HOMEPAGE من 15 إلى 60 ثانية | `server/cacheMiddleware.ts` | عالي |
| 1.2 | زيادة `stale-while-revalidate` للـ HOMEPAGE إلى 120 ثانية | `server/cacheMiddleware.ts` | عالي |
| 1.3 | تفعيل Brotli في Cloudflare Dashboard | Cloudflare Dashboard | متوسط |
| 1.4 | ضبط Cloud Run `min-instances = 1` | Google Cloud Console | عالي |
| 1.5 | إضافة Cloudflare Page Rule لكاش الصفحة الرئيسية | Cloudflare Dashboard | عالي |

### المرحلة 2 — تحسينات الـ Frontend (2-3 أيام)

| # | المهمة | الملف | الأثر |
|---|--------|-------|-------|
| 2.1 | إضافة `manualChunks` في Vite config | `vite.config.ts` | عالي |
| 2.2 | تقليل عائلات الخطوط من 3 إلى 2 | `client/index.html` | متوسط |
| 2.3 | إضافة `modulepreload` و `preload` hints | `client/index.html` أو Server middleware | متوسط |
| 2.4 | استضافة الخطوط محلياً (self-host) | `public/fonts/` + CSS | متوسط |
| 2.5 | إضافة `dns-prefetch` لـ third-party domains | `client/index.html` | منخفض |

### المرحلة 3 — SSR أو Pre-rendering (أسبوع+)

| # | المهمة | الملف | الأثر |
|---|--------|-------|-------|
| 3.1 | تطوير Cloudflare Worker لـ pre-render الصفحات العامة | `cloudflare-worker/` | عالي جداً |
| 3.2 | حقن بيانات API في HTML كـ `window.__INITIAL_DATA__` | Worker + Client | عالي جداً |
| 3.3 | إزالة Set-Cookie من HTML للزوار غير المسجلين | `server/index.ts` | عالي |
| 3.4 | أو: تحويل إلى Vite SSR كامل | بنية المشروع كاملة | عالي جداً |

### المرحلة 4 — تحسينات متقدمة (مستمر)

| # | المهمة | الملف | الأثر |
|---|--------|-------|-------|
| 4.1 | تحسين الصور (WebP/AVIF, srcset, lazy loading) | Components | متوسط |
| 4.2 | استخدام Brotli في السيرفر (`shrink-ray-current`) | `server/index.ts` | منخفض-متوسط |
| 4.3 | تحسين Memory Cache للـ API routes الثقيلة | `server/routes.ts` | متوسط |
| 4.4 | إضافة Service Worker للكاش المحلي | `public/sw.js` | متوسط |
| 4.5 | تحليل ومراقبة Core Web Vitals بشكل دوري | Analytics | مستمر |

---

## الأهداف المستهدفة بعد التحسين

| المقياس | الحالي | الهدف |
|---------|--------|-------|
| TTFB | 1.9 - 8.5s | < 500ms |
| FCP (First Contentful Paint) | ~4-11s | < 1.5s |
| LCP (Largest Contentful Paint) | ~6-15s | < 2.5s |
| JS Bundle (Main) | 150KB gzip | < 80KB gzip |
| CSS Bundle | 49KB gzip | < 35KB gzip |
| PageSpeed Mobile Score | ~30-40 (تقدير) | > 70 |
| PageSpeed Desktop Score | ~50-60 (تقدير) | > 85 |

---

## ملاحظات مهمة

1. **لا تغير `cache-control: no-store` للـ HTML بدون اختبار** — هذا يمنع مشاكل الـ chunk mismatch بعد كل deployment. الحل الصحيح هو استخدام `s-maxage` فقط (Cloudflare يخزن، المتصفح لا يخزن).

2. **الـ Chunk Error Handler موجود ومهم** — الكود في `main.tsx` و `App.tsx` يتعامل مع مشاكل تحميل chunks قديمة بعد deployments. لا تحذفه.

3. **الاختبار بعد كل تغيير** — بعد كل تغيير، شغل:
   ```bash
   # قياس TTFB
   curl -o /dev/null -s -w "TTFB: %{time_starttransfer}s\n" https://sabq.org
   
   # قياس حجم JS
   curl -s -o /dev/null -w "Size: %{size_download}\n" -H "Accept-Encoding: gzip" https://sabq.org/assets/index-HASH.js
   ```

4. **Cloudflare Cache Purge** — بعد تغيير إعدادات الكاش، نفذ cache purge من Cloudflare Dashboard.
