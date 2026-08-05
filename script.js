/* ============================================
   pneet — Frontend Interactions + Live Prices
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initTabs();
  initWizard();
  initChips();
  initShare();
  initChatbot();
  initCategoryPage();
  loadPrices();
  loadNews();
  loadMarkets();
  // Refresh prices every 5 minutes, news و بازارهای جهانی هر ۳۰ دقیقه
  setInterval(loadPrices, 300000);
  setInterval(loadNews, 1800000);
  setInterval(loadMarkets, 1800000);
});

/* Mobile Menu */
function initMobileMenu() {
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.main-nav');
  if (!burger || !nav) return;
  burger.addEventListener('click', () => {
    nav.classList.toggle('is-open');
    burger.classList.toggle('is-active');
  });
  // بستن منو با کلیک روی هر لینک (رفع باگ: منو بعد از انتخاب باز می‌ماند)
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      burger.classList.remove('is-active');
    });
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !burger.contains(e.target)) {
      nav.classList.remove('is-open');
      burger.classList.remove('is-active');
    }
  });
}

/* Tabs (payment & sort) */
function initTabs() {
  document.querySelectorAll('.pay-tabs').forEach(container => {
    const tabs = container.querySelectorAll('.pay-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const target = tab.dataset.target;
        if (target) {
          document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('is-active'));
          const panel = document.getElementById(target);
          if (panel) panel.classList.add('is-active');
        }
      });
    });
  });

  document.querySelectorAll('.sort-tabs').forEach(container => {
    const tabs = container.querySelectorAll('button');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
      });
    });
  });
}

/* Ads Wizard */
function initWizard() {
  const stepsRow = document.querySelector('.steps-row');
  if (!stepsRow) return;

  const panels = document.querySelectorAll('.step-panel');
  const steps = document.querySelectorAll('.step');

  function showStep(n) {
    panels.forEach(p => p.style.display = 'none');
    const panel = document.querySelector(`.step-panel[data-step="${n}"]`);
    if (panel) panel.style.display = 'block';

    steps.forEach(s => {
      const num = parseInt(s.dataset.step);
      s.classList.remove('is-active', 'is-done');
      if (num === n) s.classList.add('is-active');
      else if (num < n) s.classList.add('is-done');
    });

    const anchor = document.querySelector('.wizard-anchor');
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => showStep(parseInt(btn.dataset.next)));
  });
  document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => showStep(parseInt(btn.dataset.prev)));
  });

  document.querySelectorAll('.placement-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.placement-card').forEach(c => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
    });
  });
}

/* Filter Chips */
function initChips() {
  document.querySelectorAll('.chip-row').forEach(row => {
    const chips = row.querySelectorAll('.chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const group = chip.closest('.filter-group');
        if (group) {
          const siblings = group.querySelectorAll('.chip');
          siblings.forEach(c => c.classList.remove('is-active'));
        }
        chip.classList.toggle('is-active');
      });
    });
  });
}

/* Share Buttons */
function initShare() {
  const shareBtn = document.querySelector('[data-share]');
  if (!shareBtn) return;
  shareBtn.addEventListener('click', async () => {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch (e) {}
    } else {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = '✓';
      setTimeout(() => shareBtn.textContent = '🔗', 2000);
    }
  });
}

/* ============================================
   Live Price Fetcher
   Strategy:
   1. Try local backend  /api/prices  (اگر api_server.py یا prices_proxy.php را روی هاست فعال کرده باشید)
   2. Fallback به API عمومی نوبیتکس مستقیماً از مرورگر
   3. Fallback نهایی: همان اعداد پیش‌فرض placeholder
   ============================================ */
async function loadPrices() {
  let data = null;

  try {
    const res = await fetch('/api/prices', { cache: 'no-store' });
    if (res.ok) data = await res.json();
  } catch (e) { /* silent fail */ }

  if (!data) {
    data = await fetchPublicPrices();
  }

  if (!data) return;
  updateTicker(data);
  updateMiniRates(data);
  updateInlineRates(data);
  updatePriceDashboard(data);
  updateDetailTable(data);
}

function updatePriceDashboard(data) {
  const grid = document.querySelector('#priceDashboardGrid');
  if (!grid) return;
  const map = {
    dollar: data.dollar || 194500,
    euro: data.euro || 225600,
    tether: data.tether || 194000,
    gold: data.gold || 18836000,
    coin: data.coin || 189500000,
    bitcoin: data.bitcoin || 64800,
  };
  grid.querySelectorAll('.price-tile').forEach(tile => {
    const key = tile.dataset.key;
    if (map[key] === undefined) return;
    const valueEl = tile.querySelector('.value');
    if (valueEl) valueEl.textContent = map[key].toLocaleString('fa-IR');
  });
  const stamp = document.querySelector('#priceUpdatedAt');
  if (stamp) {
    const now = new Date();
    stamp.textContent = 'آخرین به‌روزرسانی: ' + now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  }
}

async function fetchPublicPrices() {
  const result = { gold: 18836000, dollar: 194500, euro: 225600, coin: 189500000, bitcoin: 64800, tether: 194000 };
  try {
    const nobitex = await fetch('https://api.nobitex.ir/market/stats').then(r => r.ok ? r.json() : null);
    if (nobitex && nobitex.stats) {
      const s = nobitex.stats;
      if (s['usdt-rls']?.latest) result.tether = Math.round(parseFloat(s['usdt-rls'].latest) / 10);
      if (s['btc-rls']?.latest) result.bitcoin = Math.round((parseFloat(s['btc-rls'].latest) / 10) / result.tether);
      if (s['eth-rls']?.latest) result.ethereum = Math.round((parseFloat(s['eth-rls'].latest) / 10) / result.tether);
    }
  } catch (e) {}
  return result;
}

function formatPrice(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + ' میلیارد';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 2) + ' میلیون';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + ' هزار';
  return n.toLocaleString('fa-IR');
}

function updateTicker(data) {
  const track = document.querySelector('.ticker-track');
  if (!track) return;
  const items = [
    { label: 'سکه امامی', value: data.coin || 85000000 },
    { label: 'دلار آزاد', value: data.dollar || 192400 },
    { label: 'بیت‌کوین', value: (data.bitcoin || 64800) + ' دلار', raw: true },
    { label: 'طلای ۱۸ عیار', value: data.gold || 18700000 },
    { label: 'یورو', value: data.euro || 223000 },
    { label: 'تتر', value: data.tether || 192000 },
  ];
  const html = items.map(it => {
    const val = it.raw ? it.value : formatPrice(it.value);
    return `<div class="ticker-item">${it.label} <b class="tabular">${val}</b></div>`;
  }).join('');
  track.innerHTML = html + html; // duplicate for seamless loop
}

function updateMiniRates(data) {
  const box = document.querySelector('.mini-rates');
  if (!box) return;
  const g = data.gold || 18700000;
  const d = data.dollar || 192400;
  box.innerHTML = `
    <span>طلا ۱۸ عیار <b class="tabular" data-rate="gold">${g.toLocaleString('fa-IR')}</b> <span class="up">▲</span></span>
    <span>دلار <b class="tabular" data-rate="dollar">${d.toLocaleString('fa-IR')}</b> <span class="up">▲</span></span>
  `;
}

function updateInlineRates(data) {
  document.querySelectorAll('[data-rate]').forEach(el => {
    const key = el.dataset.rate;
    if (data[key] !== undefined) {
      el.textContent = data[key].toLocaleString('fa-IR');
    }
  });
}

/* ============================================
   چت‌بات pneet
   یک دستیار قانون‌محور (بدون نیاز به سرویس هوش مصنوعی جانبی):
   - به پرکاربردترین سؤال‌های کاربران پاسخ می‌دهد
   - اگر پاسخ را نمی‌داند، پیام را برای ادمین سایت (شما) ارسال می‌کند
   ============================================ */
const CHATBOT_ADMIN_EMAIL = 'pneet.ir@gmail.com'; // ایمیل خودتان را اینجا جایگزین کنید

const CHATBOT_FAQ = [
  { keys: ['قیمت طلا', 'طلا چند', 'نرخ طلا'], answer: 'قیمت لحظه‌ای طلای ۱۸ عیار در نوار بالای سایت و در بخش «طلا، سکه و ارز» به‌روزرسانی می‌شود. برای جزئیات بیشتر می‌توانید به صفحه دسته‌بندی طلا و ارز مراجعه کنید.' },
  { keys: ['قیمت دلار', 'دلار چند', 'نرخ دلار', 'قیمت ارز'], answer: 'نرخ دلار آزاد به‌صورت لحظه‌ای در نوار بالای صفحه و کنار لوگو نمایش داده می‌شود.' },
  { keys: ['بیت کوین', 'بیت‌کوین', 'رمزارز', 'ارز دیجیتال'], answer: 'قیمت بیت‌کوین و سایر رمزارزها در نوار قیمت‌های لحظه‌ای بالای صفحه موجود است. اخبار تحلیلی رمزارز را هم در دسته «طلا و ارز» ببینید.' },
  { keys: ['ثبت آگهی', 'تبلیغ', 'بنر', 'تبلیغات'], answer: 'برای ثبت تبلیغ یا بنر، به صفحه «ثبت آگهی» بروید — سه گام ساده شامل انتخاب جایگاه، اطلاعات بنر و پرداخت دارد. می‌خواهید همین الان به آن صفحه بروم؟', link: 'ads.html', linkLabel: 'رفتن به صفحه ثبت آگهی' },
  { keys: ['بازارچه', 'خرید', 'فروش', 'محصول'], answer: 'در بخش «بازارچه» می‌توانید کالاهای مختلف را مرور، فیلتر بر اساس قیمت و شهر اعمال کرده و با فروشنده تماس بگیرید.', link: 'marketplace.html', linkLabel: 'رفتن به بازارچه' },
  { keys: ['تماس', 'پشتیبانی', 'ارتباط با ما', 'شماره تماس'], answer: 'می‌توانید پیام‌تان را همین‌جا برایم بنویسید تا به دستتان برسانم، یا از فرم «تماس با ما» در فوتر سایت استفاده کنید.' },
  { keys: ['سلام', 'درود', 'وقت بخیر'], answer: 'سلام! خوش اومدید 👋 چطور می‌تونم کمکتون کنم؟' },
  { keys: ['ممنون', 'مرسی', 'تشکر'], answer: 'خواهش می‌کنم! اگر سؤال دیگه‌ای داشتید در خدمتم 🙂' },
];

const CHATBOT_SUGGESTIONS = ['قیمت طلا و دلار امروز چنده؟', 'چطور آگهی ثبت کنم؟', 'بازارچه چیه؟', 'می‌خوام باهاتون تماس بگیرم'];

function initChatbot() {
  if (document.querySelector('.chatbot-fab')) return; // جلوگیری از تکرار

  const fab = document.createElement('button');
  fab.className = 'chatbot-fab';
  fab.setAttribute('aria-label', 'گفت‌وگو با دستیار pneet');
  fab.innerHTML = '💬';

  const panel = document.createElement('div');
  panel.className = 'chatbot-panel';
  panel.innerHTML = `
    <div class="chatbot-head">
      <div>
        <h4>دستیار pneet</h4>
        <span>معمولاً در کمتر از یک دقیقه پاسخ می‌دهد</span>
      </div>
      <button class="chatbot-close" aria-label="بستن">✕</button>
    </div>
    <div class="chatbot-body" id="chatbotBody"></div>
    <div class="chatbot-escalate" id="chatbotEscalate">
      متوجه نشدم 🤔 می‌خواهید پیام‌تان مستقیم برای تیم pneet ارسال شود؟
      <button id="chatbotEscalateBtn">ارسال پیام برای ادمین</button>
    </div>
    <div class="chatbot-suggestions" id="chatbotSuggestions"></div>
    <div class="chatbot-input-row">
      <input type="text" id="chatbotInput" placeholder="پیام خود را بنویسید…" />
      <button id="chatbotSend" aria-label="ارسال">➤</button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const body = panel.querySelector('#chatbotBody');
  const escalateBox = panel.querySelector('#chatbotEscalate');
  const escalateBtn = panel.querySelector('#chatbotEscalateBtn');
  const suggestionsBox = panel.querySelector('#chatbotSuggestions');
  const input = panel.querySelector('#chatbotInput');
  const sendBtn = panel.querySelector('#chatbotSend');
  const closeBtn = panel.querySelector('.chatbot-close');

  let lastUserMessage = '';
  let opened = false;

  function addMessage(text, who, linkHref, linkLabel) {
    const msg = document.createElement('div');
    msg.className = 'chatbot-msg ' + who;
    msg.textContent = text;
    if (linkHref) {
      const a = document.createElement('a');
      a.href = linkHref;
      a.textContent = linkLabel || 'مشاهده';
      a.style.cssText = 'display:block;margin-top:6px;color:inherit;text-decoration:underline;font-weight:700;';
      msg.appendChild(a);
    }
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function renderSuggestions() {
    suggestionsBox.innerHTML = '';
    CHATBOT_SUGGESTIONS.forEach(s => {
      const b = document.createElement('button');
      b.textContent = s;
      b.addEventListener('click', () => handleUserMessage(s));
      suggestionsBox.appendChild(b);
    });
  }

  function findAnswer(text) {
    const normalized = text.trim().toLowerCase();
    for (const item of CHATBOT_FAQ) {
      if (item.keys.some(k => normalized.includes(k.toLowerCase()))) return item;
    }
    return null;
  }

  function handleUserMessage(text) {
    if (!text.trim()) return;
    addMessage(text, 'user');
    lastUserMessage = text;
    input.value = '';
    escalateBox.classList.remove('is-visible');

    setTimeout(() => {
      const match = findAnswer(text);
      if (match) {
        addMessage(match.answer, 'bot', match.link, match.linkLabel);
      } else {
        addMessage('ببخشید، دقیق متوجه سؤالتون نشدم. می‌تونید واضح‌تر بپرسید یا پیام‌تون رو مستقیم برای تیم ما ارسال کنید.', 'bot');
        escalateBox.classList.add('is-visible');
      }
    }, 400);
  }

  escalateBtn.addEventListener('click', () => {
    const subject = encodeURIComponent('پیام جدید از چت‌بات سایت pneet');
    const body_ = encodeURIComponent('پیام کاربر:\n' + lastUserMessage + '\n\nصفحه: ' + window.location.href);
    window.location.href = `mailto:${CHATBOT_ADMIN_EMAIL}?subject=${subject}&body=${body_}`;
    addMessage('پیامتون آماده ارسال به ایمیل ادمینه — برنامه ایمیل شما باز شد تا نهایی‌اش کنید.', 'bot');
    escalateBox.classList.remove('is-visible');
  });

  sendBtn.addEventListener('click', () => handleUserMessage(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleUserMessage(input.value); });

  fab.addEventListener('click', () => {
    panel.classList.toggle('is-open');
    if (!opened && panel.classList.contains('is-open')) {
      opened = true;
      addMessage('سلام! من دستیار هوشمند pneet هستم 👋 می‌تونم درباره قیمت‌ها، ثبت آگهی، بازارچه و سؤالات عمومی کمکتون کنم.', 'bot');
      renderSuggestions();
    }
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('is-open'));
}

/* ============================================
   بارگذاری اخبار زنده در صفحه اصلی
   ------------------------------------
   روش کار (به ترتیب اولویت):
   ۱) اول بک‌اند اختصاصی خودتان را امتحان می‌کند (اگر api/news_server.py یا
      api/news_proxy.php را روی هاست فعال کرده باشید) → دقیق‌ترین و بدون محدودیت.
   ۲) اگر بک‌اند در دسترس نبود (مثلاً روی هاست استاتیک مثل Cloudflare Pages/GitHub
      Pages که سرور ندارد)، مستقیماً از مرورگر به فید فارسی گوگل‌نیوز از طریق
      سرویس رایگان rss2json.com وصل می‌شود — این سرویس RSS را به JSON با CORS باز
      تبدیل می‌کند و نیازی به بک‌اند یا کلید API ندارد.
   ۳) اگر هیچ‌کدام در دسترس نبود (مثلاً اینترنت قطع بود)، کارت‌های نمونه فعلی
      دست‌نخورده می‌مانند (بدون ادعای دروغین «زنده»).
   ============================================ */
function timeAgoFa(pubDateStr) {
  if (!pubDateStr) return '';
  const pub = new Date(pubDateStr);
  if (isNaN(pub.getTime())) return '';
  const diffMin = Math.round((Date.now() - pub.getTime()) / 60000);
  if (diffMin < 60) return diffMin <= 1 ? 'همین الان' : `${diffMin.toLocaleString('fa-IR')} دقیقه پیش`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour.toLocaleString('fa-IR')} ساعت پیش`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay.toLocaleString('fa-IR')} روز پیش`;
}

const NEWS_QUERIES = {
  tech: 'فناوری هوش مصنوعی',
  stock: 'بورس بازار سرمایه ایران',
  car: 'قیمت خودرو ایران',
  gold: 'قیمت طلا سکه',
  currency: 'قیمت دلار ارز ارز دیجیتال',
};

// بدون کلید، rss2json.com بعد از چند بار فراخوانی زودهنگام خطای ۴۲۹ (محدودیت نرخ)
// می‌دهد. یک کلید رایگان از https://rss2json.com/register.html بگیرید (سطح رایگان
// تا ۱۰,۰۰۰ درخواست در ماه) و همین‌جا قرار دهید تا اخبار به‌طور پایدار به‌روزرسانی شود.
const RSS2JSON_API_KEY = '';

async function tryBackendNews(cat) {
  try {
    const res = await fetch(`/api/news?cat=${encodeURIComponent(cat)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const items = (data && data.items) || [];
    return items.length ? items : null;
  } catch (e) {
    return null;
  }
}

async function tryRss2JsonNews(query) {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fa&gl=IR&ceid=IR:fa`;
    let apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=6`;
    if (RSS2JSON_API_KEY) apiUrl += `&api_key=${encodeURIComponent(RSS2JSON_API_KEY)}`;
    const res = await fetch(apiUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'ok' || !Array.isArray(data.items) || !data.items.length) return null;
    return data.items.map(it => ({
      title: it.title,
      link: it.link,
      source: (it.author || '').replace(/^By\s+/i, '').trim(),
      published: it.pubDate,
    }));
  } catch (e) {
    return null;
  }
}

async function loadNews() {
  const grids = document.querySelectorAll('[data-news-cat]');
  if (!grids.length) return;

  for (const grid of grids) {
    const cat = grid.dataset.newsCat;
    const query = NEWS_QUERIES[cat];

    let items = await tryBackendNews(cat);
    if (!items && query) items = await tryRss2JsonNews(query);
    if (!items || !items.length) continue; // هیچ منبعی در دسترس نبود → کارت‌های نمونه دست‌نخورده می‌مانند

    grid.innerHTML = items.slice(0, 3).map((it, i) => `
      <a href="#" data-news-idx="${i}" class="news-card${i === 0 ? ' featured' : ''}">
        <div class="body">
          <h4>${escapeHtml(it.title)}</h4>
          <div class="time">${escapeHtml(it.source || '')} ${it.source ? '·' : ''} ${timeAgoFa(it.published)}</div>
        </div>
      </a>
    `).join('');

    grid.querySelectorAll('[data-news-idx]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(a.dataset.newsIdx, 10);
        openNewsModal(items[idx]);
      });
    });
  }
}

/* ============================================
   مودال «کلیک روی خبر و ترجمه همزمان»
   خبرهای فارسی (Google News) مستقیم نمایش داده می‌شوند؛ خبرهای انگلیسی
   (newsdata.io / gnews.io) که بک‌اند ترجمه کرده، هم ترجمه و هم متن اصلی
   را نشان می‌دهند.
   ============================================ */
function ensureNewsModal() {
  if (document.querySelector('.news-translate-modal')) return document.querySelector('.news-translate-modal');
  const modal = document.createElement('div');
  modal.className = 'news-translate-modal';
  modal.innerHTML = `
    <div class="ntm-box">
      <button class="ntm-close" aria-label="بستن">✕</button>
      <div id="ntmContent"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.ntm-close').addEventListener('click', () => modal.classList.remove('is-open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('is-open'); });
  return modal;
}

function openNewsModal(item) {
  const modal = ensureNewsModal();
  const content = modal.querySelector('#ntmContent');
  const wasTranslated = !!item.title_original;

  content.innerHTML = `
    <span class="ntm-badge">${wasTranslated ? '🌐 ترجمه‌شده با هوش مصنوعی' : '📰 ' + escapeHtml(item.source || 'خبر')}</span>
    <div class="ntm-title">${escapeHtml(item.title)}</div>
    ${item.description ? `<div class="ntm-desc">${escapeHtml(item.description)}</div>` : ''}
    ${wasTranslated ? `
      <details class="ntm-original">
        <summary>مشاهده متن اصلی (انگلیسی)</summary>
        <div class="orig-text">
          <b>${escapeHtml(item.title_original)}</b>
          ${item.description_original ? `<p>${escapeHtml(item.description_original)}</p>` : ''}
        </div>
      </details>
    ` : ''}
    <a class="ntm-link" href="${item.link}" target="_blank" rel="noopener">مشاهده خبر کامل در منبع اصلی ←</a>
  `;
  modal.classList.add('is-open');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ============================================
   صفحه دسته‌بندی: عنوان، منوی فعال و جدول تفصیلی
   بر اساس پارامتر ?c= پویا تنظیم می‌شود
   ============================================ */
const CATEGORY_LABELS = {
  tech: 'فناوری و هوش مصنوعی',
  stock: 'بورس و بازار سرمایه',
  car: 'قیمت خودرو',
  gold: 'طلا و سکه',
  currency: 'ارز و رمزارز',
};

function initCategoryPage() {
  const navLinks = document.querySelectorAll('.main-nav a[data-nav-cat]');
  if (!navLinks.length) return; // این تابع فقط برای category.html اجراست

  const params = new URLSearchParams(window.location.search);
  const cat = params.get('c') || 'tech';
  const label = CATEGORY_LABELS[cat] || CATEGORY_LABELS.tech;

  document.title = `${label} | pneet`;
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = label;
  const crumbEl = document.getElementById('breadcrumbCurrent');
  if (crumbEl) crumbEl.textContent = label;

  navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.navCat === cat);
  });

  const goldTable = document.getElementById('goldCurrencyTable');
  const carTable = document.getElementById('carPriceTable');
  if (goldTable) goldTable.style.display = (cat === 'gold' || cat === 'currency') ? 'block' : 'none';
  if (carTable) carTable.style.display = (cat === 'car') ? 'block' : 'none';
}

/* به‌روزرسانی جدول تفصیلی طلا/ارز از همان داده‌ی زنده‌ی قیمت‌ها */
function updateDetailTable(data) {
  const rows = document.querySelectorAll('[data-dpt]');
  if (!rows.length) return;
  const map = {
    dollar: data.dollar, euro: data.euro, tether: data.tether,
    gold_18: data.gold, bitcoin: data.bitcoin,
  };
  rows.forEach(el => {
    const key = el.dataset.dpt;
    if (map[key] !== undefined) {
      el.textContent = (key === 'bitcoin')
        ? map[key].toLocaleString('fa-IR') + ' دلار'
        : map[key].toLocaleString('fa-IR');
    }
  });
  const stamp = document.getElementById('dptUpdatedGold');
  if (stamp) {
    const now = new Date();
    stamp.textContent = 'آخرین به‌روزرسانی: ' + now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  }
}

/* ============================================
   بازارهای جهانی و نفت (فقط صفحه اصلی)
   ============================================ */
async function loadMarkets() {
  const grid = document.querySelector('#marketsGrid');
  if (!grid) return;
  const stamp = document.querySelector('#marketsUpdatedAt');
  try {
    const res = await fetch('/api/markets', { cache: 'no-store' });
    if (!res.ok) throw new Error('no backend');
    const data = await res.json();

    const fmt = {
      brent: v => '$' + v.toFixed(2),
      wti: v => '$' + v.toFixed(2),
      sp500: v => v.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      dow: v => v.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      nasdaq: v => v.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      nikkei: v => v.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      istanbul: v => v.toLocaleString('en-US', { maximumFractionDigits: 2 }),
    };

    grid.querySelectorAll('.market-tile').forEach(tile => {
      const key = tile.dataset.key;
      const q = data[key];
      const valueEl = tile.querySelector('.value');
      const deltaEl = tile.querySelector('.delta');
      if (!q || q.price == null) return; // این نماد جواب نداد → همان «—» می‌ماند
      if (valueEl) valueEl.textContent = fmt[key] ? fmt[key](q.price) : q.price;
      if (deltaEl && q.change_pct != null) {
        const up = q.change_pct >= 0;
        deltaEl.textContent = (up ? '▲ ' : '▼ ') + Math.abs(q.change_pct) + '٪';
        deltaEl.className = 'delta ' + (up ? 'up' : 'down');
      }
    });

    const stamp2 = document.querySelector('#marketsUpdatedAt');
    if (stamp2) {
      const now = new Date();
      stamp2.textContent = 'به‌روزرسانی: ' + now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (e) {
    if (stamp) stamp.textContent = 'داده لحظه‌ای در دسترس نیست (بک‌اند غیرفعال)';
  }
}
