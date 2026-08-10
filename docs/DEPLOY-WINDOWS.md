# การ Deploy บนเซิร์ฟเวอร์ Windows แบบ Native (ไม่ใช้ Docker)

ใช้วิธีนี้แทน `DEPLOY.md` (Docker) เนื่องจากเซิร์ฟเวอร์/เครื่องเป้าหมายไม่รองรับ hardware virtualization (VT-x/AMD-V ปิดอยู่ที่ BIOS) ทำให้ Docker Desktop รันไม่ได้เลยไม่ว่าจะใช้ backend แบบไหน

ไฟล์ Docker (`Dockerfile`, `docker-compose.yml`, `DEPLOY.md`) ยังเก็บไว้เหมือนเดิมในโปรเจกต์ — ถ้า IT เปิด virtualization ให้ในอนาคตก็สลับไปใช้วิธีนั้นได้ทันทีโดยไม่ต้องแก้โค้ด

แนวทาง: รัน PostgreSQL แบบติดตั้งตรงบน Windows + รันแอปด้วย Node.js ตรงๆ มีให้เลือก 2 วิธีตามสิทธิ์ที่มีบนเครื่อง:

| | วิธี A: ไม่มีสิทธิ์ Administrator | วิธี B: มีสิทธิ์ Administrator |
|---|---|---|
| กลไก | `run-loop.ps1` (auto-restart) + shortcut ใน Startup folder (auto-start) | Windows Service จริงผ่าน NSSM |
| เริ่มทำงานตอนไหน | หลัง user account นี้ **login** เข้า Windows | ตั้งแต่ **ก่อน** ใคร login (boot เสร็จก็รันเลย) |
| auto-restart ถ้าแอปล่ม | ✅ (loop script) | ✅ (NSSM) |
| ต้องใช้สิทธิ์ | ไม่ต้อง | ต้อง (สร้าง service ต้อง admin) |
| มองเห็นใน `Get-Service` | ❌ | ✅ |

ถ้าไม่แน่ใจว่ามีสิทธิ์ admin บนเครื่องเป้าหมายไหม ตรวจสอบด้วย:

```powershell
([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

## ขั้นตอนที่ทำเหมือนกันทั้ง 2 วิธี

### สิ่งที่ต้องมีบนเซิร์ฟเวอร์

- [Node.js LTS](https://nodejs.org/) (เวอร์ชันเดียวกับที่ใช้ dev หรือใหม่กว่า)
- [PostgreSQL for Windows](https://www.postgresql.org/download/windows/) — ตัวติดตั้งของ EDB จะลงเป็น Windows Service ให้อัตโนมัติ (ขั้นตอนนี้ต้อง admin เสมอไม่ว่าจะเลือกวิธี A หรือ B ในการรันตัวแอปเอง — ปกติ IT เป็นคนติดตั้ง PostgreSQL ให้ครั้งเดียว)

### 1. เตรียมฐานข้อมูล

เปิด `psql` หรือ pgAdmin ที่มากับตัวติดตั้ง PostgreSQL แล้วสร้าง database + user (เปลี่ยนรหัสผ่านให้ปลอดภัยจริง):

```sql
CREATE USER expense_billing WITH PASSWORD 'ใส่รหัสผ่านที่ปลอดภัย';
CREATE DATABASE expense_billing OWNER expense_billing;
```

### 2. คัดลอกโปรเจกต์ไปยังเซิร์ฟเวอร์

คัดลอกทั้งโฟลเดอร์ `expense-billing-app/` ไปยังเซิร์ฟเวอร์ เช่น `C:\apps\expense-billing-app`

### 3. ติดตั้ง dependencies

```powershell
cd C:\apps\expense-billing-app
npm ci
```

### 4. ตั้งค่า `.env` สำหรับรัน migration

```powershell
Copy-Item .env.production.example .env
notepad .env   # แก้ DATABASE_URL ให้เป็นรหัสผ่านจริงจากขั้นตอนที่ 1, และตั้ง AUTH_USERNAME/AUTH_PASSWORD (รหัสเดียวใช้ร่วมกันทั้งออฟฟิศ, HTTP Basic Auth — ดูคอมเมนต์ใน proxy.ts)
```

`deploy\windows\run-loop.ps1` อ่าน `AUTH_USERNAME`/`AUTH_PASSWORD` จากไฟล์นี้ให้อัตโนมัติถ้าไม่ได้ใส่ `-AuthUsername`/`-AuthPassword` ตอนรัน — แต่ไม่ตั้งไว้เลยสักทาง แอปจะปฏิเสธทุก request ตอนรันจริง (fail closed ไม่ใช่เปิดให้เข้าได้ฟรีๆ)

### 5. รัน migration

```powershell
npx prisma migrate deploy
```

### 6. Build

```powershell
npm run build
```

(สคริปต์ `build` ตั้ง `--webpack` ไว้แล้วเป็นค่าเริ่มต้น เผื่อเครื่องนี้ก็ติด Application Control policy บล็อก native binary ของ SWC เหมือนเครื่อง dev)

### 7. ประกอบไฟล์ standalone ให้พร้อมรัน

```powershell
.\deploy\windows\stage-standalone.ps1
```

คัดลอก `.next/static` และ `public/` เข้าไปใน `.next/standalone/` (จำเป็นเพราะ `next build` ไม่คัดลอกให้เองสองโฟลเดอร์นี้)

จากจุดนี้เลือกวิธี A หรือ B ต่อ

---

## วิธี A: ไม่มีสิทธิ์ Administrator

### 8A. รันด้วย run-loop.ps1

รันแบบ foreground ก่อนเพื่อทดสอบ (Ctrl+C เพื่อหยุด):

```powershell
.\deploy\windows\run-loop.ps1 -DatabaseUrl "postgresql://expense_billing:รหัสผ่านจริง@localhost:5432/expense_billing" -AuthUsername "office" -AuthPassword "รหัสผ่านจริง"
```

หรือถ้าตั้ง `DATABASE_URL`/`AUTH_USERNAME`/`AUTH_PASSWORD` ไว้ใน `.env` แล้ว (ขั้นตอนที่ 4) ไม่ต้องใส่พารามิเตอร์พวกนี้ก็ได้ สคริปต์จะอ่านจากไฟล์นั้นให้เอง

ตรวจว่าเปิดได้จริงที่ `http://localhost:3000` แล้วค่อยกด Ctrl+C ปิด

### 9A. ตั้งให้ auto-start ตอน login

```powershell
.\deploy\windows\install-startup-shortcut.ps1 -DatabaseUrl "postgresql://expense_billing:รหัสผ่านจริง@localhost:5432/expense_billing" -AuthUsername "office" -AuthPassword "รหัสผ่านจริง"
```

สร้าง shortcut ในโฟลเดอร์ Startup ของ user ปัจจุบัน (`shell:startup`) ที่จะรัน `run-loop.ps1` แบบซ่อนหน้าต่างทุกครั้งที่ user นี้ login

**⚠️ ข้อจำกัด**: แอปจะเริ่มทำงาน **ก็ต่อเมื่อ user account นี้ login เข้า Windows แล้วเท่านั้น** ถ้าเซิร์ฟเวอร์ reboot แล้วไม่มีใคร login เลย แอปจะไม่ขึ้นจนกว่าจะมีคน login เข้าบัญชีนี้ (เช่น เปิด RDP เข้าไป login ครั้งหนึ่งแล้วปล่อย session ค้างไว้แบบ disconnect ก็นับว่า login อยู่) ถ้าต้องการให้ทำงานได้ตั้งแต่ก่อน login (เหมือน Service จริง) ต้องใช้วิธี B ซึ่งต้องมีสิทธิ์ admin

### 10A. เริ่มทำงานทันทีโดยไม่ต้อง login ใหม่

```powershell
.\deploy\windows\run-loop.ps1 -DatabaseUrl "postgresql://expense_billing:รหัสผ่านจริง@localhost:5432/expense_billing" -AuthUsername "office" -AuthPassword "รหัสผ่านจริง"
```

รันค้างไว้ใน background (เช่นเปิด PowerShell window แยกทิ้งไว้ หรือใช้ `Start-Process powershell -ArgumentList ...` เพื่อไม่ให้ค้าง terminal ปัจจุบัน)

### หยุด / ถอนการติดตั้ง (วิธี A)

```powershell
.\deploy\windows\stop-run-loop.ps1                # หยุด process ที่กำลังรันอยู่ตอนนี้
.\deploy\windows\uninstall-startup-shortcut.ps1    # เอา shortcut ออกจาก Startup folder (ไม่ auto-start อีกต่อไป)
```

### อัปเดตเวอร์ชันใหม่ (วิธี A)

```powershell
cd C:\apps\expense-billing-app
.\deploy\windows\stop-run-loop.ps1
# คัดลอกโค้ดใหม่ทับ (หรือ git pull)
npm ci
npx prisma migrate deploy
npm run build
.\deploy\windows\stage-standalone.ps1
.\deploy\windows\run-loop.ps1 -DatabaseUrl "postgresql://expense_billing:รหัสผ่านจริง@localhost:5432/expense_billing" -AuthUsername "office" -AuthPassword "รหัสผ่านจริง"
```

---

## วิธี B: มีสิทธิ์ Administrator

### สิ่งที่ต้องมีเพิ่ม

- [NSSM](https://nssm.cc/download) — แตกไฟล์แล้ว copy `nssm.exe` (เลือกตัวที่ตรงสถาปัตยกรรมเครื่อง เช่น `win64`) ไปไว้ในโฟลเดอร์ที่อยู่ใน `PATH` เช่น `C:\Windows\System32` หรือใช้พารามิเตอร์ `-NssmPath` ชี้ path เต็มแทนก็ได้ (หรือถ้ามี Chocolatey: `choco install nssm -y`)

### 8B. ติดตั้งเป็น Windows Service

```powershell
.\deploy\windows\install-service.ps1 -DatabaseUrl "postgresql://expense_billing:รหัสผ่านจริง@localhost:5432/expense_billing" -AuthUsername "office" -AuthPassword "รหัสผ่านจริง"
```

สคริปต์จะ:
- สร้าง service ชื่อ `ExpenseBillingApp` ให้รัน `node server.js` จาก `.next\standalone`
- ตั้งค่า auto-start ตอนบูตเครื่อง (ทำงานได้แม้ไม่มีใคร login)
- เขียน log ไปที่ `logs\service-out.log` / `logs\service-err.log`
- สตาร์ท service ให้ทันที

### 9B. ตรวจสอบ

```powershell
Get-Service ExpenseBillingApp
nssm status ExpenseBillingApp
```

### อัปเดตเวอร์ชันใหม่ (วิธี B)

```powershell
cd C:\apps\expense-billing-app
npm ci
npx prisma migrate deploy
npm run build
.\deploy\windows\stage-standalone.ps1
.\deploy\windows\install-service.ps1 -DatabaseUrl "postgresql://expense_billing:รหัสผ่านจริง@localhost:5432/expense_billing" -AuthUsername "office" -AuthPassword "รหัสผ่านจริง"
```

`install-service.ps1` รันซ้ำได้อย่างปลอดภัย — จะ stop/remove service เดิมแล้วติดตั้งใหม่ทับให้เอง

### หยุด / ถอนการติดตั้ง (วิธี B)

```powershell
nssm stop ExpenseBillingApp             # หยุดชั่วคราว
.\deploy\windows\uninstall-service.ps1   # หยุดและลบ service ออกทั้งหมด
```

---

## เปิดพอร์ต (ถ้าจำเป็น)

ถ้า Windows Firewall เปิดอยู่และต้องให้เครื่องอื่นในองค์กรเข้าถึงได้ (ต้อง admin):

```powershell
New-NetFirewallRule -DisplayName "Expense Billing App" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

เปิด `http://<ip-เครื่องนี้>:3000` จากเครื่องอื่นในวง intranet

## การยืนยันตัวตน (Basic Auth)

ระบบนี้ไม่มีระบบ login รายบุคคล ใช้รหัสผ่านเดียวร่วมกันทั้งออฟฟิศแทน (HTTP Basic Auth, ทำงานใน `proxy.ts`) เบราว์เซอร์จะเด้งกล่องใส่ username/password ก่อนเข้าเว็บได้ — ตั้งค่าที่ `AUTH_USERNAME`/`AUTH_PASSWORD` ในไฟล์ `.env` (ขั้นตอนที่ 4) หรือใส่ผ่าน `-AuthUsername`/`-AuthPassword` ตอนรันสคริปต์ก็ได้ ไม่ตั้งไว้เลยสักทาง แอปจะปฏิเสธทุก request (fail closed)

`proxy.ts` ยังจำกัดจำนวน request ต่อ IP ด้วย (กัน brute-force รหัสผ่าน/สคริปต์ยิงรัวๆ) เกินแล้วตอบ `429` ชั่วคราว

## สำรองข้อมูล (backup)

`deploy\windows\backup-postgres.ps1` ทำให้อัตโนมัติได้ — dump ลงโฟลเดอร์ `backups\` ที่ root โปรเจกต์ ลบไฟล์เก่าเกิน retention ให้เอง:

```powershell
.\deploy\windows\backup-postgres.ps1 -DatabaseUrl "postgresql://expense_billing:รหัสผ่านจริง@localhost:5432/expense_billing"
```

ตั้งให้รันเป็นประจำผ่าน Windows Task Scheduler — ดูตัวอย่างคำสั่งลงทะเบียน (`Register-ScheduledTask`) ใน comment ต้นไฟล์ `backup-postgres.ps1`

หรือสำรองด้วยมือทันทีแบบเดิมก็ได้:

```powershell
$env:PGPASSWORD = "รหัสผ่านจริง"
pg_dump -U expense_billing -h localhost expense_billing > backup-$(Get-Date -Format yyyyMMdd).sql
```

กู้คืน (ไฟล์จากทั้งสองวิธีกู้คืนแบบเดียวกัน):

```powershell
$env:PGPASSWORD = "รหัสผ่านจริง"
psql -U expense_billing -h localhost expense_billing -f backup-YYYYMMDD.sql
```

(`pg_dump`/`psql` มาพร้อมตัวติดตั้ง PostgreSQL อยู่ที่ `C:\Program Files\PostgreSQL\<version>\bin\` — เพิ่มเข้า PATH หรือเรียก full path ก็ได้)

## หมายเหตุ

- ไม่มีระบบ login แยกรายบุคคล ใช้รหัสผ่านเดียวร่วมกันทั้งออฟฟิศแทน (ดูหัวข้อ "การยืนยันตัวตน" ด้านบน) — ใครก็ตามที่รู้รหัสผ่านนี้และเข้าถึงเครือข่ายได้จะกรอก/แก้ไข/ลบข้อมูลได้ทั้งหมดเหมือนกันหมด ไม่มีการแยกสิทธิ์/audit log ควรจำกัดการเข้าถึงระดับเครือข่ายเพิ่มด้วย (intranet only, firewall) เป็นชั้นป้องกันที่สอง
- การเซ็นอนุมัติยังคงเป็นการเซ็นบนกระดาษหลังพิมพ์ออกมา
- **ยังไม่มี HTTPS ให้อัตโนมัติในวิธี native นี้** (ต่างจาก `DEPLOY.md`/Docker ที่มี Caddy ทำให้) — Basic Auth ที่เพิ่งตั้งไว้ส่งรหัสผ่านแบบไม่เข้ารหัส (base64) ถ้าไม่มี HTTPS คั่นกลาง ใครดักแพ็กเก็ตในเครือข่ายได้ก็เห็นรหัสผ่านตรงๆ — ต้องตั้ง reverse proxy เอง (IIS + URL Rewrite/ARR + certificate, หรือ nginx for Windows) ชี้มาที่พอร์ต 3000 — ไม่รวมอยู่ในสคริปต์นี้เพราะแล้วแต่ setup ขององค์กร
- ทั้งวิธี A และ B ทดสอบแล้วจริงว่า build → stage → รันเซิร์ฟเวอร์ → auto-restart เมื่อ process ถูกฆ่า ทำงานถูกต้อง รวมถึงการย้ายสคริปต์ทั้งหมดเข้า `deploy\windows\` ก็ทดสอบ path resolution จริงแล้ว (`stage-standalone.ps1`, `install-service.ps1` ผ่านจนถึงจุดที่ควรจะผ่าน — ล้มเหลวที่ nssm.exe หายไปตามที่คาดไว้, `stop-run-loop.ps1` เจอ/ลบ pid file ที่ตำแหน่งถูกต้อง) ส่วนการติดตั้ง shortcut ใน Startup folder จริง (วิธี A ขั้นตอน 9A) และการสร้าง Windows Service จริงผ่าน NSSM (วิธี B) ยังไม่ได้ทดสอบบนเครื่อง/เซิร์ฟเวอร์เป้าหมายจริง เพราะสภาพแวดล้อมที่พัฒนาไม่มีสิทธิ์ admin และไม่ควรทิ้ง auto-start ถาวรไว้บนเครื่อง dev
