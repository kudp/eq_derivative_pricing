const NEWS_LIMIT = 10;
const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q=%E7%B5%8C%E6%B8%88%20USDJPY%20OR%20%E3%83%89%E3%83%AB%E5%86%86%20OR%20%E7%B1%B3%E9%87%91%E5%88%A9%20OR%20%E6%97%A5%E9%8A%80&hl=ja&gl=JP&ceid=JP:ja";
const RSS_PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(GOOGLE_NEWS_RSS)}`;

const FALLBACK_NEWS = [
  {
    title: "米金利上昇観測が強まり、ドル円は底堅い展開",
    link: "https://news.google.com/search?q=%E7%B1%B3%E9%87%91%E5%88%A9%20%E3%83%89%E3%83%AB%E5%86%86&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "日銀の追加利上げ観測で円買い圧力が意識される",
    link: "https://news.google.com/search?q=%E6%97%A5%E9%8A%80%20%E8%BF%BD%E5%8A%A0%E5%88%A9%E4%B8%8A%E3%81%92%20%E3%83%89%E3%83%AB%E5%86%86&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "米雇用統計を控え為替市場は様子見、ドル円の変動率に注目",
    link: "https://news.google.com/search?q=%E7%B1%B3%E9%9B%87%E7%94%A8%E7%B5%B1%E8%A8%88%20%E3%83%89%E3%83%AB%E5%86%86&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "株高でリスク選好が改善し、円売りが入りやすい地合い",
    link: "https://news.google.com/search?q=%E3%83%AA%E3%82%B9%E3%82%AF%E9%81%B8%E5%A5%BD%20%E5%86%86%E5%A3%B2%E3%82%8A&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "地政学リスクの高まりで安全通貨として円が買われる可能性",
    link: "https://news.google.com/search?q=%E5%9C%B0%E6%94%BF%E5%AD%A6%E3%83%AA%E3%82%B9%E3%82%AF%20%E5%86%86%E8%B2%B7%E3%81%84&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "米CPIの上振れでFRBの高金利長期化シナリオが再浮上",
    link: "https://news.google.com/search?q=%E7%B1%B3CPI%20FRB%20%E9%AB%98%E9%87%91%E5%88%A9%20%E3%83%89%E3%83%AB%E5%86%86&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "日本の賃金データ改善で日銀正常化期待が意識される",
    link: "https://news.google.com/search?q=%E8%B3%83%E9%87%91%20%E6%97%A5%E9%8A%80%20%E6%AD%A3%E5%B8%B8%E5%8C%96%20%E5%86%86&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "原油価格上昇で日本の貿易収支悪化が円の重荷に",
    link: "https://news.google.com/search?q=%E5%8E%9F%E6%B2%B9%E9%AB%98%20%E8%B2%BF%E6%98%93%E5%8F%8E%E6%94%AF%20%E5%86%86%E5%AE%89&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "米景気減速懸念でFRB利下げ観測が強まりドル売り優勢",
    link: "https://news.google.com/search?q=%E7%B1%B3%E6%99%AF%E6%B0%97%E6%B8%9B%E9%80%9F%20FRB%20%E5%88%A9%E4%B8%8B%E3%81%92%20%E3%83%89%E3%83%AB%E5%A3%B2%E3%82%8A&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
  {
    title: "為替介入への警戒感が高まりドル円の上値を抑える",
    link: "https://news.google.com/search?q=%E7%82%BA%E6%9B%BF%E4%BB%8B%E5%85%A5%20%E8%AD%A6%E6%88%92%20%E3%83%89%E3%83%AB%E5%86%86&hl=ja&gl=JP&ceid=JP:ja",
    source: "Google ニュース検索",
    published: "--",
  },
];

const UP_KEYWORDS = [
  "米金利上昇", "高金利", "利上げ", "タカ派", "インフレ", "CPI", "雇用堅調", "ドル高", "円安", "リスク選好", "株高", "原油高", "貿易赤字",
];
const DOWN_KEYWORDS = [
  "米金利低下", "利下げ", "ハト派", "景気減速", "リセッション", "ドル安", "円高", "円買い", "日銀", "追加利上げ", "為替介入", "リスク回避", "地政学", "安全通貨", "賃金",
];

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
}

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function analyzeUsdJpyImpact(text) {
  const upScore = UP_KEYWORDS.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
  const downScore = DOWN_KEYWORDS.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
  return upScore >= downScore ? "UP" : "Down";
}

function parseGoogleNews(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const items = [...doc.querySelectorAll("item")].slice(0, NEWS_LIMIT);

  return items.map((item) => ({
    title: stripHtml(item.querySelector("title")?.textContent ?? "No title"),
    link: item.querySelector("link")?.textContent ?? GOOGLE_NEWS_RSS,
    source: stripHtml(item.querySelector("source")?.textContent ?? "Google News"),
    published: item.querySelector("pubDate")?.textContent ?? "",
  }));
}

function renderNews(newsItems, { fallback = false } = {}) {
  const list = document.querySelector("#newsList");
  const status = document.querySelector("#newsStatus");
  list.innerHTML = "";

  newsItems.slice(0, NEWS_LIMIT).forEach((item) => {
    const impact = analyzeUsdJpyImpact(`${item.title} ${item.source}`);
    const li = document.createElement("li");
    const copy = document.createElement("div");
    const link = document.createElement("a");
    const meta = document.createElement("span");
    const badge = document.createElement("span");

    li.className = "news-item";
    copy.className = "news-copy";
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.title;
    meta.className = "news-meta";
    meta.textContent = `${item.source} / ${formatDate(item.published)}`;
    badge.className = `impact-badge ${impact.toLowerCase()}`;
    badge.textContent = impact;

    copy.append(link, meta);
    li.append(copy, badge);
    list.appendChild(li);
  });

  status.textContent = fallback
    ? "Googleニュース取得不可のため検索リンクを表示中"
    : `Googleニュースから${Math.min(newsItems.length, NEWS_LIMIT)}件を表示`;
}

async function loadNews() {
  const status = document.querySelector("#newsStatus");
  status.textContent = "Googleニュースを取得中...";

  try {
    const response = await fetch(RSS_PROXY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
    const xmlText = await response.text();
    const items = parseGoogleNews(xmlText);
    if (items.length === 0) throw new Error("RSS feed returned no items");
    renderNews(items);
  } catch (error) {
    console.warn(error);
    renderNews(FALLBACK_NEWS, { fallback: true });
  }
}

function updateTimestamp() {
  const timestamp = document.querySelector("#marketTimestamp");
  timestamp.textContent = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function initApp() {
  updateTimestamp();
  setInterval(updateTimestamp, 1000);
  document.querySelector("#refreshNews").addEventListener("click", loadNews);
  loadNews();
}

if (typeof document !== "undefined") {
  initApp();
}

if (typeof module !== "undefined") {
  module.exports = { analyzeUsdJpyImpact, formatDate, parseGoogleNews, stripHtml };
}
