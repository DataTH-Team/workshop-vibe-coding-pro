(function () {
  'use strict';

  const STATUS_LABELS = {
    Pending: 'รอรับออเดอร์',
    Preparing: 'กำลังเตรียม',
    Ready: 'พร้อมรับ',
    Completed: 'สำเร็จ',
  };

  const NEXT_STATUS = {
    Pending: { status: 'Preparing', label: 'เริ่มเตรียม' },
    Preparing: { status: 'Ready', label: 'พร้อมให้ลูกค้ารับ' },
    Ready: { status: 'Completed', label: 'ส่งมอบแล้ว' },
  };

  const state = {
    pin: sessionStorage.getItem('cafe-staff-pin') || '',
    orders: [],
    filter: 'Active',
    loading: false,
    pollTimer: null,
  };

  const el = {};
  let toastTimer;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    setTodayLabel();
    if (!window.CafeApi.isConfigured()) {
      el.staffSetupNotice.hidden = false;
      renderCounts();
      renderOrders();
      return;
    }
    if (state.pin && window.CafeApi.isConfigured()) {
      loadOrders({ silent: false, authenticate: true });
    } else {
      openPinDialog();
    }
  }

  function cacheElements() {
    [
      'staffSetupNotice', 'refreshOrders', 'logoutStaff', 'todayLabel', 'activeCount', 'statusTabs',
      'lastUpdated', 'orderList', 'orderSkeleton', 'ordersEmpty', 'ordersError', 'ordersErrorMessage',
      'retryOrders', 'pinDialog', 'pinForm', 'staffPin', 'pinError', 'submitPin', 'toast',
    ].forEach(function (id) { el[id] = document.getElementById(id); });
  }

  function bindEvents() {
    el.pinForm.addEventListener('submit', login);
    el.pinDialog.addEventListener('cancel', function (event) {
      if (!state.pin) event.preventDefault();
    });
    el.refreshOrders.addEventListener('click', function () { loadOrders({ silent: false }); });
    el.retryOrders.addEventListener('click', function () { loadOrders({ silent: false }); });
    el.logoutStaff.addEventListener('click', logout);
    el.statusTabs.addEventListener('click', onFilterClick);
    el.orderList.addEventListener('click', onOrderAction);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.pin) loadOrders({ silent: true });
    });
  }

  function setTodayLabel() {
    const label = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
    el.todayLabel.textContent = 'ออเดอร์' + label;
  }

  function openPinDialog() {
    if (!el.pinDialog.open) el.pinDialog.showModal();
    window.setTimeout(function () { el.staffPin.focus(); }, 50);
  }

  async function login(event) {
    event.preventDefault();
    const pin = el.staffPin.value.trim();
    if (pin.length < 4) {
      showPinError('กรุณากรอกรหัสพนักงานอย่างน้อย 4 หลัก');
      return;
    }
    state.pin = pin;
    setButtonBusy(el.submitPin, true, 'กำลังตรวจสอบ');
    el.pinError.hidden = true;
    try {
      await loadOrders({ silent: false, authenticate: true, throwError: true });
      sessionStorage.setItem('cafe-staff-pin', state.pin);
      el.pinDialog.close();
      el.staffPin.value = '';
      schedulePoll();
    } catch (error) {
      state.pin = '';
      showPinError(error.message);
    } finally {
      setButtonBusy(el.submitPin, false, 'เข้าสู่ระบบ');
    }
  }

  function logout() {
    state.pin = '';
    state.orders = [];
    sessionStorage.removeItem('cafe-staff-pin');
    window.clearInterval(state.pollTimer);
    renderOrders();
    openPinDialog();
  }

  async function loadOrders(options) {
    const settings = options || {};
    if (!state.pin || state.loading) return;
    state.loading = true;
    if (!settings.silent) showOrdersState('loading');
    try {
      const data = await window.CafeApi.post('staffOrders', { pin: state.pin });
      state.orders = Array.isArray(data.orders) ? data.orders : [];
      if (data.cafeName) {
        document.querySelectorAll('[data-cafe-name]').forEach(function (node) { node.textContent = data.cafeName; });
        document.title = data.cafeName + ' | ออเดอร์พนักงาน';
      }
      renderCounts();
      renderOrders();
      el.lastUpdated.textContent = 'อัปเดต ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' น.';
      if (settings.authenticate) schedulePoll();
      return data;
    } catch (error) {
      if (settings.authenticate) {
        state.pin = '';
        sessionStorage.removeItem('cafe-staff-pin');
        showPinError(error.message);
        openPinDialog();
      }
      if (!settings.silent) {
        el.ordersErrorMessage.textContent = error.message;
        showOrdersState('error');
      }
      if (settings.throwError) throw error;
    } finally {
      state.loading = false;
    }
  }

  function schedulePoll() {
    window.clearInterval(state.pollTimer);
    const interval = Number(window.CAFE_CONFIG.POLL_INTERVAL_MS) || 30000;
    state.pollTimer = window.setInterval(function () {
      if (document.visibilityState === 'visible') loadOrders({ silent: true });
    }, Math.max(10000, interval));
  }

  function onFilterClick(event) {
    const button = event.target.closest('[data-status]');
    if (!button) return;
    state.filter = button.dataset.status;
    el.statusTabs.querySelectorAll('button').forEach(function (tab) { tab.classList.toggle('active', tab === button); });
    renderOrders();
  }

  async function onOrderAction(event) {
    const button = event.target.closest('[data-order-action]');
    if (!button || button.disabled) return;
    const orderId = button.dataset.orderId;
    const nextStatus = button.dataset.orderAction;
    const order = state.orders.find(function (item) { return item.orderId === orderId; });
    if (!order) return;
    const previousStatus = order.status;
    order.status = nextStatus;
    renderCounts();
    renderOrders();
    try {
      await window.CafeApi.post('updateOrderStatus', { pin: state.pin, orderId: orderId, status: nextStatus });
      showToast('อัปเดต ' + orderId + ' เป็น ' + STATUS_LABELS[nextStatus]);
      await loadOrders({ silent: true });
    } catch (error) {
      order.status = previousStatus;
      renderCounts();
      renderOrders();
      showToast(error.message);
    }
  }

  function renderCounts() {
    const counts = {
      Active: state.orders.filter(function (order) { return order.status === 'Pending' || order.status === 'Preparing'; }).length,
      Ready: state.orders.filter(function (order) { return order.status === 'Ready'; }).length,
      Completed: state.orders.filter(function (order) { return order.status === 'Completed'; }).length,
    };
    el.activeCount.textContent = counts.Active;
    el.statusTabs.querySelectorAll('[data-status]').forEach(function (button) {
      button.querySelector('span').textContent = counts[button.dataset.status] || 0;
    });
  }

  function filteredOrders() {
    return state.orders.filter(function (order) {
      if (state.filter === 'Active') return order.status === 'Pending' || order.status === 'Preparing';
      return order.status === state.filter;
    }).sort(function (a, b) {
      if (state.filter === 'Completed') return new Date(b.createdIso) - new Date(a.createdIso);
      return new Date(a.createdIso) - new Date(b.createdIso);
    });
  }

  function renderOrders() {
    const orders = filteredOrders();
    el.orderList.replaceChildren();
    orders.forEach(function (order) { el.orderList.appendChild(buildOrderCard(order)); });
    showOrdersState(orders.length ? 'ready' : 'empty');
  }

  function buildOrderCard(order) {
    const card = document.createElement('article');
    card.className = 'order-card' + (order.status === 'Ready' ? ' ready-order' : '');
    const items = (order.items || []).map(function (item) {
      return '<li><span>' + Number(item.qty || 0) + '×</span><span>' + escapeHtml(item.name) + '</span><small>' + money(item.total) + '</small></li>';
    }).join('');
    const next = NEXT_STATUS[order.status];
    const action = next
      ? '<button class="primary-button" type="button" data-order-id="' + escapeHtml(order.orderId) + '" data-order-action="' + next.status + '">' + next.label + '</button>'
      : '<span></span>';
    const note = order.note ? '<p class="order-note"><strong>หมายเหตุ:</strong> ' + escapeHtml(order.note) + '</p>' : '';
    const phone = String(order.phone || '').replace(/[^0-9+]/g, '');
    card.innerHTML = [
      '<header class="order-card-header">',
      '<div><p>' + escapeHtml(order.orderId) + '</p><h2>' + escapeHtml(order.customerName || 'ไม่ระบุชื่อ') + '</h2></div>',
      '<span class="status-badge ' + escapeHtml(order.status) + '">' + escapeHtml(STATUS_LABELS[order.status] || order.status) + '</span>',
      '</header>',
      '<div class="pickup-block"><span>เวลารับ</span><strong>' + escapeHtml(pickupLabel(order.pickupTime)) + '</strong></div>',
      '<ul class="order-items">' + items + '</ul>',
      note,
      '<div class="customer-contact"><span>' + escapeHtml(order.createdAt || '') + '</span><a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(order.phone || 'ไม่มีเบอร์โทร') + '</a></div>',
      '<footer class="order-card-footer">' + action + '<strong>' + money(order.total) + '</strong></footer>',
    ].join('');
    return card;
  }

  function showOrdersState(mode) {
    el.orderSkeleton.hidden = mode !== 'loading';
    el.orderList.hidden = mode === 'loading' || mode === 'error';
    el.ordersEmpty.hidden = mode !== 'empty';
    el.ordersError.hidden = mode !== 'error';
  }

  function showPinError(message) {
    el.pinError.textContent = message;
    el.pinError.hidden = false;
  }

  function setButtonBusy(button, busy, label) {
    button.disabled = busy;
    button.textContent = label;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add('visible');
    toastTimer = window.setTimeout(function () { el.toast.classList.remove('visible'); }, 2200);
  }

  function pickupLabel(value) {
    return value === 'ASAP' ? 'เร็วที่สุด' : String(value || '') + (String(value || '').includes(':') ? ' น.' : '');
  }

  function money(value) {
    return (window.CAFE_CONFIG.CURRENCY || '฿') + Number(value || 0).toLocaleString('th-TH');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character];
    });
  }
})();
