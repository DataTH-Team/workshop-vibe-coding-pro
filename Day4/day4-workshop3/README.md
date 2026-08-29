# Workshop 6 — Cafe Chatbot + Gemini + Snowflake

ต่อจาก Workshop 5: UI เดิม แต่คำตอบยอดขายดึง**ตัวเลขจริง**จาก Snowflake

Flow: คำถามภาษาไทย → Gemini เขียน SQL → backend ยิง Snowflake SQL API → ส่งผลลัพธ์กลับ Gemini → ตอบเจ้าของร้าน

API Key และ PAT อยู่ในไฟล์ `.env` ฝั่งเซิร์ฟเวอร์เท่านั้น **ไม่มีในหน้าเว็บ**

## เปิดใช้งาน

1. คัดลอกไฟล์ env แล้วใส่คีย์

```bash
cd day4-workshop3
cp .env.example .env
```

ใส่ค่าใน `.env`:

```
GEMINI_API_KEY=คีย์จาก Google AI Studio
SNOWFLAKE_PAT=Personal Access Token ของ Snowflake
SNOWFLAKE_ACCOUNT=account identifier เช่น xy12345 หรือ org-account
```

`SNOWFLAKE_ACCOUNT` ดูจาก URL ของ Snowflake: `https://<account>.snowflakecomputing.com`

ถ้า user ไม่มี default warehouse ให้ใส่ `SNOWFLAKE_WAREHOUSE` ด้วย

2. ติดตั้งไลบรารีแล้วเปิดเซิร์ฟเวอร์

```bash
cd day4-workshop3
python3 -m pip install -r requirements.txt
```

ดับเบิลคลิก `serve.command` หรือรัน:

```bash
python3 server.py
```

เปิด `http://localhost:8080` (อย่าเปิด `index.html` ตรง ๆ — ต้องผ่าน backend)

## โครงไฟล์

| ไฟล์ | ใช้ทำอะไร |
| --- | --- |
| `index.html` | หน้าแชท (ไม่มี API Key / PAT) |
| `server.py` | backend: Gemini เขียน SQL แล้ว query Snowflake |
| `.env` | เก็บ `GEMINI_API_KEY` และ `SNOWFLAKE_PAT` (อย่า commit) |
| `.env.example` | ตัวอย่างไฟล์ env ไม่มีคีย์จริง |

## คำถามตัวอย่าง

- ยอดขายสัปดาห์ที่แล้วเท่าไหร่?
- เมนูไหนขายดีที่สุด?
- แยกตามหมวดหมู่
- ช่องทางไหนขายดี?
- วันไหนยอดสูงสุด?
- เมื่อวานขายได้เท่าไหร่?

ข้อมูลอ่านอย่างเดียวจาก `cafe_db.sales.ORDERS`

## หมายเหตุ

- โมเดลเริ่มต้น `gemini-2.5-flash` เปลี่ยนได้ที่ `GEMINI_MODEL` ใน `.env`
- `server.py` จะไม่เสิร์ฟไฟล์ `.env` ออกไปทางเว็บ
- อนุญาตเฉพาะ SQL แบบ SELECT จากตาราง ORDERS
