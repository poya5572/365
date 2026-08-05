/**
 * pneet — Cloudflare Pages Function
 * مسیر: /api/markets
 *
 * قیمت نفت (برنت، WTI) و شاخص‌های بورس جهانی (S&P 500، داوجونز، نزدک،
 * نیک‌کی ۲۲۵، بورس استانبول) را از Yahoo Finance می‌گیرد.
 *
 * توجه صادقانه: یاهو فایننس یک API رسمی و مستند برای عموم منتشر نکرده؛
 * این آدرس (query1.finance.yahoo.com) یک اندپوینت غیررسمی است که سال‌هاست
 * به‌طور گسترده استفاده می‌شود و کلید نمی‌خواهد، اما یاهو می‌تواند هر زمان
 * بدون اطلاع قبلی آن را تغییر دهد یا محدود کند — به همین دلیل کل تابع در
 * try/catch پوشانده شده تا اگر یاهو قطع شد، بقیه‌ی سایت (اخبار، قیمت ارز و
 * طلا) بدون مشکل کار کند.
 */

const SYMBOLS = {
  sp500: '%5EGSPC',
  dow: '%5EDJI',
  nasdaq: '%5EIXIC',
  nikkei: '%5EN225',
  istanbul: 'XU100.IS',
  brent: 'BZ=F',
  wti: 'CL=F',
};

const CACHE_SECONDS = 900; // ۱۵ دقیقه (بازارهای جهانی سریع‌تر از ارز/طلای داخلی نوسان می‌کنند)

export async function onRequestGet({ request }) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const results = {};
  await Promise.all(
    Object.entries(SYMBOLS).map(async ([key, symbol]) => {
      results[key] = await fetchQuote(symbol);
    })
  );
  results.updated_at = new Date().toISOString();

  const response = new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
  await cache.put(cacheKey, response.clone());
  return response;
}

async function fetchQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    return {
      price,
      change_pct: changePct !== null ? Number(changePct.toFixed(2)) : null,
    };
  } catch (e) {
    return null;
  }
}
