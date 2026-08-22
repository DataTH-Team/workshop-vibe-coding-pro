  (function() {
    'use strict';

    const STORAGE_KEY = 'cafeActiveOrderId';
    const PROFILE_KEY = 'cafeCustomerProfile';
    const STATUS_ORDER = ['Pending', 'Preparing', 'Ready', 'Completed'];
    const STATUS_COPY = {
      Pending: { label: 'รับออเดอร์แล้ว', message: 'ร้านกำลังตรวจสอบรายการของคุณ' },
      Preparing: { label: 'กำลังทำ', message: 'บาริสต้ากำลังเตรียมออเดอร์' },
      Ready: { label: 'พร้อมรับ', message: 'มารับออเดอร์ที่เคาน์เตอร์ได้เลย' },
      Completed: { label: 'รับสินค้าแล้ว', message: 'ขอบคุณ แล้วพบกันใหม่' },
    };
    const STEP_LABELS = ['รับออเดอร์', 'กำลังทำ', 'พร้อมรับ', 'รับแล้ว'];

    const state = {
      menu: [],
      categories: [],
      activeCategory: 'all',
      cart: {},
      activeOrderId: localStorage.getItem(STORAGE_KEY) || '',
      statusTimer: null,
      toastTimer: null,
    };

    const elements = {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
      [
        'trackOrderButton', 'categoryFilters', 'menuLoading', 'menuGrid', 'menuError',
        'retryMenuButton', 'cartDock', 'openCartButton', 'cartCount', 'cartTotal',
        'cartDialog', 'cartItems', 'dialogTotal', 'checkoutForm', 'customerName',
        'customerPhone', 'pickupTime', 'orderNote', 'submitError', 'submitOrderButton',
        'submitTotal', 'statusDialog', 'statusOrderId', 'statusLoading', 'statusContent',
        'statusError', 'statusErrorText', 'statusLabel', 'statusMessage', 'statusSteps',
        'statusPickup', 'statusTotal', 'retryStatusButton', 'orderAnotherButton', 'toast',
        'brandName'
      ].forEach(function(id) { elements[id] = document.getElementById(id); });

      applyCafeName();
      bindEvents();
      populatePickupTimes();
      restoreProfile();
      updateTrackingButton();
      loadMenu();
    }

    function bindEvents() {
      elements.retryMenuButton.addEventListener('click', loadMenu);
      elements.categoryFilters.addEventListener('click', handleCategoryClick);
      elements.menuGrid.addEventListener('click', handleMenuClick);
      elements.openCartButton.addEventListener('click', openCart);
      elements.cartItems.addEventListener('click', handleCartClick);
      elements.checkoutForm.addEventListener('submit', submitOrder);
      elements.trackOrderButton.addEventListener('click', function() { openStatus(state.activeOrderId); });
      elements.retryStatusButton.addEventListener('click', function() { loadOrderStatus(state.activeOrderId); });
      elements.orderAnotherButton.addEventListener('click', startAnotherOrder);

      document.querySelectorAll('[data-close-dialog]').forEach(function(button) {
        button.addEventListener('click', function() { elements.cartDialog.close(); });
      });
      document.querySelectorAll('[data-close-status]').forEach(function(button) {
        button.addEventListener('click', function() { elements.statusDialog.close(); });
      });
      [elements.cartDialog, elements.statusDialog].forEach(function(dialog) {
        dialog.addEventListener('click', function(event) {
          if (event.target === dialog) dialog.close();
        });
      });
      elements.statusDialog.addEventListener('close', stopStatusPolling);
    }

    async function apiRequest(action, payload, method) {
      if (!window.CafeApi) throw new Error('โหลดตัวเชื่อม Apps Script ไม่สำเร็จ');
      return window.CafeApi.request(action, payload || {});
    }

    function applyCafeName() {
      const name = String((window.CAFE_CONFIG || {}).CAFE_NAME || 'บ้านกาแฟ');
      elements.brandName.textContent = name;
      document.title = name + ' | สั่งล่วงหน้า';
    }

    async function loadMenu() {
      setMenuView('loading');
      try {
        const data = await apiRequest('menu');
        state.menu = Array.isArray(data.menu) ? data.menu : [];
        state.categories = Array.isArray(data.categories) ? data.categories : [];
        renderCategories();
        renderMenu();
        setMenuView('ready');
      } catch (error) {
        console.error(error);
        setMenuView('error');
      }
    }

    function setMenuView(view) {
      elements.menuLoading.hidden = view !== 'loading';
      elements.menuGrid.hidden = view !== 'ready';
      elements.menuError.hidden = view !== 'error';
    }

    function renderCategories() {
      elements.categoryFilters.innerHTML = state.categories.map(function(category) {
        const active = category.id === state.activeCategory;
        return '<button class="' + (active ? 'is-active' : '') + '" type="button" data-category="' +
          escapeHtml(category.id) + '" aria-pressed="' + String(active) + '">' + escapeHtml(category.label) + '</button>';
      }).join('');
    }

    function renderMenu() {
      const filtered = state.menu.filter(function(item) {
        return state.activeCategory === 'all' || item.category === state.activeCategory;
      });

      elements.menuGrid.innerHTML = filtered.map(function(item) {
        const quantity = state.cart[item.id] || 0;
        return '<article class="product-card" data-product-id="' + escapeHtml(item.id) + '">' +
          '<div class="product-visual tone-' + escapeHtml(item.tone) + '" aria-hidden="true">' + escapeHtml(item.mark) + '</div>' +
          '<div class="product-content">' +
            '<span class="product-category">' + escapeHtml(item.categoryLabel) + '</span>' +
            '<h3>' + escapeHtml(item.name) + '</h3>' +
            '<p>' + escapeHtml(item.description) + '</p>' +
            '<div class="product-actions">' +
              '<strong class="product-price">' + formatMoney(item.price) + '</strong>' +
              renderQuantityControl(item.id, quantity, 'menu') +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    function renderQuantityControl(id, quantity, context) {
      if (!quantity) {
        return '<button class="add-button" type="button" data-cart-action="add" data-item-id="' + escapeHtml(id) + '">เพิ่ม</button>';
      }
      return '<div class="quantity-control" aria-label="จำนวนสินค้า">' +
        '<button class="quantity-button" type="button" data-cart-action="decrease" data-item-id="' + escapeHtml(id) + '" aria-label="ลดจำนวน">−</button>' +
        '<span class="quantity-value" aria-live="polite">' + quantity + '</span>' +
        '<button class="quantity-button" type="button" data-cart-action="increase" data-item-id="' + escapeHtml(id) + '" aria-label="เพิ่มจำนวน">+</button>' +
      '</div>';
    }

    function handleCategoryClick(event) {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.activeCategory = button.dataset.category;
      renderCategories();
      renderMenu();
    }

    function handleMenuClick(event) {
      const button = event.target.closest('[data-cart-action]');
      if (!button) return;
      updateCart(button.dataset.itemId, button.dataset.cartAction);
    }

    function handleCartClick(event) {
      const button = event.target.closest('[data-cart-action]');
      if (!button) return;
      updateCart(button.dataset.itemId, button.dataset.cartAction);
      renderCartItems();
    }

    function updateCart(itemId, action) {
      const current = state.cart[itemId] || 0;
      if (action === 'add' || action === 'increase') state.cart[itemId] = Math.min(10, current + 1);
      if (action === 'decrease') {
        const next = current - 1;
        if (next > 0) state.cart[itemId] = next;
        else delete state.cart[itemId];
      }
      renderMenu();
      updateCartDock();
    }

    function getCartSummary() {
      return state.menu.reduce(function(summary, item) {
        const qty = state.cart[item.id] || 0;
        if (qty) summary.items.push({ item: item, qty: qty });
        summary.count += qty;
        summary.total += qty * item.price;
        return summary;
      }, { items: [], count: 0, total: 0 });
    }

    function updateCartDock() {
      const summary = getCartSummary();
      elements.cartDock.hidden = summary.count === 0;
      elements.cartCount.textContent = String(summary.count);
      elements.cartTotal.textContent = formatMoney(summary.total);
      elements.dialogTotal.textContent = formatMoney(summary.total);
      elements.submitTotal.textContent = formatMoney(summary.total);
    }

    function openCart() {
      if (!getCartSummary().count) return;
      clearFormErrors();
      populatePickupTimes();
      renderCartItems();
      elements.cartDialog.showModal();
    }

    function renderCartItems() {
      const summary = getCartSummary();
      elements.cartItems.innerHTML = summary.items.map(function(entry) {
        return '<article class="cart-row">' +
          '<div><h3>' + escapeHtml(entry.item.name) + '</h3><small>' + formatMoney(entry.item.price) + ' ต่อชิ้น</small></div>' +
          renderQuantityControl(entry.item.id, entry.qty, 'cart') +
          '<strong>' + formatMoney(entry.item.price * entry.qty) + '</strong>' +
        '</article>';
      }).join('');
      updateCartDock();
      if (!summary.count && elements.cartDialog.open) elements.cartDialog.close();
    }

    function populatePickupTimes() {
      const selected = elements.pickupTime.value;
      const now = new Date();
      const options = ['<option value="เร็วที่สุด">เร็วที่สุด (ประมาณ 10-15 นาที)</option>'];
      for (let minutes = 30; minutes <= 120; minutes += 15) {
        const time = new Date(now.getTime() + minutes * 60000);
        time.setMinutes(Math.ceil(time.getMinutes() / 5) * 5, 0, 0);
        const value = String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0');
        options.push('<option value="' + value + '">' + value + ' น.</option>');
      }
      elements.pickupTime.innerHTML = options.join('');
      if (Array.from(elements.pickupTime.options).some(function(option) { return option.value === selected; })) {
        elements.pickupTime.value = selected;
      }
    }

    async function submitOrder(event) {
      event.preventDefault();
      clearFormErrors();
      const summary = getCartSummary();
      const payload = {
        customerName: elements.customerName.value.trim(),
        phone: elements.customerPhone.value.trim(),
        pickupTime: elements.pickupTime.value,
        note: elements.orderNote.value.trim(),
        items: summary.items.map(function(entry) { return { id: entry.item.id, qty: entry.qty }; }),
      };

      if (!validateCheckout(payload)) return;
      setSubmitLoading(true);
      try {
        const result = await apiRequest('createOrder', payload, 'POST');
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: payload.customerName, phone: payload.phone }));
        localStorage.setItem(STORAGE_KEY, result.orderId);
        state.activeOrderId = result.orderId;
        state.cart = {};
        renderMenu();
        updateCartDock();
        updateTrackingButton();
        elements.cartDialog.close();
        showToast('ส่งออเดอร์ให้ร้านแล้ว');
        openStatus(result.orderId);
      } catch (error) {
        elements.submitError.textContent = error.message;
        elements.submitError.hidden = false;
      } finally {
        setSubmitLoading(false);
      }
    }

    function validateCheckout(payload) {
      let valid = true;
      if (payload.customerName.length < 2) {
        setFieldError('customerName', 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร');
        valid = false;
      }
      if (!/^\+?[0-9\s-]{8,18}$/.test(payload.phone)) {
        setFieldError('phone', 'กรุณากรอกเบอร์โทรให้ถูกต้อง');
        valid = false;
      }
      if (!payload.pickupTime) {
        setFieldError('pickupTime', 'กรุณาเลือกเวลารับ');
        valid = false;
      }
      if (!payload.items.length) {
        elements.submitError.textContent = 'กรุณาเลือกอย่างน้อย 1 เมนู';
        elements.submitError.hidden = false;
        valid = false;
      }
      return valid;
    }

    function setFieldError(fieldName, message) {
      const field = elements.checkoutForm.elements[fieldName];
      const error = elements.checkoutForm.querySelector('[data-error-for="' + fieldName + '"]');
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
      error.textContent = message;
    }

    function clearFormErrors() {
      elements.checkoutForm.querySelectorAll('.is-invalid').forEach(function(field) {
        field.classList.remove('is-invalid');
        field.removeAttribute('aria-invalid');
      });
      elements.checkoutForm.querySelectorAll('[data-error-for]').forEach(function(error) { error.textContent = ''; });
      elements.submitError.hidden = true;
      elements.submitError.textContent = '';
    }

    function setSubmitLoading(loading) {
      elements.submitOrderButton.disabled = loading;
      elements.submitOrderButton.querySelector('span').textContent = loading ? 'กำลังส่งออเดอร์' : 'ยืนยันออเดอร์';
    }

    function updateTrackingButton() {
      elements.trackOrderButton.hidden = !state.activeOrderId;
    }

    function openStatus(orderId) {
      if (!orderId) return;
      state.activeOrderId = orderId;
      elements.statusOrderId.textContent = compactOrderId(orderId);
      elements.statusDialog.showModal();
      loadOrderStatus(orderId);
    }

    async function loadOrderStatus(orderId) {
      stopStatusPolling();
      setStatusView('loading');
      try {
        const order = await apiRequest('orderStatus', { orderId: orderId });
        renderOrderStatus(order);
        setStatusView('ready');
        if (order.status !== 'Completed' && elements.statusDialog.open) {
          state.statusTimer = window.setTimeout(function() { loadOrderStatus(orderId); }, 20000);
        }
      } catch (error) {
        elements.statusErrorText.textContent = error.message;
        setStatusView('error');
      }
    }

    function setStatusView(view) {
      elements.statusLoading.hidden = view !== 'loading';
      elements.statusContent.hidden = view !== 'ready';
      elements.statusError.hidden = view !== 'error';
    }

    function renderOrderStatus(order) {
      const status = STATUS_COPY[order.status] || STATUS_COPY.Pending;
      const currentIndex = Math.max(0, STATUS_ORDER.indexOf(order.status));
      elements.statusOrderId.textContent = compactOrderId(order.orderId);
      elements.statusLabel.textContent = status.label;
      elements.statusMessage.textContent = status.message;
      elements.statusPickup.textContent = order.pickupTime === 'เร็วที่สุด' ? 'เร็วที่สุด' : order.pickupTime + ' น.';
      elements.statusTotal.textContent = formatMoney(order.total);
      elements.statusSteps.innerHTML = STEP_LABELS.map(function(label, index) {
        const className = index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : '';
        return '<li class="' + className + '">' + escapeHtml(label) + '</li>';
      }).join('');
    }

    function startAnotherOrder() {
      stopStatusPolling();
      state.activeOrderId = '';
      localStorage.removeItem(STORAGE_KEY);
      updateTrackingButton();
      elements.statusDialog.close();
      document.getElementById('menuTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function stopStatusPolling() {
      if (state.statusTimer) window.clearTimeout(state.statusTimer);
      state.statusTimer = null;
    }

    function restoreProfile() {
      try {
        const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
        if (profile.name) elements.customerName.value = profile.name;
        if (profile.phone) elements.customerPhone.value = profile.phone;
      } catch (error) {
        localStorage.removeItem(PROFILE_KEY);
      }
    }

    function showToast(message) {
      if (state.toastTimer) window.clearTimeout(state.toastTimer);
      elements.toast.textContent = message;
      elements.toast.hidden = false;
      state.toastTimer = window.setTimeout(function() { elements.toast.hidden = true; }, 2600);
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

    function escapeHtml(value) {
      const span = document.createElement('span');
      span.textContent = String(value == null ? '' : value);
      return span.innerHTML;
    }
  })();
