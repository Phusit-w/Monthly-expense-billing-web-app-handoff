# สรุปการ Deploy ขึ้นเซิร์ฟเวอร์จริง — เซสชัน 2026-08-19

โปรเจกต์: `expense-billing-app` (ระบบเบิกค่าใช้จ่ายพนักงานรายเดือน — Next.js 16 / React 19 / Prisma 7)

เอกสารนี้บันทึกขั้นตอนทั้งหมดของการย้ายแอปจากเครื่อง dev ไปรันบนเซิร์ฟเวอร์บริษัทจริงเป็นครั้งแรก ตั้งแต่ได้ IP เซิร์ฟเวอร์จนถึง login ผ่าน HTTPS ได้สำเร็จ เรียงตามลำดับเวลา เก็บไว้เป็นประวัติอ้างอิง/แก้ปัญหาซ้ำในอนาคต — ไม่ใช่คู่มือ deploy (คู่มือดูที่ `docs/DEPLOY-WINDOWS.md`)

**เซิร์ฟเวอร์เป้าหมาย:** `192.168.51.43` / hostname `psaidemo.icn21.local` — Windows Server ที่รันเป็น VM บน Hyper-V host อีกที (ไม่ใช่เครื่องจริง), เข้าถึงผ่าน RDP ด้วยบัญชี `Administrator` (มีสิทธิ์ admin เต็ม), ต่อเน็ตออกได้

---

## 1. เลือกเส้นทาง deploy — native Windows ไม่ใช่ Docker

**เหตุผล:** เช็คแล้วเซิร์ฟเวอร์นี้ไม่รองรับ nested virtualization (เป็น Hyper-V guest, `systeminfo` ไม่โชว์ราย ละเอียด VT-x/AMD-V เพราะตรวจจับ hypervisor ที่ครอบอยู่แทน) — Docker Desktop รันไม่ได้ ต้องเปิด nested virtualization จากฝั่ง Hyper-V host ก่อนซึ่งต้องให้ IT ทำ ไม่ใช่สิ่งที่ทำจากใน RDP session ได้เอง
**ตัดสินใจ:** ใช้ `docs/DEPLOY-WINDOWS.md` (native, ไม่ใช้ Docker) — วิธี B (มี admin → ติดตั้งเป็น Windows Service จริงผ่าน NSSM แทน run-loop.ps1)

## 2. เตรียมไฟล์โปรเจกต์แบบสะอาด

สร้าง zip จาก **git commit ล่าสุด** (`git archive --format=zip -o ... HEAD`) แทนการ copy ทั้งโฟลเดอร์ดิบ — ตัด `node_modules/`, `.next/`, `.git/`, `.env`, `logs/`, `backups/` ออกอัตโนมัติเพราะเป็นไฟล์ที่ไม่ได้ถูก track/ถูก gitignore ไว้อยู่แล้ว ส่งเข้าเซิร์ฟเวอร์ผ่าน RDP clipboard/drive redirection

**หมายเหตุ:** Extract แล้วโฟลเดอร์ได้ชื่อ `C:\Apps\expense-billing-app-deploy` (ตามชื่อไฟล์ zip) ไม่ใช่ `C:\Apps\expense-billing-app` ตามแผนเดิม — ไม่กระทบอะไร ใช้ path นี้ตลอดการ deploy

## 3. ติดตั้ง prerequisites: Node.js 24 + PostgreSQL 16

ทั้งสองตัวไม่มีอยู่บนเซิร์ฟเวอร์เลยตอนเริ่ม (เช็คด้วย `node -v`/`psql --version` แล้วไม่เจอ) ดาวน์โหลด installer ตรงจาก nodejs.org และ postgresql.org บนเซิร์ฟเวอร์เอง (ต่อเน็ตได้) แล้วรันแบบ GUI installer ปกติ

**จุดติดขัดเล็กน้อย:** รันคำสั่งเช็คเวอร์ชันใน **Command Prompt (cmd.exe)** แทน **PowerShell** ตอนแรก ทำให้ syntax error — ต้องสลับไปเปิด PowerShell จริง

**ผลลัพธ์:** `node -v` → `v24.19.0`, `psql --version` → `16.15`

## 4. สร้าง Database + User

PostgreSQL installer ไม่เพิ่ม `psql` เข้า PATH อัตโนมัติ ต้องเรียกด้วย full path (`C:\Program Files\PostgreSQL\16\bin\psql.exe`) ในตอนแรก แล้วเพิ่มเข้า PATH ถาวรด้วย `[Environment]::SetEnvironmentVariable(...,"Machine")` เพื่อความสะดวกในอนาคต (ใช้ `psql`/`pg_dump` อีกหลายรอบสำหรับ backup)

สร้าง `CREATE USER expense_billing ...` / `CREATE DATABASE expense_billing OWNER expense_billing` สำเร็จ

**ข้อควรระวังที่เจอ:** รหัสผ่านที่ตั้งให้ DB user มีอักขระ `@` อยู่ในตัว ซึ่งเป็นตัวคั่นพิเศษใน connection string format (`user:password@host`) — ต้อง URL-encode เป็น `%40` ใน `DATABASE_URL` ไม่งั้น connection string parse ผิดแบบเงียบๆ

## 5. ติดตั้ง dependencies + ตั้งค่า `.env`

```
npm ci        # 522 packages ผ่านปกติ ไม่มี error
Copy-Item .env.production.example .env
```

ตั้ง `DATABASE_URL` (พร้อม `%40` แทน `@` ตามข้อ 4) และ `SESSION_SECRET` (สุ่มใหม่ด้วย `crypto.randomBytes(32)` ตามเอกสาร — **ไม่ใช้ค่าจากเครื่อง dev**)

## 6. Migration ผ่านฉลุย, Build พังรอบแรก — ขาด `npx prisma generate`

`npx prisma migrate deploy` สำเร็จ สร้างตารางครบทั้ง 6 migration ไม่มีปัญหา

`npm run build` **พังทันที**: `Module not found: Can't resolve '@/lib/generated/prisma/client'`

**สาเหตุ (ช่องโหว่ในเอกสาร `docs/DEPLOY-WINDOWS.md`):** `prisma/schema.prisma` กำหนด custom generator output (`../lib/generated/prisma`) ซึ่งเป็นโฟลเดอร์ที่ `.gitignore` ตัดออกโดยตั้งใจ (generated code ปกติ) — บนเครื่อง dev โฟลเดอร์นี้มีอยู่แล้วจากการรันมาก่อนหน้า เลยไม่มีใครสังเกตว่าเอกสาร deploy ไม่เคยมีขั้นตอน `npx prisma generate` เลยสักที่ พอ extract โปรเจกต์ใหม่บนเครื่องที่ไม่เคย generate มาก่อนจะพังทันที

**วิธีแก้:** รัน `npx prisma generate` ก่อน `npm run build` — build ผ่านสำเร็จหลังจากนั้น (compile, typecheck, static generation ผ่านหมด)

**Follow-up ที่ควรทำ:** เพิ่มขั้นตอน `npx prisma generate` เข้าไปใน `docs/DEPLOY-WINDOWS.md` ระหว่างขั้น "รัน migration" กับ "Build" — ยังไม่ได้แก้ไฟล์เอกสารจริงในเซสชันนี้

## 7. `stage-standalone.ps1` ผ่านปกติ, `install-service.ps1` parse error — ปัญหา encoding

`stage-standalone.ps1` (copy `.next/static`/`public/` เข้า `.next/standalone/`) รันผ่านไม่มีปัญหา

`install-service.ps1` **error ทันที**: `Missing closing '}' in statement block or type definition` ที่บรรทัดของ `if ($existing) {` — แต่เช็คไฟล์ต้นทางแล้วโครงสร้างวงเล็บถูกต้องสมบูรณ์

**สาเหตุที่แท้จริง:** ไฟล์ `.ps1` เป็น UTF-8 **แบบไม่มี BOM** และมีข้อความไทย + เครื่องหมาย em-dash (`—`) ฝังอยู่ในคอมเมนต์/string (บรรทัด `Description "ระบบบิลค่าใช้จ่ายรายเดือน..."`) — **Windows PowerShell 5.1** (ไม่ใช่ PowerShell 7/pwsh) อ่านไฟล์ `.ps1` ที่ไม่มี BOM โดยใช้ system codepage เดิม (437/1252 ตาม warning ที่เจอตั้งแต่ตอนรัน `psql` ครั้งแรก) แทนที่จะอ่านเป็น UTF-8 ทำให้ multi-byte character ของภาษาไทย/em-dash ถูกตีความผิดจน parser งงว่าวงเล็บไม่ครบ (error message ชี้ไปจุดที่ parser เริ่มสับสน ไม่ใช่จุดที่เสียจริง)

**วิธีแก้:** แปลงไฟล์ `.ps1` ทุกไฟล์ใน `deploy\windows\` ให้มี UTF-8 BOM:
```powershell
Get-ChildItem .\deploy\windows\*.ps1 | ForEach-Object { $content = Get-Content -Raw -Encoding UTF8 $_.FullName; Set-Content -Path $_.FullName -Value $content -Encoding UTF8 }
```
(Windows PowerShell's `-Encoding UTF8` เขียนไฟล์แบบมี BOM เสมอ ต่างจาก PowerShell 7 ที่ต้องระบุ `utf8BOM` ชัดเจน) หลังแปลงแล้วรัน `install-service.ps1` ซ้ำผ่านได้ปกติจนถึงจุดถัดไป

**Follow-up ที่ควรทำ:** พิจารณาบันทึกไฟล์ `.ps1` ในโปรเจกต์ด้วย UTF-8 BOM ตั้งแต่ต้น (หรือหลีกเลี่ยงอักขระไทย/em-dash ใน `.ps1` โดยเฉพาะ) กัน dev/เซิร์ฟเวอร์คนอื่นเจอปัญหาเดิมซ้ำ — ยังไม่ได้แก้ที่ต้นทางในเซสชันนี้ (แก้แค่บนเซิร์ฟเวอร์ปลายทาง)

## 8. ขาด NSSM

`install-service.ps1` รันต่อแล้ว error `nssm.exe not found on PATH` — ดาวน์โหลดจาก nssm.cc, แตก zip, copy `win64\nssm.exe` ไปวางที่ `C:\Windows\System32\` (อยู่ใน PATH อยู่แล้ว ไม่ต้องเปิด terminal ใหม่) รันซ้ำสำเร็จ:

- Service `ExpenseBillingApp` ติดตั้งและ start สำเร็จ (`SERVICE_RUNNING`)
- เปิด firewall พอร์ต 3000 (`New-NetFirewallRule`) — **ภายหลังพบว่าไม่จำเป็น** เพราะ IT เปิด firewall ระดับ network ให้แค่ 80/443/3389 เท่านั้น (ดูข้อ 11) พอร์ต 3000 เข้าได้แค่จากวง LAN เดียวกับเซิร์ฟเวอร์ ไม่ใช่ทางเข้าจริงที่ใช้งานได้กว้าง

## 9. สร้าง user login 9 คน — Prisma Client ที่ generate มาเป็น TypeScript ล้วน ใช้กับ plain `node` ตรงๆ ไม่ได้

ต้องการสร้าง user 9 คนพร้อมกัน (เร็วกว่าทำทีละคนผ่าน Prisma Studio) เขียนสคริปต์ `seed-users.js` เรียก `PrismaClient` จาก `./lib/generated/prisma/client` แบบ `require()` ตรงๆ

**พัง:** `Error: Cannot find module './lib/generated/prisma/client'`

**สาเหตุ:** Prisma 7 generator ตัวนี้ (`provider = "prisma-client"`) output เป็นไฟล์ **`.ts` ล้วน** (`client.ts`, ไม่ใช่ `.js`) — ใน Next.js ไฟล์พวกนี้ถูก Next/webpack compile ให้ตอน build แต่ plain `node script.js` ที่รันแยกนอก Next ไม่มีตัว compile TypeScript ให้เลย `require()` เจอไฟล์ `.ts` ไม่รู้จัก

**วิธีแก้ (เลี่ยงปัญหาทั้งหมด):** เขียน insert ผ่าน `pg` (package ที่แอปมีอยู่แล้ว) เข้าตาราง `"User"` ตรงๆ ด้วย raw SQL แทนที่จะพึ่ง Prisma Client — เช็คชื่อ table/column ที่ถูกต้อง (Prisma ไม่มี `@@map` เลยตารางชื่อ `"User"` ตัวใหญ่ คอลัมน์ `"passwordHash"`/`"displayName"` ต้อง quote) generate `id` เองด้วย `crypto.randomUUID()` (เพราะ `@default(cuid())` เป็น client-side default ของ Prisma เท่านั้น ไม่ใช่ DB-level default — bypass Prisma Client แล้วต้องใส่ค่าเองเสมอ) hash รหัสผ่านด้วย PBKDF2-SHA256 ให้ตรง format เดียวกับ `lib/auth.ts`'s `hashPassword` เป๊ะ (`${iterations}$${saltBase64}$${hashBase64}`)

สร้างสำเร็จครบ 9 คน ลบไฟล์สคริปต์ทิ้งทันทีหลังรัน (มีรหัสผ่านจริงฝังอยู่ในไฟล์)

**Follow-up ที่ควรทำ:** ถ้าต้องสร้าง/แก้ user จำนวนมากอีกในอนาคต วิธี raw `pg` นี้ใช้ซ้ำได้เลย เร็วกว่า Prisma Studio ทีละคนมาก — พิจารณาทำเป็นสคริปต์ถาวรในโปรเจกต์ (เช่น `deploy/windows/seed-users.ps1` หรือคล้ายกัน) แทนการเขียนสดทุกครั้ง

## 10. Login ไม่ผ่าน (เงียบๆ) — Secure cookie ต้องการ HTTPS จริง

หลัง service รันและ user มีครบแล้ว เข้า `http://psaidemo.icn21.local:3000/login` กรอก user/pass กด "เข้าสู่ระบบ" ขึ้น "กำลังเข้าสู่ระบบ" แล้ว**ไม่มีอะไรเกิดขึ้นต่อ** ไม่ error ไม่ redirect

**สาเหตุ:** `lib/session.ts`'s `setSessionCookie` ตั้ง `secure: process.env.NODE_ENV === "production"` — รันแบบ production จริงตามที่ตั้งใจ (ปลอดภัยถูกต้องตามหลักการ) แต่เว็บตอนนั้นยังวิ่งผ่าน **HTTP ธรรมดา** (ไม่มี HTTPS) เลย — browser ปฏิเสธเก็บ Secure cookie เงียบๆ ทันทีที่ไม่ได้มาจาก HTTPS ทำให้ login สำเร็จฝั่ง server จริง แต่ cookie ไม่ถูกเก็บที่ browser เลย middleware เช็ค session ไม่เจอ เด้งกลับ `/login` เงียบๆ

**สรุป:** นี่ไม่ใช่แค่เรื่อง "not secure" warning เฉยๆ แต่เป็นตัวบล็อกการใช้งาน login ทั้งหมด **ต้องทำ HTTPS ให้เสร็จก่อนถึงจะ login ได้จริง** → นำไปสู่ข้อ 11-13

## 11. ตั้ง HTTPS ผ่าน IIS + URL Rewrite + ARR (self-signed certificate)

ไม่มี internal CA (Active Directory Certificate Services) ให้ใช้ → เลือกใช้ **self-signed certificate** ไปก่อน (ยอมรับ browser warning ครั้งแรก เหมาะกับกลุ่มทดลองเล็ก ไม่ใช่ทางถาวรระยะยาวทั้งบริษัท)

**ขั้นตอนที่ทำ:**
1. `Install-WindowsFeature -Name Web-Server -IncludeManagementTools` — ติดตั้ง IIS role
2. ติดตั้ง URL Rewrite Module (iis.net) และ Application Request Routing/ARR (iis.net) แบบ GUI installer
3. เปิด "Enable proxy" ใน ARR (IIS Manager → server node → Application Request Routing Cache → Server Proxy Settings)
4. `New-SelfSignedCertificate -DnsName "psaidemo.icn21.local" -CertStoreLocation "cert:\LocalMachine\My"`
5. ผูก certificate เข้า **Default Web Site** พอร์ต 443 ผ่าน IIS Manager → Bindings → Add (Host name เว้นว่างไว้ — ไม่ต้องใส่เพื่อเลี่ยงต้องตั้ง SNI เพิ่ม)
6. สร้างกฎ Reverse Proxy (URL Rewrite → Add Rule(s) → Reverse Proxy → `localhost:3000`) — ได้ `C:\inetpub\wwwroot\web.config` มี rule ส่งต่อไป `http://localhost:3000/{R:1}`
7. เปิด firewall พอร์ต 443 (`New-NetFirewallRule`)

**จุดติดขัดระหว่างทำ (ทั้งหมดเป็นเรื่องพลาดขั้นตอน/ลืม save ในหน้าต่าง GUI ไม่ใช่บั๊ก):**
- รอบแรก `Get-WebBinding` ไม่มี `https *:443:` เลย (กด Add ใน Bindings dialog แล้วไม่จบขั้นตอนจริง) ต้องทำ Add binding ใหม่อีกรอบให้ครบจนกด OK จริง
- ไม่มี firewall rule "HTTPS" เลย (ลืมรันคำสั่งก่อนไปทดสอบ) ต้องกลับไปรัน `New-NetFirewallRule` จริง
- หาเมนู "Default Web Site" ใน IIS Manager ไม่เจอ — ต้องคลิกขยาย `PS_AI_DEMO` (server node) → `Sites` ก่อนถึงจะเห็น

## 12. `Default Web Site` มีสถานะ `Stopped` — สาเหตุจริงของ `ERR_CONNECTION_TIMED_OUT`

หลังตั้งค่าครบตามข้อ 11 เข้า `https://psaidemo.icn21.local` ยัง `ERR_CONNECTION_TIMED_OUT` เหมือนเดิม แม้ binding/rule/firewall ดูถูกต้องหมด

**วิธีวินิจฉัย:** แยกปัญหาด้วยการรัน `Test-NetConnection -ComputerName localhost -Port 443` **บนเซิร์ฟเวอร์เอง** (ตัดปัญหา network ระหว่างเครื่องออกไปก่อน) → เจอ `Get-Website "Default Web Site"` โชว์ **`State: Stopped`**

**สาเหตุ:** Site หยุดทำงานอยู่ (ไม่แน่ชัดว่าหยุดเองตอนไหน) — ไม่มีอะไรฟังอยู่ที่พอร์ต 443 เลย ไม่ว่า config อื่นจะถูกแค่ไหนก็เชื่อมต่อไม่ได้

**วิธีแก้:** `Start-Website "Default Web Site"` → `Test-NetConnection` ยืนยัน `TcpTestSucceeded: True` ทันที

## 13. IT ยืนยัน firewall ระดับ network — เปิดแค่ 80/443/3389

ระหว่างแก้ปัญหาข้อ 12 ทาง IT แจ้งว่า firewall ระดับ network config ไว้ **Incoming: TCP 80, 443, 3389 เท่านั้น** (Outgoing: Any) — พอร์ตอื่นต้องแจ้งขอเพิ่มเป็นรายพอร์ต

**ผลสรุปสำคัญ:** ยืนยันว่าทางที่เลือก (IIS + HTTPS พอร์ต 443) เป็นทางที่ **ต้องใช้จริง ไม่ใช่แค่ทางเลือกที่ดีกว่า** — พอร์ต 3000 (ที่ service เดิมฟังอยู่) ไม่ได้อยู่ในลิสต์ที่ IT เปิด เข้าได้แค่จากวง LAN เดียวกับเซิร์ฟเวอร์เท่านั้น ไม่ใช่ทางเข้าที่ใช้งานได้จริงข้าม subnet/VPN ไม่ต้องขอ IT เปิดพอร์ตเพิ่มเพราะ 443 อยู่ในลิสต์อยู่แล้ว

## 14. Login ยัง error หลัง HTTPS ใช้ได้แล้ว — Next.js Server Actions ปฏิเสธเพราะ header ไม่ตรง

เข้าเว็บผ่าน `https://psaidemo.icn21.local` ได้แล้ว (โหลดหน้าได้ปกติ) แต่กด "เข้าสู่ระบบ" ขึ้น **"This page couldn't load — A server error occurred"** (digest error code)

**เช็ค log** (`logs\service-err.log`) เจอ:
```
`x-forwarded-host` header with value `localhost:3000` does not match `origin` header with value `psaidemo.icn21.local` from a forwarded Server Actions request. Aborting the action.
```

**สาเหตุ:** Next.js มีกลไกป้องกัน CSRF ในตัวสำหรับ Server Actions — เทียบ header `origin` (browser ส่งมาตาม URL จริงที่เปิด = `psaidemo.icn21.local`) กับ `x-forwarded-host` (ที่ reverse proxy ควรใส่ให้ตรงกับ host ต้นทาง) แต่ ARR ใส่ `x-forwarded-host` เป็น `localhost:3000` (ปลายทางที่มันส่งต่อไป) แทนค่า host ต้นทางจริง เลยไม่ตรงกันและถูกบล็อกทุกครั้ง

**วิธีแก้:**
1. อนุญาต server variable ที่จะใช้ (ระดับ apphost ต้องปลดล็อกก่อน — พบว่า **มีอยู่แล้ว** จากตอนสร้าง Reverse Proxy rule ผ่าน wizard ในข้อ 11):
   ```powershell
   Add-WebConfiguration -Filter "/system.webServer/rewrite/allowedServerVariables" -PSPath "MACHINE/WEBROOT/APPHOST" -Value @{name="HTTP_X_FORWARDED_HOST"}
   Add-WebConfiguration -Filter "/system.webServer/rewrite/allowedServerVariables" -PSPath "MACHINE/WEBROOT/APPHOST" -Value @{name="HTTP_X_FORWARDED_PROTO"}
   ```
2. เพิ่ม `<serverVariables>` เข้าไปในกฎ rewrite เดิม (เขียนทับ `C:\inetpub\wwwroot\web.config` ตรงๆ แทนคลิกผ่าน GUI เพื่อความชัวร์):
   ```xml
   <serverVariables>
       <set name="HTTP_X_FORWARDED_HOST" value="{HTTP_HOST}" />
       <set name="HTTP_X_FORWARDED_PROTO" value="https" />
   </serverVariables>
   ```

ไม่ต้อง restart อะไร IIS อ่าน `web.config` ใหม่ทันที ลอง login อีกครั้ง — **สำเร็จ** เข้าใช้งานได้ปกติผ่าน `https://psaidemo.icn21.local`

---

## สรุปสถานะสุดท้าย ณ จบเซสชัน

- แอปรันเป็น Windows Service (`ExpenseBillingApp`) ผ่าน NSSM บนเซิร์ฟเวอร์ `psaidemo.icn21.local` (`192.168.51.43`), auto-start ตั้งแต่ boot
- PostgreSQL 16 รันเป็น Windows Service แยก, database `expense_billing` มีตารางครบ
- HTTPS ใช้งานได้ผ่าน IIS reverse proxy (self-signed certificate) ที่ `https://psaidemo.icn21.local`
- Login รายบุคคลใช้งานได้จริง มี user 9 คน (`UserTest`, `phusit.w`, `nopphadol.j`, `yaowarat.s`, `apisit.t`, `naiyana.w`, `chanikarn.s`, `yada.w`, `jitkrit.k`)
- Firewall ระดับ network (IT) เปิด 80/443/3389 — ตรงกับสิ่งที่แอปใช้จริง (443)

## สิ่งที่ยังค้างอยู่ ณ จบเซสชัน

1. **Self-signed certificate** — browser จะเตือน "not trusted" ทุกครั้งสำหรับผู้ใช้ใหม่จนกว่าจะกด trust เอง เหมาะกับกลุ่มทดลองเล็กเท่านั้น ถ้าจะใช้งานถาวรทั้งบริษัท ควรคุย IT เรื่องขอ certificate จาก internal CA (ถ้ามี) หรือซื้อจาก public CA (ถ้าจะ expose ออกนอกองค์กร)
2. **ยังไม่ได้ย้ายข้อมูล pilot เดิมจากเครื่อง dev** — บิลที่เคยกรอกทดลองไว้ตอน pilot (ngrok) ยังอยู่ใน DB ชั่วคราวบนเครื่อง dev เท่านั้น ยังไม่ได้ `pg_dump`/`psql` ย้ายเข้าฐานใหม่นี้ ถ้าอยากเก็บต้องทำก่อนเลิกใช้เครื่อง dev
3. **Firewall พอร์ต 3000 บนเซิร์ฟเวอร์ยังเปิดค้างอยู่** — ไม่จำเป็นอีกต่อไปหลังมี HTTPS ผ่าน 443 แล้ว (และ IT ก็ไม่ได้เปิดพอร์ตนี้จาก network ชั้นนอกอยู่แล้ว) แต่ยังเข้าได้ตรงๆ จากวง LAN เดียวกัน (ข้าม HTTPS/Secure cookie ไปเลย) ควรพิจารณาปิด rule นี้ทิ้งเพื่อบังคับให้ทุกคนเข้าทาง HTTPS เท่านั้น
4. **เอกสาร `docs/DEPLOY-WINDOWS.md` มีช่องโหว่ที่ควรแก้ไข** (พบระหว่างเซสชันนี้ ยังไม่ได้แก้ไฟล์จริง):
   - ขาดขั้นตอน `npx prisma generate` ก่อน build (ข้อ 6)
   - ไม่ได้เตือนเรื่อง `.ps1` ต้องมี UTF-8 BOM ถ้ามีอักขระไทย/em-dash ไม่งั้น parse พังบน Windows PowerShell 5.1 (ข้อ 7)
   - ไม่มีหัวข้อ "ตั้ง HTTPS ผ่าน IIS" เลย (ข้อ 11-14 ทั้งหมด) — ตอนนี้เป็นความรู้ที่ได้จากการลองผิดลองถูกหน้างานเท่านั้น ยังไม่ได้บันทึกเป็นเอกสารถาวร
5. **ไม่มีสคริปต์ backup อัตโนมัติตั้งไว้เลยบนเซิร์ฟเวอร์ใหม่นี้** — `deploy\windows\backup-postgres.ps1` มีอยู่แล้วในโปรเจกต์แต่ยังไม่ได้ตั้ง Windows Task Scheduler ให้รันประจำ
6. **`displayName` ของ user ทั้ง 9 คนเท่ากับ `username`** (เช่น `phusit.w`) ยังไม่ได้ปรับเป็นชื่อไทยแสดงผลสวยงามสำหรับช่อง "สร้างโดย/แก้ไขล่าสุดโดย" — แก้ทีหลังผ่าน Prisma Studio ได้ตรงๆ ไม่กระทบ login
