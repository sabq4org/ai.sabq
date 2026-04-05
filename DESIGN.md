# DESIGN.md — سبق الإلكترونية
> نظام التصميم الرسمي | الاتجاه: التحريري الراقي
> مرجع إلزامي لكل وكيل ذكاء اصطناعي يعمل على هذا المشروع

---

## 1. Visual Theme & Atmosphere

**الروح العامة:** منصة إخبارية عربية راقية — مزيج بين ثقل NYT وأناقة The Guardian مع هوية سعودية أصيلة.

**المبادئ الأساسية:**
- المحتوى أولاً — لا زخرفة بلا هدف
- الكثافة الإخبارية: معلومات أكثر في مساحة أقل دون ازدحام
- RTL أولاً وأبداً — كل قرار تصميمي يبدأ من اليمين
- الثقة والمصداقية عبر البساطة الواثقة
- الحدود الواضحة بين الأقسام تُنظّم البصر

**المزاج:** صحيفة ورقية راقية تحولت رقمياً — نظيفة، موثوقة، لا تصرخ.

---

## 2. Color Palette & Roles

### الألوان الأساسية

| الاسم | القيمة | الدور |
|-------|--------|-------|
| `sabq-white` | `#FFFFFF` | الخلفية الرئيسية — نقاء كامل |
| `sabq-ink` | `#0D0D0D` | نص العناوين — أسود حبر |
| `sabq-body` | `#1A1A2E` | نص المحتوى — أسود دافئ |
| `sabq-red` | `#C0392B` | الـ Accent الرئيسي — أخبار عاجلة، تمييز |
| `sabq-gold` | `#B8860B` | الـ Accent الثانوي — تميّز، أقسام مميزة |
| `sabq-gray-100` | `#F8F8F6` | خلفية الكاردز والأقسام |
| `sabq-gray-300` | `#D4D4CC` | الحدود والفواصل |
| `sabq-gray-500` | `#7A7A72` | نص ثانوي، تواريخ، meta |
| `sabq-gray-700` | `#3D3D35` | نص مساعد، تسميات |

### ألوان الحالات

| الحالة | اللون | الاستخدام |
|--------|-------|-----------|
| Breaking News | `#C0392B` | عاجل، خبر طازج |
| Published | `#1E7D4F` | خبر منشور |
| Draft | `#7A7A72` | مسودة |
| Pending | `#B8860B` | قيد المراجعة |
| Exclusive | `#1A1A2E` على `#B8860B` | خبر حصري |

### Dark Mode

| المتغير | القيمة |
|---------|--------|
| الخلفية | `#0F0F0F` |
| السطح | `#1A1A1A` |
| الكارد | `#242424` |
| النص الأساسي | `#F0EFE9` |
| النص الثانوي | `#9A9A92` |
| الـ Accent | `#E04040` (أحمر أكثر إضاءة) |

---

## 3. Typography Rules

### الخطوط

| الدور | الخط | الوزن |
|-------|------|-------|
| **العناوين الكبرى** | `Playfair Display` + `Noto Naskh Arabic` | 700-900 |
| **عناوين الأقسام** | `Cairo` | 700 |
| **جسم النص** | `Cairo` | 400-500 |
| **واجهة CMS / أرقام** | `IBM Plex Sans Arabic` | 400-600 |
| **عناوين بالإنجليزية** | `Playfair Display` | 700 |

### التسلسل الهرمي

| المستوى | الحجم | الوزن | الاستخدام |
|---------|-------|-------|-----------|
| Display | 48-64px | 900 | عاجل رئيسي، hero |
| H1 | 36-42px | 800 | عناوين المقالات |
| H2 | 28-32px | 700 | عناوين الأقسام |
| H3 | 22-24px | 700 | عناوين الكاردز |
| H4 | 18-20px | 600 | عناوين فرعية |
| Body Large | 18px | 400 | مقدمة المقال (lead) |
| Body | 16px | 400 | نص المحتوى |
| Caption | 13-14px | 400 | تاريخ، مصدر، meta |
| Label | 12px | 600 | تصنيفات، badges |

### قواعد الطباعة العربية
- `line-height: 1.8` للنص (أعلى من الإنجليزي)
- `letter-spacing: 0` دائماً للعربي
- `word-spacing: 0.05em` للقراءة المريحة
- لا تكسير للكلمات (`word-break: keep-all`)
- الأرقام: عربية (٠١٢٣) في المحتوى، لاتينية في الداتا والإحصاءات

---

## 4. Component Stylings

### الأزرار

**الأساسي (Primary):**
```
bg: #C0392B | text: white | border: none
padding: 10px 24px | border-radius: 4px | font-weight: 600
hover: bg #A93226 | transition: 150ms ease
```

**الثانوي (Secondary):**
```
bg: transparent | text: #0D0D0D | border: 1.5px solid #0D0D0D
hover: bg #0D0D0D, text white
```

**الذهبي (Premium/Exclusive):**
```
bg: #B8860B | text: white
hover: bg #9A6F0A
```

### كاردز الأخبار

**الكارد الأساسي:**
```
bg: white | border: 1px solid #D4D4CC
border-radius: 4px | overflow: hidden
hover: border-color #7A7A72, shadow: 0 2px 8px rgba(0,0,0,0.08)
transition: 200ms ease
```
- صورة 16:9 بدون border-radius (حواف حادة = تحريري)
- شريط تصنيف ملوّن بالأعلى (2px solid)
- العنوان: H3 أسود ثقيل
- meta: رمادي خفيف + فاصل `·`

**الكارد المميز (Hero):**
- صورة كاملة الخلفية
- gradient من الشفاف إلى `rgba(0,0,0,0.85)` من الأسفل
- العنوان أبيض كبير فوق الصورة
- شريط أحمر رفيع يفصل التصنيف عن العنوان

**كارد Breaking News:**
```
border-right: 4px solid #C0392B (RTL: border-left)
bg: #FEF9F9
label "عاجل": bg #C0392B, text white, font-size 11px, font-weight 700
نبض: animation pulse على الـ label
```

### الـ Navigation

**الشريط العلوي:**
```
bg: #0D0D0D | text: white | height: 56px
border-bottom: 2px solid #C0392B
```
- اللوقو يمين
- البحث وسط
- تسجيل الدخول يسار (RTL)

**شريط التصنيفات:**
```
bg: white | border-bottom: 1px solid #D4D4CC
height: 44px | font-size: 14px | font-weight: 600
active: border-bottom: 2px solid #C0392B, color: #C0392B
hover: color #C0392B
```

**Sidebar الـ CMS:**
```
bg: #0D0D0D | text: #F0EFE9 | width: 256px
border-left: 1px solid #1A1A1A (RTL)
active item: bg #C0392B/15, border-left: 3px solid #C0392B
```

### الفواصل والحدود
- فاصل القسم الرئيسي: `border-top: 3px solid #0D0D0D`
- فاصل داخل القسم: `border-top: 1px solid #D4D4CC`
- فاصل الأخبار العاجلة: `border: 2px solid #C0392B`

### الـ Inputs (CMS)
```
border: 1px solid #D4D4CC | border-radius: 4px
focus: border-color #0D0D0D, outline: none, box-shadow: 0 0 0 3px rgba(13,13,13,0.08)
bg: white | font: Cairo 16px
```

---

## 5. Layout Principles

### المسافات (Spacing Scale)
```
4px  → فاصل داخلي خفيف (meta، icons)
8px  → مسافة بين عناصر مرتبطة
12px → padding خفيف
16px → padding أساسي للكاردز
24px → مسافة بين الكاردز
32px → مسافة بين الأقسام
48px → مسافة بين الصفحات/الأقسام الكبرى
64px → مسافة Hero
```

### شبكة المحتوى
```
max-width: 1280px (container رئيسي)
max-width: 768px  (نص المقال - قراءة مريحة)
padding-x: 16px (موبايل) | 24px (تابلت) | 48px (ديسكتوب)
```

### Grid الأخبار
```
الصفحة الرئيسية:  1fr (موبايل) | 1fr 1fr (تابلت) | 2fr 1fr 1fr (ديسكتوب)
قسم الأخبار:      1fr (موبايل) | repeat(3, 1fr) (ديسكتوب)
صفحة المقال:      8fr 4fr (محتوى + sidebar) على ديسكتوب
```

### فلسفة المسافة البيضاء
- المسافة البيضاء تُنشئ هرمية بصرية — لا تملأ الفراغ بلا سبب
- كثافة الأخبار تعني: المزيد من الكاردز في أقل مساحة — لكن بترتيب واضح
- الـ Hero يأخذ مساحته كاملاً — لا تزاحمه

---

## 6. Depth & Elevation

| المستوى | الظل | الاستخدام |
|---------|------|-----------|
| 0 | بلا ظل | الكاردز الافتراضية |
| 1 | `0 1px 3px rgba(0,0,0,0.06)` | كاردز hover خفيف |
| 2 | `0 2px 8px rgba(0,0,0,0.10)` | dropdowns، tooltips |
| 3 | `0 8px 24px rgba(0,0,0,0.15)` | modals، overlays |
| Hero | لا ظل — border فقط | أقوى من الظل |

**المبدأ:** الحدود (borders) أقوى من الظلال في التصميم التحريري — تُنشئ بنية لا عمق زائف.

---

## 7. Do's and Don'ts

### ✅ افعل
- استخدم الأسود الحقيقي `#0D0D0D` للعناوين — لا رماديات
- الحواف الحادة (border-radius: 4px max) — تحريري لا ناعم
- الخط الأحمر الرفيع تحت التصنيف = بصمة سبق
- الكثافة المنظّمة: أخبار كثيرة لكن في شبكة صارمة
- الصور 16:9 دائماً في الكاردز
- فواصل أقسام واضحة وثقيلة
- الـ label "عاجل" بخلفية حمراء — لا مجرد نص أحمر

### ❌ لا تفعل
- ❌ لا gradients زخرفية — فقط على صور Hero
- ❌ لا border-radius > 6px في الكاردز الإخبارية
- ❌ لا ألوان باستيل أو ناعمة كـ primary
- ❌ لا animations ترفيهية — الحركة للوظيفة فقط
- ❌ لا تستخدم اللون الأزرق `#1E9DF1` كـ accent رئيسي (للـ links فقط)
- ❌ لا خطوط سكريبت أو زخرفية
- ❌ لا تكسير الشبكة — كل عنصر في خطه

---

## 8. Responsive Behavior

### نقاط التوقف
```
xs:  < 475px  → موبايل صغير
sm:  640px    → موبايل عادي
md:  768px    → تابلت
lg:  1024px   → لابتوب
xl:  1280px   → ديسكتوب
2xl: 1536px   → شاشات كبيرة
```

### استراتيجية الانهيار
- الـ Grid ينهار من 3 أعمدة → 2 → 1 بشكل تدريجي
- الـ Sidebar يختفي على موبايل ويصبح drawer من اليمين
- العناوين تصغر بـ `clamp()` — لا قفزات مفاجئة
- شريط التصنيفات يصبح horizontal scroll على موبايل
- أزرار CTA: full-width على موبايل

### أهداف اللمس (Touch Targets)
- الحد الأدنى: 44×44px لكل عنصر تفاعلي
- مسافة بين الأزرار: 8px على الأقل
- النص القابل للنقر لا يقل عن 16px

---

## 9. RTL-Specific Rules

```css
/* القواعد الإلزامية */
html { direction: rtl; }
body { text-align: right; }

/* عكس كل شيء اتجاهي */
margin-right  → margin-left
padding-right → padding-left
border-right  → border-left
float: right  → float: left

/* الـ Flexbox يعكس تلقائياً مع RTL */
/* لكن انتبه لـ: icons، arrows، sliders */
```

**الأيقونات والسهام:**
- كل سهم يشير لليمين → اعكسه في RTL
- أيقونة البحث: يسار الـ input
- أيقونة الإغلاق X: يسار الـ header

---

## 10. Agent Prompt Guide

### مرجع الألوان السريع
```
أحمر سبق:   #C0392B  (accent, breaking, CTA)
ذهبي سبق:   #B8860B  (premium, exclusive)
أسود سبق:   #0D0D0D  (عناوين، header)
أبيض سبق:   #FFFFFF  (خلفية أساسية)
رمادي فاتح: #F8F8F6  (خلفية ثانوية)
رمادي حدود: #D4D4CC  (borders, dividers)
رمادي نص:  #7A7A72  (meta, captions)
```

### جمل جاهزة للمطالبات

**لبناء كارد خبر:**
> "ابنِ news card بأسلوب تحريري راقي — حواف حادة، صورة 16:9، شريط تصنيف أحمر في الأعلى، عنوان H3 أسود ثقيل (Cairo 700)، meta رمادي. RTL."

**لبناء صفحة رئيسية:**
> "صفحة رئيسية إخبارية — header أسود بشريط أحمر في الأسفل، hero كارد كبير 2/3 + عمود جانبي، شبكة 3 أعمدة للأخبار، فواصل أقسام بخط أسود ثقيل. RTL. Cairo font."

**لبناء dashboard CMS:**
> "CMS dashboard — sidebar أسود يمين، محتوى رئيسي أبيض، metrics كاردز بحدود رمادية لا ظلال، badges ملوّنة بالحالات. RTL. IBM Plex Sans Arabic."

**لتعديل مكوّن موجود:**
> "عدّل هذا المكوّن ليتوافق مع DESIGN.md لسبق — أحمر #C0392B للـ accent، حواف 4px، Cairo font، RTL."

---

## 11. سبق Identity Tokens

```css
/* ضع هذه في :root */
--sabq-red:      #C0392B;
--sabq-red-dark: #A93226;
--sabq-gold:     #B8860B;
--sabq-ink:      #0D0D0D;
--sabq-body:     #1A1A2E;
--sabq-white:    #FFFFFF;
--sabq-surface:  #F8F8F6;
--sabq-border:   #D4D4CC;
--sabq-muted:    #7A7A72;

--sabq-font-heading: 'Playfair Display', 'Noto Naskh Arabic', serif;
--sabq-font-ui:      'Cairo', sans-serif;
--sabq-font-data:    'IBM Plex Sans Arabic', sans-serif;

--sabq-radius:   4px;
--sabq-radius-sm: 2px;
```

---

> **ملاحظة للوكيل:** هذا الملف هو المرجع الأعلى سلطة في قرارات التصميم. أي تعارض بين هذا الملف وأي ملف آخر → اتّبع هذا الملف.
