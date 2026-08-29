var selectedId = "bangkok";
var visited = [];
var saved = [];

function byId(id) {
  return document.getElementById(id);
}
function getDest(id) {
  return DESTINATIONS.find(function (d) {
    return d.id === id;
  });
}
function displayName(d) {
  return d.name === d.country ? d.name : d.name + ", " + d.country;
}
function has(arr, id) {
  return arr.indexOf(id) !== -1;
}
function toggle(arr, id) {
  var i = arr.indexOf(id);
  if (i === -1) arr.push(id);
  else arr.splice(i, 1);
}

function renderPassport() {
  byId("visitedCount").textContent = visited.length;
  var gn = byId("gameVisitedNote");
  if (gn) gn.textContent = visited.length;
  byId("savedCount").textContent = saved.length;
  byId("passportStamps").innerHTML = DESTINATIONS.map(function (d) {
    return (
      '<div class="stamp ' +
      (has(visited, d.id) ? "is-visited" : "") +
      '">' +
      d.name.toUpperCase() +
      "</div>"
    );
  }).join("");
}

function renderCards() {
  byId("destinationList").innerHTML = "";
  DESTINATIONS.forEach(function (d) {
    var card = document.createElement("article");
    card.className = "city-card" + (selectedId === d.id ? " is-active" : "");
    card.innerHTML =
      '<img src="' +
      d.image +
      '" alt="' +
      d.name +
      '"><div class="city-body"><div class="city-title-row"><div><div class="city-name">' +
      d.name +
      '</div><div class="city-region">' +
      d.region +
      '</div></div><span>✦</span></div><p class="city-tagline">' +
      d.tagline +
      '</p><div class="card-actions"><button class="mini-btn been ' +
      (has(visited, d.id) ? "is-on" : "") +
      '">' +
      (has(visited, d.id) ? "✓ ไปมาแล้ว" : "ไปมาแล้ว") +
      '</button><button class="mini-btn save ' +
      (has(saved, d.id) ? "is-on" : "") +
      '">' +
      (has(saved, d.id) ? "♥ Saved" : "＋ My Trip") +
      "</button></div></div>" +
      (has(visited, d.id) ? '<div class="badge-visited">PASSPORT ✓</div>' : "");
    card.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      openDetail(d.id);
    });
    card.querySelector(".been").addEventListener("click", function (e) {
      e.stopPropagation();
      toggle(visited, d.id);
      renderAll();
    });
    card.querySelector(".save").addEventListener("click", function (e) {
      e.stopPropagation();
      toggle(saved, d.id);
      renderAll();
    });
    byId("destinationList").appendChild(card);
  });
}

function renderDetail() {
  var d = getDest(selectedId);
  byId("detail").innerHTML =
    '<article class="detail-card"><div class="detail-media"><img src="' +
    d.image +
    '" alt="' +
    d.name +
    '"><div class="detail-overlay"><b>' +
    d.region +
    "</b><br>" +
    d.tagline +
    '</div></div><div class="detail-content"><div class="detail-kicker">DESTINATION</div><h3 class="detail-title">' +
    displayName(d) +
    '</h3><p class="detail-tag">' +
    d.bestFor.join(" · ") +
    '</p><div class="detail-boxes"><section class="info-box fact-box"><div class="box-label">FACT · ข้อมูลจริง</div><dl class="facts"><dt>Country</dt><dd>' +
    d.country +
    "</dd><dt>Region</dt><dd>" +
    d.region +
    "</dd><dt>Language</dt><dd>" +
    d.facts.language +
    "</dd><dt>Currency</dt><dd>" +
    d.facts.currency +
    '</dd></dl></section><section class="info-box review-box"><div class="box-label">REVIEW · ความเห็นของฉัน</div><div class="review-rating">' +
    d.rating +
    ' <small>/ 5</small></div><p class="review-take">' +
    d.myTake +
    '</p></section></div><div class="detail-lists"><div><h4>Highlights</h4><ul>' +
    d.highlights
      .map(function (x) {
        return "<li>" + x + "</li>";
      })
      .join("") +
    "</ul></div><div><h4>Travel Tips</h4><ul>" +
    d.tips
      .map(function (x) {
        return "<li>" + x + "</li>";
      })
      .join("") +
    '</ul></div></div><div class="detail-actions"><button class="btn btn-soft" id="btnVisited">' +
    (has(visited, d.id) ? "✓ ไปมาแล้ว" : "ทำเครื่องหมายว่าไปมาแล้ว") +
    '</button><button class="btn btn-primary" id="btnSave">' +
    (has(saved, d.id) ? "♥ อยู่ใน My Trip" : "เก็บไว้ My Trip") +
    "</button></div></div></article>";
  byId("btnVisited").addEventListener("click", function () {
    toggle(visited, d.id);
    renderAll();
  });
  byId("btnSave").addEventListener("click", function () {
    toggle(saved, d.id);
    renderAll();
  });
}

function renderTrip() {
  var list = byId("tripList"),
    empty = byId("tripEmpty");
  list.innerHTML = "";
  saved.forEach(function (id) {
    var d = getDest(id);
    var item = document.createElement("div");
    item.className = "trip-item";
    item.innerHTML =
      '<img src="' +
      d.image +
      '" alt="' +
      d.name +
      '"><div><strong>' +
      d.name +
      "</strong><span>" +
      d.bestFor.slice(0, 2).join(" · ") +
      "</span></div><button>Remove</button>";
    item.querySelector("button").addEventListener("click", function () {
      toggle(saved, id);
      renderAll();
    });
    list.appendChild(item);
  });
  empty.classList.toggle("is-hidden", saved.length > 0);
}
function renderAll() {
  renderPins();
  renderPassport();
  renderCards();
  renderDetail();
  renderTrip();
}
renderAll();

/* ---------- Find My Next Trip game ---------- */
var gameStep = 0;
var gameAnswers = { interest: null, pace: null, length: null };

function showGameStep(n) {
  gameStep = n;
  document.querySelectorAll(".game-step").forEach(function (el) {
    el.classList.toggle("is-hidden", Number(el.dataset.step) !== n);
  });
  byId("gameResult").classList.add("is-hidden");
  byId("gameBack").disabled = n === 0;
  byId("gameNext").textContent = n === 2 ? "ดูผลลัพธ์ ✦" : "ต่อไป →";
  byId("gameProgressBar").style.width = ((n + 1) / 3) * 100 + "%";
  byId("gameProgressText").textContent = "STEP " + (n + 1) + " / 3";
}

document.querySelectorAll(".option-grid[data-key]").forEach(function (group) {
  group.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var key = group.dataset.key;
    gameAnswers[key] = b.dataset.value;
    group.querySelectorAll("button").forEach(function (x) {
      x.classList.toggle("is-selected", x === b);
    });
  });
});

function gameScore(d) {
  var s = 0;
  if (d.tags.interests.indexOf(gameAnswers.interest) !== -1) s += 4;
  if (d.tags.pace.indexOf(gameAnswers.pace) !== -1) s += 3;
  if (d.tags.length.indexOf(gameAnswers.length) !== -1) s += 2;
  return s;
}
function recommendCity() {
  var pool = DESTINATIONS.filter(function (d) {
    return !has(visited, d.id);
  });
  if (pool.length === 0) pool = DESTINATIONS.slice();
  var best = pool[0],
    bestScore = gameScore(best);
  pool.slice(1).forEach(function (d) {
    var s = gameScore(d);
    if (s > bestScore) {
      best = d;
      bestScore = s;
    }
  });
  return best;
}
function whyMatch(d) {
  var hits = [];
  if (d.tags.interests.indexOf(gameAnswers.interest) !== -1) hits.push(gameAnswers.interest);
  if (d.tags.pace.indexOf(gameAnswers.pace) !== -1) hits.push(gameAnswers.pace);
  if (d.tags.length.indexOf(gameAnswers.length) !== -1) hits.push(gameAnswers.length);
  return hits.length
    ? "ตรงกับ Travel DNA รอบนี้: " + hits.join(" · ")
    : "เป็นตัวเลือกที่ใกล้กับสิ่งที่เลือกที่สุดจาก 6 เมือง";
}
function showRecommendation() {
  var d = recommendCity();
  document.querySelectorAll(".game-step").forEach(function (el) {
    el.classList.add("is-hidden");
  });
  var r = byId("gameResult");
  r.classList.remove("is-hidden");
  r.innerHTML =
    '<span class="result-badge">YOUR NEXT TRIP MATCH</span><div class="result-city">' +
    d.name +
    '</div><p class="result-why">' +
    whyMatch(d) +
    '</p><div class="result-mini"><img src="' +
    d.image +
    '" alt="' +
    d.name +
    '"><div><b>' +
    displayName(d) +
    "</b><br><span>" +
    d.bestFor.join(" · ") +
    '</span></div></div><div class="result-actions"><button class="btn btn-primary" id="viewRecommended">ดูเมืองนี้ →</button><button class="btn btn-soft" id="saveRecommended">＋ เก็บไว้ My Trip</button><button class="btn btn-soft" id="playAgain">เล่นใหม่</button></div>';
  byId("gameProgressBar").style.width = "100%";
  byId("gameProgressText").textContent = "RESULT";
  byId("gameNext").classList.add("is-hidden");
  byId("gameBack").classList.add("is-hidden");
  byId("viewRecommended").addEventListener("click", function () {
    openDetail(d.id);
  });
  byId("saveRecommended").addEventListener("click", function () {
    if (!has(saved, d.id)) saved.push(d.id);
    renderAll();
    this.textContent = "♥ อยู่ใน My Trip แล้ว";
    this.disabled = true;
  });
  byId("playAgain").addEventListener("click", function () {
    gameAnswers = { interest: null, pace: null, length: null };
    document.querySelectorAll(".option-grid[data-key] button").forEach(function (x) {
      x.classList.remove("is-selected");
    });
    byId("gameNext").classList.remove("is-hidden");
    byId("gameBack").classList.remove("is-hidden");
    showGameStep(0);
  });
}

byId("gameNext").addEventListener("click", function () {
  var keys = ["interest", "pace", "length"];
  var key = keys[gameStep];
  if (!gameAnswers[key]) {
    alert("เลือกคำตอบข้อนี้ก่อนนะ");
    return;
  }
  if (gameStep < 2) showGameStep(gameStep + 1);
  else showRecommendation();
});
byId("gameBack").addEventListener("click", function () {
  if (gameStep > 0) showGameStep(gameStep - 1);
});
showGameStep(0);

/* ---------- Detail Modal ---------- */
function openDetail(id) {
  selectedId = id;
  renderAll();
  var m = byId("detailModal");
  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  var c = byId("modalClose");
  if (c) c.focus();
}

function closeDetail() {
  var m = byId("detailModal");
  m.classList.remove("is-open");
  m.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

byId("modalClose").addEventListener("click", closeDetail);
byId("detailModal").addEventListener("click", function (e) {
  if (e.target.dataset.close) closeDetail();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeDetail();
});

/* ---------- World Map ---------- */
/* พิกัดคิดจาก lat/lon จริงด้วยสูตร equirectangular แล้วเก็บเป็น % ของกรอบแผนที่
   ถ้าปล่อยให้ AI เดาตำแหน่งหมุดเอง มันจะไปลงกลางมหาสมุทรเกือบทุกครั้ง */
var PIN_POS = {
  bangkok: [77.92, 42.37],
  tokyo: [88.8, 30.17],
  sydney: [92.0, 68.81],
  singapore: [78.84, 49.25],
  paris: [50.65, 22.85],
  "new-york": [29.44, 27.38],
};

function renderPins() {
  var layer = byId("pinLayer");
  // PIN_POS ประกาศไว้ท้ายไฟล์ แต่ renderAll() ถูกเรียกก่อน — ต้องกันไว้ไม่ให้พังตอนโหลด
  if (!layer || typeof PIN_POS === "undefined") return;
  layer.innerHTML = "";
  var tip = byId("mapTip");
  DESTINATIONS.forEach(function (d) {
    var pos = PIN_POS[d.id];
    if (!pos) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className =
      "pin" + (selectedId === d.id ? " is-active" : "") + (has(visited, d.id) ? " is-visited" : "");
    b.style.left = pos[0] + "%";
    b.style.top = pos[1] + "%";
    b.setAttribute("aria-label", d.name);
    b.addEventListener("mouseenter", function () {
      tip.innerHTML = d.name + "<small>" + d.country + "</small>";
      tip.style.left = pos[0] + "%";
      tip.style.top = pos[1] + "%";
      tip.classList.add("is-on");
    });
    b.addEventListener("mouseleave", function () {
      tip.classList.remove("is-on");
    });
    b.addEventListener("click", function () {
      tip.classList.remove("is-on");
      openDetail(d.id);
    });
    layer.appendChild(b);
  });
}

renderPins();
