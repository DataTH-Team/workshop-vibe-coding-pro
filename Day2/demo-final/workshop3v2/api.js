(function () {
  'use strict';

  function endpoint() {
    return String(window.CAFE_CONFIG && window.CAFE_CONFIG.GAS_WEB_APP_URL || '').trim();
  }

  function isConfigured() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint());
  }

  async function readJson(response) {
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error('เซิร์ฟเวอร์ตอบกลับในรูปแบบที่อ่านไม่ได้ กรุณาตรวจ URL ของ Web app');
    }
    if (!result.ok) throw new Error(result.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
    return result.data;
  }

  async function get(action, params) {
    if (!isConfigured()) throw new Error('ยังไม่ได้ตั้งค่า GAS_WEB_APP_URL ใน config.js');
    const url = new URL(endpoint());
    url.searchParams.set('action', action);
    Object.entries(params || {}).forEach(function (entry) {
      if (entry[1] !== undefined && entry[1] !== null) url.searchParams.set(entry[0], entry[1]);
    });
    const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    if (!response.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (' + response.status + ')');
    return readJson(response);
  }

  async function post(action, payload) {
    if (!isConfigured()) throw new Error('ยังไม่ได้ตั้งค่า GAS_WEB_APP_URL ใน config.js');
    const response = await fetch(endpoint(), {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, payload: payload || {} }),
    });
    if (!response.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (' + response.status + ')');
    return readJson(response);
  }

  window.CafeApi = Object.freeze({ get: get, post: post, isConfigured: isConfigured });
})();
