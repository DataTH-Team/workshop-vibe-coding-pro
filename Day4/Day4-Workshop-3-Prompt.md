# Day 4 Workshop 3: Friendly Prompt

ไม่ต้องมี `SPEC.md` วางหลัง smoke test Snowflake ผ่าน

```text
ใช้ UI และ Backend จาก Workshop 2 มาต่อยอด ปรับเฉพาะส่วนที่จำเป็น

Flow ดังนี้:
ให้ผู้ใช้ถามคำถาม -> Gemini เขียน SQL เพื่อหาคำตอบจาก Snowflake -> Backend query Snowflake ผ่าน Snowflake SQL API > คำตอบจาก Snowflake ส่งมาที่ Gemini > Gemini เขียนคำตอบ ส่งกลับให้ Frontend

Personal Access Token ของ Snowflake: ตัวแปร SNOWFLAKE_PAT อยู่ในไฟล์ .env  
ข้อมูลใน Snowflake อยู่ที่ cafe_db.sales.ORDERS อ่านอย่างเดียว

เป้าหมายการทำงาน: ผู้ใช้ถามภาษาไทย 1 ข้อ แล้วได้ตัวเลขจริงจาก Snowflake
```
