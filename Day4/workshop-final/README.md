# Day 4 Workshop Solution — Cafe Sales Intelligence

โค้ดเฉลยสำหรับ Workshop 3: หน้าแชต → Node backend → Gemini function calling → Snowflake SQL API ผ่าน HTTPS + PAT → Snowflake.

โฟลเดอร์นี้เป็น **เฉลยของผู้สอน** และไม่ต้องแจกตั้งแต่ต้นคาบ. ถ้านาทีที่ 12 ของ Workshop 3 ยังไม่ได้คำตอบแรก ให้ผู้เรียนแปะ `lib/query-tool.mjs`, `lib/snowflake-sql-api.mjs`, `lib/tool-loop.mjs` และส่วน `/api/chat` จาก `server.mjs` แล้วไปโฟกัสการทดสอบคำถามจริง.

Spec และ prompt ที่แจกผู้เรียนอยู่ที่ `../Day4-Workshop-3-SPEC.md` และ `../Day4-Workshop-3-Prompt.md`.

## เปิด prototype โดยไม่ใช้ credentials

```bash
DEMO_MODE=true npm start
```

จากนั้นเปิด `http://127.0.0.1:3000`. โหมดนี้ใช้คำตอบตัวอย่างและไม่เรียก Gemini หรือ Snowflake.

## Architecture จริง

```text
Browser → Node backend → Gemini
                    ↘ query_orders → Snowflake SQL API → CAFE_DB.SALES.ORDERS
```

- `SNOWFLAKE_PAT` ถูกส่งเป็น Bearer token จาก backend เท่านั้น
- Backend ประกาศ Gemini function ชื่อ `query_orders` แล้วส่ง SQL ที่ผ่านการตรวจไปยัง `/api/v2/statements`
- ตอนหน้าเว็บตรวจ `/api/health` backend จะโหลด schema ของ `ORDERS` ครั้งเดียวและ cache ไว้จนกว่าจะ restart
- ไม่โหลด 50,000 rows เข้า prompt; ทุกผลลัพธ์ถูกจำกัดไม่เกิน 50 แถว
- คำถามทั่วไปใช้ business query เดียว; tool loop สูงสุด 10 รอบมีไว้แก้ error หรือวิเคราะห์หลายขั้น
- Node ตรวจซ้ำว่า SQL เป็น `SELECT` / `WITH` ครั้งละหนึ่ง statement
- Snowflake บังคับอีกชั้นด้วย PAT ที่ล็อก role เป็น `CAFE_READONLY` และ query timeout
- หน้าเว็บรับ progress จริงจาก backend และ highlight `หน้าแชต → Backend → SQL API → Snowflake`

## เตรียม Snowflake trial

1. รัน `../Day4-snowflake-readonly.sql` ใน Snowsight ด้วย `ACCOUNTADMIN`
2. อัปโหลด `../Day4-orders-20-branches.csv` เป็น `CAFE_DB.SALES.ORDERS`
3. รัน PAT block ท้ายไฟล์ SQL แล้ว copy `token_secret` ทันที
4. คัดลอก `.env.example` เป็น `.env`
5. ใส่ `GEMINI_API_KEY`, `SNOWFLAKE_ACCOUNT_URL` และ `SNOWFLAKE_PAT` ใน `.env`

ห้ามส่งหรือ commit `.env`. Snowflake แสดง PAT secret ตอนสร้างครั้งเดียว.

## ติดตั้งและทดสอบ

```bash
npm install
npm run check
npm run smoke:snowflake
npm start
```

`npm run smoke:snowflake` ต้องแสดงจำนวนแถวจาก `CAFE_DB.SALES.ORDERS` และข้อความว่า smoke test ผ่าน ก่อนเปิดหน้าเว็บที่ `http://127.0.0.1:3000`.

ทดสอบคำถามตามลำดับ:

1. `สาขาไหนทำรายได้รวมสูงสุด`
2. `สาขาไหนมี AOV สูงสุด`
3. `เปรียบเทียบรายได้และ AOV ของทุกสาขา`

ค่าตรวจสอบของไฟล์ต้นฉบับ:

- Siam — รายได้ Completed `360,110 บาท` จาก `3,808` ออเดอร์
- Thonglor — AOV Completed `182.41 บาทต่อบิล`

## Secrets และ production

Browser ต้องไม่เห็น Gemini key, PAT หรือ environment variables. PAT อายุ 14 วันใช้เพื่อ Workshop เท่านั้น; ระบบ production ควรเปลี่ยนเป็น OAuth และเพิ่ม login/rate limit.
