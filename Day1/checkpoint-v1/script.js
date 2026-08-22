var selectedId = "bangkok";
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
  byId("tripCount").textContent = saved.length;
  byId("passportStamps").innerHTML = DESTINATIONS.map(function (d) {
    return '<div class="stamp ' + (has(saved, d.id) ? "is-visited" : "") + '">' + d.name + "</div>";
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
      '</p><div class="card-actions"><button class="mini-btn save ' +
      (has(saved, d.id) ? "is-on" : "") +
      '">' +
      (has(saved, d.id) ? "♥ Saved" : "＋ My Trip") +
      "</button></div></div>";
    card.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      openDetail(d.id);
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
    '</ul></div></div><div class="detail-actions"><button class="btn btn-primary" id="btnSave">' +
    (has(saved, d.id) ? "♥ อยู่ใน My Trip" : "เก็บไว้ My Trip") +
    "</button></div></div></article>";
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
  renderPassport();
  renderCards();
  renderDetail();
  renderTrip();
}
renderAll();

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
