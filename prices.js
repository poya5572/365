/**
 * pneet Prices API — Cloudflare Pages Function
 * ============================================
 * مسیر: /api/prices
 *
 * مثل news.js، این فایل هم به‌محض قرارگرفتن پوشه‌ی functions/ در پروژه‌ی
 * Cloudflare Pages شما، خودکار فعال می‌شود — بدون سرور جداگانه.
 *
 * منبع: API عمومی نوبیتکس (بدون کلید). این پروکسی باعث می‌شود قیمت‌ها
 * حتی اگر در آینده نوبیتکس دسترسی CORS مستقیم از مرورگر را محدود کند،
 * همچنان کار کنند — و سریع‌تر هم هست چون در لبه‌ی Cloudflare کش می‌شود.
 */

const CACHE_SECONDS = 120; // ۲ دقیقه — قیمت‌ها سریع‌تر از اخبار به‌روز می‌شوند

const DEFAULTS = {
  gold: 18836000, dollar: 194500, euro: 225600, coin: 189500000,
  bitcoin: 64800, tether: 194000, ethereum: 3450,
};

export async function onRequestGet() {
  try {
    const res = await fetch('https://api.nobitex.ir/market/stats', {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
    if (!res.ok) throw new Error(`Nobitex fetch failed: ${res.status}`);
    const data = await res.json();
    const stats = data.stats || {};

    const out = { ...DEFAULTS };
    const usdt = stats['usdt-rls']?.latest;
    if (usdt) out.tether = Math.round(parseFloat(usdt) / 10);
    const btc = stats['btc-rls']?.latest;
    if (btc && usdt) out.bitcoin = Math.round((parseFloat(btc) / 10) / out.tether);
    const eth = stats['eth-rls']?.latest;
    if (eth && usdt) out.ethereum = Math.round((parseFloat(eth) / 10) / out.tether);

    out.updated_at = new Date().toISOString();

    return new Response(JSON.stringify(out), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ...DEFAULTS, error: String(err) }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
