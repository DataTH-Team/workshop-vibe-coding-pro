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

## โค้ดต่อ SQL warehouse — ใช้ตามนี้ ห้ามเขียนเอง

โค้ดก้อนนี้ทดสอบบน Databricks Apps แล้วว่าใช้ได้จริง คัดลอกไปทั้งก้อน

```python
import os
import pandas as pd
import streamlit as st
from databricks.sdk import WorkspaceClient

@st.cache_data(ttl=300)
def run_query(sql: str) -> pd.DataFrame:
    w = WorkspaceClient()
    r = w.statement_execution.execute_statement(
        warehouse_id=os.environ["DATABRICKS_WAREHOUSE_ID"],
        statement=sql,
        wait_timeout="30s",
    )
    state = getattr(r.status.state, "value", str(r.status.state))
    if state != "SUCCEEDED":
        raise RuntimeError(getattr(r.status.error, "message", state))
    cols = [c.name for c in r.manifest.schema.columns]
    rows = [list(x) for x in (r.result.data_array or [])]
    df = pd.DataFrame(rows, columns=cols)
    for c in df.columns:
        df[c] = pd.to_numeric(df[c], errors="ignore")
    return df
```

สามจุดที่ AI เขียนผิดประจำ อย่าทำ

- `r.status.state` เป็น **enum** ไม่ใช่ string เทียบตรง ๆ จะได้ False เสมอ
  ต้องอ่าน `.value` ก่อน
- `r.result.data_array` คืน **list ของ list** ไม่ใช่ object ที่มี `.values`
- ค่าที่ได้เป็น **string ทั้งหมด** ต้อง `pd.to_numeric` ก่อนวาดกราฟ

## app.yaml — ใช้ตามนี้เท่านั้น

```yaml
command: ["streamlit", "run", "app.py"]

env:
  - name: DATABRICKS_WAREHOUSE_ID
    valueFrom: sql-warehouse
  - name: GENIE_SPACE_ID
    valueFrom: genie-space
```

- ห้ามใส่ `--server.port` runtime กำหนด port ให้เอง
- ห้ามใช้บล็อก `resources:` ใน app.yaml เพราะ Databricks Apps ไม่อ่าน
  แอปจะขึ้นได้แต่ไม่มี env แล้ว query ไม่ออก

## ชื่อคอลัมน์ที่ AI เดาผิดบ่อย

| ต้องใช้ | AI มักเดาเป็น |
|---|---|
| `destinations.destination` | `destination_name` · `city` |
| `bookings.total_amount` | `amount` · `price` |
| `bookings.check_in` | `checkin_date` · `date` |

## โค้ดเรียก Genie Agent — ใช้ตามนี้ ห้ามเขียนเอง

ทดสอบบน Databricks Apps แล้วว่าใช้ได้จริง คัดลอกไปทั้งก้อน

```python
import os
import pandas as pd
import streamlit as st
from databricks.sdk import WorkspaceClient

def ask_genie(prompt: str, conversation_id: str | None):
    """ถาม Genie Agent · คืน (คำตอบ, conversation_id)"""
    space_id = os.environ["GENIE_SPACE_ID"]
    w = WorkspaceClient()
    if conversation_id is None:
        msg = w.genie.start_conversation_and_wait(space_id, prompt)
    else:
        msg = w.genie.create_message_and_wait(space_id, conversation_id, prompt)

    parts = []
    for att in (msg.attachments or []):
        if getattr(att, "text", None) and att.text.content:
            parts.append(att.text.content)
        elif getattr(att, "query", None):
            if att.query.description:
                parts.append(att.query.description)
            try:
                res = w.genie.get_message_attachment_query_result(
                    space_id, msg.conversation_id, msg.id, att.attachment_id)
                sr = res.statement_response
                cols = [c.name for c in sr.manifest.schema.columns]
                rows = [list(r) for r in (sr.result.data_array or [])]
                if rows:
                    df = pd.DataFrame(rows, columns=cols)
                    for c in df.columns:
                        df[c] = pd.to_numeric(df[c], errors="ignore")
                    parts.append("```\n" + df.to_string(index=False) + "\n```")
            except Exception:
                pass
            if att.query.query:
                parts.append("```sql\n" + att.query.query + "\n```")

    answer = "\n\n".join(p for p in parts if p) or "ไม่มีคำตอบกลับมา ลองถามใหม่"
    return answer, msg.conversation_id
```

สามจุดที่ AI เขียนผิดประจำ อย่าทำ

- ใช้ `start_conversation_and_wait` / `create_message_and_wait`
  **อย่าใช้** `start_conversation` แล้ววน poll เอง — ต้องเขียนลูปกับเงื่อนไขจบเพิ่ม ซึ่งพลาดง่าย
- `msg.status` เป็น **enum** ไม่ใช่ string เทียบ `== "COMPLETED"` จะได้ False เสมอ
  แล้วจะวนจนหมด timeout ทั้งที่ Genie ตอบไปแล้ว
- คำตอบอยู่ใน `msg.attachments` ไม่ใช่ `msg.content`
  ถ้า attachment เป็น query ต้องเรียก `get_message_attachment_query_result` ถึงจะได้ตัวเลข
- คำถามต่อเนื่องต้องส่ง `conversation_id` เดิม เก็บไว้ใน `st.session_state`
