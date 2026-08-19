# วิธีเปิด/ปิดให้คนนอกทดลองใช้ผ่าน ngrok (production build)

ใช้ตอนอยากให้คนอื่น (ไม่ต้องอยู่ WiFi/office เดียวกัน) เข้าทดลองเว็บผ่านลิงก์สาธารณะ โดยมีรหัสผ่านกันไว้จริง — ต่างจาก `DEV-START.md` (`npm run dev`) ตรงที่โหมดนั้น**ข้ามการยืนยันตัวตนเสมอ** ไม่ว่าตั้งค่าไว้หรือไม่ก็ตาม (ดูคอมเมนต์ใน `proxy.ts`) จึงห้ามใช้ `npm run dev` ตอนจะให้คนนอกเข้า ต้องเป็น production build เท่านั้น

## ข้อกำหนดก่อนเริ่ม

- DB ต้องรันอยู่แล้ว (`npx prisma dev` — ดู `DEV-START.md` ข้อ 2)
- `.env` ต้องมี `SESSION_SECRET` ตั้งไว้แล้ว (ดูคอมเมนต์ใน `.env` — ไม่ตั้งไว้ ระบบปฏิเสธทุก request ตอน production)
- **ผู้ทดสอบแต่ละคนต้องมีบัญชี login ของตัวเอง** (ระบบนี้เป็น login รายคน ไม่ใช่รหัสผ่านเดียวใช้ร่วมกันแบบเดิมอีกต่อไป) สร้างให้ก่อนส่งลิงก์:

  ```powershell
  node -e "const c=require('crypto');const s=c.randomBytes(16);const h=c.pbkdf2Sync(process.argv[1],s,100000,32,'sha256');console.log('100000$'+s.toString('base64')+'$'+h.toString('base64'))" "รหัสผ่านที่ต้องการ"
  npx prisma studio
  ```

  แล้วเปิดตาราง `User` เพิ่มแถวใหม่ (`username`, `displayName`, `passwordHash` = ค่าที่ได้จากคำสั่งแรก — **ห้ามแตะช่อง `id` ปล่อยให้สร้างอัตโนมัติ** ไม่งั้น login ได้แต่ audit trail จะไม่ขึ้นชื่อ) — รายละเอียดเพิ่มเติมดูหัวข้อ "การเพิ่มผู้ใช้" ใน `docs/DEPLOY.md`
- ngrok ต้อง login (authtoken) ไว้แล้วในเครื่องนี้ (เช็คแล้วมีอยู่ ไม่ต้องตั้งใหม่)

## เปิด

**1. ปิด `npm run dev` เดิมถ้ามีรันอยู่** (กินพอร์ต 3000 ซ้ำกับ production ไม่ได้)

หา terminal ที่รันอยู่แล้วกด `Ctrl+C` — ถ้าหาไม่เจอ ใช้ PowerShell (ไม่ต้อง admin):

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

**2. Build**

```powershell
npm run build
```

**3. เปิด production server** (ปล่อยหน้าต่างนี้ค้างไว้)

```powershell
npm run start
```

**4. เปิด terminal ใหม่อีกบาน เปิด ngrok** (ปล่อยหน้าต่างนี้ค้างไว้เช่นกัน)

```powershell
ngrok http 3000
```

ปกติจะได้โดเมนเดิมกลับมาทุกครั้ง (จองไว้ในบัญชีแล้ว): **`https://jokingly-gills-antler.ngrok-free.dev`** — เช็คลิงก์ปัจจุบันได้จากหน้าจอ ngrok เอง หรือเปิด `http://127.0.0.1:4040` ในเบราว์เซอร์

**5. ส่งให้คนทดสอบ**

- ลิงก์: `https://jokingly-gills-antler.ngrok-free.dev`
- Username / Password: ของบัญชีที่สร้างให้แต่ละคนไว้ในขั้นตอน "ข้อกำหนดก่อนเริ่ม" ด้านบน (คนละบัญชีคนละรหัส ไม่ใช่ค่าเดียวที่ทุกคนใช้ร่วมกัน)

## ปิด

ปิดจากบนลงล่าง (ลำดับไม่สำคัญมาก แต่ทำแบบนี้สะอาดสุด):

1. `Ctrl+C` ที่หน้าต่าง ngrok — ลิงก์สาธารณะใช้ไม่ได้ทันที (เว็บในเครื่อง/วง LAN ยังใช้ได้ปกติ ไม่กระทบ)
2. `Ctrl+C` ที่หน้าต่าง `npm run start`
3. กลับไปทำงานต่อแบบ dev ตามปกติได้เลย: `npm run dev` (ไม่ต้อง build ใหม่)

DB (`npx prisma dev`) ไม่ต้องปิด ปล่อยรันต่อได้ทั้ง dev และ production

## เช็กลิสต์ถ้ามีปัญหา

| อาการ | สาเหตุที่เจอบ่อย | วิธีแก้ |
|---|---|---|
| เปิด `npm run start` แล้ว error พอร์ตชนกัน | มี `npm run dev`/`start` ตัวเก่าเหลือค้างอยู่ | ปิดของเก่าตามขั้นตอนข้อ 1 (เปิด) ก่อน แล้วค่อยรันใหม่ |
| เข้าหน้า `/login` แล้ว username/password ไม่ถูกต้อง | พิมพ์ผิด หรือยังไม่ได้สร้างบัญชีให้คนนี้ | เช็ค/สร้างบัญชีใหม่ผ่าน Prisma Studio ตามขั้นตอน "ข้อกำหนดก่อนเริ่ม" ด้านบน |
| แก้โค้ดแล้วเว็บไม่เปลี่ยน | production build ไม่ auto-reload เหมือน dev | `Ctrl+C` ที่ `npm run start` → `npm run build` ใหม่ → `npm run start` ใหม่ |
| ลิงก์ ngrok ใช้ไม่ได้ทันทีทั้งที่ไม่ได้ปิดอะไร | หน้าต่าง `npm run start` หรือ `ngrok` ถูกปิดไปโดยไม่ตั้งใจ (เช่น เครื่อง sleep/ปิด terminal พลาด) | เปิดใหม่ทั้ง 2 หน้าต่างตามขั้นตอน "เปิด" ข้างบน |
| อยากให้เข้าได้เฉพาะวง LAN ออฟฟิศ ไม่อยากเปิดสู่อินเทอร์เน็ตทั้งหมด | ngrok เปิดออกอินเทอร์เน็ตเสมอ | ใช้ `http://<LAN-IP-เครื่องนี้>:3000` แทน (ต้องอยู่ WiFi เดียวกัน) — แต่เครื่องนี้ยังติดปัญหา Windows Firewall (โปรไฟล์เครือข่าย Public) บล็อกเครื่องอื่นในวง LAN อยู่ ต้องให้ IT เปิดพอร์ต 3000 ให้ก่อนถึงจะใช้ทางนี้ได้ (ดูรายละเอียดใน `SESSION-LOG-2026-08-14.md`) |
