const CAFE_CONFIG = Object.freeze({
  SPREADSHEET_ID: '16gynwrx72_54DoUcaiXupolniToVE0kIKYjvhd6sBp4',
  SHEET_NAME: 'CafeOrders',
  CAFE_NAME: 'มะลิ คาเฟ่',
  DEFAULT_STAFF_PIN: '2468',
  MAX_ITEMS_PER_ORDER: 20,
  ACTIVE_STATUSES: ['Pending', 'Preparing', 'Ready'],
  ALL_STATUSES: ['Pending', 'Preparing', 'Ready', 'Completed'],
});

const ORDER_HEADERS = Object.freeze([
  'order_id',
  'created_at',
  'customer_name',
  'phone',
  'pickup_time',
  'items_json',
  'item_summary',
  'total',
  'status',
  'note',
  'updated_at',
]);

const CAFE_MENU = Object.freeze([
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
]);

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || 'health');
    let data;

    if (action === 'health') data = getHealth_();
    else if (action === 'menu') data = getMenu();
    else if (action === 'orderStatus') data = getOrderStatus(params.orderId);
    else throw new Error('ไม่พบ API action ที่ร้องขอ');

    return jsonResponse_({ ok: true, data: data });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error && error.message ? error.message : 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
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
    else if (action === 'updateOrderStatus') data = updateOrderStatus(payload.orderId, payload.status, payload.pin);
    else throw new Error('ไม่พบ API action ที่ร้องขอ');

    return jsonResponse_({ ok: true, data: data });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error && error.message ? error.message : 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
}

function setupCafeSystem() {
  const context = ensureOrderSheet_();
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('STAFF_PIN')) properties.setProperty('STAFF_PIN', CAFE_CONFIG.DEFAULT_STAFF_PIN);
  return 'พร้อมใช้งาน: ' + context.sheet.getName() + ' (' + context.headers.length + ' คอลัมน์)';
}

function setStaffPin(newPin) {
  const cleanPin = String(newPin || '').trim();
  if (!/^[0-9]{4,10}$/.test(cleanPin)) throw new Error('PIN ต้องเป็นตัวเลข 4-10 หลัก');
  PropertiesService.getScriptProperties().setProperty('STAFF_PIN', cleanPin);
  return 'เปลี่ยนรหัสพนักงานเรียบร้อยแล้ว';
}

function getMenu() {
  return {
    cafeName: CAFE_CONFIG.CAFE_NAME,
    menu: CAFE_MENU.map(function (item) { return Object.assign({}, item); }),
    categories: [
      { id: 'all', label: 'ทั้งหมด' },
      { id: 'coffee', label: 'กาแฟ' },
      { id: 'tea', label: 'ชา' },
      { id: 'other', label: 'เครื่องดื่ม' },
      { id: 'bakery', label: 'เบเกอรี่' },
    ],
  };
}

function createOrder(payload) {
  const clean = validateOrder_(payload);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const context = ensureOrderSheet_();
    const now = new Date();
    const orderId = makeOrderId_(now, context.timeZone);
    const items = clean.items.map(function (item) {
      const menuItem = getMenuItem_(item.id);
      return {
        id: menuItem.id,
        name: menuItem.name,
        qty: item.qty,
        price: menuItem.price,
        total: menuItem.price * item.qty,
      };
    });
    const record = {
      order_id: orderId,
      created_at: now,
      customer_name: clean.customerName,
      phone: clean.phone,
      pickup_time: clean.pickupTime,
      items_json: JSON.stringify(items),
      item_summary: items.map(function (item) { return item.qty + 'x ' + item.name; }).join(', '),
      total: clean.total,
      status: 'Pending',
      note: clean.note,
      updated_at: now,
    };
    const row = rowFromObject_(context.headers, record);
    context.sheet.getRange(context.sheet.getLastRow() + 1, 1, 1, context.headers.length).setValues([row]);

    return {
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
  const context = ensureOrderSheet_();
  const order = readOrders_(context).filter(function (item) { return item.orderId === cleanId; })[0];
  if (!order) throw new Error('ไม่พบหมายเลขออเดอร์นี้');
  return {
    orderId: order.orderId,
    status: order.status,
    pickupTime: order.pickupTime,
    total: order.total,
    items: order.items.map(function (item) { return { name: item.name, qty: item.qty }; }),
    createdAt: order.createdAt,
  };
}

function getStaffOrders(pin) {
  assertStaffPin_(pin);
  const context = ensureOrderSheet_();
  const today = Utilities.formatDate(new Date(), context.timeZone, 'yyyy-MM-dd');
  const orders = readOrders_(context).filter(function (order) {
    return CAFE_CONFIG.ACTIVE_STATUSES.indexOf(order.status) !== -1 || order.dateKey === today;
  });
  orders.sort(function (a, b) { return new Date(a.createdIso) - new Date(b.createdIso); });
  return {
    cafeName: CAFE_CONFIG.CAFE_NAME,
    generatedAt: formatDateTime_(new Date(), context.timeZone),
    orders: orders,
  };
}

function updateOrderStatus(orderId, newStatus, pin) {
  assertStaffPin_(pin);
  const cleanId = normalizeOrderId_(orderId);
  const cleanStatus = String(newStatus || '');
  if (CAFE_CONFIG.ALL_STATUSES.indexOf(cleanStatus) === -1) throw new Error('สถานะไม่ถูกต้อง');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const context = ensureOrderSheet_();
    if (context.sheet.getLastRow() < 2) throw new Error('ไม่พบออเดอร์ที่ต้องการอัปเดต');
    const values = context.sheet.getRange(2, 1, context.sheet.getLastRow() - 1, context.headers.length).getValues();
    const orderIndex = context.headers.indexOf('order_id');
    const statusIndex = context.headers.indexOf('status');
    let match = null;

    for (let index = 0; index < values.length; index += 1) {
      if (String(values[index][orderIndex]).trim() === cleanId) {
        match = { rowNumber: index + 2, currentStatus: String(values[index][statusIndex] || 'Pending') };
        break;
      }
    }
    if (!match) throw new Error('ไม่พบออเดอร์ที่ต้องการอัปเดต');

    const allowedNext = { Pending: 'Preparing', Preparing: 'Ready', Ready: 'Completed' }[match.currentStatus];
    if (cleanStatus !== match.currentStatus && cleanStatus !== allowedNext) {
      throw new Error('ไม่สามารถเปลี่ยนจาก ' + match.currentStatus + ' เป็น ' + cleanStatus);
    }

    context.sheet.getRange(match.rowNumber, statusIndex + 1).setValue(cleanStatus);
    context.sheet.getRange(match.rowNumber, context.headers.indexOf('updated_at') + 1).setValue(new Date());
    return { orderId: cleanId, status: cleanStatus };
  } finally {
    lock.releaseLock();
  }
}

function getHealth_() {
  const context = ensureOrderSheet_();
  return {
    service: 'cafe-preorder-api',
    cafeName: CAFE_CONFIG.CAFE_NAME,
    spreadsheetId: CAFE_CONFIG.SPREADSHEET_ID,
    sheet: context.sheet.getName(),
  };
}

function ensureOrderSheet_() {
  const spreadsheet = SpreadsheetApp.openById(CAFE_CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CAFE_CONFIG.SHEET_NAME);
  let needsFormatting = false;
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CAFE_CONFIG.SHEET_NAME);
    needsFormatting = true;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function (header) {
    return String(header).trim();
  });
  if (headers.every(function (header) { return !header; })) headers = [];

  const missing = ORDER_HEADERS.filter(function (header) { return headers.indexOf(header) === -1; });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    needsFormatting = true;
  }

  if (needsFormatting) {
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#123b31')
      .setFontColor('#f8fbf8');
    ['order_id', 'customer_name', 'phone', 'pickup_time', 'items_json', 'item_summary', 'status', 'note'].forEach(function (header) {
      const index = headers.indexOf(header);
      if (index !== -1) sheet.getRange(1, index + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
    });
    const totalColumn = headers.indexOf('total');
    if (totalColumn !== -1) sheet.getRange(2, totalColumn + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('#,##0.00');
    sheet.autoResizeColumns(1, headers.length);
  }

  return {
    spreadsheet: spreadsheet,
    sheet: sheet,
    headers: headers,
    timeZone: spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone(),
  };
}

function readOrders_(context) {
  if (context.sheet.getLastRow() < 2) return [];
  const values = context.sheet.getRange(2, 1, context.sheet.getLastRow() - 1, context.headers.length).getValues();
  return values.map(function (row) {
    const record = objectFromRow_(context.headers, row);
    if (!record.order_id) return null;
    const created = parseSheetDate_(record.created_at);
    return {
      orderId: String(record.order_id),
      createdIso: created.toISOString(),
      createdAt: formatDateTime_(created, context.timeZone),
      dateKey: Utilities.formatDate(created, context.timeZone, 'yyyy-MM-dd'),
      customerName: String(record.customer_name || ''),
      phone: String(record.phone || ''),
      pickupTime: String(record.pickup_time || ''),
      items: parseItems_(record.items_json),
      total: Number(record.total) || 0,
      status: String(record.status || 'Pending'),
      note: String(record.note || ''),
    };
  }).filter(function (order) { return Boolean(order); });
}

function validateOrder_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('ข้อมูลออเดอร์ไม่ครบ');
  const customerName = String(payload.customerName || '').trim();
  const phone = String(payload.phone || '').replace(/[^0-9+]/g, '');
  const pickupTime = String(payload.pickupTime || '').trim();
  const note = String(payload.note || '').trim().slice(0, 200);
  const submittedItems = Array.isArray(payload.items) ? payload.items : [];

  if (customerName.length < 2 || customerName.length > 60) throw new Error('กรุณากรอกชื่อสำหรับรับออเดอร์');
  if (!/^\+?[0-9]{8,15}$/.test(phone)) throw new Error('กรุณากรอกเบอร์โทรให้ถูกต้อง');
  if (!/^(ASAP|(?:[01][0-9]|2[0-3]):[0-5][0-9])$/.test(pickupTime)) throw new Error('กรุณาเลือกเวลารับให้ถูกต้อง');
  if (!submittedItems.length) throw new Error('กรุณาเลือกอย่างน้อย 1 เมนู');

  const quantities = {};
  submittedItems.forEach(function (item) {
    const menuItem = getMenuItem_(String(item.id || ''));
    const qty = Math.floor(Number(item.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 10) throw new Error('จำนวนสินค้าไม่ถูกต้อง');
    quantities[menuItem.id] = (quantities[menuItem.id] || 0) + qty;
  });

  let itemCount = 0;
  let total = 0;
  const items = Object.keys(quantities).map(function (id) {
    const menuItem = getMenuItem_(id);
    const qty = quantities[id];
    if (qty > 10) throw new Error('เมนูหนึ่งรายการสั่งได้ไม่เกิน 10 ชิ้น');
    itemCount += qty;
    total += menuItem.price * qty;
    return { id: id, qty: qty };
  });

  if (itemCount > CAFE_CONFIG.MAX_ITEMS_PER_ORDER) {
    throw new Error('สั่งได้ไม่เกิน ' + CAFE_CONFIG.MAX_ITEMS_PER_ORDER + ' ชิ้นต่อออเดอร์');
  }
  return { customerName: customerName, phone: phone, pickupTime: pickupTime, note: note, items: items, total: total };
}

function getMenuItem_(id) {
  const item = CAFE_MENU.filter(function (menuItem) { return menuItem.id === id; })[0];
  if (!item) throw new Error('พบเมนูที่ไม่ถูกต้อง');
  return item;
}

function assertStaffPin_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty('STAFF_PIN') || CAFE_CONFIG.DEFAULT_STAFF_PIN;
  if (String(pin || '') !== String(expected)) throw new Error('รหัสพนักงานไม่ถูกต้อง');
}

function normalizeOrderId_(orderId) {
  const clean = String(orderId || '').trim().toUpperCase();
  if (!/^MC-[0-9]{6}-[A-Z0-9]{6}$/.test(clean)) throw new Error('หมายเลขออเดอร์ไม่ถูกต้อง');
  return clean;
}

function makeOrderId_(date, timeZone) {
  const stamp = Utilities.formatDate(date, timeZone, 'yyMMdd');
  const suffix = Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  return 'MC-' + stamp + '-' + suffix;
}

function parseItems_(value) {
  try {
    const items = JSON.parse(String(value || '[]'));
    return Array.isArray(items) ? items.map(function (item) {
      return {
        id: String(item.id || ''),
        name: String(item.name || ''),
        qty: Number(item.qty) || 0,
        price: Number(item.price) || 0,
        total: Number(item.total) || 0,
      };
    }) : [];
  } catch (error) {
    return [];
  }
}

function parseSheetDate_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value || '').trim());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function objectFromRow_(headers, row) {
  const output = {};
  headers.forEach(function (header, index) { output[header] = row[index]; });
  return output;
}

function rowFromObject_(headers, object) {
  return headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '';
  });
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
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
