# ข้อมูลสำรอง — ใช้เมื่อเปิด `samples.wanderbricks` ไม่ได้

ถ้าเปิด `samples.wanderbricks` ไม่เจอ ใช้ CSV ชุดนี้อัปเข้า Catalog ของตัวเองแทนได้

## ในโฟลเดอร์มีอะไร

| ไฟล์ | แถว | ขนาด |
|---|---|---|
| `bookings.csv` | 57,816 | 6.0 MB |
| `reviews.csv` | 79,849 | 11 MB |
| `properties.csv` | 16,707 | 3.7 MB |
| `destinations.csv` | 42 | 1.0 MB |

**เป็นข้อมูลปี 2025 เท่านั้น** — ตรงกับที่ Workshop ใช้ ตัวเลขจึงออกมาเท่ากับบนสไลด์

```
รายได้รวม        11,140,266
จำนวนการจอง      57,816
อัตราการยกเลิก   21.5%
คะแนนรีวิวเฉลี่ย  3.01
```

(ตรวจแล้วด้วยการคำนวณจาก CSV ตรง ๆ ไม่ได้ลอกจากสไลด์)

## วิธีอัปเข้า Databricks

1. เมนูซ้าย **Catalog** → เลือก catalog `workspace` → schema `default`
2. กด **Create** → **Create table**
3. ลากไฟล์ CSV เข้าไปทีละไฟล์
4. ตั้งชื่อตารางให้ตรงกับไฟล์ — `bookings` `reviews` `properties` `destinations`
5. เปิด **Advanced attributes** → ติ๊ก **First row contains header**
6. กด **Create table**

ทำครบ 4 ไฟล์แล้วจะได้ `workspace.default.bookings` และอีก 3 ตาราง

## แก้ SQL ให้ชี้ที่ใหม่

SQL ทุกอันในแลปเขียนว่า `samples.wanderbricks.xxx`
ให้แทนที่ด้วย `workspace.default.xxx` — เปลี่ยนแค่ชื่อข้างหน้า ที่เหลือเหมือนเดิม

```sql
-- เดิม
FROM samples.wanderbricks.bookings b

-- เปลี่ยนเป็น
FROM workspace.default.bookings b
```

ในโค้ดแอปแก้ที่บรรทัดเดียว

```python
T = "samples.wanderbricks"   # เดิม
T = "workspace.default"      # เปลี่ยนเป็นอันนี้
```

## ข้อควรรู้

- ข้อมูลชุดนี้เป็นข้อมูลจำลองที่ Databricks เตรียมไว้ให้เรียน ไม่ใช่ข้อมูลจริงของใคร
- ถ้า `samples.wanderbricks` เปิดได้ปกติ **ไม่ต้องใช้โฟลเดอร์นี้** อัปโหลดกินโควตาโดยไม่จำเป็น
