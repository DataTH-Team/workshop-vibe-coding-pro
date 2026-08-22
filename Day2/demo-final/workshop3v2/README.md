# Cafe Pre-order Mobile Web

เว็บมือถือสำหรับร้านกาแฟ มี 2 หน้าและใช้ Google Sheets เป็นฐานข้อมูลผ่าน Google Apps Script

- `index.html` ลูกค้าเลือกเมนู สั่งล่วงหน้า และติดตามสถานะ
- `staff.html` พนักงานดูคิวและเปลี่ยนสถานะตามลำดับ
- `Code.gs` JSON API อย่างเดียว ไม่มีหน้าเว็บฝังใน Apps Script
- ไม่ใช้ Node.js หรือ build step

## 1. ติดตั้ง Google Apps Script

1. เปิด [Google Sheet ของร้าน](https://docs.google.com/spreadsheets/d/16gynwrx72_54DoUcaiXupolniToVE0kIKYjvhd6sBp4/edit?usp=sharing)
2. เลือก **Extensions > Apps Script**
3. ลบโค้ดตัวอย่างใน `Code.gs` แล้ววางเนื้อหาจากไฟล์ `workshop3v2/Code.gs`
4. กด Save แล้วเลือกฟังก์ชัน `setupCafeSystem` จากแถบด้านบน
5. กด Run และอนุญาตสิทธิ์เข้าถึง Google Sheets
6. สคริปต์จะสร้างชีตชื่อ `CafeOrders` โดยไม่ลบหรือแก้ชีตอื่น

### ตั้งรหัสพนักงาน

1. ใน Apps Script เปิด **Project Settings**
2. เลื่อนถึง **Script properties** แล้วกด **Add script property**
3. ตั้งชื่อ Property เป็น `STAFF_PIN`
4. ใส่ PIN ตัวเลข 4-10 หลัก เช่น `8642`

หากยังไม่ตั้งค่า ระบบจะใช้ PIN เริ่มต้น `2468` ซึ่งเหมาะสำหรับทดสอบเท่านั้น

## 2. Deploy เป็น Web app

1. ใน Apps Script กด **Deploy > New deployment**
2. เลือกประเภท **Web app**
3. ตั้ง **Execute as** เป็น `Me`
4. ตั้ง **Who has access** เป็น `Anyone`
5. กด Deploy แล้วคัดลอก URL ที่ลงท้ายด้วย `/exec`
6. เปิด `config.js` แล้ววาง URL ใน `GAS_WEB_APP_URL`

ตัวอย่าง:

```js
window.CAFE_CONFIG = Object.freeze({
  GAS_WEB_APP_URL: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec',
  CURRENCY: '฿',
  POLL_INTERVAL_MS: 30000,
});
```

ทดสอบ API โดยเปิด URL นี้ในเบราว์เซอร์:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=health
```

ควรเห็น JSON ที่มี `"ok":true`

หลังแก้ `Code.gs` ในอนาคต ให้ไปที่ **Deploy > Manage deployments > Edit** แล้วเลือก **New version** ทุกครั้ง

## 3. เปิดเว็บแบบไม่ใช้ Node.js

ไฟล์ทั้งหมดเป็น static web เปิดด้วย static server ใดก็ได้ เช่น Python ที่มากับ macOS:

```bash
cd workshop3v2
python3 -m http.server 8080
```

จากนั้นเปิด:

- ลูกค้า: `http://localhost:8080/`
- พนักงาน: `http://localhost:8080/staff.html`

สามารถนำโฟลเดอร์นี้ขึ้น GitHub Pages, Cloudflare Pages, Netlify, shared hosting หรือเว็บเซิร์ฟเวอร์ทั่วไปได้โดยไม่ต้อง build

## การทำงานของสถานะ

สถานะเปลี่ยนตามลำดับนี้เท่านั้น:

```text
Pending -> Preparing -> Ready -> Completed
```

- ลูกค้าเห็นสถานะจากหมายเลขออเดอร์
- พนักงานเห็นออเดอร์ที่ยังไม่เสร็จทั้งหมด และออเดอร์ที่เสร็จภายในวันปัจจุบัน
- หน้าพนักงานรีเฟรชอัตโนมัติทุก 30 วินาทีเมื่อแท็บกำลังเปิดใช้งาน
- PIN เก็บใน `sessionStorage` จึงหายเมื่อปิดแท็บ ไม่ถูกเก็บถาวร

## โครงสร้างข้อมูล

Apps Script สร้างชีต `CafeOrders` และเก็บหนึ่งแถวต่อหนึ่งออเดอร์:

| คอลัมน์ | ความหมาย |
| --- | --- |
| `order_id` | หมายเลขออเดอร์แบบสุ่ม |
| `created_at` | เวลาสร้างออเดอร์ |
| `customer_name` | ชื่อลูกค้า |
| `phone` | เบอร์โทร |
| `pickup_time` | เวลารับหรือ `ASAP` |
| `items_json` | รายการสินค้า ราคา และจำนวน |
| `item_summary` | สรุปรายการที่อ่านง่ายในชีต |
| `total` | ยอดรวมที่คำนวณจากราคาฝั่งเซิร์ฟเวอร์ |
| `status` | สถานะปัจจุบัน |
| `note` | หมายเหตุจากลูกค้า |
| `updated_at` | เวลาอัปเดตล่าสุด |

## ปรับชื่อร้านและเมนู

- แก้ `CAFE_CONFIG.CAFE_NAME` และ `CAFE_MENU` ใน `Code.gs` ซึ่งเป็นข้อมูลจริงจากเซิร์ฟเวอร์
- `FALLBACK_MENU` ใน `app.js` ใช้เฉพาะตอนยังไม่ได้ตั้ง API URL เพื่อให้เปิดดูหน้าตาเว็บได้
- ภาพหลักอยู่ที่ `assets/cafe-hero.jpg`

เมื่อเว็บเชื่อม API แล้ว เมนูและราคาที่แสดงจะมาจาก `Code.gs` เสมอ และยอดรวมถูกคำนวณซ้ำที่เซิร์ฟเวอร์เพื่อป้องกันการแก้ราคาจากเบราว์เซอร์

## เช็กลิสต์ก่อนใช้จริง

- เปลี่ยน `STAFF_PIN` จากค่าเริ่มต้น
- Deploy เวอร์ชันล่าสุดและใช้ URL `/exec`
- ทดลองสร้างออเดอร์จากหน้า `index.html`
- ตรวจว่าแถวใหม่ปรากฏในชีต `CafeOrders`
- ทดลองกดสถานะครบทั้ง 4 ขั้นใน `staff.html`
- ทดสอบทั้งมือถือ iOS และ Android บน URL แบบ HTTPS
