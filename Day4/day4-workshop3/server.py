#!/usr/bin/env python3
"""Cafe Assistant backend — Gemini เขียน SQL แล้วดึงตัวเลขจริงจาก Snowflake"""

from __future__ import annotations

import concurrent.futures
import json
import os
import re
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env"
MAX_MESSAGE_LEN = 4000
MAX_HISTORY = 12
REQUEST_TIMEOUT_SEC = 25
SNOWFLAKE_TIMEOUT_SEC = 45
MAX_RESULT_ROWS = 40

SQL_SYSTEM_PROMPT = """คุณคือผู้ช่วยแปลงคำถามยอดขายร้านกาแฟเป็น SQL สำหรับ Snowflake
ตอบเป็น JSON อย่างเดียว ห้ามมี markdown หรือคำอธิบายนอก JSON

รูปแบบ:
{{"sql":"SELECT ..."}}
ถ้าคำถามไม่เกี่ยวกับยอดขาย/ออเดอร์/เมนูของร้าน ให้ตอบ {{"sql":null}}

กฎ SQL:
- อ่านอย่างเดียว ขึ้นต้นด้วย SELECT หรือ WITH เท่านั้น
- ใช้ตารางเดียว: CAFE_DB.SALES.ORDERS
- ห้าม INSERT UPDATE DELETE MERGE DROP CREATE ALTER GRANT CALL COPY PUT
- ห้ามมีหลาย statement (ห้าม ;)
- นับยอดขายจากแถวที่ STATUS = 'Completed' เว้นแต่ผู้ใช้ถามสถานะอื่น
- ยอดเงินใช้คอลัมน์ TOTAL, จำนวนชิ้นใช้ QTY, จำนวนบิลใช้นับ ORDER_ID ที่ไม่ซ้ำ
- เขตเวลา Asia/Bangkok วันนี้คือ {today}
- ถ้าไม่รู้ช่วงวันที่ในคำถาม ให้ใช้ข้อมูลทั้งหมดในช่วงที่มีในตาราง
- ใส่ LIMIT ไม่เกิน 40 ถ้าผลลัพธ์อาจมีหลายแถว
- ตั้ง alias คอลัมน์เป็นภาษาอังกฤษสั้น ๆ อ่านง่าย

สคีมาตาราง CAFE_DB.SALES.ORDERS:
{schema}
"""

ANSWER_SYSTEM_PROMPT = """คุณคือ Cafe Assistant ผู้ช่วยเจ้าของร้านกาแฟ พูดภาษาไทย สุภาพ กระชับ ใช้คำว่าครับ
ตอบจากผลลัพธ์ที่ดึงมาจาก Snowflake เท่านั้น ห้ามเดาตัวเลข
ถ้าผลว่าง ให้บอกว่าไม่พบข้อมูลในช่วงนั้น
จัดรูปแบบให้อ่านง่าย ใช้ **ตัวหนา** ได้ ห้ามใช้ HTML หรือ Markdown อื่นนอกจาก **bold** และขึ้นบรรทัดใหม่
ถ้ามีตัวเลขเงิน ให้ใส่ ฿ และคั่นหลักพัน
"""

PLACEHOLDER_KEYS = {
    "",
    "ใส่คีย์ตรงนี้",
    "your_api_key_here",
    "ใส่โทเคนตรงนี้",
    "your_pat_here",
    "ใส่ account identifier",
}
_table_schema_cache: str | None = None


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.is_file():
        return env
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line.startswith("export "):
            line = line[7:].strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip("'").strip('"')
    return env


def get_settings() -> dict[str, str]:
    env = {**os.environ, **load_env(ENV_PATH)}
    account = normalize_account(env.get("SNOWFLAKE_ACCOUNT", "").strip())
    return {
        "gemini_api_key": env.get("GEMINI_API_KEY", "").strip(),
        "model": env.get("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash",
        "snowflake_pat": env.get("SNOWFLAKE_PAT", "").strip(),
        "snowflake_account": account,
        "snowflake_warehouse": env.get("SNOWFLAKE_WAREHOUSE", "").strip(),
        "snowflake_role": env.get("SNOWFLAKE_ROLE", "").strip(),
    }


def normalize_account(raw: str) -> str:
    value = raw.replace("https://", "").replace("http://", "").split("/")[0]
    suffix = ".snowflakecomputing.com"
    if value.lower().endswith(suffix):
        value = value[: -len(suffix)]
    return value


def is_configured_gemini(api_key: str | None = None) -> bool:
    key = get_settings()["gemini_api_key"] if api_key is None else api_key
    return key not in PLACEHOLDER_KEYS


def is_configured_snowflake(settings: dict[str, str] | None = None) -> bool:
    cfg = settings or get_settings()
    return cfg["snowflake_pat"] not in PLACEHOLDER_KEYS and bool(cfg["snowflake_account"])


def send_json(handler: SimpleHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler: SimpleHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0 or length > 100_000:
        raise ValueError("คำขอว่างหรือใหญ่เกินไป")
    raw = handler.rfile.read(length)
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("รูปแบบคำขอไม่ถูกต้อง")
    return data


def to_gemini_contents(message: str, history: list) -> list[dict]:
    contents: list[dict] = []
    for item in history[-MAX_HISTORY:]:
        if not isinstance(item, dict):
            continue
        role = "user" if item.get("role") == "user" else "model"
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        contents.append({"role": role, "parts": [{"text": text[:MAX_MESSAGE_LEN]}]})
    contents.append({"role": "user", "parts": [{"text": message}]})
    return contents


def call_gemini(
    message: str,
    history: list,
    api_key: str,
    model: str,
    system_instruction: str,
    temperature: float = 0.4,
    max_output_tokens: int = 1024,
) -> str:
    try:
        from google import genai
        from google.genai import errors as genai_errors
        from google.genai import types
    except ImportError as exc:
        raise RuntimeError("ยังไม่ได้ติดตั้ง google-genai — รัน pip3 install google-genai") from exc

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_SEC * 1000),
    )
    thinking = None
    lowered = model.lower()
    if "2.5" in lowered:
        thinking = types.ThinkingConfig(thinking_budget=0)
    elif "gemini-3" in lowered:
        thinking = types.ThinkingConfig(thinking_level="MINIMAL")

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        thinking_config=thinking,
    )

    def _generate():
        return client.models.generate_content(
            model=model,
            contents=to_gemini_contents(message, history),
            config=config,
        )

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            response = pool.submit(_generate).result(timeout=REQUEST_TIMEOUT_SEC)
    except concurrent.futures.TimeoutError as exc:
        raise RuntimeError("Gemini ตอบช้าเกินไป ลองส่งใหม่อีกครั้งครับ") from exc
    except genai_errors.APIError as exc:
        raise RuntimeError(parse_gemini_http_error(exc.code or 0, json.dumps(exc.details, ensure_ascii=False, default=str))) from exc
    except Exception as exc:
        raise RuntimeError("เชื่อมต่อ Gemini ไม่ได้ ตรวจเน็ตแล้วลองใหม่ครับ") from exc

    text = (response.text or "").strip()
    if text:
        return text
    raise RuntimeError("Gemini ส่งคำตอบว่างมา")


def parse_gemini_http_error(status: int, body: str) -> str:
    if status in (401, 403):
        return (
            "Gemini ไม่รับ API Key นี้ — เซิร์ฟเวอร์อ่าน .env แล้ว "
            "ลองสร้างคีย์ใหม่ที่ https://aistudio.google.com/apikey แล้ววางทับในไฟล์ .env"
        )
    if status == 429:
        return "เรียก Gemini บ่อยเกินไป รอสักครู่แล้วลองใหม่ครับ"
    if status >= 500:
        return "Gemini ฝั่งเซิร์ฟเวอร์มีปัญหาชั่วคราว ลองใหม่ได้ครับ"
    try:
        err = json.loads(body)
        message = err.get("error", {}).get("message")
        if message:
            return f"Gemini ตอบกลับมาว่า: {message}"
    except json.JSONDecodeError:
        pass
    return "ส่งคำถามไป Gemini ไม่สำเร็จ"


def extract_sql(text: str) -> str | None:
    raw = text.strip()
    parsed = None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            try:
                parsed = json.loads(match.group(0))
            except json.JSONDecodeError:
                parsed = None
    if isinstance(parsed, dict):
        if parsed.get("sql") in (None, "", "null"):
            return None
        if parsed.get("sql"):
            raw = str(parsed["sql"])
    fenced = re.search(r"```(?:sql)?\s*([\s\S]*?)```", raw, re.I)
    if fenced:
        raw = fenced.group(1)
    match = re.search(r"\b(WITH|SELECT)\b[\s\S]+", raw, re.I)
    if not match:
        return None
    return match.group(0).strip().rstrip(";").strip()


UNSAFE_SQL = re.compile(
    r"""
    \b(
        INSERT|UPDATE|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|
        COPY|PUT|GET|CALL|EXECUTE|UNDROP|REMOVE|LIST|BEGIN|COMMIT|ROLLBACK|
        COMMENT|UNDROP|INTO
    )\b
    |;\s*\S
    """,
    re.I | re.X,
)


def assert_safe_sql(sql: str) -> None:
    if not re.match(r"^\s*(SELECT|WITH)\b", sql, re.I):
        raise RuntimeError("อนุญาตเฉพาะคำสั่ง SELECT จากตารางยอดขายครับ")
    if UNSAFE_SQL.search(sql):
        raise RuntimeError("ปฏิเสธ SQL ที่ไม่ใช่การอ่านข้อมูลครับ")
    if not re.search(r"\bORDERS\b", sql, re.I):
        raise RuntimeError("SQL ต้องอ่านจากตาราง CAFE_DB.SALES.ORDERS ครับ")


def ensure_limit(sql: str) -> str:
    if re.search(r"\bLIMIT\s+\d+\s*$", sql, re.I):
        return sql
    return f"SELECT * FROM (\n{sql}\n) AS cafe_q LIMIT {MAX_RESULT_ROWS}"


def snowflake_base_url(account: str) -> str:
    return f"https://{account}.snowflakecomputing.com"


def snowflake_request(
    method: str,
    url: str,
    pat: str,
    body: dict | None = None,
    timeout: int = SNOWFLAKE_TIMEOUT_SEC,
) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {pat}")
    req.add_header("X-Snowflake-Authorization-Token-Type", "PROGRAMMATIC_ACCESS_TOKEN")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "CafeAssistant/1.0")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            payload = json.loads(raw) if raw else {}
            return resp.status, payload if isinstance(payload, dict) else {"data": payload}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"message": raw[:800]}
        if not isinstance(payload, dict):
            payload = {"message": str(payload)}
        raise RuntimeError(parse_snowflake_error(exc.code, payload)) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError("เชื่อมต่อ Snowflake ไม่ได้ ตรวจเน็ตและ SNOWFLAKE_ACCOUNT ใน .env ครับ") from exc


def parse_snowflake_error(status: int, payload: dict) -> str:
    blob = json.dumps(payload, ensure_ascii=False)
    message = str(payload.get("message") or payload.get("error") or "").strip()
    if status in (401, 403) or "PAT_INVALID" in blob:
        return "Snowflake ไม่รับ PAT นี้ — ตรวจ SNOWFLAKE_PAT ในไฟล์ .env ครับ"
    lowered = message.lower()
    if "warehouse" in lowered and ("not specified" in lowered or "does not exist" in lowered or "required" in lowered):
        return "ยังไม่ได้ระบุ warehouse — ใส่ SNOWFLAKE_WAREHOUSE ในไฟล์ .env ครับ"
    if "does not exist" in lowered or "object does not exist" in lowered:
        return "ไม่พบตาราง cafe_db.sales.ORDERS — ตรวจชื่อฐานข้อมูลใน Snowflake ครับ"
    if message:
        return f"Snowflake ตอบกลับมาว่า: {message}"
    if status >= 500:
        return "Snowflake ฝั่งเซิร์ฟเวอร์มีปัญหาชั่วคราว ลองใหม่ได้ครับ"
    return "query Snowflake ไม่สำเร็จ"


def run_snowflake_sql(sql: str, settings: dict[str, str]) -> dict:
    account = settings["snowflake_account"]
    pat = settings["snowflake_pat"]
    url = f"{snowflake_base_url(account)}/api/v2/statements?async=false"
    body: dict = {
        "statement": sql,
        "timeout": SNOWFLAKE_TIMEOUT_SEC,
        "database": "CAFE_DB",
        "schema": "SALES",
        "resultSetMetaData": {"format": "jsonv2"},
        "parameters": {
            "DATE_OUTPUT_FORMAT": "YYYY-MM-DD",
            "TIMESTAMP_OUTPUT_FORMAT": "YYYY-MM-DD HH24:MI:SS",
            "TIMESTAMP_NTZ_OUTPUT_FORMAT": "YYYY-MM-DD HH24:MI:SS",
            "TIMESTAMP_LTZ_OUTPUT_FORMAT": "YYYY-MM-DD HH24:MI:SS",
            "TIMEZONE": "Asia/Bangkok",
        },
    }
    if settings["snowflake_warehouse"]:
        body["warehouse"] = settings["snowflake_warehouse"]
    if settings["snowflake_role"]:
        body["role"] = settings["snowflake_role"]

    status, payload = snowflake_request("POST", url, pat, body)
    deadline = time.time() + SNOWFLAKE_TIMEOUT_SEC
    while status == 202:
        handle = payload.get("statementHandle")
        if not handle:
            raise RuntimeError("Snowflake ยังไม่ส่งผลลัพธ์กลับมา")
        if time.time() > deadline:
            raise RuntimeError("Snowflake ตอบช้าเกินไป ลองใหม่อีกครั้งครับ")
        time.sleep(0.8)
        poll_url = f"{snowflake_base_url(account)}/api/v2/statements/{handle}"
        status, payload = snowflake_request("GET", poll_url, pat)
    if status != 200:
        raise RuntimeError(parse_snowflake_error(status, payload))
    return payload


def result_to_text(payload: dict) -> str:
    meta = payload.get("resultSetMetaData") or {}
    row_type = meta.get("rowType") or []
    columns = [str(col.get("name") or f"COL{i}") for i, col in enumerate(row_type)]
    rows = payload.get("data") or []
    if not columns and rows:
        columns = [f"COL{i + 1}" for i in range(len(rows[0]))]
    if not rows:
        return "(ไม่มีแถวข้อมูล)"
    lines = [" | ".join(columns)]
    for row in rows[:MAX_RESULT_ROWS]:
        cells = ["" if cell is None else str(cell) for cell in row]
        lines.append(" | ".join(cells))
    total = meta.get("numRows")
    if isinstance(total, int) and total > len(rows):
        lines.append(f"(แสดง {len(rows)} จาก {total} แถว)")
    return "\n".join(lines)


def format_describe(payload: dict) -> str:
    rows = payload.get("data") or []
    lines = []
    for row in rows:
        if not row:
            continue
        name = row[0]
        col_type = row[1] if len(row) > 1 else ""
        lines.append(f"- {name} {col_type}")
    return "\n".join(lines) if lines else "- ORDER_ID, DATETIME, MENU, CATEGORY, QTY, PRICE, TOTAL, CHANNEL, CUSTOMER, STATUS"


def get_table_schema(settings: dict[str, str]) -> str:
    global _table_schema_cache
    if _table_schema_cache:
        return _table_schema_cache
    fallback = (
        "- ORDER_ID VARCHAR\n"
        "- DATETIME TIMESTAMP วันเวลาสั่งซื้อ\n"
        "- MENU VARCHAR ชื่อเมนู\n"
        "- CATEGORY VARCHAR เช่น Coffee, Tea, Other Drinks, Snacks\n"
        "- QTY NUMBER จำนวนชิ้น\n"
        "- PRICE NUMBER ราคาต่อชิ้น\n"
        "- TOTAL NUMBER ยอดเงินของแถว\n"
        "- CHANNEL VARCHAR Walk-in / Delivery / Pre-order\n"
        "- CUSTOMER VARCHAR\n"
        "- STATUS VARCHAR เช่น Completed"
    )
    try:
        described = run_snowflake_sql("DESCRIBE TABLE CAFE_DB.SALES.ORDERS", settings)
        schema = format_describe(described)
    except RuntimeError:
        schema = fallback
    try:
        stats = run_snowflake_sql(
            "SELECT MIN(DATETIME) AS min_dt, MAX(DATETIME) AS max_dt, COUNT(*) AS n "
            "FROM CAFE_DB.SALES.ORDERS",
            settings,
        )
        schema += "\nช่วงข้อมูลที่มี: " + result_to_text(stats)
    except RuntimeError:
        pass
    _table_schema_cache = schema
    return schema


def answer_with_snowflake(message: str, history: list, settings: dict[str, str]) -> str:
    today = time.strftime("%Y-%m-%d")
    schema = get_table_schema(settings)
    sql_prompt = SQL_SYSTEM_PROMPT.format(today=today, schema=schema)
    sql_raw = call_gemini(
        message,
        history,
        settings["gemini_api_key"],
        settings["model"],
        sql_prompt,
        temperature=0.1,
        max_output_tokens=512,
    )
    sql = extract_sql(sql_raw)
    if not sql:
        return call_gemini(
            message,
            history,
            settings["gemini_api_key"],
            settings["model"],
            ANSWER_SYSTEM_PROMPT + "\nตอนนี้ยังไม่มีผลลัพธ์จากฐานข้อมูล ตอบโดยไม่เดาตัวเลขยอดขาย",
        )

    assert_safe_sql(sql)
    sql = ensure_limit(sql)
    print(f"SQL: {sql}", flush=True)
    payload = run_snowflake_sql(sql, settings)
    result_text = result_to_text(payload)
    follow_up = (
        f"คำถามของเจ้าของร้าน:\n{message}\n\n"
        f"SQL ที่ใช้ดึงข้อมูล:\n{sql}\n\n"
        f"ผลลัพธ์จาก Snowflake:\n{result_text}"
    )
    return call_gemini(
        follow_up,
        [],
        settings["gemini_api_key"],
        settings["model"],
        ANSWER_SYSTEM_PROMPT,
        temperature=0.3,
        max_output_tokens=1024,
    )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        msg = fmt % args
        settings = get_settings()
        secrets = [settings["gemini_api_key"], settings["snowflake_pat"]]
        if any(secret and secret in msg for secret in secrets) or "GEMINI_API_KEY" in msg or "SNOWFLAKE_PAT" in msg:
            return
        super().log_message("%s", msg)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/health":
            settings = get_settings()
            gemini_ok = is_configured_gemini(settings["gemini_api_key"])
            snowflake_ok = is_configured_snowflake(settings)
            send_json(
                self,
                200,
                {
                    "ok": True,
                    "configured": gemini_ok and snowflake_ok,
                    "gemini": gemini_ok,
                    "snowflake": snowflake_ok,
                    "model": settings["model"],
                },
            )
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path != "/api/chat":
            send_json(self, 404, {"error": "ไม่พบเส้นทางนี้"})
            return
        try:
            body = read_json_body(self)
        except (ValueError, json.JSONDecodeError):
            send_json(self, 400, {"error": "ส่งข้อมูลไม่ถูกต้อง"})
            return

        message = str(body.get("message") or "").strip()
        history = body.get("history") or []
        if not message:
            send_json(self, 400, {"error": "พิมพ์คำถามก่อนส่งนะครับ"})
            return
        if len(message) > MAX_MESSAGE_LEN:
            send_json(self, 400, {"error": "ข้อความยาวเกินไป ลองย่อหน่อยครับ"})
            return
        if not isinstance(history, list):
            send_json(self, 400, {"error": "ประวัติแชทไม่ถูกต้อง"})
            return
        settings = get_settings()
        if not is_configured_gemini(settings["gemini_api_key"]):
            send_json(
                self,
                503,
                {"error": "ยังไม่มี Gemini API Key — คัดลอก .env.example เป็น .env แล้วใส่คีย์ในไฟล์นั้น"},
            )
            return
        if not is_configured_snowflake(settings):
            send_json(
                self,
                503,
                {"error": "ยังไม่มี Snowflake — ใส่ SNOWFLAKE_PAT และ SNOWFLAKE_ACCOUNT ในไฟล์ .env"},
            )
            return

        try:
            reply = answer_with_snowflake(message, history, settings)
        except RuntimeError as exc:
            send_json(self, 502, {"error": str(exc)})
            return
        send_json(self, 200, {"reply": reply})

    def translate_path(self, path: str) -> str:
        translated = super().translate_path(path)
        name = Path(translated).name
        blocked = name.startswith(".env") or name in {".gitignore", "server.py"}
        if blocked:
            return str(ROOT / "__blocked__")
        return translated


def main() -> None:
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    settings = get_settings()
    gemini_status = "พร้อม" if is_configured_gemini(settings["gemini_api_key"]) else "ยังไม่มี API Key ใน .env"
    snowflake_status = "พร้อม" if is_configured_snowflake(settings) else "ยังไม่มี PAT/ACCOUNT ใน .env"
    print(f"Cafe Assistant · Gemini + Snowflake  →  http://localhost:{port}")
    print(f"โมเดล: {settings['model']}  ·  Gemini {gemini_status}  ·  Snowflake {snowflake_status}")
    print("ปิดด้วย Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nปิดเซิร์ฟเวอร์แล้ว")


if __name__ == "__main__":
    main()
