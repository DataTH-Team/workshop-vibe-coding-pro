#!/bin/bash
# ดับเบิลคลิกเพื่อเปิด Cafe Chatbot (Demo)
cd "$(dirname "$0")" || exit 1

PORT=8080
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT+1))
done

echo "เปิด Chatbot ที่ http://localhost:$PORT"
echo "จากมือถือ (Wi-Fi เดียวกัน): http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'):$PORT"
echo "ปิดหน้าต่างนี้ หรือกด Ctrl+C เมื่อเลิกใช้งาน"
( sleep 1; open "http://localhost:$PORT/index.html" ) &
python3 -m http.server "$PORT"
