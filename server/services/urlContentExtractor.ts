import puppeteer from "puppeteer";
import OpenAI from "openai";

function createLazyClientProxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const client = factory() as Record<PropertyKey, unknown>;
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

const openai = createLazyClientProxy(getOpenAIClient);

export interface SourceAttribution {
  domain: string;
  nameAr: string;
  nameEn: string;
  attributionFormats: string[];
}

export const TRUSTED_NEWS_SOURCES: SourceAttribution[] = [
  {
    domain: "spa.gov.sa",
    nameAr: "وكالة الأنباء السعودية",
    nameEn: "Saudi Press Agency",
    attributionFormats: ["وفق واس", "كما أفادت واس", "بحسب وكالة الأنباء السعودية"]
  },
  {
    domain: "reuters.com",
    nameAr: "رويترز",
    nameEn: "Reuters",
    attributionFormats: ["وفق رويترز", "كما نقلت رويترز", "بحسب وكالة رويترز"]
  },
  {
    domain: "aljazeera.net",
    nameAr: "الجزيرة",
    nameEn: "Al Jazeera",
    attributionFormats: ["وفق الجزيرة", "كما أفادت الجزيرة"]
  },
  {
    domain: "alarabiya.net",
    nameAr: "العربية",
    nameEn: "Al Arabiya",
    attributionFormats: ["وفق العربية", "كما نقلت العربية"]
  },
  {
    domain: "cnn.com",
    nameAr: "سي إن إن",
    nameEn: "CNN",
    attributionFormats: ["وفق CNN", "كما أفادت سي إن إن"]
  },
  {
    domain: "bbc.com",
    nameAr: "بي بي سي",
    nameEn: "BBC",
    attributionFormats: ["وفق BBC", "كما نقلت بي بي سي"]
  },
  {
    domain: "skynewsarabia.com",
    nameAr: "سكاي نيوز عربية",
    nameEn: "Sky News Arabia",
    attributionFormats: ["وفق سكاي نيوز", "كما أفادت سكاي نيوز عربية"]
  },
  {
    domain: "aawsat.com",
    nameAr: "الشرق الأوسط",
    nameEn: "Asharq Al-Awsat",
    attributionFormats: ["وفق الشرق الأوسط", "كما نشرت الشرق الأوسط"]
  },
  {
    domain: "aleqt.com",
    nameAr: "الاقتصادية",
    nameEn: "Al Eqtisadiah",
    attributionFormats: ["وفق الاقتصادية", "كما أفادت صحيفة الاقتصادية"]
  },
  {
    domain: "okaz.com.sa",
    nameAr: "عكاظ",
    nameEn: "Okaz",
    attributionFormats: ["وفق عكاظ", "كما نشرت صحيفة عكاظ"]
  },
  {
    domain: "alriyadh.com",
    nameAr: "الرياض",
    nameEn: "Al Riyadh",
    attributionFormats: ["وفق الرياض", "كما نشرت صحيفة الرياض"]
  },
  {
    domain: "alwatan.com.sa",
    nameAr: "الوطن",
    nameEn: "Al Watan",
    attributionFormats: ["وفق الوطن", "كما أفادت صحيفة الوطن"]
  },
  {
    domain: "ajel.sa",
    nameAr: "عاجل",
    nameEn: "Ajel",
    attributionFormats: ["وفق عاجل", "كما نشرت صحيفة عاجل"]
  },
  {
    domain: "moi.gov.sa",
    nameAr: "وزارة الداخلية",
    nameEn: "Ministry of Interior",
    attributionFormats: ["وفق وزارة الداخلية", "كما أفاد بيان وزارة الداخلية"]
  },
  {
    domain: "moe.gov.sa",
    nameAr: "وزارة التعليم",
    nameEn: "Ministry of Education",
    attributionFormats: ["وفق وزارة التعليم", "كما أفادت وزارة التعليم"]
  },
  {
    domain: "moh.gov.sa",
    nameAr: "وزارة الصحة",
    nameEn: "Ministry of Health",
    attributionFormats: ["وفق وزارة الصحة", "كما أعلنت وزارة الصحة"]
  },
  {
    domain: "vision2030.gov.sa",
    nameAr: "رؤية 2030",
    nameEn: "Vision 2030",
    attributionFormats: ["وفق رؤية 2030", "بحسب موقع رؤية المملكة 2030"]
  },
  {
    domain: "argaam.com",
    nameAr: "أرقام",
    nameEn: "Argaam",
    attributionFormats: ["وفق أرقام", "كما أفاد موقع أرقام"]
  },
  {
    domain: "tadawul.com.sa",
    nameAr: "تداول",
    nameEn: "Tadawul",
    attributionFormats: ["وفق تداول", "كما أفادت السوق المالية السعودية"]
  },
  {
    domain: "afp.com",
    nameAr: "فرانس برس",
    nameEn: "AFP",
    attributionFormats: ["وفق فرانس برس", "كما نقلت وكالة الأنباء الفرنسية"]
  },
  {
    domain: "apnews.com",
    nameAr: "أسوشيتد برس",
    nameEn: "Associated Press",
    attributionFormats: ["وفق أسوشيتد برس", "كما أفادت وكالة أسوشيتد برس"]
  }
];

export interface ExtractedArticle {
  title: string;
  content: string;
  excerpt: string;
  imageUrl: string | null;
  sourceUrl: string;
  sourceName: string;
  sourceNameAr: string;
  attribution: string;
  originalPublishDate: string | null;
}

export interface ExtractionResult {
  success: boolean;
  article?: ExtractedArticle;
  error?: string;
}

export function detectUrls(text: string): string[] {
  // Match URLs with protocol (https:// or http://)
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const protocolMatches = text.match(urlRegex) || [];
  
  // Also match URLs starting with www. (without protocol)
  const wwwRegex = /\bwww\.[^\s<>"{}|\\^`\[\]]+/gi;
  const wwwMatches = text.match(wwwRegex) || [];
  
  // Combine and normalize: add https:// to www URLs
  const allUrls = [
    ...protocolMatches,
    ...wwwMatches.map(url => `https://${url}`)
  ];
  
  // Remove duplicates and clean trailing punctuation
  const cleanedUrls = allUrls.map(url => url.replace(/[.,;:!?)\]]+$/, ''));
  const uniqueUrls = cleanedUrls.filter((url, index) => cleanedUrls.indexOf(url) === index);
  return uniqueUrls;
}

export function isNewsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // SECURITY: Only allow HTTPS protocol (no HTTP, file://, ftp://, etc.)
    if (parsed.protocol !== 'https:') {
      console.log(`[URL Extractor] ❌ Rejected non-HTTPS URL: ${url}`);
      return false;
    }
    
    // SECURITY: Block private/internal IPs
    const hostname = parsed.hostname.toLowerCase();
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^0\./,
      /^169\.254\./,
      /^\[::1\]$/,
      /^\[fe80:/i,
      /^\[fc00:/i,
      /^\[fd00:/i,
    ];
    
    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      console.log(`[URL Extractor] ❌ Rejected internal/private IP: ${url}`);
      return false;
    }
    
    const domain = hostname.replace(/^www\./, '');
    
    // SECURITY: Strict allowlist - only accept known trusted sources
    const isKnownSource = TRUSTED_NEWS_SOURCES.some(source => {
      // Exact domain match or subdomain of trusted source
      return domain === source.domain || domain.endsWith('.' + source.domain);
    });
    
    if (!isKnownSource) {
      console.log(`[URL Extractor] ⚠️ Domain not in trusted sources: ${domain}`);
    }
    
    return isKnownSource;
  } catch {
    return false;
  }
}

export function getSourceAttribution(url: string): { nameAr: string; nameEn: string; attribution: string } {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    
    for (const source of TRUSTED_NEWS_SOURCES) {
      if (domain.includes(source.domain) || source.domain.includes(domain.split('.').slice(-2).join('.'))) {
        const randomFormat = source.attributionFormats[Math.floor(Math.random() * source.attributionFormats.length)];
        return {
          nameAr: source.nameAr,
          nameEn: source.nameEn,
          attribution: randomFormat
        };
      }
    }
    
    const siteName = domain.split('.')[0];
    const capitalizedName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
    return {
      nameAr: capitalizedName,
      nameEn: capitalizedName,
      attribution: `نقلاً عن ${capitalizedName}`
    };
  } catch {
    return {
      nameAr: "مصدر خارجي",
      nameEn: "External Source",
      attribution: "نقلاً عن مصدر خارجي"
    };
  }
}

export async function extractArticleContent(url: string): Promise<ExtractionResult> {
  console.log(`[URL Extractor] 🔗 Extracting content from: ${url}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForSelector('body', { timeout: 10000 });
    
    const pageData = await page.evaluate(() => {
      const getMetaContent = (selectors: string[]): string => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            const content = el.getAttribute('content') || el.textContent;
            if (content?.trim()) return content.trim();
          }
        }
        return '';
      };
      
      const title = getMetaContent([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'h1.article-title',
        'h1.entry-title',
        'h1[class*="title"]',
        'article h1',
        '.post-title',
        'h1'
      ]) || document.title;
      
      const image = getMetaContent([
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'meta[property="og:image:url"]'
      ]);
      
      const publishDate = getMetaContent([
        'meta[property="article:published_time"]',
        'meta[name="publish-date"]',
        'time[datetime]'
      ]);
      
      const contentSelectors = [
        'article .entry-content',
        'article .post-content',
        'article .article-content',
        'article .content',
        '.article-body',
        '.story-body',
        '.post-body',
        '[itemprop="articleBody"]',
        '.entry-content',
        'article p',
        'main p'
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const texts: string[] = [];
          elements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 50) {
              texts.push(text);
            }
          });
          if (texts.length > 0) {
            content = texts.join('\n\n');
            break;
          }
        }
      }
      
      if (!content) {
        const paragraphs = document.querySelectorAll('p');
        const validParagraphs: string[] = [];
        paragraphs.forEach(p => {
          const text = p.textContent?.trim();
          if (text && text.length > 100) {
            validParagraphs.push(text);
          }
        });
        content = validParagraphs.slice(0, 10).join('\n\n');
      }
      
      return { title, content, image, publishDate };
    });
    
    await browser.close();
    
    if (!pageData.content || pageData.content.length < 100) {
      return {
        success: false,
        error: "لم يتم العثور على محتوى كافٍ في الصفحة"
      };
    }
    
    const sourceInfo = getSourceAttribution(url);
    
    console.log(`[URL Extractor] 📰 Raw title: ${pageData.title}`);
    console.log(`[URL Extractor] 📝 Content length: ${pageData.content.length} chars`);
    console.log(`[URL Extractor] 🏷️ Source: ${sourceInfo.nameAr} (${sourceInfo.attribution})`);
    
    const aiResult = await processWithAI(pageData.title, pageData.content, sourceInfo);
    
    return {
      success: true,
      article: {
        title: aiResult.title,
        content: aiResult.content,
        excerpt: aiResult.excerpt,
        imageUrl: pageData.image || null,
        sourceUrl: url,
        sourceName: sourceInfo.nameEn,
        sourceNameAr: sourceInfo.nameAr,
        attribution: sourceInfo.attribution,
        originalPublishDate: pageData.publishDate || null
      }
    };
    
  } catch (error: any) {
    console.error(`[URL Extractor] ❌ Error:`, error.message);
    if (browser) await browser.close();
    
    return {
      success: false,
      error: error.message || "فشل في استخراج المحتوى"
    };
  }
}

async function processWithAI(
  rawTitle: string, 
  rawContent: string, 
  sourceInfo: { nameAr: string; attribution: string }
): Promise<{ title: string; content: string; excerpt: string }> {
  
  const prompt = `أنت محرر صحفي محترف في صحيفة سبق السعودية.

المهمة: إعادة صياغة الخبر التالي بأسلوب صحفي احترافي مع الإشارة للمصدر.

المصدر: ${sourceInfo.nameAr}
صيغة الإسناد: ${sourceInfo.attribution}

العنوان الأصلي:
${rawTitle}

المحتوى الأصلي:
${rawContent.substring(0, 4000)}

التعليمات:
1. أعد صياغة العنوان بشكل جذاب ومختصر (لا يتجاوز 80 حرفًا)
2. أعد كتابة المحتوى بأسلوب صحفي سعودي احترافي
3. أضف إشارة للمصدر "${sourceInfo.attribution}" في بداية أو نهاية الخبر بشكل طبيعي
4. اكتب مقدمة مختصرة (excerpt) لا تتجاوز 160 حرفًا
5. حافظ على المعلومات الأساسية والأرقام والتواريخ

أجب بصيغة JSON فقط:
{
  "title": "العنوان المعاد صياغته",
  "content": "المحتوى المعاد صياغته مع إسناد المصدر",
  "excerpt": "المقدمة المختصرة"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      title: result.title || rawTitle,
      content: result.content || rawContent,
      excerpt: result.excerpt || rawContent.substring(0, 150)
    };
  } catch (error) {
    console.error("[URL Extractor] ⚠️ AI processing failed, using raw content");
    
    const contentWithAttribution = `${sourceInfo.attribution}، ${rawContent}`;
    
    return {
      title: rawTitle,
      content: contentWithAttribution,
      excerpt: rawContent.substring(0, 150)
    };
  }
}

export function containsOnlyUrl(text: string): boolean {
  const trimmed = text.trim();
  const urls = detectUrls(trimmed);
  if (urls.length !== 1) return false;
  
  // Remove URL from text - handle both normalized (https://www.) and original (www.) formats
  let withoutUrl = trimmed;
  const normalizedUrl = urls[0]; // e.g., "https://www.spa.gov.sa/..."
  
  // First try to remove the normalized URL
  withoutUrl = withoutUrl.replace(normalizedUrl, '');
  
  // Also try to remove www. version (without https://)
  if (normalizedUrl.startsWith('https://www.')) {
    const wwwVersion = normalizedUrl.replace('https://', '');
    withoutUrl = withoutUrl.replace(wwwVersion, '');
  }
  
  // Also try to remove http:// and https:// versions of any URL
  const urlWithoutProtocol = normalizedUrl.replace(/^https?:\/\//, '');
  withoutUrl = withoutUrl.replace(urlWithoutProtocol, '');
  
  withoutUrl = withoutUrl.trim();
  return withoutUrl.length < 20;
}
