# ไฟล์ prompt ทั้งหมด · อันไหนใช้ตอนไหน

เลขไฟล์ **ไม่ได้เรียงตามลำดับที่ใช้จริง** — ดูตารางนี้ก่อน

| ลำดับที่ใช้จริง | ไฟล์ | ใช้ตอนไหน | ทำที่ไหน |
|---|---|---|---|
| 1 | `00_warmup_genie.txt` | ก่อนเริ่ม ลองถาม 4 ข้อ ยังไม่สร้างอะไร | Genie Code |
| 2 | `03_dashboard_build.txt` | **Workshop 1 ทั้งหมด** ก้อน B แล้วก้อน C | Dashboards |
| 3 | `04_genie_agent.txt` | ช่วง Genie Agent วางใน Instructions | Genie |
| 4 | `05_genie_examplesql.txt` | ช่วง Genie Agent เติม Example SQL **+ โจทย์ Agent mode ท้ายไฟล์** | Genie |
| 5 | `08_app_resources.txt` | **Workshop 2 ต้องทำอันนี้ก่อน** ผูก resource | Apps |
| 6 | `07_app_build.txt` | Workshop 2 ให้ AI เขียนโค้ด ก้อน A B C | Genie Code |
| 7 | `09_verify.txt` | ท้ายคาบ ให้ AI ตรวจงานตัวเองเทียบ SPEC | Genie Code |

จำสั้น ๆ **00 → 03 → 04 → 05 → 08 → 07 → 09**

## ไฟล์ที่เหลือคือทางถอย ไม่ใช่ขั้นตอน

| ไฟล์ | ใช้เมื่อ |
|---|---|
| `02_dashboard_sql.txt` | AI เขียน SQL ไม่ได้จริง ๆ ก็อป SQL ไปวางเอง |
| `01_read_spec.txt` | อยากให้ AI อ่าน SPEC สรุปให้ฟังก่อน |
| `06_app_plan.txt` | อยากให้ AI วางแผนก่อนลงมือ (Plan mode) |

## กับดักที่เจอบ่อยที่สุด

**08 ต้องมาก่อน 07** — ถ้าให้ AI เขียนโค้ดแอปก่อนผูก resource
แอปจะต่อ SQL warehouse กับ Genie Agent ไม่ได้ แล้วต้องรื้อทำใหม่

## กติกาข้อเดียวของ Workshop 1

งานคำนวณ เรียง ตัดแถว ปัดทศนิยม → อยู่ใน **SQL ของ dataset**
widget มีหน้าที่แค่ชี้ว่าจะเอาคอลัมน์ไหนมาวาด

เจอ error พวกนี้เมื่อไหร่

```
must be object
must have required property
must be equal to one of the allowed values
```

แปลว่า AI ไปทำงานในตัว widget พิมพ์กลับไปว่า

```
ลบ widget นั้นทิ้ง แล้วสร้าง dataset ใหม่ที่สรุปมาแล้ว
```

## เลขที่ต้องได้ (รันจริงแล้ว 29 ส.ค.)

| | |
|---|---|
| รายได้ 2025 (confirmed + completed) | 11,140,266 |
| จำนวนการจอง 2025 | 57,816 |
| อัตราการยกเลิก | 21.5% |
| 10 เมือง | Phuket 1,156,263 · Gold Coast 1,039,577 · Mallorca 1,014,619 · Paris 869,544 |
| สัดส่วนสถานะ | pending 43.6% · confirmed 24.6% · cancelled 21.5% · completed 10.2% |

กราฟเส้นจะมี **7 จุด** (ม.ค.–ก.ค.) ไม่ใช่ 12 — ข้อมูลปี 2025 มีถึงแค่ ก.ค. ถูกแล้ว
