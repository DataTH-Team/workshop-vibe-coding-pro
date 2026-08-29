#!/usr/bin/env python3
"""Cafe Assistant backend — ส่งคำถามไป Gemini โดยเก็บ API key ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น"""

from __future__ import annotations

import concurrent.futures
import json
import os
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

SYSTEM_PROMPT = """คุณคือ Cafe Assistant ผู้ช่วยเจ้าของร้านกาแฟ พูดภาษาไทย สุภาพ กระชับ ใช้คำว่าครับ
ตอบจากข้อมูลยอดขายตัวอย่างด้านล่างเป็นหลัก ถ้าคำถามอยู่นอกข้อมูล ให้บอกตรง ๆ แล้วช่วยคิดเท่าที่สมเหตุสมผล
จัดรูปแบบให้อ่านง่าย ใช้ **ตัวหนา** ได้ ห้ามใช้ HTML หรือ Markdown อื่นนอกจาก **bold** และขึ้นบรรทัดใหม่

ข้อมูลยอดขายตัวอย่าง (ยังไม่เชื่อมชีตจริง):

สัปดาห์ที่แล้ว (10–16 ส.ค. 2026)
- ยอดขายรวม ฿5,090 / 37 ออเดอร์ / 91 แก้ว-ชิ้น
- เมนูขายดี: Iced Americano 22 แก้ว (฿1,210), Iced Latte 16 (฿1,040), Thai Iced Tea 11 (฿605), Lemon Soda 8 (฿360), Lemon Tea 7 (฿350)
- หมวด: Coffee ฿2,520 (49%), Tea ฿1,280 (25%), Other Drinks ฿780 (15%), Snacks ฿510 (11%)
- ช่องทาง: Walk-in 26 ออเดอร์ ฿3,445 · Delivery 10 ออเดอร์ ฿1,515 · Pre-order 1 ออเดอร์ ฿130
- รายวัน: จ.10 ฿520, อ.11 ฿890, พ.12 ฿640, พฤ.13 ฿710, ศ.14 ฿980, ส.15 ฿850, อา.16 ฿500
- วันยอดสูงสุด ศ. 14 ส.ค. ฿980 · วันยอดต่ำสุด อา. 16 ส.ค. ฿500

เมื่อวาน (อา. 16 ส.ค. 2026): ฿500 / 4 ออเดอร์ / เมนูขายดี Iced Americano (3 แก้ว)
เดือนนี้ (1–16 ส.ค. 2026): ยอดรวมเท่าสัปดาห์ที่แล้ว ฿5,090 / 37 ออเดอร์ / เฉลี่ยวันละ ~฿318
"""


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


def get_settings() -> tuple[str, str]:
    # ไฟล์ .env ชนะเสมอ เพื่อให้ใส่คีย์แล้วใช้ได้โดยไม่ต้องจำว่าเปิดเซิร์ฟเวอร์ตอนไหน
    env = {**os.environ, **load_env(ENV_PATH)}
    api_key = env.get("GEMINI_API_KEY", "").strip()
    model = env.get("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    return api_key, model


PLACEHOLDER_KEYS = {"", "ใส่คีย์ตรงนี้", "your_api_key_here"}


def is_configured(api_key: str | None = None) -> bool:
    key = get_settings()[0] if api_key is None else api_key
    return key not in PLACEHOLDER_KEYS


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


def call_gemini(message: str, history: list, api_key: str, model: str) -> str:
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
        system_instruction=SYSTEM_PROMPT,
        temperature=0.4,
        max_output_tokens=1024,
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


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        msg = fmt % args
        api_key, _ = get_settings()
        if "GEMINI_API_KEY" in msg or api_key and api_key in msg:
            return
        super().log_message("%s", msg)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/health":
            api_key, model = get_settings()
            send_json(self, 200, {"ok": True, "configured": is_configured(api_key), "model": model})
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
        api_key, model = get_settings()
        if not is_configured(api_key):
            send_json(
                self,
                503,
                {"error": "ยังไม่มี Gemini API Key — คัดลอก .env.example เป็น .env แล้วใส่คีย์ในไฟล์นั้น"},
            )
            return

        try:
            reply = call_gemini(message, history, api_key, model)
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
    api_key, model = get_settings()
    status = "พร้อม" if is_configured(api_key) else "ยังไม่มี API Key ใน .env"
    print(f"Cafe Assistant · Gemini  →  http://localhost:{port}")
    print(f"โมเดล: {model}  ·  {status}")
    print("ปิดด้วย Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nปิดเซิร์ฟเวอร์แล้ว")


if __name__ == "__main__":
    main()
