/**
 * pneet News API — Cloudflare Pages Function
 * ============================================
 * مسیر: /api/news?cat=tech|stock|car|gold|currency
 *
 * سه منبع خبر را ترکیب می‌کند:
 *   ۱) Google News RSS فارسی   → همیشه فعال، رایگان، بدون کلید
 *   ۲) newsdata.io             → فقط اگر NEWSDATA_API_KEY تنظیم شده باشد
 *   ۳) gnews.io                → فقط اگر GNEWS_API_KEY تنظیم شده باشد
 *
 * برای فعال‌کردن newsdata.io و gnews.io باید خودتان یک حساب رایگان در
 * سایت‌شان بسازید (کلید API رایگان است) و کلید را در تنظیمات Cloudflare
 * Pages به‌عنوان Environment Variable اضافه کنید:
 *   Cloudflare dashboard → پروژه‌ی pneet → Settings → Environment variables
 *   NEWSDATA_API_KEY = <کلید شما>
 *   GNEWS_API_KEY     = <کلید شما>
 * من نمی‌توانم برای شما حساب بسازم یا کلید بگیرم — این کار نیاز به ایمیل
 * و ثبت‌نام خودتان دارد. اگر کلیدی تنظیم نشده باشد، آن منبع به‌سادگی نادیده
 * گرفته می‌شود و بقیه سایت (Google News) بدون مشکل کار می‌کند.
 *
 * ترجمه: اگر خبری از newsdata.io/gnews.io فارسی نباشد، با LibreTranslate
 * (سرویس رایگان و متن‌باز، بدون کلید) به فارسی ترجمه می‌شود. این سرویس
 * عمومی گاهی کند یا در دسترس نیست — به همین دلیل در try/catch جداگانه
 * پوشانده شده و اگر شکست بخورد، متن اصلی (انگلیسی) نمایش داده می‌شود، نه
 * خطا. برای ترجمه‌ی حرفه‌ای‌تر می‌توانید GOOGLE_TRANSLATE_API_KEY را هم
 * تنظیم کنید (نیاز به حساب Google Cloud با صورت‌حساب فعال دارد).
 */

const CATEGORY_QUERIES = {
  tech: { fa: 'فناوری هوش مصنوعی', en: 'technology AI' },
  stock: { fa: 'بورس بازار سرمایه ایران', en: 'Iran stock market' },
  car: { fa: 'قیمت خودرو ایران', en: 'Iran car prices' },
  gold: { fa: 'قیمت طلا سکه', en: 'gold price Iran' },
  currency: { fa: 'قیمت دلار ارز ارز دیجیتال', en: 'USD rial exchange rate crypto' },
};

const CACHE_SECONDS = 1800; // ۳۰ دقیقه

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cat = (url.searchParams.get('cat') || 'tech').toLowerCase();
  const query = CATEGORY_QUERIES[cat] || CATEGORY_QUERIES.tech;

  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const [googleItems, newsdataItems, gnewsItems] = await Promise.allSettled([
    fetchGoogleNews(query.fa),
    fetchNewsdataIo(query.en, env),
    fetchGNewsIo(query.en, env),
  ]);

  let items = [
    ...unwrap(googleItems),
    ...unwrap(newsdataItems),
    ...unwrap(gnewsItems),
  ];

  items = await Promise.all(items.map(async (it) => {
    if (it.needsTranslation) {
      it.title_original = it.title;
      it.description_original = it.description || '';
      it.title = await translateText(it.title, env);
      if (it.description) it.description = await translateText(it.description, env);
      delete it.needsTranslation;
    }
    return it;
  }));

  items = items.slice(0, 15);

  const response = jsonResponse({ cat, items, updated_at: new Date().toISOString() });
  await cache.put(cacheKey, response.clone());
  return response;
}

function unwrap(settled) {
  return settled.status === 'fulfilled' && Array.isArray(settled.value) ? settled.value : [];
}

async function fetchGoogleNews(queryFa) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryFa)}&hl=fa&gl=IR&ceid=IR:fa`;
  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pneetBot/1.0)' },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml).slice(0, 8).map(it => ({ ...it, provider: 'google-news' }));
  } catch (e) {
    return [];
  }
}

async function fetchNewsdataIo(queryEn, env) {
  const key = env && env.NEWSDATA_API_KEY;
  if (!key) return [];
  try {
    const apiUrl = `https://newsdata.io/api/1/news?apikey=${key}&q=${encodeURIComponent(queryEn)}&language=fa,en`;
    const res = await fetch(apiUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];
    return results.slice(0, 6).map(r => ({
      title: r.title || '',
      link: r.link || '',
      source: r.source_id || 'newsdata.io',
      published: r.pubDate || '',
      description: r.description || '',
      image: r.image_url || null,
      provider: 'newsdata.io',
      needsTranslation: (r.language && r.language !== 'fa'),
    }));
  } catch (e) {
    return [];
  }
}

async function fetchGNewsIo(queryEn, env) {
  const key = env && env.GNEWS_API_KEY;
  if (!key) return [];
  try {
    const apiUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(queryEn)}&lang=en&max=6&apikey=${key}`;
    const res = await fetch(apiUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const articles = data.articles || [];
    return articles.map(a => ({
      title: a.title || '',
      link: a.url || '',
      source: (a.source && a.source.name) || 'gnews.io',
      published: a.publishedAt || '',
      description: a.description || '',
      image: a.image || null,
      provider: 'gnews.io',
      needsTranslation: true,
    }));
  } catch (e) {
    return [];
  }
}

async function translateText(text, env) {
  if (!text) return text;

  const googleKey = env && env.GOOGLE_TRANSLATE_API_KEY;
  if (googleKey) {
    try {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${googleKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: 'fa', format: 'text' }),
      });
      if (res.ok) {
        const data = await res.json();
        const translated = data?.data?.translations?.[0]?.translatedText;
        if (translated) return translated;
      }
    } catch (e) { /* برو سراغ LibreTranslate */ }
  }

  try {
    const res = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'en', target: 'fa', format: 'text' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.translatedText) return data.translatedText;
    }
  } catch (e) { /* اگر ترجمه شکست خورد، متن اصلی را برگردان */ }

  return text;
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
}

function parseRss(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractTag(block, 'source');
    if (title) {
      items.push({
        title: decodeEntities(title),
        link: decodeEntities(link),
        source: decodeEntities(source),
        published: pubDate,
      });
    }
  }
  return items;
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = block.match(re);
  if (!match) return '';
  return match[1].replace('<![CDATA[', '').replace(']]>', '').trim();
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
