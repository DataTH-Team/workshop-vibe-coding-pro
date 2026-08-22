(function() {
  'use strict';

  const config = window.CAFE_CONFIG || {};
  const baseUrl = String(config.APPS_SCRIPT_URL || '').trim();
  const pending = new Map();
  const token = makeToken();
  let iframe = null;
  let bridgeWindow = null;
  let ready = false;
  let readyResolve;
  let readyReject;

  const readyPromise = new Promise(function(resolve, reject) {
    readyResolve = resolve;
    readyReject = reject;
  });

  const readyTimeout = window.setTimeout(function() {
    if (!ready) readyReject(new Error('เชื่อมต่อ Apps Script ไม่สำเร็จ ตรวจ URL และสิทธิ์ Anyone'));
  }, 15000);

  window.CafeApi = Object.freeze({ request: request });
  window.addEventListener('message', handleMessage);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBridge);
  else mountBridge();

  function mountBridge() {
    if (!baseUrl || baseUrl.indexOf('PASTE_') === 0) {
      readyReject(new Error('กรุณาใส่ Apps Script URL ใน config.js'));
      return;
    }

    iframe = document.createElement('iframe');
    iframe.title = 'Google Sheets connection';
    iframe.hidden = true;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.src = baseUrl + (baseUrl.indexOf('?') === -1 ? '?' : '&') +
      'bridge=1&token=' + encodeURIComponent(token);
    document.body.appendChild(iframe);
  }

  async function request(action, payload) {
    await readyPromise;
    return new Promise(function(resolve, reject) {
      const id = makeToken();
      const timeout = window.setTimeout(function() {
        pending.delete(id);
        reject(new Error('Apps Script ใช้เวลาตอบกลับนานเกินไป'));
      }, 30000);

      pending.set(id, { resolve: resolve, reject: reject, timeout: timeout });
      bridgeWindow.postMessage({
        namespace: 'cafe-order-bridge',
        type: 'request',
        token: token,
        id: id,
        action: action,
        payload: payload || {},
      }, '*');
    });
  }

  function handleMessage(event) {
    const message = event.data || {};
    if (message.namespace !== 'cafe-order-bridge' || message.token !== token) return;

    if (message.type === 'ready') {
      bridgeWindow = event.source;
      ready = true;
      window.clearTimeout(readyTimeout);
      readyResolve();
      return;
    }

    if (event.source !== bridgeWindow || message.type !== 'response' || !pending.has(message.id)) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    window.clearTimeout(task.timeout);
    if (message.ok) task.resolve(message.data);
    else task.reject(new Error(message.error || 'Apps Script ทำรายการไม่สำเร็จ'));
  }

  function makeToken() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function(value) { return value.toString(16).padStart(2, '0'); }).join('');
  }
})();
