# ตั้งค่า iPad เป็นจอกดคิวหน้าร้าน (Kiosk) + ปริ้นบัตรคิว Star mC-Print2

หน้าจอ kiosk: **https://ppsswken-byte.github.io/kiosk.html**

ลูกค้ากดเลือก จำนวนคน → ブッフェ/アラカルト → รถเข็น/รถเข็นเด็ก → รอบเวลา → ยืนยัน
แล้วเครื่องปริ้นจะพิมพ์บัตรคิวออกมาทันที บนบัตรมี **QR สำหรับผูก LINE** ลูกค้าสแกนแล้วจะได้รับแจ้งเตือนเรียกคิวทาง LINE

> **ทำไมต้องใช้แอป Star webPRNT Browser?**
> Safari/Chrome บน iPad สั่งเครื่องปริ้น Bluetooth จากหน้าเว็บไม่ได้ (ระบบ Air ของ Recruit เป็นแอปเฉพาะ)
> Star Micronics จึงทำแอปเบราว์เซอร์ฟรี **Star webPRNT Browser** ให้หน้าเว็บสั่งปริ้นไปที่เครื่อง Star ผ่าน Bluetooth ได้โดยตรง
> — ไม่มีหน้าต่างยืนยัน ไม่สลับแอป และรองรับ mC-Print2 อย่างเป็นทางการ

---

## 1. ครั้งแรก: redeploy Google Apps Script (สำหรับฟีเจอร์ผูก LINE)

1. เปิด https://github.com/ppsswken-byte/ppsswken-byte.github.io/raw/main/gas-backend.gs → เลือกทั้งหมด → คัดลอก
2. Google Sheet ระบบคิว → **Extensions → Apps Script** → ลบโค้ดเดิมทั้งหมด → วางโค้ดใหม่ → กด 💾 **บันทึก**
3. **Deploy → Manage deployments** → เลือก deployment ที่ URL ขึ้นต้นด้วย `AKfycbzWjYWC8R…` → ✏️ **Edit** → Version: **New version** → **Deploy**
4. เปิด https://ppsswken-byte.github.io/check.html → ช่อง **"Kiosk: ผูก LINE จาก QR บนบัตรคิว"** ต้องเป็น ✅

> ถ้าเผลอกด *New deployment* แล้วได้ URL ใหม่ ไม่เป็นไร — ส่ง URL ใหม่มา แล้วจะอัปเดตทุกหน้าให้

## 2. เชื่อมเครื่องปริ้นกับ iPad

1. เปิดเครื่อง mC-Print2 ให้อยู่ในโหมดจับคู่ Bluetooth (ดูคู่มือเครื่อง: กดปุ่ม PAIR ด้านหลังค้างไว้)
2. iPad → **การตั้งค่า (Settings) → Bluetooth** → เลือก **mC-Print2** (หรือ Star Micronics) ให้ขึ้นว่า "เชื่อมต่อแล้ว"

## 3. ติดตั้งและตั้งค่าแอป Star webPRNT Browser

1. App Store → ค้นหา **"Star webPRNT Browser"** (ของ Star Micronics, ฟรี) → ติดตั้ง
2. iPad → **การตั้งค่า (Settings)** → เลื่อนลงหาแอป **Star webPRNT** แล้วตั้งค่า:
   - **Use Custom URL**: เปิด (ON)
   - **HOME URL**: `https://ppsswken-byte.github.io/kiosk.html`
   - **PRINTER**: เลือก **mC-Print2**
   - **PORT NAME**: ใช้ค่าเริ่มต้น `BT:Star Micronics` (Use Default = ON)
3. เปิดแอป Star webPRNT Browser → จะเข้าหน้าจอ kiosk อัตโนมัติ

## 4. ทดสอบปริ้น

1. บนหน้าจอ kiosk **กดค้างที่โลโก้ 3 วินาที** → ใส่รหัส **1234** → เข้าเมนูสตาฟ
2. บรรทัดแรกต้องขึ้น ✓ *"Star webPRNT Browser で動作中"*
3. กด **テスト印刷** → เครื่องต้องพิมพ์บัตรตัวอย่างออกมา
4. ลองกดคิวจริง 1 ใบตั้งแต่หน้าแรก → ตรวจว่าบัตรออก และคิวขึ้นในหน้า staff-dashboard

## 5. ล็อก iPad ให้อยู่หน้า kiosk (Guided Access)

1. **Settings → Display & Brightness → Auto-Lock → Never** (จอไม่ดับเอง)
2. **Settings → Accessibility → Guided Access** → เปิด → ตั้งรหัสผ่าน
3. เปิดแอป Star webPRNT Browser → **กดปุ่มด้านข้าง (หรือปุ่ม Home) 3 ครั้งติดกัน** → Start
   ลูกค้าจะออกจากแอปไม่ได้ — สตาฟปลดล็อกด้วยการกด 3 ครั้งแล้วใส่รหัส
4. แนะนำเสียบสายชาร์จ iPad ไว้ตลอด

---

## เมนูสตาฟ (กดค้างโลโก้ 3 วินาที → รหัส 1234)

| ปุ่ม | ใช้ทำอะไร |
|---|---|
| テスト印刷 | ปริ้นบัตรตัวอย่าง เช็คเครื่อง |
| 最後の整理券を再印刷 | ปริ้นบัตรใบล่าสุดซ้ำ (เช่น กระดาษหมดกลางทาง) |
| 印刷プレビュー | ดูหน้าตาบัตรบนจอ |
| 発券時に自動で印刷する | เปิด/ปิดการปริ้นอัตโนมัติ |
| 印刷後に用紙をカットする | เปิด/ปิดการตัดกระดาษอัตโนมัติ |

เปลี่ยนรหัสได้ที่ `STAFF_PIN` ใน `kiosk.html`

## แก้ปัญหา

| อาการ | วิธีแก้ |
|---|---|
| แถบแดงล่างจอ "用紙切れです" | กระดาษหมด → ใส่ม้วนใหม่ → เมนูสตาฟ → 最後の整理券を再印刷 |
| "カバーが開いています" | ปิดฝาเครื่องให้สนิท |
| "プリンターと通信できません" | เช็คว่าเครื่องเปิดอยู่ และ iPad → Settings → Bluetooth ยังเชื่อมกับ mC-Print2 / ปิดเปิดเครื่องปริ้นใหม่ |
| เมนูสตาฟขึ้น ✕ "通常のブラウザで開いています" | เปิดหน้าผิดแอป (Safari) → ต้องเปิดผ่านแอป **Star webPRNT Browser** |
| ปริ้นไม่ออกแต่ไม่มี error | เช็ค Settings → Star webPRNT → PRINTER ว่าเลือก mC-Print2 และ PORT NAME = `BT:Star Micronics` |
| ปุ่ม "タッチして整理券を発券" กดไม่ได้ | ทุกรอบเต็ม (ตั้งที่ staff-dashboard → お席の状況) หรือเชื่อมต่อ backend ไม่ได้ (เช็ค check.html) |

ถ้าปริ้นไม่ออก ระบบ**ยังออกคิวได้ปกติ** — หมายเลขและ QR แสดงบนจอให้ลูกค้าถ่ายรูป และสตาฟปริ้นซ้ำได้ภายหลัง
