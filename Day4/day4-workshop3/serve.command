#!/bin/bash
# ดับเบิลคลิกเพื่อเปิด Cafe Assistant ที่ดึงยอดขายจาก Snowflake
cd "$(dirname "$0")" || exit 1

PORT=8080
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT+1))
done

export PORT
python3 -c "import google.genai, certifi" 2>/dev/null || python3 -m pip install -q -r requirements.txt
echo "เปิด Chatbot ที่ http://localhost:$PORT"
echo "จากมือถือ (Wi-Fi เดียวกัน): http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'):$PORT"
echo "ปิดหน้าต่างนี้ หรือกด Ctrl+C เมื่อเลิกใช้งาน"
( sleep 1; open "http://localhost:$PORT/" ) &
python3 server.py
