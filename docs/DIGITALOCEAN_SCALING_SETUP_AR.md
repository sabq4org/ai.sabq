# إعداد سبق على DigitalOcean لتحمل الضغط

هذا المشروع أصبح يدعم فصل خدمة الويب عن خدمة المهام الخلفية.

## المكونات المقترحة

### 1) Web Service

- الغرض: خدمة الواجهة العامة ولوحة التحكم وطلبات API.
- الأمر:

```bash
npm run start
```

- المتغيرات المقترحة:

```env
ENABLE_BACKGROUND_WORKERS=false
SABQ_PROCESS_ROLE=web
DB_POOL_MAX=10
DB_POOL_MIN=0
```

### 2) Worker Component

- الغرض: تشغيل الوظائف الخلفية فقط مثل:
  - WhatsApp aggregator
  - notification worker
  - push worker
  - cron jobs
  - audio/job queue handlers
- الأمر:

```bash
npm run start:worker
```

- المتغيرات المقترحة:

```env
ENABLE_BACKGROUND_WORKERS=true
SABQ_PROCESS_ROLE=worker
DB_POOL_MAX=5
DB_POOL_MIN=0
```

## الخدمات المساندة المطلوبة

### PostgreSQL

- استخدم رابط pooled endpoint وليس direct endpoint إذا كانت القاعدة على Neon أو DigitalOcean Managed PostgreSQL.
- لا ترفع عدد اتصالات التطبيق قبل مراقبة الاستهلاك الفعلي.

### Redis / Valkey

- اربط `REDIS_URL` حتى تنتقل الجلسات بعيدًا عن PostgreSQL.
- هذا مهم جدًا لأن الجلسات والـ cache السريع لا يجب أن تضغط القاعدة أثناء الذروة.

### Object Storage

- استخدم `Spaces` أو مزود S3-compatible للملفات العامة والوسائط.

## إعداد App Platform الموصى به

### Web

- Dedicated CPU
- `min_instance_count=2`
- فعّل autoscaling
- ابدأ بذاكرة مناسبة ثم راقب `CPU` و`RAM`

### Worker

- Instance واحدة في البداية
- يمكن رفعها لاحقًا إذا احتجت، والقيادة بين النسخ مضبوطة عبر leader election

## التنبيهات والمراقبة

فعّل Alerts لهذه المؤشرات:

- CPU
- RAM
- Restart count
- Failed deployment
- Failed scaling

## ملاحظات مهمة

- الواجهة لم تعد تهيئ CSRF مبكرًا لكل زائر، بل فقط عند أول عملية تغيّر البيانات.
- `GET /api/auth/user` للزائر غير المسجل لم يعد يحتاج إلى جلسة.
- الـ background jobs لم تعد تبدأ من داخل `registerRoutes`.
