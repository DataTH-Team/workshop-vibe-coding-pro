const REPORT_AS_OF = new Date("2026-08-18T12:00:00+10:00");
const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const THAI_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const CATEGORY_LABELS = {
  Coffee: "กาแฟ",
  Tea: "ชา",
  Snacks: "ของทานเล่น",
  "Other Drinks": "เครื่องดื่มอื่น",
};

const state = {
  current: null,
  previous: null,
  rankingMetric: "qty",
  category: "ทั้งหมด",
};

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
      if (row.some((cell) => cell.length)) records.push(row);
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

  const [headers, ...dataRows] = records;
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() ?? ""])),
  );
}

function parseOrderDate(value) {
  const [datePart, timePart = "00:00"] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function inDateRange(date, start, end) {
  return date >= start && date < addDays(end, 1);
}

function aggregate(rows) {
  const summary = {
    revenue: 0,
    qty: 0,
    orders: new Set(),
    menus: new Map(),
    categories: new Map(),
    channels: new Map(),
    days: new Map(),
    periods: new Map(),
  };

  rows.forEach((row) => {
    const qty = Number(row.qty);
    const revenue = Number(row.total);
    const date = parseOrderDate(row.datetime);
    const hour = date.getHours();
    const dateKey = toDateKey(date);
    const period = hour < 11 ? "morning" : hour < 14 ? "noon" : hour < 17 ? "afternoon" : "evening";

    summary.revenue += revenue;
    summary.qty += qty;
    summary.orders.add(row.order_id);
    addToGroup(summary.menus, row.menu, qty, revenue, row.order_id, { category: row.category });
    addToGroup(summary.categories, row.category, qty, revenue, row.order_id);
    addToGroup(summary.channels, row.channel, qty, revenue, row.order_id);
    addToGroup(summary.days, dateKey, qty, revenue, row.order_id, { date });
    addToGroup(summary.periods, period, qty, revenue, row.order_id);
  });

  return {
    ...summary,
    orders: summary.orders.size,
    average: summary.orders.size ? summary.revenue / summary.orders.size : 0,
  };
}

function addToGroup(map, key, qty, revenue, orderId, extra = {}) {
  if (!map.has(key)) map.set(key, { name: key, qty: 0, revenue: 0, orders: new Set(), ...extra });
  const item = map.get(key);
  item.qty += qty;
  item.revenue += revenue;
  item.orders.add(orderId);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBaht(value, decimals = 0) {
  return `฿${new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("th-TH").format(value);
}

function formatPercent(value, digits = 1) {
  return `${new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;
}

function formatPeriod(start, end) {
  const buddhistYear = end.getFullYear() + 543;
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}-${end.getDate()} ${THAI_MONTHS[end.getMonth()]} ${buddhistYear}`;
  }
  return `${start.getDate()} ${THAI_MONTHS[start.getMonth()]}-${end.getDate()} ${THAI_MONTHS[end.getMonth()]} ${buddhistYear}`;
}

function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function renderChange(elementId, current, previous) {
  const element = document.getElementById(elementId);
  const change = percentChange(current, previous);
  const direction = change >= 0 ? "is-up" : "is-down";
  const label = change >= 0 ? "เพิ่ม" : "ลด";
  element.innerHTML = `<span class="change-badge ${direction}">${label} ${formatPercent(Math.abs(change))}</span><span>จากสัปดาห์ก่อน</span>`;
}

function renderMetrics() {
  const { current, previous } = state;
  document.getElementById("revenueValue").textContent = formatBaht(current.revenue);
  document.getElementById("unitsValue").innerHTML = `${formatNumber(current.qty)} <span>ชิ้น</span>`;
  document.getElementById("ordersValue").innerHTML = `${formatNumber(current.orders)} <span>ออเดอร์</span>`;
  document.getElementById("averageValue").textContent = formatBaht(current.average, 0);

  renderChange("revenueChange", current.revenue, previous.revenue);
  renderChange("unitsChange", current.qty, previous.qty);
  renderChange("ordersChange", current.orders, previous.orders);
  renderChange("averageChange", current.average, previous.average);
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function sortedMenus(summary, metric, category = "ทั้งหมด") {
  return [...summary.menus.values()]
    .filter((item) => category === "ทั้งหมด" || item.category === category)
    .sort((a, b) => b[metric] - a[metric] || b.qty - a.qty || a.name.localeCompare(b.name));
}

function renderCategoryFilters() {
  const container = document.getElementById("categoryFilters");
  const categories = ["ทั้งหมด", ...state.current.categories.keys()];
  container.innerHTML = categories
    .map(
      (category) => `<button
        type="button"
        class="category-button ${category === state.category ? "is-active" : ""}"
        data-category="${category}"
        aria-pressed="${category === state.category}"
      >${category === "ทั้งหมด" ? category : categoryLabel(category)}</button>`,
    )
    .join("");

  container.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      renderCategoryFilters();
      renderRanking();
    });
  });
}

function renderRanking() {
  const list = document.getElementById("rankingList");
  const menus = sortedMenus(state.current, state.rankingMetric, state.category);
  const max = Math.max(...menus.map((item) => item[state.rankingMetric]), 1);
  document.getElementById("rankingDescription").textContent =
    state.rankingMetric === "qty" ? "เรียงตามจำนวนชิ้นที่ขายได้" : "เรียงตามรายได้จากแต่ละเมนู";

  list.innerHTML = menus
    .map((item, index) => {
      const previousItem = state.previous.menus.get(item.name);
      const change = percentChange(item[state.rankingMetric], previousItem?.[state.rankingMetric] || 0);
      const comparison = previousItem
        ? `${change >= 0 ? "+" : ""}${formatPercent(change)} จากสัปดาห์ก่อน`
        : "ไม่มีขายในสัปดาห์ก่อน";
      const primaryValue =
        state.rankingMetric === "qty" ? `${formatNumber(item.qty)} ชิ้น` : formatBaht(item.revenue);
      const secondaryValue =
        state.rankingMetric === "qty" ? formatBaht(item.revenue) : `${formatNumber(item.qty)} ชิ้น`;

      return `<li class="ranking-item">
        <span class="rank-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="menu-name">
          <strong>${item.name}</strong>
          <small>${categoryLabel(item.category)} · ${comparison}</small>
        </span>
        <span class="rank-track" aria-hidden="true">
          <span class="rank-fill" style="width: ${(item[state.rankingMetric] / max) * 100}%"></span>
        </span>
        <span class="rank-value">
          <strong>${primaryValue}</strong>
          <small>${secondaryValue}</small>
        </span>
      </li>`;
    })
    .join("");

  requestAnimationFrame(() => {
    list.querySelectorAll(".rank-fill").forEach((bar) => {
      bar.style.transform = "scaleX(1)";
    });
  });
}

function renderDailyChart() {
  const chart = document.getElementById("dailyChart");
  const days = [...state.current.days.values()].sort((a, b) => a.date - b.date);
  const max = Math.max(...days.map((day) => day.revenue), 1);
  const best = days.reduce((winner, day) => (day.revenue > winner.revenue ? day : winner), days[0]);

  chart.setAttribute(
    "aria-label",
    days.map((day) => `${THAI_DAYS[day.date.getDay()]} ${formatBaht(day.revenue)}`).join(", "),
  );
  chart.innerHTML = days
    .map(
      (day) => `<div class="day-column ${day === best ? "is-best" : ""}" title="${day.date.getDate()} ${THAI_MONTHS[day.date.getMonth()]}: ${formatBaht(day.revenue)}">
        <span class="day-value">${new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(day.revenue)}</span>
        <span class="day-bar-wrap"><span class="day-bar" style="height: ${(day.revenue / max) * 100}%"></span></span>
        <span class="day-label">${THAI_DAYS[day.date.getDay()]}</span>
      </div>`,
    )
    .join("");

  requestAnimationFrame(() => {
    chart.querySelectorAll(".day-bar").forEach((bar) => {
      bar.style.transform = "scaleY(1)";
    });
  });

  document.getElementById("bestDayAmount").textContent = formatBaht(best.revenue);
  return best;
}

function renderCategoryMix() {
  const container = document.getElementById("categoryMix");
  const categories = [...state.current.categories.values()].sort((a, b) => b.qty - a.qty);
  container.innerHTML = categories
    .map((category) => {
      const share = (category.qty / state.current.qty) * 100;
      return `<div class="mix-row">
        <span class="mix-label">${categoryLabel(category.name)}</span>
        <span class="mix-value">${formatPercent(share, 0)}</span>
        <span class="mix-track" aria-hidden="true"><span class="mix-fill" style="width: ${share}%"></span></span>
      </div>`;
    })
    .join("");
}

function renderInsights(bestDay) {
  const menus = sortedMenus(state.current, "qty");
  const top = menus[0];
  const previousTop = state.previous.menus.get(top.name);
  const topChange = percentChange(top.qty, previousTop?.qty || 0);
  const bestDayShare = (bestDay.revenue / state.current.revenue) * 100;
  document.getElementById("mainInsight").textContent =
    `${top.name} ขึ้นเป็นอันดับ 1 ที่ ${formatNumber(top.qty)} ชิ้น ` +
    `${topChange >= 0 ? "เพิ่ม" : "ลด"} ${formatPercent(Math.abs(topChange), 0)} จากสัปดาห์ก่อน และทำยอดขาย ${formatBaht(top.revenue)}`;
  document.getElementById("bestDay").textContent =
    `${THAI_DAYS[bestDay.date.getDay()]} ${bestDay.date.getDate()} ส.ค. · ${formatPercent(bestDayShare, 0)} ของสัปดาห์`;

  const morning = state.current.periods.get("morning");
  const morningShare = (morning.revenue / state.current.revenue) * 100;
  document.getElementById("morningInsight").textContent =
    `เวลา 07:00-10:59 ทำยอด ${formatBaht(morning.revenue)} จาก ${morning.orders.size} ออเดอร์ ควรเตรียมวัตถุดิบและคนให้พร้อมก่อนเปิดร้าน`;
  document.getElementById("morningShare").textContent = formatPercent(morningShare, 0);

  const weekendDays = [...state.current.days.values()].filter((day) => [0, 6].includes(day.date.getDay()));
  const weekendQty = weekendDays.reduce((sum, day) => sum + day.qty, 0);
  const weekendShare = (weekendQty / state.current.qty) * 100;
  document.getElementById("weekendInsight").textContent =
    `เสาร์และอาทิตย์ขายรวม ${formatNumber(weekendQty)} ชิ้น โดยวันอาทิตย์วันเดียวขายได้ ${formatNumber(bestDay.qty)} ชิ้น สูงที่สุดในสัปดาห์`;
  document.getElementById("weekendShare").textContent = formatPercent(weekendShare, 0);

  const walkin = state.current.channels.get("Walk-in");
  const walkinShare = (walkin.revenue / state.current.revenue) * 100;
  document.getElementById("channelInsight").textContent =
    `หน้าร้านสร้างยอด ${formatBaht(walkin.revenue)} จาก ${walkin.orders.size} ออเดอร์ ส่วน Delivery สร้างยอด ${formatBaht(state.current.channels.get("Delivery")?.revenue || 0)}`;
  document.getElementById("walkinShare").textContent = formatPercent(walkinShare, 0);
}

function setupMetricToggle() {
  document.querySelectorAll("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.rankingMetric = button.dataset.metric;
      document.querySelectorAll("[data-metric]").forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      renderRanking();
    });
  });
}

function setupRevealAnimations() {
  const elements = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  elements.forEach((element) => observer.observe(element));
}

function renderDashboard(rows, periods) {
  const completed = rows.filter((row) => row.status === "Completed");
  const currentRows = completed.filter((row) => inDateRange(parseOrderDate(row.datetime), periods.currentStart, periods.currentEnd));
  const previousRows = completed.filter((row) => inDateRange(parseOrderDate(row.datetime), periods.previousStart, periods.previousEnd));

  if (!currentRows.length) throw new Error("ไม่พบข้อมูลในช่วงสัปดาห์ที่ต้องการ");

  state.current = aggregate(currentRows);
  state.previous = aggregate(previousRows);

  document.getElementById("periodLabel").textContent = formatPeriod(periods.currentStart, periods.currentEnd);
  document.querySelector(".report-period small").textContent = `เทียบกับ ${formatPeriod(periods.previousStart, periods.previousEnd)}`;
  document.getElementById("dataStatus").textContent = `ข้อมูลพร้อม · ${formatNumber(completed.length)} รายการ`;
  document.getElementById("sourceNote").textContent = `แหล่งข้อมูล: orders.csv · อัปเดต ณ ${REPORT_AS_OF.getDate()} ${THAI_MONTHS[REPORT_AS_OF.getMonth()]} ${REPORT_AS_OF.getFullYear() + 543}`;

  renderMetrics();
  renderCategoryFilters();
  renderRanking();
  const bestDay = renderDailyChart();
  renderCategoryMix();
  renderInsights(bestDay);

  document.getElementById("loadingState").hidden = true;
  document.getElementById("errorState").hidden = true;
  document.getElementById("dashboard").hidden = false;
  setupRevealAnimations();
}

async function loadData() {
  document.getElementById("loadingState").hidden = false;
  document.getElementById("errorState").hidden = true;
  try {
    const response = await fetch("orders.csv", { cache: "no-store" });
    if (!response.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (${response.status})`);
    const text = await response.text();
    const rows = parseCsv(text);
    const currentStart = addDays(startOfWeek(REPORT_AS_OF), -7);
    const currentEnd = addDays(currentStart, 6);
    const previousStart = addDays(currentStart, -7);
    const previousEnd = addDays(previousStart, 6);
    renderDashboard(rows, { currentStart, currentEnd, previousStart, previousEnd });
  } catch (error) {
    console.error(error);
    document.getElementById("loadingState").hidden = true;
    document.getElementById("dashboard").hidden = true;
    document.getElementById("errorState").hidden = false;
    document.getElementById("dataStatus").textContent = "อ่านข้อมูลไม่สำเร็จ";
  }
}

document.getElementById("retryButton").addEventListener("click", loadData);
setupMetricToggle();
setupRevealAnimations();
loadData();
