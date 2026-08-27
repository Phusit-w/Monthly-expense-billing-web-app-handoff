# สรุปเซสชัน 2026-08-27 — แก้ฟอร์ม FA017 + เตรียม deploy รอบใหม่ (ยังไม่ได้ขึ้นเซิร์ฟเวอร์)

โปรเจกต์: `expense-billing-app` (Next.js 16 / React 19 / Prisma 7)

เอกสารนี้บันทึกงานที่ทำในเซสชันนี้ + ขั้นตอน deploy ขึ้นเซิร์ฟเวอร์จริงที่ **ยังไม่ได้ลงมือทำ** ไว้กลับมาทำต่อ

---

## ส่วนที่ 1 — งานที่ทำเสร็จแล้ว (commit + push GitHub backup แล้ว)

### 1.1 FA017Form: ตัวเลข/ข้อความยาวในตารางให้ขึ้นบรรทัดใหม่แทนโดนตัด

ไฟล์: `components/FA017Form.tsx`

ช่อง **Project / CC** + 7 ช่องจำนวนเงิน (Gasoline, Hotel, Entertain, Mobile, Transport & Express way, Other, Local Currency Amount) เดิมเป็น `<input>` บรรทัดเดียว ค่าที่ยาวเกินความกว้างคอลัมน์จะโดนตัด/เลื่อนหาย — เปลี่ยนเป็น `<textarea>` โตอัตโนมัติ (แบบเดียวกับช่อง Description ที่มีอยู่แล้ว): ค่าเกินกรอบจะ wrap ขึ้นบรรทัดใหม่ แถวยืดตาม

- กด Enter ในช่องพวกนี้ไม่เพิ่มบรรทัดจริง (กันไว้ด้วย `onKeyDown` preventDefault)
- `inputMode="decimal"` คงคีย์บอร์ดตัวเลขบนมือถือ (แทน `type="number"` ที่ textarea ไม่มี)
- พฤติกรรมตัวเลขคงเดิม: blur แล้ว snap เป็นทศนิยม 2 ตำแหน่ง, focus แล้วเคลียร์ค่า 0
- ช่อง "Thai Baht Total" ทั้งรายแถวและแถว Total รวม เพิ่ม `word-break` ให้ยอดยาวๆ wrap ได้
- ขยาย re-measure ตอนฟอนต์โหลดเสร็จให้ครอบคลุม `textarea.amount-textarea` ด้วย
- เข้ากันได้กับ PDF export: `lib/exportPdf.ts` `replaceFormControlsWithText` รองรับ `<textarea>` อยู่แล้ว (`el.value` + `white-space: pre-wrap; word-break: break-word`)

### 1.2 Project / CC → "เลขที่โครงการ" ตอนสร้างฟอร์มใบรับรองแทนใบเสร็จ

ไฟล์: `components/BillEditor.tsx`, `components/EntryFormFA017.tsx`, `components/EditorToolbar.tsx`

ปุ่ม "สร้างฟอร์มใบรับรองแทนใบเสร็จ →" (มี 2 จุด: จากหน้าฟอร์มจริง `BillEditor` และจากหน้ากรอกแบบ roomy `EntryFormFA017`) — `handleCreateFA018()` เดิม map `projectNo: ""` (ทิ้ง Project/CC) เปลี่ยนเป็น `projectNo: it.projectCC` → ค่า Project/CC ของแต่ละแถวไปลงคอลัมน์ "เลขที่โครงการ" ของ FA018

การ map ตอนนี้: `วันที่ → วันที่`, `Description of Expenses → รายการ`, `Project/CC → เลขที่โครงการ`, `ยอดรวมทุกคอลัมน์ของแถว (fa017RowTotal) → จำนวนเงิน` (Receipt ยังตัดทิ้ง — FA018 ไม่มีช่องนี้) tooltip ปุ่มทั้ง 2 จุดอัปเดตแล้ว

### 1.3 แก้ช่องโหว่ deploy: `npx prisma generate` ขาด

ไฟล์: `package.json`, `docs/DEPLOY-WINDOWS.md`

`lib/generated/prisma/` ถูก `.gitignore` ตัดออก (regeneratable) พอ extract โปรเจกต์ใหม่บนเครื่องที่ไม่เคย generate → `npm run build` พังทันที `Module not found: Can't resolve '@/lib/generated/prisma/client'` (เจอมาแล้วรอบ deploy 2026-08-19 §6)

**แก้:** เพิ่ม `"postinstall": "prisma generate"` ใน `package.json` scripts → `npm ci` จะ generate ให้อัตโนมัติทุกครั้ง (ทดสอบ `prisma generate` รันผ่านสะอาดแล้ว) + เพิ่มโน้ตอธิบายใน `DEPLOY-WINDOWS.md` ข้อ 6

### 1.4 เอา SESSION-LOG-2026-08-19.md เข้า repo

ไฟล์นั้นเดิมลอยอยู่นอก git (untracked) — commit เข้าไปแล้ว (log การ deploy ครั้งแรกขึ้นเซิร์ฟเวอร์ native Windows)

### 1.5 Validation

| คำสั่ง | ผล |
|---|---|
| `npm run build` | ผ่าน (compile + TypeScript + static generation) |
| `npm run lint` | 15 ปัญหา **เดิมทั้งหมด (pre-existing)** ไม่มีเพิ่มจากการแก้รอบนี้ |
| `npm run typecheck` | สะอาด |
| ทดสอบในเบราว์เซอร์ (localhost:3000) | wrapping ทำงาน + Project/CC ไปลงเลขที่โครงการจริง (verified) |

### 1.6 Git

Commit บน branch `main` (ยังไม่ได้ push ขึ้น `origin`):

```
ebcf739  docs: add SESSION-LOG-2026-08-19 (first native Windows server deploy)
9192e47  FA017: wrap long cell values; carry Project/CC into FA018; auto prisma generate
c532fdf  (เดิม/ฐาน) Add per-user login, saved-item reuse polish, deploy docs, and UX audit
```

Remotes:
- `origin` = `https://github.com/Phusit-w/Monthly-expense-billing-web-app-handoff.git` — **ยังไม่ push** (local main นำหน้าอยู่ 2 commit)
- `backup` = `https://github.com/Phusit-w/Billing-web-app-hand-off.git` — **push `main` แล้ว** (อยู่ที่ `ebcf739`) ใช้ URL แบบ HTTPS เพราะเน็ตที่นี่บล็อก SSH (port 22); ครั้งหน้าสำรองซ้ำ: `git push backup main`

---

## ส่วนที่ 2 — ขั้นตอน deploy ขึ้นเซิร์ฟเวอร์ (ยังไม่ได้ทำ — กลับมาทำต่อจากตรงนี้)

**เซิร์ฟเวอร์:** `psaidemo.icn21.local` (`192.168.51.43`), RDP บัญชี `Administrator`
**วิธีที่ใช้:** วิธี B — Windows Service `ExpenseBillingApp` ผ่าน NSSM
**โฟลเดอร์บนเซิร์ฟเวอร์:** `C:\Apps\expense-billing-app-deploy`

### ทำไมข้อมูล user ไม่หายในการอัปเดตรอบนี้

- ข้อมูลทั้งหมด (บิล, พนักงานที่บันทึก, รายการที่บันทึก, บัญชี 9 คน) อยู่ใน PostgreSQL database `expense_billing` — คนละส่วนกับโค้ดแอป
- อัปเดตรอบนี้แก้ 7 ไฟล์ **ไม่มี `prisma/` เลย** → ไม่มี migration ใหม่ → `npx prisma migrate deploy` จะขึ้น "No pending migrations" → ฐานข้อมูลไม่ถูกแตะ
- `.env` บนเซิร์ฟเวอร์ (เก็บ `DATABASE_URL` + `SESSION_SECRET` จริง) ไม่อยู่ใน git → วิธี extract zip ทับไม่โดนไฟล์นี้

### ขั้นตอน (ทำตามลำดับ)

**0. Backup DB ก่อน — ประกันชั้นแรก (ถึงจะไม่แตะ DB ก็ทำ)**
```powershell
cd C:\Apps\expense-billing-app-deploy
.\deploy\windows\backup-postgres.ps1 -DatabaseUrl "postgresql://expense_billing:<รหัสจริง>@localhost:5432/expense_billing"
```
ได้ไฟล์ `.sql` ในโฟลเดอร์ `backups\`

**1. สร้าง zip เวอร์ชันใหม่ (บนเครื่อง dev)**
```powershell
cd "C:\Phusit\Claude Project\Monthly expense-billing web app-handoff\expense-billing-app"
git archive --format=zip -o ..\expense-billing-app-deploy.zip HEAD
```
zip = เฉพาะไฟล์ที่ commit แล้ว (ตรงกับ GitHub `backup`) ไม่มี `.env` / `node_modules` / `.next` / `logs`

**2. ก็อป zip เข้าเซิร์ฟเวอร์ผ่าน RDP → แตก *ทับ* โฟลเดอร์เดิม** `C:\Apps\expense-billing-app-deploy`
แตกทับ = ไฟล์โค้ดถูกเขียนใหม่ แต่ `.env`, `logs\`, `backups\`, `node_modules\`, `.next\` เดิมยังอยู่ครบ (zip ไม่มีของพวกนี้ การแตกทับไม่ลบไฟล์ส่วนเกิน)

**3. หยุด service**
```powershell
nssm stop ExpenseBillingApp
```

**4. Build ใหม่ (ในโฟลเดอร์เซิร์ฟเวอร์)**
```powershell
cd C:\Apps\expense-billing-app-deploy
npm ci                       # postinstall รัน prisma generate ให้เอง (ของใหม่รอบนี้ ข้อ 1.3)
npx prisma migrate deploy    # ต้องขึ้น "No pending migrations" — ปกติ ยืนยันว่า DB ไม่เปลี่ยน
npm run build
.\deploy\windows\stage-standalone.ps1
```

**5. ติดตั้ง service ทับ + สตาร์ท — ใช้ `SESSION_SECRET` ค่าเดิมเท่านั้น**
```powershell
.\deploy\windows\install-service.ps1 -DatabaseUrl "postgresql://expense_billing:<รหัสจริง>@localhost:5432/expense_billing" -SessionSecret "<ค่าเดิมจาก .env>"
```
`install-service.ps1` จะ stop/remove ตัวเก่าแล้วติดตั้งใหม่ทับให้เอง

**6. ตรวจ**
```powershell
Get-Service ExpenseBillingApp     # ต้อง Running
```
เปิด `https://psaidemo.icn21.local` → login ได้, บิลเก่าครบ, ลองของใหม่ (ตัวเลขยาว wrap, Project/CC → เลขที่โครงการ)

### ข้อควรระวัง

- **ห้ามเขียนทับ `.env` บนเซิร์ฟเวอร์** — มี `DATABASE_URL` + `SESSION_SECRET` จริง (วิธีข้างบนไม่โดน แต่ระวังถ้าก็อปด้วยมือ)
- **`SESSION_SECRET` ต้องเป็นค่าเดิม** — เปลี่ยน = ทุกคนถูก logout ต้อง login ใหม่หมด (ไม่ใช่ข้อมูลหาย แต่กวนใจ)
- **`.ps1` ไม่มี UTF-8 BOM** (ดูส่วนที่ 3 ข้อ 1) — ถ้า `install-service.ps1` ขึ้น error `Missing closing '}'` ให้รันคำสั่งเติม BOM ก่อนลองใหม่:
  ```powershell
  Get-ChildItem .\deploy\windows\*.ps1 | ForEach-Object { $c = Get-Content -Raw -Encoding UTF8 $_.FullName; Set-Content $_.FullName -Value $c -Encoding UTF8 }
  ```
- **Downtime** ช่วง restart แค่ไม่กี่วินาที
- **Rollback ถ้าพัง:** DB ไม่เปลี่ยน → แค่เอาโฟลเดอร์โค้ดเก่ากลับมา build ใหม่ + `install-service.ps1` ก็พอ (DB backup จากข้อ 0 เป็นชั้นสำรองสุดท้าย)

---

## ส่วนที่ 3 — สิ่งที่ยังค้าง / follow-up (แนะนำแต่ยังไม่ได้ทำ)

1. **`deploy/windows/*.ps1` ไม่มี UTF-8 BOM** — เช็คแล้วทุกไฟล์ขึ้นต้นด้วย `<#` ไม่ใช่ `EF BB BF` → Windows PowerShell 5.1 parse ข้อความไทย/em-dash ในไฟล์พัง (`install-service.ps1` error `Missing closing '}'`) รอบ 2026-08-19 §7 แก้แค่บนเซิร์ฟเวอร์ปลายทาง ไม่ได้แก้ที่ repo ถ้า deploy เครื่องใหม่/extract ทับจะเจอซ้ำ แก้ครั้งเดียวจบ:
   ```powershell
   Get-ChildItem .\deploy\windows\*.ps1 | ForEach-Object { $c = Get-Content -Raw -Encoding UTF8 $_.FullName; Set-Content $_.FullName -Value $c -Encoding UTF8 }
   ```
   แล้ว commit — (Claude เสนอทำให้แล้ว รอ user ตอบ)

2. **`docs/DEPLOY-WINDOWS.md` ไม่มีหัวข้อ HTTPS/IIS** — ทั้ง IIS + URL Rewrite/ARR + self-signed cert + `x-forwarded-host` serverVariables (2026-08-19 §11–14) เป็นความรู้หน้างานล้วน ยังไม่ได้บันทึกเป็นขั้นตอนถาวร ไม่มี HTTPS → login ใช้ไม่ได้ (Secure cookie)

3. **push `origin`** — local `main` นำหน้า `origin/main` อยู่ 2 commit ยังไม่ได้ `git push origin main` (push แค่ `backup`)

4. เรื่องฝั่งเซิร์ฟเวอร์ค้างจาก 2026-08-19 (ไม่เกี่ยว repo): self-signed cert เตือน trust, firewall พอร์ต 3000 ยังเปิดค้าง, ยังไม่มี Task Scheduler ตั้ง `backup-postgres.ps1` ให้รันประจำ, `displayName` ของ user 9 คน = username, ข้อมูล pilot เดิมบนเครื่อง dev ยังไม่ migrate เข้า production

5. เล็กน้อย: `docs/ux-audit/CURRENT-UI-AUDIT.md` บอกว่า `/bill/new/[type]` "ถูกปิดไปแล้ว" แต่ route ยัง render ได้ (ไม่มี guard) — doc/code ไม่ตรงกัน; console warning `Image with src "/icn-logo.png"...` โผล่ทุกหน้าฟอร์ม (cosmetic, pre-existing)

---

## สถานะปัจจุบัน ณ จบเซสชัน / จุดที่ทำต่อ

- โค้ดแก้เสร็จ + commit + push `backup` เรียบร้อย — **ยังไม่ได้ deploy ขึ้นเซิร์ฟเวอร์**
- เครื่อง dev: `npm run dev` + `pilot-db` (prisma dev) รันค้างอยู่จากเซสชันนี้
- **ทำต่อ:** ทำตามส่วนที่ 2 (deploy) — เริ่มจากข้อ 0 (backup DB) หรือจะจัดการ follow-up ข้อ 1 (BOM) / ข้อ 3 (push origin) ก่อนก็ได้
