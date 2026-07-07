# วิดีโอสำหรับจอ TV

วิดีโอ**ไม่ได้เก็บในโฟลเดอร์นี้** — เก็บไว้ที่ GitHub Release เพราะไฟล์ใหญ่เกินลิมิตอัปโหลดของ repo (25 MB)

📦 **ที่เก็บวิดีโอ:** https://github.com/ppsswken-byte/ppsswken-byte.github.io/releases/tag/videos-v1

## ตารางการเล่น (ค่าเริ่มต้น — แก้ได้จาก staff-dashboard)

| ช่วง | เวลา | ไฟล์ที่เล่นวนสลับกัน |
|---|---|---|
| ลันช์ วันธรรมดา | 10:45–15:01 | `lunch.buffet.weekday.mp4` + `lunch.course.mp4` |
| ลันช์ เสาร์–อาทิตย์/วันหยุด | 10:45–16:01 | `lunch.buffet.holiday.mp4` + `lunch.course.mp4` |
| ดินเนอร์ (ทุกวัน) | 16:45–23:01 | `dinner.a.la.carte.202511.mp4` + `dinner.course.202511.mp4` |

นอกช่วงเวลา หรือโหลดวิดีโอไม่ได้ → จอแสดงโลโก้ร้านแทน

## วิธีเปลี่ยนวิดีโอในอนาคต

1. เปิดหน้า [Release videos-v1](https://github.com/ppsswken-byte/ppsswken-byte.github.io/releases/tag/videos-v1) → กด ✏️ Edit
2. ลากไฟล์ใหม่ใส่ (ตั้งชื่อไม่ซ้ำของเดิม เช่น `dinner.course.202601.mp4`) → Update release
3. แก้ชื่อไฟล์ในตัวแปร `LUNCH_WD_VIDEOS` / `LUNCH_HOL_VIDEOS` / `DINNER_VIDEOS` ใน `tv-display.html` ให้ตรงกับไฟล์ใหม่

## การควบคุมหน้างาน

สตาฟควบคุมได้จาก **staff-dashboard.html** กล่อง "TV ディスプレイ映像":
- บังคับโหมด ランチ / ディナー / ロゴ หรือกลับเป็น 自動
- ติ๊ก "本日は土日祝スケジュール" เมื่อเป็นวันหยุดนักขัตฤกษ์
- แก้เวลาสลับทั้ง 3 ช่วง
