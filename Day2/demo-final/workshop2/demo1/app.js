const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTk5k-yEq9DWruGfkdWAnycPoT5bTZB0uOJ5GWyLWI97m7_2FKh9HDMKSy6o5IRADt98uAcnmrvPaMd/pub?output=csv";

const CATEGORY_LABELS = {
  Coffee: "กาแฟ",
  Tea: "ชา",
  Snacks: "ของทานเล่น",
  "Other Drinks": "เครื่องดื่มอื่น",
};

const CATEGORY_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const DAYPARTS = [
  { key: "morning", label: "เช้า", time: "ก่อน 11:00" },
  { key: "noon", label: "กลางวัน", time: "11:00-13:59" },
  { key: "afternoon", label: "บ่าย", time: "14:00-16:59" },
  { key: "evening", label: "เย็น", time: "หลัง 17:00" },
];

const state = {
  rows: [],
  dataStart: "",
  dataEnd: "",
  start: "",
  end: "",
  rankingMetric: "revenue",
  category: "ทั้งหมด",
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  [
    "loadingState",
    "dashboard",
    "errorState",
    "emptyState",
    "startDate",
    "endDate",
    "dateForm",
    "dateError",
    "rangeDuration",
    "connectionMark",
    "connectionText",
    "sourceNote",
    "retryButton",
    "showAllButton",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  elements.dateForm.addEventListener("submit", handleDateSubmit);
  elements.retryButton.addEventListener("click", loadData);
  elements.showAllButton.addEventListener("click", () => setQuickRange("all"));

  document.querySelectorAll("[data-days]").forEach((button) => {
    button.addEventListener("click", () => setQuickRange(button.dataset.days));
  });

  document.querySelectorAll("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.rankingMetric = button.dataset.metric;
      document.querySelectorAll("[data-metric]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      renderRanking(aggregate(getCurrentRows()));
    });
  });

  loadData();
});

async function loadData() {
  setLoadingState();

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);

    const rawRows = parseCsv(await response.text());
    const cleanRows = rawRows.map(normalizeRow).filter(Boolean);
    state.rows = cleanRows.filter((row) => row.status.toLowerCase() === "completed");

    if (!state.rows.length) throw new Error("No completed orders were found");

    const dates = state.rows.map((row) => row.dateKey).sort();
    state.dataStart = dates[0];
    state.dataEnd = dates.at(-1);

    elements.startDate.min = state.dataStart;
    elements.startDate.max = state.dataEnd;
    elements.endDate.min = state.dataStart;
    elements.endDate.max = state.dataEnd;
    elements.dashboard.hidden = false;
    elements.loadingState.hidden = true;
    elements.errorState.hidden = true;
    setConnection("connected", `เชื่อมต่อแล้ว ${formatNumber(state.rows.length)} รายการ`);
    elements.sourceNote.textContent = `Google Sheets: ${formatThaiDate(state.dataStart)} ถึง ${formatThaiDate(state.dataEnd)}`;
    setQuickRange("30");
  } catch (error) {
    console.error(error);
    elements.loadingState.hidden = true;
    elements.dashboard.hidden = true;
    elements.errorState.hidden = false;
    setConnection("error", "เชื่อมต่อข้อมูลไม่สำเร็จ");
  }
}

function setLoadingState() {
  elements.loadingState.hidden = false;
  elements.dashboard.hidden = true;
  elements.errorState.hidden = true;
  setConnection("loading", "กำลังเชื่อมต่อข้อมูล");
}

function setConnection(status, text) {
  elements.connectionMark.className = "connection-mark";
  if (status !== "connected") elements.connectionMark.classList.add(`is-${status}`);
  elements.connectionText.textContent = text;
}

function parseCsv(text) {
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    records.push(row);
  }

  const [headers = [], ...dataRows] = records;
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() ?? ""])),
  );
}

function normalizeRow(row) {
  const date = parseOrderDate(row.datetime);
  const qty = Number(row.qty);
  const revenue = Number(row.total);

  if (!row.order_id || !row.menu || Number.isNaN(date.getTime()) || !Number.isFinite(qty) || !Number.isFinite(revenue)) {
    return null;
  }

  return {
    orderId: row.order_id,
    date,
    dateKey: toDateKey(date),
    menu: row.menu,
    category: row.category || "Uncategorized",
    qty,
    revenue,
    channel: row.channel || "Unknown",
    status: row.status,
  };
}

function parseOrderDate(value) {
  const [datePart = "", timePart = "00:00"] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateKey, days) {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + Number(days));
  return toDateKey(date);
}

function daysBetween(start, end) {
  const milliseconds = fromDateKey(end) - fromDateKey(start);
  return Math.floor(milliseconds / 86400000) + 1;
}

function setQuickRange(days) {
  if (!state.dataEnd) return;

  state.end = state.dataEnd;
  state.start = days === "all" ? state.dataStart : addDays(state.dataEnd, -(Number(days) - 1));
  if (state.start < state.dataStart) state.start = state.dataStart;

  elements.startDate.value = state.start;
  elements.endDate.value = state.end;
  elements.dateError.hidden = true;

  document.querySelectorAll("[data-days]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.days === String(days));
  });

  renderDashboard();
}

function handleDateSubmit(event) {
  event.preventDefault();
  const start = elements.startDate.value;
  const end = elements.endDate.value;

  if (!start || !end || start > end) {
    elements.dateError.textContent = "วันที่เริ่มต้นต้องอยู่ก่อนวันที่สิ้นสุด";
    elements.dateError.hidden = false;
    return;
  }

  state.start = start;
  state.end = end;
  elements.dateError.hidden = true;
  document.querySelectorAll("[data-days]").forEach((button) => button.classList.remove("is-active"));
  renderDashboard();
}

function getCurrentRows() {
  return state.rows.filter((row) => row.dateKey >= state.start && row.dateKey <= state.end);
}

function getPreviousRows() {
  const duration = daysBetween(state.start, state.end);
  const previousEnd = addDays(state.start, -1);
  const previousStart = addDays(previousEnd, -(duration - 1));
  return state.rows.filter((row) => row.dateKey >= previousStart && row.dateKey <= previousEnd);
}

function aggregate(rows) {
  const result = {
    revenue: 0,
    qty: 0,
    orderIds: new Set(),
    products: new Map(),
    categories: new Map(),
    days: new Map(),
    dayparts: new Map(DAYPARTS.map((period) => [period.key, { ...period, revenue: 0, qty: 0 }])),
  };

  rows.forEach((row) => {
    result.revenue += row.revenue;
    result.qty += row.qty;
    result.orderIds.add(row.orderId);

    addToMap(result.products, row.menu, row, { category: row.category });
    addToMap(result.categories, row.category, row);
    addToMap(result.days, row.dateKey, row, { date: row.date });

    const hour = row.date.getHours();
    const period = hour < 11 ? "morning" : hour < 14 ? "noon" : hour < 17 ? "afternoon" : "evening";
    result.dayparts.get(period).revenue += row.revenue;
    result.dayparts.get(period).qty += row.qty;
  });

  return {
    ...result,
    orders: result.orderIds.size,
    average: result.orderIds.size ? result.revenue / result.orderIds.size : 0,
  };
}

function addToMap(map, key, row, extra = {}) {
  if (!map.has(key)) map.set(key, { name: key, revenue: 0, qty: 0, orderIds: new Set(), ...extra });
  const item = map.get(key);
  item.revenue += row.revenue;
  item.qty += row.qty;
  item.orderIds.add(row.orderId);
}

function renderDashboard() {
  const rows = getCurrentRows();
  const empty = rows.length === 0;

  elements.rangeDuration.textContent = `${formatNumber(daysBetween(state.start, state.end))} วัน`;
  elements.emptyState.hidden = !empty;
  document.querySelectorAll("#dashboard > section:not(#emptyState)").forEach((section) => {
    section.hidden = empty;
  });

  if (empty) return;

  const current = aggregate(rows);
  const previous = aggregate(getPreviousRows());
  renderMetrics(current, previous);
  renderInsight(current);
  renderTrend(current);
  renderCategories(current);
  renderCategoryFilters(current);
  renderRanking(current);
  renderDayparts(current);
  renderRecommendation(current);
}

function renderMetrics(current, previous) {
  document.getElementById("revenueValue").textContent = formatBaht(current.revenue);
  document.getElementById("ordersValue").textContent = formatNumber(current.orders);
  document.getElementById("unitsValue").textContent = formatNumber(current.qty);
  document.getElementById("averageValue").textContent = formatBaht(current.average);

  renderChange("revenueChange", current.revenue, previous.revenue);
  renderChange("ordersChange", current.orders, previous.orders);
  renderChange("unitsChange", current.qty, previous.qty);
  renderChange("averageChange", current.average, previous.average);
}

function renderChange(elementId, current, previous) {
  const element = document.getElementById(elementId);
  if (!previous) {
    element.innerHTML = '<span class="change-value">ไม่มีข้อมูลเปรียบเทียบ</span>';
    return;
  }

  const change = ((current - previous) / previous) * 100;
  const direction = change >= 0 ? "+" : "";
  element.innerHTML = `<span class="change-value ${change < 0 ? "is-negative" : ""}">${direction}${formatPercent(change)}</span><span>เทียบช่วงก่อนหน้า</span>`;
}

function renderInsight(summary) {
  const products = sortedValues(summary.products, "revenue");
  const topProduct = products[0];
  const share = summary.revenue ? (topProduct.revenue / summary.revenue) * 100 : 0;
  const secondProduct = products[1];

  document.getElementById("insightTitle").textContent = `${topProduct.name} คือเมนูทำเงินอันดับหนึ่ง`;
  document.getElementById("insightDescription").textContent = secondProduct
    ? `ตามด้วย ${secondProduct.name} ที่ยอดขาย ${formatBaht(secondProduct.revenue)}`
    : `สร้างยอดขาย ${formatBaht(topProduct.revenue)} ในช่วงที่เลือก`;
  document.getElementById("topProductShare").textContent = formatPercent(share, 1);
}

function renderTrend(summary) {
  const days = [];
  let cursor = state.start;
  while (cursor <= state.end) {
    days.push({
      dateKey: cursor,
      revenue: summary.days.get(cursor)?.revenue ?? 0,
      qty: summary.days.get(cursor)?.qty ?? 0,
    });
    cursor = addDays(cursor, 1);
  }

  const totalDays = days.length;
  document.getElementById("dailyAverage").textContent = formatBaht(summary.revenue / totalDays);
  document.getElementById("trendSubtitle").textContent = `${formatThaiDate(state.start)} ถึง ${formatThaiDate(state.end)}`;

  const width = 900;
  const height = 276;
  const padding = { top: 18, right: 16, bottom: 34, left: 52 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...days.map((day) => day.revenue), 1);
  const x = (index) => padding.left + (days.length === 1 ? innerWidth / 2 : (index / (days.length - 1)) * innerWidth);
  const y = (value) => padding.top + innerHeight - (value / maxValue) * innerHeight;
  const points = days.map((day, index) => `${x(index)},${y(day.revenue)}`).join(" ");
  const areaPoints = `${padding.left},${padding.top + innerHeight} ${points} ${padding.left + innerWidth},${padding.top + innerHeight}`;
  const labelStep = Math.max(1, Math.ceil(days.length / 6));
  const gridValues = [0, 0.5, 1];

  const chart = document.getElementById("trendChart");
  chart.setAttribute(
    "aria-label",
    `กราฟยอดขายรายวันแบบโต้ตอบ ตั้งแต่ ${formatThaiDate(state.start)} ถึง ${formatThaiDate(state.end)}`,
  );
  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" preserveAspectRatio="none">
      <title id="trendSvgTitle">ยอดขายรายวัน</title>
      <desc id="trendSvgDesc">ยอดขายรวม ${escapeHtml(formatBaht(summary.revenue))} ระหว่าง ${escapeHtml(formatThaiDate(state.start))} และ ${escapeHtml(formatThaiDate(state.end))}</desc>
      ${gridValues
        .map((ratio) => {
          const gridY = padding.top + innerHeight - ratio * innerHeight;
          return `<line class="chart-grid-line" x1="${padding.left}" y1="${gridY}" x2="${padding.left + innerWidth}" y2="${gridY}" />
            <text class="chart-value" x="0" y="${gridY + 3}">${escapeHtml(formatCompactBaht(maxValue * ratio))}</text>`;
        })
        .join("")}
      <polygon class="chart-area" points="${areaPoints}" />
      <polyline class="chart-line" points="${points}" vector-effect="non-scaling-stroke" />
      ${days
        .map((day, index) => {
          if (index % labelStep !== 0 && index !== days.length - 1) return "";
          return `<circle class="chart-point" cx="${x(index)}" cy="${y(day.revenue)}" r="3.5" vector-effect="non-scaling-stroke">
              <title>${escapeHtml(formatThaiDate(day.dateKey))}: ${escapeHtml(formatBaht(day.revenue))}</title>
            </circle>
            <text class="chart-label" x="${x(index)}" y="${height - 8}" text-anchor="middle">${escapeHtml(formatShortDate(day.dateKey))}</text>`;
        })
        .join("")}
      <g class="chart-active" aria-hidden="true">
        <line class="chart-crosshair" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + innerHeight}" vector-effect="non-scaling-stroke" />
        <circle class="chart-active-halo" cx="0" cy="0" r="8" vector-effect="non-scaling-stroke" />
        <circle class="chart-active-point" cx="0" cy="0" r="4" vector-effect="non-scaling-stroke" />
      </g>
      <rect class="chart-hit-area" x="${padding.left}" y="${padding.top}" width="${innerWidth}" height="${innerHeight}" />
    </svg>`;

  chart.insertAdjacentHTML(
    "beforeend",
    `<div class="chart-tooltip" aria-hidden="true">
      <span class="chart-tooltip-date"></span>
      <strong class="chart-tooltip-revenue"></strong>
      <small class="chart-tooltip-units"></small>
    </div>
    <span class="sr-only chart-live" aria-live="polite"></span>`,
  );

  setupTrendInteractions(chart, days, { width, height, padding, innerWidth, innerHeight, x, y });
}

function setupTrendInteractions(chart, days, geometry) {
  const svg = chart.querySelector("svg");
  const activeGroup = chart.querySelector(".chart-active");
  const crosshair = chart.querySelector(".chart-crosshair");
  const halo = chart.querySelector(".chart-active-halo");
  const activePoint = chart.querySelector(".chart-active-point");
  const tooltip = chart.querySelector(".chart-tooltip");
  const tooltipDate = chart.querySelector(".chart-tooltip-date");
  const tooltipRevenue = chart.querySelector(".chart-tooltip-revenue");
  const tooltipUnits = chart.querySelector(".chart-tooltip-units");
  const liveRegion = chart.querySelector(".chart-live");
  let activeIndex = days.length - 1;

  function showDay(index, announce = false) {
    activeIndex = Math.max(0, Math.min(days.length - 1, index));
    const day = days[activeIndex];
    const pointX = geometry.x(activeIndex);
    const pointY = geometry.y(day.revenue);
    const leftPercent = (pointX / geometry.width) * 100;
    const topPercent = (pointY / geometry.height) * 100;

    crosshair.setAttribute("x1", pointX);
    crosshair.setAttribute("x2", pointX);
    halo.setAttribute("cx", pointX);
    halo.setAttribute("cy", pointY);
    activePoint.setAttribute("cx", pointX);
    activePoint.setAttribute("cy", pointY);
    activeGroup.classList.add("is-visible");

    tooltipDate.textContent = formatThaiDate(day.dateKey);
    tooltipRevenue.textContent = formatBaht(day.revenue);
    tooltipUnits.textContent = `${formatNumber(day.qty)} ชิ้น`;
    tooltip.style.left = `${leftPercent}%`;
    tooltip.style.top = `${topPercent}%`;
    tooltip.classList.toggle("align-start", leftPercent < 19);
    tooltip.classList.toggle("align-end", leftPercent > 81);
    tooltip.classList.toggle("is-below", pointY < 78);
    tooltip.classList.add("is-visible");
    tooltip.setAttribute("aria-hidden", "false");

    if (announce) {
      liveRegion.textContent = `${formatThaiDate(day.dateKey)} ยอดขาย ${formatBaht(day.revenue)} จำนวน ${formatNumber(day.qty)} ชิ้น`;
    }
  }

  function hideDay() {
    activeGroup.classList.remove("is-visible");
    tooltip.classList.remove("is-visible");
    tooltip.setAttribute("aria-hidden", "true");
  }

  function indexFromPointer(event) {
    const bounds = svg.getBoundingClientRect();
    const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * geometry.width;
    const progress = (viewBoxX - geometry.padding.left) / geometry.innerWidth;
    return Math.round(Math.max(0, Math.min(1, progress)) * (days.length - 1));
  }

  chart.onpointermove = (event) => {
    if (event.pointerType === "touch") return;
    showDay(indexFromPointer(event));
  };

  chart.onpointerdown = (event) => {
    showDay(indexFromPointer(event), true);
  };

  chart.onpointerleave = (event) => {
    if (event.pointerType !== "touch") hideDay();
  };

  chart.onfocus = () => showDay(activeIndex, true);
  chart.onblur = hideDay;
  chart.onkeydown = (event) => {
    const actions = {
      ArrowLeft: () => showDay(activeIndex - 1, true),
      ArrowRight: () => showDay(activeIndex + 1, true),
      Home: () => showDay(0, true),
      End: () => showDay(days.length - 1, true),
      Escape: hideDay,
    };

    if (!actions[event.key]) return;
    event.preventDefault();
    actions[event.key]();
  };
}

function renderCategories(summary) {
  const categories = sortedValues(summary.categories, "revenue");
  const total = summary.revenue || 1;
  let cursor = 0;
  const stops = categories.map((category, index) => {
    const start = cursor;
    cursor += (category.revenue / total) * 100;
    return `${CATEGORY_COLORS[index % CATEGORY_COLORS.length]} ${start}% ${cursor}%`;
  });

  document.getElementById("categoryDonut").style.background = `conic-gradient(${stops.join(", ")})`;
  document.getElementById("topCategoryShare").textContent = formatPercent((categories[0].revenue / total) * 100, 0);
  document.getElementById("categoryList").innerHTML = categories
    .map(
      (category, index) => `<li class="category-item">
        <span class="category-swatch" style="background:${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}"></span>
        <span class="category-name">
          <strong>${escapeHtml(categoryLabel(category.name))}</strong>
          <small>${formatNumber(category.qty)} ชิ้น</small>
        </span>
        <span class="category-value">
          <strong>${escapeHtml(formatBaht(category.revenue))}</strong>
          <small>${formatPercent((category.revenue / total) * 100, 1)}</small>
        </span>
      </li>`,
    )
    .join("");
}

function renderCategoryFilters(summary) {
  const categories = ["ทั้งหมด", ...sortedValues(summary.categories, "revenue").map((item) => item.name)];
  if (!categories.includes(state.category)) state.category = "ทั้งหมด";

  const container = document.getElementById("categoryFilters");
  container.innerHTML = categories
    .map(
      (category) => `<button type="button" class="${category === state.category ? "is-active" : ""}" data-category="${escapeHtml(category)}" aria-pressed="${category === state.category}">
        ${escapeHtml(category === "ทั้งหมด" ? category : categoryLabel(category))}
      </button>`,
    )
    .join("");

  container.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      renderCategoryFilters(summary);
      renderRanking(summary);
    });
  });
}

function renderRanking(summary) {
  const products = sortedValues(summary.products, state.rankingMetric).filter(
    (item) => state.category === "ทั้งหมด" || item.category === state.category,
  );
  const max = Math.max(...products.map((item) => item[state.rankingMetric]), 1);
  const list = document.getElementById("productRanking");

  document.getElementById("rankingSubtitle").textContent =
    state.rankingMetric === "revenue" ? "เรียงตามยอดขาย" : "เรียงตามจำนวนชิ้น";

  list.innerHTML = products
    .map((product, index) => {
      const primary = state.rankingMetric === "revenue" ? formatBaht(product.revenue) : `${formatNumber(product.qty)} ชิ้น`;
      const secondary = state.rankingMetric === "revenue" ? `${formatNumber(product.qty)} ชิ้น` : formatBaht(product.revenue);
      return `<li class="product-item">
        <span class="rank-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="product-name">
          <strong>${escapeHtml(product.name)}</strong>
          <small>${escapeHtml(categoryLabel(product.category))}</small>
        </span>
        <span class="product-bar" aria-hidden="true"><span style="--bar-width:${(product[state.rankingMetric] / max) * 100}%"></span></span>
        <span class="product-value">
          <strong>${escapeHtml(primary)}</strong>
          <small>${escapeHtml(secondary)}</small>
        </span>
      </li>`;
    })
    .join("");

  requestAnimationFrame(() => list.querySelectorAll(".product-bar span").forEach((bar) => bar.classList.add("is-visible")));
}

function renderDayparts(summary) {
  const periods = DAYPARTS.map((period) => summary.dayparts.get(period.key));
  const max = Math.max(...periods.map((period) => period.revenue), 1);
  const container = document.getElementById("daypartChart");

  container.innerHTML = periods
    .map(
      (period) => `<div class="daypart-item">
        <div class="daypart-column">
          <strong>${escapeHtml(formatCompactBaht(period.revenue))}</strong>
          <span class="daypart-bar" style="--bar-height:${Math.max(2, (period.revenue / max) * 100)}%"></span>
        </div>
        <span class="daypart-label">
          <strong>${escapeHtml(period.label)}</strong>
          <small>${escapeHtml(period.time)}</small>
        </span>
      </div>`,
    )
    .join("");

  requestAnimationFrame(() => container.querySelectorAll(".daypart-bar").forEach((bar) => bar.classList.add("is-visible")));
}

function renderRecommendation(summary) {
  const topProduct = sortedValues(summary.products, "qty")[0];
  const topPeriod = [...summary.dayparts.values()].sort((a, b) => b.revenue - a.revenue)[0];
  const periodShare = summary.revenue ? (topPeriod.revenue / summary.revenue) * 100 : 0;

  document.getElementById("recommendationTitle").textContent = `เตรียม ${topProduct.name} ให้พร้อมในช่วง${topPeriod.label}`;
  document.getElementById("recommendationText").textContent = `${topProduct.name} ขายได้ ${formatNumber(topProduct.qty)} ชิ้น และช่วง${topPeriod.label}สร้างยอดขาย ${formatPercent(periodShare, 1)} ของช่วงที่เลือก`;
}

function sortedValues(map, metric) {
  return [...map.values()].sort((a, b) => b[metric] - a[metric] || b.qty - a.qty || a.name.localeCompare(b.name));
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function formatBaht(value) {
  return `฿${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatCompactBaht(value) {
  return `฿${new Intl.NumberFormat("th-TH", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value, digits = 1) {
  return `${new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;
}

function formatThaiDate(dateKey) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(fromDateKey(dateKey));
}

function formatShortDate(dateKey) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(fromDateKey(dateKey));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
