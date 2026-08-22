# ระบบสั่งกาแฟล่วงหน้าแบบ Static HTML

ระบบนี้ไม่ใช้ Node.js หน้าเว็บเป็น HTML/CSS/JavaScript ปกติทั้งหมด และนำไปวางบน Apache, Nginx, GitHub Pages, Netlify, shared hosting หรือ VS Code Live Server ได้

Google Apps Script ทำหน้าที่อ่านเขียน Google Sheets และสร้าง iframe bridge ขนาดเล็กสำหรับรับคำสั่งจากหน้าเว็บ จึงไม่ต้องนำไฟล์หน้าเว็บเข้า Apps Script และไม่ติดปัญหา CORS

## ไฟล์หน้าเว็บ

- `Index.html` หน้าสั่งกาแฟของลูกค้า
- `Staff.html` หน้าจัดการคิวของพนักงาน
- `styles.css` สไตล์ของทั้งสองหน้า
- `config.js` ชื่อร้านและ URL ของ Apps Script
- `gas-bridge.js` ตัวเชื่อมหน้าเว็บกับ Apps Script
- `customer.js` การทำงานของหน้าลูกค้า
- `staff.js` การทำงานของหน้าพนักงาน

## ติดตั้ง Apps Script

1. เปิด Google Sheet แล้วเลือก **Extensions > Apps Script**
2. นำเฉพาะ `Code.gs` ไปแทนโค้ดใน Apps Script
3. เปิดการแสดง manifest ใน **Project Settings** แล้วนำค่าใน `appsscript.json` ไปใช้
4. เพิ่ม Script Property ชื่อ `STAFF_PIN` และตั้ง PIN สำหรับพนักงาน ถ้าไม่ตั้งจะใช้ `2468`
5. เลือกฟังก์ชัน `setupCafeApp` แล้วกด Run หนึ่งครั้งเพื่ออนุญาตสิทธิ์
6. เลือก **Deploy > New deployment > Web app**
7. ตั้ง **Execute as: Me** และ **Who has access: Anyone**
8. คัดลอก URL ที่ลงท้ายด้วย `/exec`

ไม่ต้องสร้างไฟล์ HTML ใน Apps Script

## ตั้งค่าหน้าเว็บ

เปิด `config.js` แล้วนำ URL `/exec` ที่ได้มาใส่ใน `APPS_SCRIPT_URL`

```js
window.CAFE_CONFIG = Object.freeze({
  CAFE_NAME: 'บ้านกาแฟ',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec',
});
```

## เปิดใช้งาน

สามารถเปิด `Index.html` โดยตรง หรือใช้ VS Code Live Server ก็ได้

- ลูกค้าเปิด `Index.html`
- พนักงานเปิด `Staff.html`

เมื่อนำขึ้น hosting ให้อัปโหลดไฟล์เหล่านี้ไปไว้ในโฟลเดอร์เดียวกัน:

```text
Index.html
Staff.html
styles.css
config.js
gas-bridge.js
customer.js
staff.js
```

## การทำงานกับ Google Sheets

- ออเดอร์ใหม่ใช้ `channel` เป็น `Pre-order`
- หลายเมนูในออเดอร์เดียวกันใช้ `order_id` เดียวกัน
- สถานะเปลี่ยนตามลำดับ `Pending` > `Preparing` > `Ready` > `Completed`
- ระบบรักษาข้อมูลเดิม และเพิ่มเฉพาะ `pickup_time`, `phone`, `note`, `updated_at` หากยังไม่มี

## ค่าที่ปรับได้

- ชื่อร้านบนหน้าเว็บ: `CAFE_NAME` ใน `config.js`
- ชื่อร้าน เมนู และราคา: `CONFIG.CAFE_NAME` และ `MENU` ใน `Code.gs`
- PIN พนักงาน: Script Property ชื่อ `STAFF_PIN`
- Time zone: `appsscript.json` และ Time zone ของ Google Sheet

เมื่อแก้ `Code.gs` ให้เลือก **Deploy > Manage deployments > Edit > New version > Deploy** เพื่อให้โค้ดใหม่มีผล
