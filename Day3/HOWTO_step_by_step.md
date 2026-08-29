# วิธีกด — ทีละขั้น

เปิดคู่กับ `prompt/` เวลาทำแลป · ทุกขั้นทำบนเบราว์เซอร์ล้วน

---

## ขั้น 0 · เปิด Genie Code ครั้งแรก

1. เข้า Databricks → เมนูซ้าย **SQL Editor**
2. มุมขวาบนของ editor มีปุ่ม **Genie Code** (ไอคอนประกายดาว) → กดเปิด
   แผงจะเลื่อนออกมาทางขวา
3. ถ้าหาไม่เจอ ให้กดที่ editor ก่อน แล้วลอง **Cmd+I** (Mac) หรือ **Ctrl+I** (Windows)
   จะได้ช่องพิมพ์ inline กลาง editor แทน
4. วาง prompt จาก `prompt/00_warmup_genie.txt` ทีละบรรทัด
5. **อย่ากด Run ทันที** — อ่าน SQL ที่มันเสนอก่อนว่าใช้ตารางถูกไหม

> เคล็ดลับ: ถ้ารู้ว่าจะใช้ตารางไหน พิมพ์ `@` แล้วเลือกตารางนั้น
> จะได้ไม่ต้องให้มันเดา

---

## ขั้น 1 · ตั้ง Approval เป็น Ask first

1. ในแผง Genie Code มุมขวาบน มีเมนูตั้งค่า
2. เลือก **Ask first** ไม่ใช่ Auto-approve
3. เหตุผล: จะได้เห็นว่ามันกำลังจะทำอะไรก่อนลงมือ

---

## ขั้น 2 · Workshop 1 — Dashboard

### 2.1 คลิก ไม่ต้องพิมพ์

1. เมนูซ้าย **Dashboards** → **Create dashboard**
2. แท็บ **Data** → ปุ่ม **Add**
3. เลือก **samples → wanderbricks → bookings** → **Confirm**

ได้ dataset ชื่อ `bookings` มา 1 อัน — **ไม่ต้องเขียน SQL**

> **dataset คืออะไร** widget ทุกตัวบน Dashboard อ่านจากตารางใน Catalog ตรง ๆ ไม่ได้
> ต้องอ่านผ่าน dataset ของ Dashboard เอง · dataset ไม่ได้ก็อปข้อมูล มันคือ query ที่เซฟไว้

### 2.2 ก้อน B — วางใน Genie Code

เปิด **Genie Code** (ไอคอนประกายดาว มุมขวาบน) → วางก้อน B จาก
`prompt/03_dashboard_build.txt` → อ่าน Plan → **อนุมัติ**

ต้องได้ **11,140,266** · **57,816** · **21.5%** · กราฟเส้น **7 จุด** (ม.ค.–ก.ค. ถูกแล้ว)

**Publish ตรงนี้เลย — ถือว่าผ่าน Workshop 1**

### 2.3 ก้อน C — ของเพิ่ม

วางก้อน C ต่อ ได้กราฟแท่ง 10 เมือง + ตารางรายเมือง + โดนัทสถานะ
ต้องได้ Phuket **1,156,263** · Gold Coast **1,039,577** · Mallorca **1,014,619**

**Publish อีกครั้ง** ไม่งั้นคนอื่นยังเห็นของเก่า

### ถ้า AI วนแก้ไม่จบ

เห็น error พวกนี้

```
must be object
must have required property
must be equal to one of the allowed values
```

แปลว่ามันไปคำนวณ/เรียง/ตัดแถวในตัว widget พิมพ์กลับไปบรรทัดเดียว

```
ลบ widget นั้นทิ้ง แล้วสร้าง dataset ใหม่ที่สรุปมาแล้ว
```

> **กติกาข้อเดียวของ Workshop นี้** — งานคำนวณ เรียง ตัดแถว ปัดทศนิยม
> อยู่ใน **SQL ของ dataset** · widget มีหน้าที่แค่ชี้คอลัมน์

> ถ้า AI เขียน SQL ไม่ออกจริง ๆ → ทางถอยอยู่ที่ `prompt/02_dashboard_sql.txt`

---

## ขั้น 3 · Genie Agent

1. เมนูซ้าย **Genie** → **New** → ตั้งชื่อ `Wanderbricks Analytics`
2. **Add data** → วางชื่อ 4 ตารางรวดเดียว
3. **Instructions** → วาง `prompt/04_genie_agent.txt` ก้อนเดียว → **Save**
4. ถามเป็นภาษาไทยได้เลย · กดดู SQL ที่มันใช้ทุกครั้ง
5. **Example SQL** → วาง `prompt/05_genie_examplesql.txt`
   กฎเรื่องตัวเลขที่เขียนเป็น SQL ได้ อย่าฝากไว้กับข้อความ
6. ลอง **Agent mode** กับโจทย์หลายขั้น

---

## ขั้น 4 · Workshop 2 — Data App

### 4.1 สร้างแอปแล้วผูก resource ก่อนเขียนโค้ด

1. **Apps** → **Create app** → เลือก **Streamlit** → ชื่อ `wanderbricks-app`
2. **Edit** → **Add resource** 2 รอบ

| Resource type | เลือก | Permission | key |
|---|---|---|---|
| `SQL warehouse` | Serverless Starter Warehouse | Can use | `sql-warehouse` |
| `Genie space` | Wanderbricks Analytics | Can run | `genie-space` |

> ข้ามขั้นนี้ = แอปขึ้นได้แต่ query ไม่ออก
> ดรอปดาวน์ Genie ว่าง แปลว่ายังไม่ได้สร้าง Agent — ผูกแค่ SQL warehouse ไปก่อนได้

### 4.2 อัปไฟล์ขึ้น Workspace

**Workspace** → สร้างโฟลเดอร์ `wanderbricks-app` → **Import** 7 ไฟล์

```
day1-web/index.html      เว็บที่ทำไว้ Day 1
day1-web/style.css
SPEC.md  AGENTS.md  DESIGN.md
assets.py  catto.png
```

### 4.3 ก้อน A — แปลงเว็บ Day 1 เป็นแอปจริง

เปิด **Genie Code** → วางก้อน A จาก `prompt/07_app_build.txt` → อ่านแผน → **อนุมัติ**

**Deploy** → เปิด URL เห็นหน้าร้าน = **ผ่าน Workshop 2**

### 4.4 ก้อน B — แท็บ Chat

วางก้อน B → **Deploy ซ้ำที่แอปเดิม** ไม่ต้องสร้างแอปใหม่

### 4.5 ก้อน C — แท็บ AI Insights (ของเพิ่ม)

ทำถ้าเหลือเวลา ข้ามได้ ไม่กระทบสองแท็บแรก

### ถ้าหน้าตาไม่ตรง

พิมพ์ต่อทีละบรรทัด (ก็อปได้จากท้าย `prompt/07_app_build.txt`)

```
CSS โผล่เป็นข้อความบนหน้าเว็บ ทำ style ให้เป็นบรรทัดเดียว
การ์ดกดไม่ได้ ลูกศรกับการ์ดต้องเป็น a href จริง ไม่ใช่ span
ปุ่มยังเป็นสีเทาของ Streamlit ทาสีตามที่ DESIGN.md เขียนไว้
สร้าง .streamlit/config.toml ปักธีมสว่างตามที่ DESIGN.md เขียนไว้
หน้าตาไม่เหมือน index.html ให้กลับไปดู index.html แล้วทำตามโครงนั้น
```

---

## ขั้น 5 · ผูก Resource (ถ้ายังไม่ได้ทำในขั้น 4)

1. เมนูซ้าย **Apps** → **Create app** → ตั้งชื่อ (ตัวเล็ก เลข ขีดกลาง ไม่เกิน 26 ตัว)
2. ในหน้า App กด **Edit** → **Add resource**
   - **SQL warehouse** → Serverless Starter Warehouse → permission **Can use**
   - **Genie space** → Agent ที่สร้างไว้ → permission **Can run**
3. จำ resource key ไว้: `sql-warehouse` และ `genie-space`
4. ถ้าแอป query ตารางโดยตรง ต้องให้สิทธิ์ service principal ของแอปด้วย
   `USE CATALOG` · `USE SCHEMA` · `SELECT`

> ข้ามขั้นนี้ = แอปขึ้นได้แต่ query ไม่ออก · เจอบ่อยที่สุดใน Workshop นี้

---

## ขั้น 6 · Deploy

1. เมนูซ้าย **Workspace** → โฟลเดอร์ของเรา → **Import**
   ลากไฟล์ทั้งหมดเข้าไป (`app.py` `landing.py` `theme.py` `assets.py`
   `catto.png` `app.yaml` `requirements.txt` และโฟลเดอร์ `.streamlit/`)
2. กลับไปหน้า **App** → **Deploy** → เลือกโฟลเดอร์ที่เพิ่ง Import
3. รอ 1–2 นาที → ได้ URL ลงท้าย `.databricksapps.com`
4. เปิดครั้งแรกถ้าเจอ **Permission Requested** ให้กด **Authorize** หนึ่งครั้ง
5. แก้โค้ดทีหลัง → Import ทับ แล้ว **Deploy ซ้ำที่แอปเดิม** ไม่ต้องสร้างใหม่

---

## พังตรงไหนบ่อย

| อาการ | เช็กตรงนี้ |
|---|---|
| หน้าขาว ไม่มีสไตล์ | บล็อกสไตล์มีบรรทัดว่างคั่นไหม ต้องเป็นบรรทัดเดียว |
| 502 | `app.yaml` startup command กับ `requirements.txt` |
| ขึ้น Deploying นาน | รอสักครู่ ยังไม่ใช่ error |
| ขึ้น Failed | เปิด **Logs** ในหน้า App |
| กราฟว่าง | ปีที่ filter · ชื่อคอลัมน์ที่ query ส่งออกตรงกับที่กราฟใช้ไหม |
| Chat ไม่ตอบ | ผูก Genie resource แล้วยัง · permission Can run ยัง |
| Query ไม่ออก | สิทธิ์ SELECT ของ service principal |
| กล่องเลือกใน sidebar ว่าง | อย่าใช้ `st.selectbox` บนพื้นเข้ม ใช้ `st.radio` |
