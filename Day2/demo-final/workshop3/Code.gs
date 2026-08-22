const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1a0ElwjZdLOd0MJg7tx-iqQVXwZVdZPKG9WTfuQtJKxA',
  SHEET_GID: 0,
  CAFE_NAME: 'บ้านกาแฟ',
  DEFAULT_STAFF_PIN: '2468',
  MAX_ITEMS_PER_ORDER: 20,
  ACTIVE_STATUSES: ['Pending', 'Preparing', 'Ready'],
  ALL_STATUSES: ['Pending', 'Preparing', 'Ready', 'Completed'],
});

const REQUIRED_HEADERS = Object.freeze([
  'order_id',
  'datetime',
  'menu',
  'category',
  'qty',
  'price',
  'total',
  'channel',
  'customer',
  'status',
  'pickup_time',
  'phone',
  'note',
  'updated_at',
]);

const MENU = Object.freeze([
  { id: 'iced-americano', sheetName: 'Iced Americano', name: 'อเมริกาโน่เย็น', category: 'Coffee', categoryLabel: 'กาแฟ', price: 55, mark: 'A', tone: 'cobalt', description: 'เอสเปรสโซ่เข้ม เติมน้ำและน้ำแข็ง' },
  { id: 'iced-latte', sheetName: 'Iced Latte', name: 'ลาเต้เย็น', category: 'Coffee', categoryLabel: 'กาแฟ', price: 65, mark: 'L', tone: 'sky', description: 'เอสเปรสโซ่กับนมสด รสนุ่ม' },
  { id: 'hot-cappuccino', sheetName: 'Hot Cappuccino', name: 'คาปูชิโน่ร้อน', category: 'Coffee', categoryLabel: 'กาแฟ', price: 60, mark: 'C', tone: 'slate', description: 'กาแฟร้อนพร้อมโฟมนมนุ่ม' },
  { id: 'espresso', sheetName: 'Espresso', name: 'เอสเปรสโซ่', category: 'Coffee', categoryLabel: 'กาแฟ', price: 50, mark: 'E', tone: 'ink', description: 'ช็อตกาแฟเข้ม หอมชัด' },
  { id: 'iced-mocha', sheetName: 'Iced Mocha', name: 'มอคค่าเย็น', category: 'Coffee', categoryLabel: 'กาแฟ', price: 70, mark: 'M', tone: 'rose', description: 'กาแฟ โกโก้ และนมสด' },
  { id: 'thai-iced-tea', sheetName: 'Thai Iced Tea', name: 'ชาไทยเย็น', category: 'Tea', categoryLabel: 'ชา', price: 55, mark: 'T', tone: 'orange', description: 'ชาไทยหอมเข้มกับนมสด' },
  { id: 'green-tea-latte', sheetName: 'Green Tea Latte', name: 'มัทฉะลาเต้', category: 'Tea', categoryLabel: 'ชา', price: 65, mark: 'G', tone: 'sage', description: 'ชาเขียวกับนมสด หอมนุ่ม' },
  { id: 'lemon-tea', sheetName: 'Lemon Tea', name: 'ชามะนาว', category: 'Tea', categoryLabel: 'ชา', price: 50, mark: 'L', tone: 'lime', description: 'ชาดำกับมะนาวสด เปรี้ยวพอดี' },
  { id: 'orange-juice', sheetName: 'Fresh Orange Juice', name: 'น้ำส้มสด', category: 'Other Drinks', categoryLabel: 'เครื่องดื่ม', price: 60, mark: 'O', tone: 'sun', description: 'น้ำส้มคั้น สดชื่น ไม่เติมน้ำตาล' },
  { id: 'lemon-soda', sheetName: 'Lemon Soda', name: 'เลมอนโซดา', category: 'Other Drinks', categoryLabel: 'เครื่องดื่ม', price: 45, mark: 'LS', tone: 'citrus', description: 'มะนาวสดกับโซดา ซ่ากำลังดี' },
  { id: 'butter-croissant', sheetName: 'Butter Croissant', name: 'ครัวซองต์เนยสด', category: 'Snacks', categoryLabel: 'ของทานเล่น', price: 55, mark: 'CR', tone: 'wheat', description: 'อบกรอบนอก นุ่มใน หอมเนย' },
  { id: 'choc-chip-cookie', sheetName: 'Choc Chip Cookie', name: 'คุกกี้ช็อกชิพ', category: 'Snacks', categoryLabel: 'ของทานเล่น', price: 35, mark: 'CK', tone: 'cocoa', description: 'คุกกี้เนื้อนุ่ม ช็อกโกแลตแน่น' },
  { id: 'chocolate-cake', sheetName: 'Chocolate Cake', name: 'เค้กช็อกโกแลต', category: 'Snacks', categoryLabel: 'ของทานเล่น', price: 75, mark: 'CH', tone: 'plum', description: 'เค้กช็อกโกแลตเนื้อชุ่มเข้มข้น' },
]);

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (params.bridge === '1') return bridgeResponse_(params.token);
    const action = String(params.action || 'health');
    if (action === 'health') {
      const context = ensureSheet_();
      return jsonResponse_({
        ok: true,
        data: {
          service: 'cafe-order-api',
          cafeName: CONFIG.CAFE_NAME,
          sheet: context.sheet.getName(),
        },
      });
    }
    if (action === 'menu') return jsonResponse_({ ok: true, data: getMenu() });
    if (action === 'orderStatus') {
      return jsonResponse_({ ok: true, data: getOrderStatus(params.orderId) });
    }
    throw new Error('ไม่พบ API action ที่ร้องขอ');
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
}

function doPost(e) {
  try {
    const request = parseRequestBody_(e);
    const action = String(request.action || '');
    const payload = request.payload || {};
    let data;

    if (action === 'createOrder') data = createOrder(payload);
    else if (action === 'staffOrders') data = getStaffOrders(payload.pin);
    else if (action === 'updateOrderStatus') {
      data = updateOrderStatus(payload.orderId, payload.status, payload.pin);
    } else {
      throw new Error('ไม่พบ API action ที่ร้องขอ');
    }

    return jsonResponse_({ ok: true, data: data });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
}

function getMenu() {
  ensureSheet_();
  return {
    cafeName: CONFIG.CAFE_NAME,
    menu: MENU.map(function(item) { return Object.assign({}, item); }),
    categories: [
      { id: 'all', label: 'ทั้งหมด' },
      { id: 'Coffee', label: 'กาแฟ' },
      { id: 'Tea', label: 'ชา' },
      { id: 'Other Drinks', label: 'เครื่องดื่ม' },
      { id: 'Snacks', label: 'ของทานเล่น' },
    ],
  };
}

function createOrder(payload) {
  const clean = validateOrder_(payload);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const context = ensureSheet_();
    const now = new Date();
    const orderId = makeOrderId_(now, context.timeZone);
    const rows = clean.items.map(function(item) {
      const menuItem = getMenuItem_(item.id);
      return rowFromObject_(context.headers, {
        order_id: orderId,
        datetime: now,
        menu: menuItem.sheetName,
        category: menuItem.category,
        qty: item.qty,
        price: menuItem.price,
        total: menuItem.price * item.qty,
        channel: 'Pre-order',
        customer: clean.customerName,
        status: 'Pending',
        pickup_time: clean.pickupTime,
        phone: clean.phone,
        note: clean.note,
        updated_at: now,
      });
    });

    context.sheet.getRange(context.sheet.getLastRow() + 1, 1, rows.length, context.headers.length).setValues(rows);
    return {
      ok: true,
      orderId: orderId,
      status: 'Pending',
      pickupTime: clean.pickupTime,
      total: clean.total,
      createdAt: formatDateTime_(now, context.timeZone),
    };
  } finally {
    lock.releaseLock();
  }
}

function getOrderStatus(orderId) {
  const cleanId = normalizeOrderId_(orderId);
  const context = ensureSheet_();
  const orders = readGroupedOrders_(context);
  const order = orders.filter(function(item) { return item.orderId === cleanId; })[0];
  if (!order) throw new Error('ไม่พบหมายเลขออเดอร์นี้');
  return sanitizeCustomerOrder_(order);
}

function getStaffOrders(pin) {
  assertStaffPin_(pin);
  const context = ensureSheet_();
  const today = Utilities.formatDate(new Date(), context.timeZone, 'yyyy-MM-dd');
  const orders = readGroupedOrders_(context).filter(function(order) {
    return CONFIG.ACTIVE_STATUSES.indexOf(order.status) !== -1 || order.dateKey === today;
  });
  orders.sort(function(a, b) { return new Date(a.createdIso) - new Date(b.createdIso); });

  return {
    cafeName: CONFIG.CAFE_NAME,
    generatedAt: formatDateTime_(new Date(), context.timeZone),
    orders: orders,
  };
}

function updateOrderStatus(orderId, newStatus, pin) {
  assertStaffPin_(pin);
  const cleanId = normalizeOrderId_(orderId);
  if (CONFIG.ALL_STATUSES.indexOf(newStatus) === -1) throw new Error('สถานะไม่ถูกต้อง');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const context = ensureSheet_();
    const values = context.sheet.getDataRange().getValues();
    const statusColumn = context.headers.indexOf('status') + 1;
    const updatedColumn = context.headers.indexOf('updated_at') + 1;
    const orderColumn = context.headers.indexOf('order_id');
    const channelColumn = context.headers.indexOf('channel');
    const matchingRows = [];

    for (let index = 1; index < values.length; index += 1) {
      if (String(values[index][orderColumn]).trim() === cleanId && String(values[index][channelColumn]).trim() === 'Pre-order') {
        matchingRows.push(index + 1);
      }
    }

    if (!matchingRows.length) throw new Error('ไม่พบออเดอร์ที่ต้องการอัปเดต');
    const currentStatus = String(values[matchingRows[0] - 1][statusColumn - 1] || 'Pending');
    const allowedNext = {
      Pending: 'Preparing',
      Preparing: 'Ready',
      Ready: 'Completed',
    }[currentStatus];
    if (newStatus !== currentStatus && newStatus !== allowedNext) {
      throw new Error('ไม่สามารถเปลี่ยนจาก ' + currentStatus + ' เป็น ' + newStatus);
    }
    matchingRows.forEach(function(rowNumber) {
      context.sheet.getRange(rowNumber, statusColumn).setValue(newStatus);
      context.sheet.getRange(rowNumber, updatedColumn).setValue(new Date());
    });

    return { ok: true, orderId: cleanId, status: newStatus };
  } finally {
    lock.releaseLock();
  }
}

function setupCafeApp() {
  const context = ensureSheet_();
  return 'พร้อมใช้งาน: ' + context.sheet.getName() + ' มี ' + context.headers.length + ' คอลัมน์';
}

function ensureSheet_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetById(CONFIG.SHEET_GID) || spreadsheet.getSheets()[0];
  if (!sheet) throw new Error('ไม่พบชีต gid=' + CONFIG.SHEET_GID);

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(header) {
    return String(header).trim();
  });

  if (headers.every(function(header) { return !header; })) headers = [];
  const missing = REQUIRED_HEADERS.filter(function(header) { return headers.indexOf(header) === -1; });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  return {
    spreadsheet: spreadsheet,
    sheet: sheet,
    headers: headers,
    timeZone: spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone(),
  };
}

function readGroupedOrders_(context) {
  if (context.sheet.getLastRow() < 2) return [];
  const values = context.sheet.getRange(2, 1, context.sheet.getLastRow() - 1, context.headers.length).getValues();
  const rows = values.map(function(row) { return objectFromRow_(context.headers, row); });
  const groups = {};

  rows.forEach(function(row) {
    if (String(row.channel).trim() !== 'Pre-order' || !row.order_id) return;
    const id = String(row.order_id).trim();
    if (!groups[id]) {
      const created = parseSheetDate_(row.datetime);
      groups[id] = {
        orderId: id,
        createdIso: created.toISOString(),
        createdAt: formatDateTime_(created, context.timeZone),
        dateKey: Utilities.formatDate(created, context.timeZone, 'yyyy-MM-dd'),
        customerName: String(row.customer || ''),
        phone: String(row.phone || ''),
        pickupTime: String(row.pickup_time || ''),
        note: String(row.note || ''),
        status: String(row.status || 'Pending'),
        items: [],
        total: 0,
      };
    }
    const qty = Number(row.qty) || 0;
    const total = Number(row.total) || 0;
    const matchedMenu = MENU.filter(function(item) { return item.sheetName === String(row.menu); })[0];
    groups[id].items.push({
      name: matchedMenu ? matchedMenu.name : String(row.menu),
      qty: qty,
      price: Number(row.price) || 0,
      total: total,
    });
    groups[id].total += total;
    groups[id].status = String(row.status || groups[id].status);
  });

  return Object.keys(groups).map(function(key) { return groups[key]; });
}

function validateOrder_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('ข้อมูลออเดอร์ไม่ครบ');
  const customerName = String(payload.customerName || '').trim();
  const phone = String(payload.phone || '').replace(/[^0-9+]/g, '').trim();
  const pickupTime = String(payload.pickupTime || '').trim();
  const note = String(payload.note || '').trim().slice(0, 200);
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (customerName.length < 2 || customerName.length > 60) throw new Error('กรุณากรอกชื่อสำหรับรับออเดอร์');
  if (!/^\+?[0-9]{8,15}$/.test(phone)) throw new Error('กรุณากรอกเบอร์โทรให้ถูกต้อง');
  if (!/^(เร็วที่สุด|[0-2][0-9]:[0-5][0-9])$/.test(pickupTime)) throw new Error('กรุณาเลือกเวลารับ');
  if (!items.length) throw new Error('กรุณาเลือกอย่างน้อย 1 เมนู');

  let itemCount = 0;
  let total = 0;
  const cleanItems = items.map(function(item) {
    const menuItem = getMenuItem_(String(item.id || ''));
    const qty = Math.floor(Number(item.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 10) throw new Error('จำนวนสินค้าไม่ถูกต้อง');
    itemCount += qty;
    total += menuItem.price * qty;
    return { id: menuItem.id, qty: qty };
  });

  if (itemCount > CONFIG.MAX_ITEMS_PER_ORDER) throw new Error('สั่งได้ไม่เกิน ' + CONFIG.MAX_ITEMS_PER_ORDER + ' ชิ้นต่อออเดอร์');
  return { customerName: customerName, phone: phone, pickupTime: pickupTime, note: note, items: cleanItems, total: total };
}

function getMenuItem_(id) {
  const item = MENU.filter(function(menuItem) { return menuItem.id === id; })[0];
  if (!item) throw new Error('พบเมนูที่ไม่ถูกต้อง');
  return item;
}

function assertStaffPin_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty('STAFF_PIN') || CONFIG.DEFAULT_STAFF_PIN;
  if (String(pin || '') !== String(expected)) throw new Error('รหัสพนักงานไม่ถูกต้อง');
}

function normalizeOrderId_(orderId) {
  const clean = String(orderId || '').trim().toUpperCase();
  if (!/^P[0-9]{6}-[0-9]{6}-[A-Z0-9]{4}$/.test(clean)) throw new Error('หมายเลขออเดอร์ไม่ถูกต้อง');
  return clean;
}

function makeOrderId_(date, timeZone) {
  const stamp = Utilities.formatDate(date, timeZone, 'yyMMdd-HHmmss');
  const suffix = Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase();
  return 'P' + stamp + '-' + suffix;
}

function objectFromRow_(headers, row) {
  const output = {};
  headers.forEach(function(header, index) { output[header] = row[index]; });
  return output;
}

function rowFromObject_(headers, object) {
  return headers.map(function(header) { return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : ''; });
}

function parseSheetDate_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const normalized = String(value || '').trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateTime_(date, timeZone) {
  return Utilities.formatDate(date, timeZone, 'dd/MM/yyyy HH:mm');
}

function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('ไม่พบ request body');
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('request body ต้องเป็น JSON');
  }
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function bridgeResponse_(token) {
  const cleanToken = String(token || '');
  if (!/^[a-f0-9]{36}$/.test(cleanToken)) throw new Error('bridge token ไม่ถูกต้อง');

  const tokenJson = JSON.stringify(cleanToken);
  const html = [
    '<!doctype html><html><head><base target="_top"></head><body>',
    '<script>',
    '(function(){',
    "'use strict';",
    'const TOKEN=' + tokenJson + ';',
    'window.addEventListener("message",function(event){',
    'if(event.source!==window.top)return;',
    'const message=event.data||{};',
    'if(message.namespace!=="cafe-order-bridge"||message.type!=="request"||message.token!==TOKEN)return;',
    'const payload=message.payload||{};',
    'const reply=function(ok,value){window.top.postMessage({namespace:"cafe-order-bridge",type:"response",token:TOKEN,id:message.id,ok:ok,data:ok?value:undefined,error:ok?undefined:String(value&&value.message?value.message:value)},"*");};',
    'const runner=google.script.run.withSuccessHandler(function(data){reply(true,data);}).withFailureHandler(function(error){reply(false,error);});',
    'if(message.action==="menu")runner.getMenu();',
    'else if(message.action==="createOrder")runner.createOrder(payload);',
    'else if(message.action==="orderStatus")runner.getOrderStatus(payload.orderId);',
    'else if(message.action==="staffOrders")runner.getStaffOrders(payload.pin);',
    'else if(message.action==="updateOrderStatus")runner.updateOrderStatus(payload.orderId,payload.status,payload.pin);',
    'else reply(false,"ไม่พบ bridge action ที่ร้องขอ");',
    '});',
    'window.top.postMessage({namespace:"cafe-order-bridge",type:"ready",token:TOKEN},"*");',
    '})();',
    '</script></body></html>',
  ].join('');

  return HtmlService
    .createHtmlOutput(html)
    .setTitle('Cafe API Bridge')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function sanitizeCustomerOrder_(order) {
  return {
    orderId: order.orderId,
    status: order.status,
    pickupTime: order.pickupTime,
    total: order.total,
    items: order.items.map(function(item) { return { name: item.name, qty: item.qty }; }),
    createdAt: order.createdAt,
  };
}
