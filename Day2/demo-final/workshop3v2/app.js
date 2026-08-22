(function () {
  'use strict';

  const FALLBACK_MENU = [
    { id: 'iced-americano', name: 'อเมริกาโน่เย็น', category: 'coffee', categoryLabel: 'กาแฟ', price: 55, mark: 'A', color: '#2e6758', description: 'เข้ม สดชื่น ไม่หวาน' },
    { id: 'iced-latte', name: 'ลาเต้เย็น', category: 'coffee', categoryLabel: 'กาแฟ', price: 65, mark: 'L', color: '#d28b59', description: 'นุ่ม หอมเอสเปรสโซ่' },
    { id: 'hot-cappuccino', name: 'คาปูชิโน่ร้อน', category: 'coffee', categoryLabel: 'กาแฟ', price: 60, mark: 'C', color: '#8b6d5b', description: 'โฟมนมนุ่ม เนื้อกาแฟชัด' },
    { id: 'iced-mocha', name: 'มอคค่าเย็น', category: 'coffee', categoryLabel: 'กาแฟ', price: 70, mark: 'M', color: '#6f4d43', description: 'โกโก้เข้มกับกาแฟ' },
    { id: 'thai-tea', name: 'ชาไทยเย็น', category: 'tea', categoryLabel: 'ชา', price: 55, mark: 'T', color: '#d66b2f', description: 'ชาเข้ม หอมนมสด' },
    { id: 'matcha-latte', name: 'มัทฉะลาเต้', category: 'tea', categoryLabel: 'ชา', price: 70, mark: 'G', color: '#6a8c59', description: 'มัทฉะหอม รสนุ่ม' },
    { id: 'lemon-tea', name: 'ชามะนาว', category: 'tea', categoryLabel: 'ชา', price: 50, mark: 'LT', color: '#9a963a', description: 'เปรี้ยวสดชื่น หวานพอดี' },
    { id: 'lemon-soda', name: 'เลมอนโซดา', category: 'other', categoryLabel: 'เครื่องดื่ม', price: 50, mark: 'LS', color: '#78a087', description: 'ซ่า สดชื่นจากมะนาว' },
    { id: 'orange-juice', name: 'น้ำส้มสด', category: 'other', categoryLabel: 'เครื่องดื่ม', price: 60, mark: 'O', color: '#e17a35', description: 'คั้นสด ไม่เติมน้ำตาล' },
    { id: 'butter-croissant', name: 'ครัวซองต์เนยสด', category: 'bakery', categoryLabel: 'เบเกอรี่', price: 60, mark: 'CR', color: '#d19b4f', description: 'กรอบนอก นุ่มใน' },
    { id: 'choc-chip-cookie', name: 'คุกกี้ช็อกชิพ', category: 'bakery', categoryLabel: 'เบเกอรี่', price: 40, mark: 'CK', color: '#826052', description: 'เนื้อนุ่ม ช็อกโกแลตแน่น' },
    { id: 'banana-cake', name: 'เค้กกล้วยหอม', category: 'bakery', categoryLabel: 'เบเกอรี่', price: 55, mark: 'BC', color: '#b88b38', description: 'นุ่ม ชุ่ม หอมกล้วย' },
  ];

  const FALLBACK_CATEGORIES = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'coffee', label: 'กาแฟ' },
    { id: 'tea', label: 'ชา' },
    { id: 'other', label: 'เครื่องดื่ม' },
    { id: 'bakery', label: 'เบเกอรี่' },
  ];

  const state = {
    cafeName: 'มะลิ คาเฟ่',
    menu: [],
    categories: [],
    activeCategory: 'all',
    cart: new Map(),
    submitting: false,
  };

  const el = {};
  let toastTimer;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    populatePickupTimes();
    if (!window.CafeApi.isConfigured()) el.setupNotice.hidden = false;
    loadMenu();
    restoreLastOrder();
  }

  function cacheElements() {
    [
      'setupNotice', 'categoryTabs', 'menuGrid', 'menuSkeleton', 'menuError', 'menuErrorMessage',
      'retryMenu', 'cartDock', 'openCart', 'cartCount', 'cartSummary', 'cartTotal', 'cartDialog',
      'cartLines', 'dialogTotal', 'orderForm', 'customerName', 'phone', 'pickupTime', 'note',
      'orderError', 'submitOrder', 'submitTotal', 'openTracking', 'trackingDialog', 'trackingForm',
      'trackingId', 'trackOrder', 'trackingResult', 'successDialog', 'successOrderId', 'successPickup',
      'successTotal', 'closeSuccess', 'toast',
    ].forEach(function (id) { el[id] = document.getElementById(id); });
  }

  function bindEvents() {
    el.categoryTabs.addEventListener('click', onCategoryClick);
    el.menuGrid.addEventListener('click', onMenuClick);
    el.openCart.addEventListener('click', function () { renderCart(); openDialog(el.cartDialog); });
    el.cartLines.addEventListener('click', onCartClick);
    el.orderForm.addEventListener('submit', submitOrder);
    el.openTracking.addEventListener('click', function () { openDialog(el.trackingDialog); });
    el.trackingForm.addEventListener('submit', trackOrder);
    el.retryMenu.addEventListener('click', loadMenu);
    el.closeSuccess.addEventListener('click', function () { el.successDialog.close(); });
    el.successOrderId.addEventListener('click', copyOrderId);
    document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
      button.addEventListener('click', function () { button.closest('dialog').close(); });
    });
    document.querySelectorAll('dialog').forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
    });
  }

  async function loadMenu() {
    showMenuState('loading');
    try {
      let data;
      if (window.CafeApi.isConfigured()) {
        data = await window.CafeApi.get('menu');
      } else {
        data = { cafeName: state.cafeName, menu: FALLBACK_MENU, categories: FALLBACK_CATEGORIES };
      }
      state.cafeName = data.cafeName || state.cafeName;
      state.menu = Array.isArray(data.menu) ? data.menu : [];
      state.categories = Array.isArray(data.categories) ? data.categories : FALLBACK_CATEGORIES;
      if (!state.menu.length) throw new Error('ยังไม่มีเมนูที่เปิดขาย');
      document.querySelectorAll('[data-cafe-name]').forEach(function (node) { node.textContent = state.cafeName; });
      document.title = state.cafeName + ' | สั่งล่วงหน้า';
      renderCategories();
      renderMenu();
      showMenuState('ready');
    } catch (error) {
      el.menuErrorMessage.textContent = error.message;
      showMenuState('error');
    }
  }

  function showMenuState(mode) {
    el.menuSkeleton.hidden = mode !== 'loading';
    el.menuError.hidden = mode !== 'error';
    el.menuGrid.hidden = mode !== 'ready';
  }

  function renderCategories() {
    el.categoryTabs.replaceChildren();
    state.categories.forEach(function (category) {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.dataset.category = category.id;
      button.setAttribute('aria-selected', String(category.id === state.activeCategory));
      button.textContent = category.label;
      el.categoryTabs.appendChild(button);
    });
  }

  function renderMenu() {
    const items = state.menu.filter(function (item) {
      return state.activeCategory === 'all' || item.category === state.activeCategory;
    });
    el.menuGrid.replaceChildren();
    items.forEach(function (item) {
      const card = document.createElement('article');
      card.className = 'menu-card';
      card.innerHTML = [
        '<div class="menu-visual" style="--menu-color:' + safeColor(item.color) + '" aria-hidden="true">' + escapeHtml(item.mark || item.name.slice(0, 1)) + '</div>',
        '<div class="menu-info"><small>' + escapeHtml(item.categoryLabel || '') + '</small><h3>' + escapeHtml(item.name) + '</h3><p>' + escapeHtml(item.description || '') + ' · ' + money(item.price) + '</p></div>',
        '<button class="add-item" type="button" data-add-item="' + escapeHtml(item.id) + '" aria-label="เพิ่ม ' + escapeHtml(item.name) + '">+</button>',
      ].join('');
      el.menuGrid.appendChild(card);
    });
  }

  function onCategoryClick(event) {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.activeCategory = button.dataset.category;
    el.categoryTabs.querySelectorAll('button').forEach(function (tab) {
      tab.setAttribute('aria-selected', String(tab === button));
    });
    renderMenu();
  }

  function onMenuClick(event) {
    const button = event.target.closest('[data-add-item]');
    if (!button) return;
    const id = button.dataset.addItem;
    const current = state.cart.get(id) || 0;
    if (cartQuantity() >= 20) {
      showToast('หนึ่งออเดอร์สั่งได้ไม่เกิน 20 ชิ้น');
      return;
    }
    state.cart.set(id, current + 1);
    updateCartDock();
    showToast('เพิ่มลงตะกร้าแล้ว');
  }

  function onCartClick(event) {
    const button = event.target.closest('[data-qty]');
    if (!button) return;
    const id = button.dataset.id;
    const delta = Number(button.dataset.qty);
    const current = state.cart.get(id) || 0;
    const next = Math.max(0, Math.min(10, current + delta));
    if (delta > 0 && cartQuantity() >= 20) {
      showToast('หนึ่งออเดอร์สั่งได้ไม่เกิน 20 ชิ้น');
      return;
    }
    if (next === 0) state.cart.delete(id);
    else state.cart.set(id, next);
    renderCart();
    updateCartDock();
    if (!state.cart.size) el.cartDialog.close();
  }

  function updateCartDock() {
    const qty = cartQuantity();
    el.cartDock.hidden = qty === 0;
    el.cartCount.textContent = qty;
    el.cartSummary.textContent = qty + ' ชิ้น';
    el.cartTotal.textContent = money(cartTotal());
  }

  function renderCart() {
    el.cartLines.replaceChildren();
    state.cart.forEach(function (qty, id) {
      const item = menuById(id);
      if (!item) return;
      const row = document.createElement('div');
      row.className = 'cart-line';
      row.innerHTML = [
        '<div><h3>' + escapeHtml(item.name) + '</h3><p>' + money(item.price) + ' ต่อชิ้น</p></div>',
        '<div class="quantity-control"><button type="button" data-id="' + escapeHtml(id) + '" data-qty="-1" aria-label="ลดจำนวน ' + escapeHtml(item.name) + '">−</button><strong>' + qty + '</strong><button type="button" data-id="' + escapeHtml(id) + '" data-qty="1" aria-label="เพิ่มจำนวน ' + escapeHtml(item.name) + '">+</button></div>',
        '<strong>' + money(item.price * qty) + '</strong>',
      ].join('');
      el.cartLines.appendChild(row);
    });
    const total = money(cartTotal());
    el.dialogTotal.textContent = total;
    el.submitTotal.textContent = total;
  }

  function populatePickupTimes() {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(new Option('เร็วที่สุด (ประมาณ 20 นาที)', 'ASAP'));
    const start = new Date();
    start.setMinutes(Math.ceil((start.getMinutes() + 25) / 15) * 15, 0, 0);
    for (let index = 0; index < 9; index += 1) {
      const time = new Date(start.getTime() + index * 15 * 60 * 1000);
      const label = time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
      fragment.appendChild(new Option(label + ' น.', label));
    }
    el.pickupTime.replaceChildren(fragment);
  }

  function validateOrderForm() {
    clearFieldErrors();
    let valid = true;
    const name = el.customerName.value.trim();
    const phone = el.phone.value.replace(/[^0-9+]/g, '');
    if (name.length < 2) {
      setFieldError('customerName', 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร');
      valid = false;
    }
    if (!/^\+?[0-9]{8,15}$/.test(phone)) {
      setFieldError('phone', 'กรุณากรอกเบอร์โทร 8-15 หลัก');
      valid = false;
    }
    if (!el.pickupTime.value) {
      setFieldError('pickupTime', 'กรุณาเลือกเวลารับ');
      valid = false;
    }
    return valid;
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (state.submitting || !state.cart.size || !validateOrderForm()) return;
    state.submitting = true;
    setButtonBusy(el.submitOrder, true, 'กำลังส่งออเดอร์');
    el.orderError.hidden = true;
    try {
      const payload = {
        customerName: el.customerName.value.trim(),
        phone: el.phone.value.replace(/[^0-9+]/g, ''),
        pickupTime: el.pickupTime.value,
        note: el.note.value.trim(),
        items: Array.from(state.cart.entries()).map(function (entry) { return { id: entry[0], qty: entry[1] }; }),
      };
      const order = await window.CafeApi.post('createOrder', payload);
      rememberOrder(order.orderId);
      el.cartDialog.close();
      el.successOrderId.textContent = order.orderId;
      el.successPickup.textContent = 'รับเวลา ' + pickupLabel(order.pickupTime);
      el.successTotal.textContent = money(order.total);
      state.cart.clear();
      updateCartDock();
      el.orderForm.reset();
      populatePickupTimes();
      openDialog(el.successDialog);
    } catch (error) {
      el.orderError.textContent = error.message;
      el.orderError.hidden = false;
    } finally {
      state.submitting = false;
      setButtonBusy(el.submitOrder, false, 'ยืนยันออเดอร์');
      el.submitTotal.textContent = money(cartTotal());
    }
  }

  async function trackOrder(event) {
    event.preventDefault();
    const orderId = el.trackingId.value.trim().toUpperCase();
    if (!orderId) return;
    setButtonBusy(el.trackOrder, true, 'กำลังตรวจสอบ');
    el.trackingResult.innerHTML = '<div class="tracking-card"><p>กำลังโหลดสถานะ...</p></div>';
    try {
      const order = await window.CafeApi.get('orderStatus', { orderId: orderId });
      rememberOrder(order.orderId);
      renderTracking(order);
    } catch (error) {
      el.trackingResult.innerHTML = '<div class="form-alert">' + escapeHtml(error.message) + '</div>';
    } finally {
      setButtonBusy(el.trackOrder, false, 'ตรวจสอบสถานะ');
    }
  }

  function renderTracking(order) {
    const labels = { Pending: 'รับออเดอร์แล้ว', Preparing: 'กำลังเตรียม', Ready: 'พร้อมรับ', Completed: 'รับสินค้าแล้ว' };
    const statuses = ['Pending', 'Preparing', 'Ready', 'Completed'];
    const currentIndex = Math.max(0, statuses.indexOf(order.status));
    const steps = statuses.map(function (status, index) {
      return '<span class="progress-step ' + (index <= currentIndex ? 'done' : '') + '">' + labels[status] + '</span>';
    }).join('');
    el.trackingResult.innerHTML = [
      '<article class="tracking-card">',
      '<header><div><p>' + escapeHtml(order.orderId) + '</p><h3>' + escapeHtml(labels[order.status] || order.status) + '</h3></div><strong>' + money(order.total) + '</strong></header>',
      '<p>เวลารับ ' + escapeHtml(pickupLabel(order.pickupTime)) + '</p>',
      '<div class="progress-steps">' + steps + '</div>',
      '</article>',
    ].join('');
  }

  function restoreLastOrder() {
    const id = localStorage.getItem('cafe-last-order-id');
    if (id) el.trackingId.value = id;
  }

  function rememberOrder(orderId) {
    localStorage.setItem('cafe-last-order-id', orderId);
    el.trackingId.value = orderId;
  }

  async function copyOrderId() {
    try {
      await navigator.clipboard.writeText(el.successOrderId.textContent);
      showToast('คัดลอกหมายเลขออเดอร์แล้ว');
    } catch (error) {
      showToast('กดค้างที่หมายเลขเพื่อคัดลอก');
    }
  }

  function cartQuantity() {
    return Array.from(state.cart.values()).reduce(function (sum, qty) { return sum + qty; }, 0);
  }

  function cartTotal() {
    return Array.from(state.cart.entries()).reduce(function (sum, entry) {
      const item = menuById(entry[0]);
      return sum + (item ? Number(item.price) * entry[1] : 0);
    }, 0);
  }

  function menuById(id) {
    return state.menu.find(function (item) { return item.id === id; });
  }

  function money(value) {
    const currency = window.CAFE_CONFIG.CURRENCY || '฿';
    return currency + Number(value || 0).toLocaleString('th-TH');
  }

  function pickupLabel(value) {
    return value === 'ASAP' ? 'เร็วที่สุด' : String(value || '') + (String(value || '').includes(':') ? ' น.' : '');
  }

  function setButtonBusy(button, busy, label) {
    button.disabled = busy;
    const labelNode = button.querySelector('span');
    if (labelNode) labelNode.textContent = label;
    else button.textContent = label;
  }

  function clearFieldErrors() {
    document.querySelectorAll('[data-error-for]').forEach(function (node) { node.textContent = ''; });
    el.orderForm.querySelectorAll('[aria-invalid]').forEach(function (node) { node.removeAttribute('aria-invalid'); });
  }

  function setFieldError(id, message) {
    const input = document.getElementById(id);
    const error = document.querySelector('[data-error-for="' + id + '"]');
    input.setAttribute('aria-invalid', 'true');
    if (error) error.textContent = message;
  }

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add('visible');
    toastTimer = window.setTimeout(function () { el.toast.classList.remove('visible'); }, 1800);
  }

  function safeColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#b9471c';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character];
    });
  }
})();
