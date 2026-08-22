# VibeCode Travel — V1

## Goal
สร้าง Travel Guide แบบ interactive ที่ช่วยให้คนดู 6 เมืองแบบสนุก ๆ และแยก “ข้อมูลจริง” ออกจาก “รีวิวส่วนตัว” ให้ชัดเจน

## Destinations
- Bangkok, Thailand
- Tokyo, Japan
- Sydney, Australia
- Singapore
- Paris, France
- New York, USA


## Core Features — V1
ผู้ใช้ต้องสามารถ:
- เห็น Destination ครบ 6 เมือง
- กดการ์ดเมือง แล้วรายละเอียด **เด้งขึ้นมากลางจอ**
- Save เมืองที่สนใจไว้ใน My Trip ได้
- Remove ออกจาก My Trip ได้
- เห็นสรุปว่า Save ไว้กี่เมือง

## Destination Detail
แต่ละเมืองมี:
- Name / Country / Region / Image / Tagline
- FACT: Country, Region, Language, Currency
- HIGHLIGHTS 3 รายการ
- TRAVEL TIPS 2 รายการ
- REVIEW: Best For, My Take, Numeric Rating / 5

### Image — ใช้ไฟล์ที่มีอยู่แล้วเท่านั้น
รูป 6 เมืองอยู่ในโฟลเดอร์ `assets/` แล้ว ใช้ path ตามนี้ตรง ๆ:

```
assets/bangkok.svg    assets/tokyo.svg      assets/sydney.svg
assets/singapore.svg  assets/paris.svg      assets/new-york.svg
```

- ใส่ผ่าน `<img src="assets/bangkok.svg">`
- **ห้ามใช้ URL รูปจากอินเทอร์เน็ต** เพราะต้องเปิดได้ตอนไม่มีเน็ต
- ห้ามใช้ emoji หรือกล่องไล่สีแทนรูป

### Best For — list สั้น 2–3 คำ
เลือกจากชุดนี้เท่านั้น: `Food` · `Culture` · `Shopping` · `Nature`
เก็บเป็น array เช่น `["Food", "Culture", "Shopping"]`
แสดงบนหน้าเว็บคั่นด้วย ` · `

### Numeric Rating — ทศนิยม 1 ตำแหน่ง
- ช่วง `1.0` – `5.0` เช่น `4.5`
- แสดงเป็น **ตัวเลข** เท่านั้น **ห้ามแปลงเป็นดาว**
  (ปัดเป็นดาวแล้วทุกเมืองจะกลายเป็น 5 ดาวเหมือนกันหมด มองไม่ออกว่าต่างกัน)

### สำคัญ
FACT กับ REVIEW ต้องแยกเป็นคนละกล่องและมองออกทันที
- FACT = ข้อมูลเชิงข้อเท็จจริง
- REVIEW = ความเห็นของคนทำเว็บ

### ★ กฎเรื่องความจริงของกล่อง FACT
กล่อง FACT คือข้อมูลที่ต้องถูก ไม่ใช่ข้อมูลที่ฟังดูน่าเชื่อ

- **ห้ามแต่งขึ้นเอง** ถ้าไม่แน่ใจให้ใส่ `<ตรวจเอง>` ไว้แทน แล้วค่อยไปหาทีหลัง
- ห้ามใส่ราคา ค่าวีซ่า อุณหภูมิ หรืออะไรที่เปลี่ยนบ่อย เพราะตรวจไม่ทัน
- ถ้าอยากพูดถึงเรื่องพวกนี้ ให้ย้ายไปเขียนในกล่อง REVIEW แทน
  เพราะกล่อง REVIEW บอกอยู่แล้วว่าเป็นความเห็น ไม่ใช่ข้อเท็จจริง

กล่อง REVIEW เป็นความเห็นของคนทำเว็บ ไม่ต้องอ้างอิงที่มา
แต่ต้องมีป้ายกำกับให้คนอ่านรู้ว่าเป็นความเห็น

### ★ ข้อมูล FACT ของ 6 เมือง — ตรวจมาแล้ว ใช้ชุดนี้
ใช้ตามตารางนี้ตรง ๆ **ห้ามเปลี่ยน ห้ามเพิ่มฟิลด์เอง**

| เมือง | Country | Region | Language | Currency |
|---|---|---|---|---|
| Bangkok | Thailand | Asia | Thai | Thai Baht (THB) |
| Tokyo | Japan | Asia | Japanese | Japanese Yen (JPY) |
| Sydney | Australia | Oceania | English is widely used | Australian Dollar (AUD) |
| Singapore | Singapore | Asia | English · Malay · Mandarin · Tamil | Singapore Dollar (SGD) |
| Paris | France | Europe | French | Euro (EUR) |
| New York | USA | North America | English is widely used | US Dollar (USD) |

ตารางนี้ครบแล้ว → **ไม่ต้องมี `<ตรวจเอง>` เหลือในเว็บ**
กฎ `<ตรวจเอง>` ข้างบนไว้ใช้กับข้อมูลอื่นที่เราจะเพิ่มเองทีหลัง

ส่วน HIGHLIGHTS · TRAVEL TIPS · Tagline · Best For · My Take · Rating
**ให้เขียนร่างมาเลยทั้ง 6 เมือง ไม่ต้องถาม** เดี๋ยวเราค่อยแก้เป็นของตัวเองทีหลัง
- Tagline 1 ประโยคสั้น
- HIGHLIGHTS 3 รายการ = สถานที่/ย่านที่คนไปกันจริง
- TRAVEL TIPS 2 รายการ = เรื่องการเดินทางหรือการวางแผน
- My Take 1–2 ประโยค เขียนเป็นภาษาไทย
- Rating ตั้งให้ต่างกันในแต่ละเมือง อย่าให้เท่ากันหมด
- **ภาษา: Tagline · HIGHLIGHTS · TRAVEL TIPS เขียนภาษาอังกฤษ · My Take เขียนภาษาไทย**

## My Trip
- ปุ่ม “เก็บไว้ My Trip” เพิ่มเมืองลงรายการ
- ถ้า Save ซ้ำ ห้ามมีรายการซ้ำ
- กด Remove แล้วเมืองต้องหายออกจากรายการ
- มีตัวเลขสรุปว่าตอนนี้ Save ไว้กี่เมือง

### My Trip เป็นข้อมูลชั่วคราวใน V1
- เก็บไว้ในหน่วยความจำของหน้าเว็บเท่านั้น
- Refresh หน้าเว็บแล้วรายการเริ่มใหม่ = ถูกต้อง ไม่ใช่บั๊ก
- **ห้ามใช้ localStorage / sessionStorage / database** ใน V1

### การเปิดรายละเอียด
- กดการ์ดเมือง แล้วรายละเอียดต้อง **เด้งขึ้นมากลางจอ (Modal)**
  ห้ามใช้วิธีเลื่อนหน้าลงไปหาแผงข้างล่าง เพราะกดแล้วเหมือนไม่มีอะไรเกิดขึ้น
- ปิดได้ 3 ทาง: ปุ่ม ✕ · คลิกพื้นหลังนอกกล่อง · กด Esc
- ตอนเปิด Modal พื้นหลังต้องเลื่อนไม่ได้
- ปุ่ม “＋ My Trip” บนการ์ด ต้องไม่เปิด Modal

## Technical Requirements
- HTML + CSS + Vanilla JavaScript เท่านั้น
- ไม่ใช้ Framework / Package
- ไม่ใช้ Backend / Database / API
- ไม่ใช้ fetch()
- ไม่ใช้ <script type="module">
- **ไม่โหลดอะไรจากอินเทอร์เน็ตเลย** รวมถึง Google Fonts / CDN / CSS ภายนอก
  ใช้ฟอนต์ที่มีในเครื่องเท่านั้น เพราะต้องเปิดได้ตอนไม่มีเน็ต
- ต้องเปิด index.html ด้วย file:// แล้วใช้งานได้
- ข้อมูล Destination ทั้งหมดอยู่ใน destinations-data.js

## Required Application Files
- index.html
- style.css
- destinations-data.js
- script.js

## Out of Scope — V1
- Login
- Booking / Payment
- Search / Map
- Comments
- AI API
- Mark “ไปมาแล้ว” / Travel Passport  (จะเพิ่มใน Iteration ถัดไป)
- Find My Next Trip recommendation game (จะเพิ่มใน Iteration ถัดไป)
- แผนที่โลก (ของแถม ไม่ต้องทำในคาบ)

## Done When — V1
- 6 เมืองแสดงครบ
- กดการ์ดทั้ง 6 เมือง แล้ว Modal ขึ้นข้อมูลของเมืองนั้นถูกต้อง
- FACT / REVIEW แยกชัด
- กดการ์ดแล้วรายละเอียดเด้งขึ้นเป็น Modal
- ปิด Modal ได้ทั้งปุ่ม ✕ · คลิกพื้นหลัง · กด Esc
- ไม่มี `<ตรวจเอง>` ค้างอยู่ในหน้าเว็บตอนเอาขึ้นออนไลน์
- ไม่มีข้อมูลในกล่อง FACT ที่เราไม่ได้ตรวจเอง
- Save / Remove My Trip ได้
- ตัวเลขสรุป My Trip เปลี่ยนตาม state
- Desktop ใช้ได้
- Mobile 375px ไม่มี horizontal overflow
- เปิด index.html ตรง ๆ ได้
