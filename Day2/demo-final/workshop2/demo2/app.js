const SHEET_ID = "1a0ElwjZdLOd0MJg7tx-iqQVXwZVdZPKG9WTfuQtJKxA";
const QUERY = `select D, sum(G)
  where J = 'Completed' and D is not null
  group by D
  label D 'category', sum(G) 'sales'`;
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=0&tqx=out:json&tq=${encodeURIComponent(QUERY)}`;

const CATEGORY_LABELS = {
  Coffee: "กาแฟ",
  Tea: "ชา",
  Snacks: "ของทานเล่น",
  "Other Drinks": "เครื่องดื่มอื่น",
};

const CATEGORY_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  [
    "loadingState",
    "dashboard",
    "emptyState",
    "errorState",
    "connectionDot",
    "connectionText",
    "refreshButton",
    "emptyRetryButton",
    "retryButton",
    "totalSales",
    "topCategory",
    "topCategorySales",
    "topShare",
    "categoryCount",
    "updatedAt",
    "shareStrip",
    "categoryList",
    "insightTitle",
    "insightText",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  elements.refreshButton.addEventListener("click", loadCategorySales);
  elements.emptyRetryButton.addEventListener("click", loadCategorySales);
  elements.retryButton.addEventListener("click", loadCategorySales);

  loadCategorySales();
});

async function loadCategorySales() {
  setView("loading");

  try {
    const response = await fetch(`${GVIZ_URL}&_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);

    const payload = parseGvizResponse(await response.text());
    if (payload.status !== "ok") {
      throw new Error(payload.errors?.[0]?.detailed_message || "Google Sheets query failed");
    }

    const categories = normalizeCategories(payload.table);
    if (!categories.length) {
      setView("empty");
      return;
    }

    renderDashboard(categories);
    setView("ready");
  } catch (error) {
    console.error("Unable to load category sales:", error);
    setView("error");
  }
}

function parseGvizResponse(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Invalid gviz response");
  return JSON.parse(text.slice(start, end + 1));
}

function normalizeCategories(table) {
  const columns = table?.cols || [];
  const categoryIndex = columns.findIndex((column) => column.label === "category");
  const salesIndex = columns.findIndex((column) => column.label === "sales");

  if (categoryIndex === -1 || salesIndex === -1) {
    throw new Error("Expected category and sales columns were not found");
  }

  return (table.rows || [])
    .map((row) => ({
      key: String(row.c?.[categoryIndex]?.v || "").trim(),
      sales: Number(row.c?.[salesIndex]?.v),
    }))
    .filter((item) => item.key && Number.isFinite(item.sales) && item.sales > 0)
    .sort((a, b) => b.sales - a.sales);
}

function renderDashboard(categories) {
  const total = categories.reduce((sum, item) => sum + item.sales, 0);
  const top = categories[0];
  const topShare = (top.sales / total) * 100;

  elements.totalSales.textContent = formatCurrency(total);
  elements.topCategory.textContent = getCategoryLabel(top.key);
  elements.topCategorySales.textContent = formatCurrency(top.sales);
  elements.topShare.textContent = formatPercent(topShare);
  elements.categoryCount.textContent = `${formatNumber(categories.length)} หมวดหมู่ที่มียอดขาย`;
  elements.updatedAt.textContent = `อัปเดต ${formatUpdateTime(new Date())}`;

  renderShareStrip(categories, total);
  renderCategoryList(categories, total);
  renderInsight(categories, total);
}

function renderShareStrip(categories, total) {
  elements.shareStrip.innerHTML = "";
  const labels = [];

  categories.forEach((category, index) => {
    const share = (category.sales / total) * 100;
    const segment = document.createElement("span");
    segment.className = "share-segment";
    segment.style.width = `${share}%`;
    segment.style.background = getCategoryColor(index);
    segment.style.setProperty("--delay", `${index * 80}ms`);
    elements.shareStrip.append(segment);
    labels.push(`${getCategoryLabel(category.key)} ${formatPercent(share)}`);
  });

  elements.shareStrip.setAttribute("aria-label", labels.join(", "));
}

function renderCategoryList(categories, total) {
  elements.categoryList.innerHTML = "";
  const largestSales = categories[0].sales;

  categories.forEach((category, index) => {
    const share = (category.sales / total) * 100;
    const barWidth = (category.sales / largestSales) * 100;
    const item = document.createElement("li");
    item.className = "category-row";
    item.style.setProperty("--category-color", getCategoryColor(index));
    item.style.setProperty("--bar-width", `${barWidth}%`);
    item.style.setProperty("--delay", `${120 + index * 80}ms`);
    item.innerHTML = `
      <div class="category-name">
        <span class="category-rank">${String(index + 1).padStart(2, "0")}</span>
        <span class="category-swatch" aria-hidden="true"></span>
        <strong>${escapeHtml(getCategoryLabel(category.key))}</strong>
      </div>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill"></div>
      </div>
      <div class="category-value">
        <strong>${formatCurrency(category.sales)}</strong>
        <span>${formatPercent(share)} ของยอดรวม</span>
      </div>
    `;
    elements.categoryList.append(item);
  });
}

function renderInsight(categories, total) {
  const top = categories[0];
  const second = categories[1];
  const topShare = (top.sales / total) * 100;

  elements.insightTitle.textContent = `${getCategoryLabel(top.key)} เป็นหมวดที่สร้างรายได้สูงสุด`;

  if (!second) {
    elements.insightText.textContent = `ยอดขายทั้งหมดมาจากหมวด${getCategoryLabel(top.key)}เพียงหมวดเดียว`;
    return;
  }

  const lead = top.sales - second.sales;
  elements.insightText.textContent =
    `คิดเป็น ${formatPercent(topShare)} ของยอดขายรวม และมากกว่า${getCategoryLabel(second.key)} ${formatCurrency(lead)}`;
}

function setView(view) {
  const loading = view === "loading";
  elements.loadingState.hidden = !loading;
  elements.dashboard.hidden = view !== "ready";
  elements.emptyState.hidden = view !== "empty";
  elements.errorState.hidden = view !== "error";
  elements.refreshButton.disabled = loading;

  elements.connectionDot.className = "connection-dot";
  if (view === "loading") {
    elements.connectionDot.classList.add("is-loading");
    elements.connectionText.textContent = "กำลังอ่านข้อมูล";
  } else if (view === "error") {
    elements.connectionDot.classList.add("is-error");
    elements.connectionText.textContent = "เชื่อมต่อไม่สำเร็จ";
  } else if (view === "empty") {
    elements.connectionText.textContent = "เชื่อมต่อแล้ว — ไม่พบข้อมูล";
  } else {
    elements.connectionText.textContent = "เชื่อมต่อ Google Sheets แล้ว";
  }
}

function getCategoryLabel(key) {
  return CATEGORY_LABELS[key] || key;
}

function getCategoryColor(index) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function formatCurrency(value) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatUpdateTime(date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}
