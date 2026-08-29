# Workshop 5 — Cafe Chatbot + Gemini

ต่อจาก Workshop 4: UI เดิม คุยกับ **Gemini จริง** ผ่าน backend  
API Key อยู่ในไฟล์ `.env` ฝั่งเซิร์ฟเวอร์เท่านั้น **ไม่มีในหน้าเว็บ**

## เปิดใช้งาน

1. คัดลอกไฟล์ env แล้วใส่คีย์

```bash
cd workshop5
cp .env.example .env
```

สร้างคีย์ที่ [Google AI Studio](https://aistudio.google.com/apikey) แล้ววางใน `.env`:

```
GEMINI_API_KEY=คีย์ของคุณ
```

2. ติดตั้งไลบรารีแล้วเปิดเซิร์ฟเวอร์

```bash
cd workshop5
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
| `index.html` | หน้าแชท (ไม่มี API Key) |
| `server.py` | backend อ่าน `.env` แล้วส่งคำถามไป Gemini |
| `.env` | เก็บ `GEMINI_API_KEY` (อย่า commit) |
| `.env.example` | ตัวอย่างไฟล์ env ไม่มีคีย์จริง |

## คำถามตัวอย่าง

- ยอดขายสัปดาห์ที่แล้วเท่าไหร่?
- เมนูไหนขายดีที่สุด?
- แยกตามหมวดหมู่
- ช่องทางไหนขายดี?
- วันไหนยอดสูงสุด?
- เมื่อวานขายได้เท่าไหร่?

นอกจากคำถามยอดขาย ถามอย่างอื่นได้ Gemini จะตอบจากบริบทร้านกาแฟ

## หมายเหตุ

- ใช้ข้อมูลยอดขาย**ตัวอย่าง**ชุดเดียวกับ Workshop 4 เป็นบริบทให้โมเดล
- โมเดลเริ่มต้น `gemini-2.5-flash` เปลี่ยนได้ที่ `GEMINI_MODEL` ใน `.env`
- `server.py` จะไม่เสิร์ฟไฟล์ `.env` ออกไปทางเว็บ
