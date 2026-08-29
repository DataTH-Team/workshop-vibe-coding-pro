# Day 4 - Vibe Coding Pro by DataTH

## Prompts

### Workshop 1

```
สร้างหน้าเว็บเพื่อคุยกับ Chatbot สำหรับเจ้าของร้าน Cafe ใช้ถามข้อมูลยอดขาย  
  
รองรับคอม+มือถือ

ใช้ข้อมูลตัวอย่างและคำตอบตัวอย่างไปก่อน ยังไม่ต้องมี Backend หรือเชื่อมต่อ API จริง
```

### Workshop 2

```
ใช้ UI จาก Workshop 1 มาต่อยอด ปรับเฉพาะส่วนที่จำเป็น ให้ผู้ใช้คุยกับ Gemini ได้จริงแทนคำตอบตัวอย่าง

เพิ่มส่วน Backend ด้วย NodeJS/Express ส่งคำถามไป Gemini และนำคำตอบกลับมาแสดงในหน้า Chat โดยเก็บ Gemini API Key ไว้ในไฟล์ .env ห้ามแสดงคีย์ใน frontend

เชื่อมต่อ Backend <-> Gemini ด้วย google-genai SDK
```

### Workshop 3

```
ใช้ UI และ Backend จาก Workshop 2 มาต่อยอด ปรับเฉพาะส่วนที่จำเป็น

Flow ดังนี้:
ให้ผู้ใช้ถามคำถาม -> Gemini เขียน SQL เพื่อหาคำตอบจาก Snowflake -> Backend query Snowflake ผ่าน Snowflake SQL API > คำตอบจาก Snowflake ส่งมาที่ Gemini > Gemini เขียนคำตอบ ส่งกลับให้ Frontend

Personal Access Token ของ Snowflake: ตัวแปร SNOWFLAKE_PAT อยู่ในไฟล์ .env  
ข้อมูลใน Snowflake อยู่ที่ cafe_db.sales.ORDERS อ่านอย่างเดียว

เป้าหมายการทำงาน: ผู้ใช้ถามภาษาไทย 1 ข้อ แล้วได้ตัวเลขจริงจาก Snowflake
```

---

## ของแถม: Snowflake Managed MCP (ไม่ทำในคลาสนี้)

[`optional-Day4-mcp-claude-chatgpt.sql`](optional-Day4-mcp-claude-chatgpt.sql) — วิธีเปิดชุดข้อมูลเดียวกันให้ Claude Desktop / ChatGPT ผ่าน Snowflake-managed MCP + OAuth
