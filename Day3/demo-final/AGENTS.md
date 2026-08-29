# Wanderbricks Data App

## Stack
- Streamlit + databricks-sdk + plotly
- รันเป็น Databricks App (Free Edition)

## ไฟล์ที่ต้องมี
- app.yaml / requirements.txt / app.py / .streamlit/config.toml

## Data
- samples.wanderbricks (bookings, properties, destinations, reviews)
- รายได้นับแค่ status = 'confirmed' หรือ 'completed'
- ข้อมูลอยู่ปี 2025 ห้าม filter 2023
- Cancellation rate = cancelled / การจองทั้งหมด (ไม่ใช่หารด้วยเฉพาะที่ไม่ใช่ pending)
- 1 booking มีได้หลายรีวิว — ต้องย่อ reviews ให้เหลือ 1 แถวต่อ booking ก่อน join

## ห้ามทำ
- ห้าม hardcode warehouse id หรือ genie space id
- ต้องอ่านจาก env ที่มาจาก resource: DATABRICKS_WAREHOUSE_ID, GENIE_SPACE_ID

## UI
- 2 หน้า: landing.py (หน้าร้าน) · app.py (แดชบอร์ด · ?view=analytics)
- แดชบอร์ด 3 แท็บ: Charts / Chat / AI Insights
- CSS กลางอยู่ theme.py ที่เดียว ทั้งสองหน้าเรียกใช้
- รูปเมืองกับคำโปรยไทยอยู่ assets.py ที่แจกให้ ห้ามสร้างเอง
- แมวในการ์ด Travel Pulse ใช้ catto.png ฝังเป็น base64
- ภาษาไทยทั้งหมด

## ห้ามทำ · หน้าตา
- ห้ามใช้ `st.selectbox` ใน sidebar พื้นเข้ม — เรนเดอร์เป็นกล่องเปล่า
- ห้ามใส่เมนู/ปุ่ม/ลูกศรที่กดแล้วไม่มีผล ต้องเป็น `<a href>` จริง
- ห้ามใส่ตัวเลขเทียบปีก่อนถ้าชุดข้อมูลไม่มีปีก่อน
- ห้ามเขียนโน้ตสอนลงบนหน้าเว็บ ให้อยู่ในคอมเมนต์โค้ด
