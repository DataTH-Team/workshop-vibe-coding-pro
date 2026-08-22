  (function() {
    'use strict';

    const PIN_KEY = 'cafeStaffPin';
    const ACTIVE_STATUSES = ['Pending', 'Preparing', 'Ready'];
    const STATUS_COPY = {
      Pending: { label: 'ออเดอร์เข้าใหม่', action: 'เริ่มทำ', next: 'Preparing', actionClass: '' },
      Preparing: { label: 'กำลังทำ', action: 'ทำเสร็จแล้ว', next: 'Ready', actionClass: 'is-ready' },
      Ready: { label: 'พร้อมรับ', action: 'ลูกค้ารับแล้ว', next: 'Completed', actionClass: 'is-complete' },
      Completed: { label: 'รับแล้ว', action: '', next: '', actionClass: '' },
    };

    const state = {
      pin: sessionStorage.getItem(PIN_KEY) || '',
      orders: [],
      filter: 'active',
      pollTimer: null,
      toastTimer: null,
      loading: false,
    };

    const elements = {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
      [
        'pinGate', 'pinForm', 'staffPin', 'pinError', 'pinSubmitButton', 'staffApp',
        'liveStatus', 'refreshButton', 'logoutButton', 'lastUpdated', 'pendingCount',
        'preparingCount', 'readyCount', 'statusFilters', 'activeBadge', 'ordersLoading',
        'ordersBoard', 'emptyOrders', 'staffError', 'staffErrorText', 'retryStaffButton',
        'staffToast', 'brandName'
      ].forEach(function(id) { elements[id] = document.getElementById(id); });

      applyCafeName();
      bindEvents();
      if (state.pin) authenticate(state.pin, true);
      else showPinGate();
    }

    function bindEvents() {
      elements.pinForm.addEventListener('submit', function(event) {
        event.preventDefault();
        authenticate(elements.staffPin.value.trim(), false);
      });
      elements.refreshButton.addEventListener('click', function() { loadOrders(false); });
      elements.retryStaffButton.addEventListener('click', function() { loadOrders(false); });
      elements.logoutButton.addEventListener('click', logout);
      elements.statusFilters.addEventListener('click', handleFilterClick);
      elements.ordersBoard.addEventListener('click', handleOrderAction);
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden && state.pin) loadOrders(true);
      });
    }

    async function apiRequest(action, payload, method) {
      if (!window.CafeApi) throw new Error('โหลดตัวเชื่อม Apps Script ไม่สำเร็จ');
      return window.CafeApi.request(action, payload || {});
    }

    function applyCafeName() {
      const name = String((window.CAFE_CONFIG || {}).CAFE_NAME || 'บ้านกาแฟ');
      elements.brandName.textContent = name;
      document.title = name + ' | คิวหน้าบาร์';
    }

    async function authenticate(pin, silent) {
      if (!pin) {
        elements.pinError.textContent = 'กรุณากรอกรหัสพนักงาน';
        elements.pinError.hidden = false;
        return;
      }
      elements.pinSubmitButton.disabled = true;
      elements.pinSubmitButton.querySelector('span').textContent = 'กำลังตรวจสอบ';
      elements.pinError.hidden = true;
      try {
        const data = await apiRequest('staffOrders', { pin: pin }, 'POST');
        state.pin = pin;
        sessionStorage.setItem(PIN_KEY, pin);
        showStaffApp();
        applyOrders(data);
        schedulePolling();
      } catch (error) {
        sessionStorage.removeItem(PIN_KEY);
        state.pin = '';
        showPinGate();
        if (!silent || error.message.indexOf('รหัสพนักงาน') !== -1) {
          elements.pinError.textContent = error.message;
          elements.pinError.hidden = false;
        }
      } finally {
        elements.pinSubmitButton.disabled = false;
        elements.pinSubmitButton.querySelector('span').textContent = 'เปิดหน้าคิว';
      }
    }

    function showPinGate() {
      elements.pinGate.hidden = false;
      elements.staffApp.hidden = true;
      window.setTimeout(function() { elements.staffPin.focus(); }, 0);
    }

    function showStaffApp() {
      elements.pinGate.hidden = true;
      elements.staffApp.hidden = false;
    }

    async function loadOrders(background) {
      if (state.loading || !state.pin) return;
      state.loading = true;
      if (!background) setOrdersView('loading');
      setLiveState('loading');
      elements.refreshButton.disabled = true;

      try {
        const data = await apiRequest('staffOrders', { pin: state.pin }, 'POST');
        applyOrders(data);
        setLiveState('connected');
      } catch (error) {
        if (error.message.indexOf('รหัสพนักงาน') !== -1) {
          logout();
          elements.pinError.textContent = 'เซสชันหมดอายุ กรุณาใส่รหัสอีกครั้ง';
          elements.pinError.hidden = false;
          return;
        }
        elements.staffErrorText.textContent = error.message;
        if (!background) setOrdersView('error');
        setLiveState('error');
      } finally {
        state.loading = false;
        elements.refreshButton.disabled = false;
        schedulePolling();
      }
    }

    function applyOrders(data) {
      state.orders = Array.isArray(data.orders) ? data.orders : [];
      elements.lastUpdated.textContent = 'อัปเดตล่าสุด ' + (data.generatedAt || 'เมื่อสักครู่');
      updateMetrics();
      renderOrders();
      setLiveState('connected');
    }

    function updateMetrics() {
      const counts = state.orders.reduce(function(result, order) {
        if (Object.prototype.hasOwnProperty.call(result, order.status)) result[order.status] += 1;
        return result;
      }, { Pending: 0, Preparing: 0, Ready: 0 });
      elements.pendingCount.textContent = String(counts.Pending);
      elements.preparingCount.textContent = String(counts.Preparing);
      elements.readyCount.textContent = String(counts.Ready);
      elements.activeBadge.textContent = String(counts.Pending + counts.Preparing + counts.Ready);
    }

    function handleFilterClick(event) {
      const button = event.target.closest('[data-status]');
      if (!button) return;
      state.filter = button.dataset.status;
      elements.statusFilters.querySelectorAll('[data-status]').forEach(function(item) {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderOrders();
    }

    function getFilteredOrders() {
      const filtered = state.orders.filter(function(order) {
        return state.filter === 'active' ? ACTIVE_STATUSES.indexOf(order.status) !== -1 : order.status === state.filter;
      });
      filtered.sort(function(a, b) {
        const direction = state.filter === 'Completed' ? -1 : 1;
        return (new Date(a.createdIso) - new Date(b.createdIso)) * direction;
      });
      return filtered;
    }

    function renderOrders() {
      const orders = getFilteredOrders();
      elements.ordersBoard.innerHTML = orders.map(renderOrderCard).join('');
      if (orders.length) setOrdersView('ready');
      else setOrdersView('empty');
    }

    function renderOrderCard(order) {
      const status = STATUS_COPY[order.status] || STATUS_COPY.Pending;
      const phoneHref = String(order.phone || '').replace(/[^0-9+]/g, '');
      const items = order.items.map(function(item) {
        return '<li><b>' + Number(item.qty) + '×</b><span>' + escapeHtml(item.name) + '</span><small>' + formatMoney(item.total) + '</small></li>';
      }).join('');
      const action = status.next ? '<button class="order-action ' + status.actionClass + '" type="button" data-order-id="' +
        escapeHtml(order.orderId) + '" data-next-status="' + status.next + '">' + status.action + '</button>' : '';
      const note = order.note ? '<p class="order-note"><strong>หมายเหตุ:</strong> ' + escapeHtml(order.note) + '</p>' : '';
      const phone = phoneHref ? '<a href="tel:' + escapeHtml(phoneHref) + '">' + escapeHtml(order.phone) + '</a>' : '<span>ไม่มีเบอร์โทร</span>';

      return '<article class="order-card status-' + escapeHtml(order.status) + '" data-card-order-id="' + escapeHtml(order.orderId) + '">' +
        '<header class="order-card-header">' +
          '<div><span class="order-id">' + escapeHtml(compactOrderId(order.orderId)) + '</span><h2>' + escapeHtml(order.customerName || 'ไม่ระบุชื่อ') + '</h2><span class="status-chip">' + status.label + '</span></div>' +
          '<span class="order-age">' + escapeHtml(formatAge(order.createdIso)) + '</span>' +
        '</header>' +
        '<div class="pickup-time"><span>เวลารับ</span><strong>' + escapeHtml(formatPickup(order.pickupTime)) + '</strong></div>' +
        '<ul class="order-items">' + items + '</ul>' +
        note +
        '<div class="order-contact"><span>สั่งเมื่อ ' + escapeHtml(shortTime(order.createdIso)) + '</span>' + phone + '</div>' +
        '<footer class="order-footer"><span class="order-total">' + formatMoney(order.total) + '</span>' + action + '</footer>' +
      '</article>';
    }

    async function handleOrderAction(event) {
      const button = event.target.closest('[data-next-status]');
      if (!button) return;
      const orderId = button.dataset.orderId;
      const nextStatus = button.dataset.nextStatus;
      const card = elements.ordersBoard.querySelector('[data-card-order-id="' + cssEscape(orderId) + '"]');
      if (card) card.classList.add('is-updating');
      button.disabled = true;
      const previousLabel = button.textContent;
      button.textContent = 'กำลังบันทึก';

      try {
        await apiRequest('updateOrderStatus', {
          orderId: orderId,
          status: nextStatus,
          pin: state.pin,
        }, 'POST');
        const order = state.orders.filter(function(item) { return item.orderId === orderId; })[0];
        if (order) order.status = nextStatus;
        updateMetrics();
        renderOrders();
        showToast('อัปเดต ' + compactOrderId(orderId) + ' แล้ว');
      } catch (error) {
        if (card) card.classList.remove('is-updating');
        button.disabled = false;
        button.textContent = previousLabel;
        showToast(error.message);
      }
    }

    function setOrdersView(view) {
      elements.ordersLoading.hidden = view !== 'loading';
      elements.ordersBoard.hidden = view !== 'ready';
      elements.emptyOrders.hidden = view !== 'empty';
      elements.staffError.hidden = view !== 'error';
    }

    function setLiveState(view) {
      elements.liveStatus.classList.toggle('is-error', view === 'error');
      elements.liveStatus.innerHTML = '<i aria-hidden="true"></i>' +
        (view === 'loading' ? ' กำลังอัปเดต' : view === 'error' ? ' เชื่อมต่อขัดข้อง' : ' เชื่อมต่อแล้ว');
    }

    function schedulePolling() {
      if (state.pollTimer) window.clearTimeout(state.pollTimer);
      if (state.pin) state.pollTimer = window.setTimeout(function() { loadOrders(true); }, 15000);
    }

    function logout() {
      if (state.pollTimer) window.clearTimeout(state.pollTimer);
      state.pollTimer = null;
      state.pin = '';
      state.orders = [];
      sessionStorage.removeItem(PIN_KEY);
      elements.staffPin.value = '';
      showPinGate();
    }

    function showToast(message) {
      if (state.toastTimer) window.clearTimeout(state.toastTimer);
      elements.staffToast.textContent = message;
      elements.staffToast.hidden = false;
      state.toastTimer = window.setTimeout(function() { elements.staffToast.hidden = true; }, 2600);
    }

    function formatAge(iso) {
      const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
      if (minutes < 1) return 'เมื่อสักครู่';
      if (minutes < 60) return minutes + ' นาทีที่แล้ว';
      const hours = Math.floor(minutes / 60);
      return hours + ' ชม. ' + (minutes % 60) + ' นาที';
    }

    function shortTime(iso) {
      return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) + ' น.';
    }

    function formatPickup(value) {
      return value === 'เร็วที่สุด' ? 'เร็วที่สุด' : String(value || '-') + ' น.';
    }

    function compactOrderId(orderId) {
      const parts = String(orderId).split('-');
      return parts.length === 3 ? '#' + parts[1] + '-' + parts[2] : '#' + orderId;
    }

    function formatMoney(value) {
      return new Intl.NumberFormat('th-TH', {
        style: 'currency', currency: 'THB', maximumFractionDigits: 0
      }).format(Number(value) || 0);
    }

    function cssEscape(value) {
      return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
    }

    function escapeHtml(value) {
      const span = document.createElement('span');
      span.textContent = String(value == null ? '' : value);
      return span.innerHTML;
    }
  })();
