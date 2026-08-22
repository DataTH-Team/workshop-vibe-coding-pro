# Day 1 · Vibe Code Travel

## โหลดยังไง

หน้าแรกของ repo → ปุ่มเขียว **Code → Download ZIP** → แตกไฟล์

แล้วเปิดโฟลเดอร์ **`Day1/starter`** ใน VS Code (File → Open Folder)

---

## ในนี้มีอะไรบ้าง

```
Day1/
├── starter/          ← ★ เริ่มที่นี่ ยังไม่มีโค้ดเว็บ
│   ├── SPEC.md              โจทย์: สร้างอะไร · อะไรไม่ทำ · แบบไหนถือว่าเสร็จ
│   ├── DESIGN.md            แนวทางหน้าตาเว็บ
│   ├── design-reference.png ภาพตัวอย่างหน้าตาที่จะได้
│   ├── assets/              รูป 6 เมือง
│   └── prompt/              prompt ทุกก้อนที่ใช้ในคาบ
│
├── prompt/           ชุด prompt (ชุดเดียวกับใน starter/ วางไว้ให้หาง่าย)
│
├── checkpoint-v1/    เฉลย V1 — เปิดดูตอนตามไม่ทัน
└── demo-final/       เฉลยตัวเต็ม V2
```

> **แนะนำให้ลองทำเองก่อน** อย่าเพิ่งเปิด `checkpoint-v1` กับ `demo-final`
> สองอันนี้มีไว้กันตกขบวน ถ้าเปิดตั้งแต่แรกจะไม่ได้ฝึกอะไรเลย

---

## prompt ใช้ตอนไหน

| ไฟล์ | ใช้ตอน |
|---|---|
| `00_tryit_interview.txt` | ลองให้ AI สัมภาษณ์เรา (ยังไม่เปิด VS Code) |
| `01_read_spec.txt` | ให้ AI อ่านโจทย์แล้วสรุปกลับมา |
| `02_build_v1.txt` | สั่งสร้างเว็บ V1 |
| `03_init.txt` | สร้าง `CLAUDE.md` ด้วย `/init` |
| `04_update_spec.txt` | Requirement เปลี่ยน → แก้ SPEC ก่อน |
| `05_plan.txt` | วางแผนก่อนแก้ (Plan Mode) |
| `06_implement.txt` | กลับ Manual แล้วสั่งลงมือ |
| `07_verify.txt` | ให้ AI ตรวจงานตัวเอง |
| `08_bonus_plugin.txt` | ของแถม · รีวิว UI ด้วย plugin |

---

## เตรียมเครื่องก่อนมา

1. ลง [VS Code](https://code.visualstudio.com)
2. ลง Extension **Claude Code** (ของ Anthropic) แล้ว Sign in
3. โหลดไฟล์ชุดนี้ แตกไฟล์เก็บไว้ในที่ที่หาเจอง่าย

> ไม่ต้องลง Git · ไม่ต้องสมัคร GitHub · ไม่ต้องรู้ HTML / CSS / JavaScript มาก่อน

## เปิดเว็บเฉลยยังไง

ดับเบิลคลิก `index.html` ได้เลย ไม่ต้องรัน server
