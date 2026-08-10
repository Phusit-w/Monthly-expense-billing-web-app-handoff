# ระบบบิลค่าใช้จ่ายรายเดือน (Expense Billing App)

ระบบกรอก/บันทึก/พิมพ์แบบฟอร์มเบิกค่าใช้จ่ายรายเดือน 2 ชนิดของบริษัท ICN:

- **F-FA-018** — รายงานค่าใช้จ่ายไม่มีบิล (ใบรับรองแทนใบเสร็จรับเงิน)
- **F-FA-017** — Employee Expense Claim

พอร์ตมาจาก design prototype ใน `../monthly-expense-billing-web-app/project/ระบบบิลค่าใช้จ่ายรายเดือน.dc.html` ให้เป็นแอปจริง: Next.js (App Router) + PostgreSQL ผ่าน Prisma แทน `localStorage` เดิม ยังไม่มีระบบ login (ตามที่ตกลงกันไว้) และการอนุมัติยังคงเป็นการเซ็นชื่อบนกระดาษหลังพิมพ์ ไม่มี digital approval workflow

## Stack

- Next.js 16 (App Router, Server Actions, TypeScript)
- PostgreSQL + Prisma ORM 7 (driver adapter: `@prisma/adapter-pg`)
- ไม่มี CSS framework แยก — สไตล์พอร์ตมาแบบ inline ตรงจาก design source เพื่อให้ pixel-perfect กับต้นฉบับ

## Dev บนเครื่อง

```bash
npm install
npx prisma dev        # เปิด local Postgres ชั่วคราว (ไม่ต้องมี Docker) — ปล่อยหน้าต่างนี้ทิ้งไว้
```

เปิดอีก terminal:

```bash
npx prisma migrate dev   # สร้าง/อัปเดต schema ครั้งแรก
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

> **หมายเหตุเครื่อง Windows องค์กรนี้:** นโยบาย Application Control ของบริษัทบล็อกไฟล์ native binary ของ SWC (`@next/swc-win32-x64-msvc`) สคริปต์ `dev`/`build` จึงตั้งค่า `--webpack` ไว้ให้แล้วเป็นค่าเริ่มต้น (ใช้ WASM fallback แทน) ถ้าย้ายไปรันบนเครื่อง/เซิร์ฟเวอร์ที่ไม่ติดข้อจำกัดนี้ ก็ยังใช้ได้ปกติ เพียงแต่ build จะช้ากว่าเล็กน้อย

## Deploy จริง (on-prem/intranet)

- **เครื่องที่รองรับ virtualization**: ดู [`docs/DEPLOY.md`](./docs/DEPLOY.md) — รันผ่าน `docker compose up -d --build` (app + postgres + Caddy สำหรับ HTTPS + backup อัตโนมัติ ในตัว)
- **เครื่องที่ virtualization ปิดอยู่ (BIOS)** เช่นกรณี Docker Desktop ขึ้น "Virtualization support not detected": ดู [`docs/DEPLOY-WINDOWS.md`](./docs/DEPLOY-WINDOWS.md) — ติดตั้งแบบ native (PostgreSQL ตรงบน Windows + รันแอปด้วย Node.js ผ่านสคริปต์ใน `deploy/windows/`)

ทั้งสองแบบใช้ HTTP Basic Auth ร่วมกัน (`proxy.ts`, รหัสเดียวใช้ร่วมกันทั้งออฟฟิศ — ไม่มีระบบ login รายบุคคล) ตั้งค่าที่ `AUTH_USERNAME`/`AUTH_PASSWORD`

## โครงสร้างโปรเจกต์

```
app/                    routes (History, สร้างบิลใหม่, แก้ไขบิล)
components/              UI components (forms, header, ตาราง, toolbar)
lib/                     constants, format, totals (คำนวณยอดรวม), types, prisma client
actions/                 Server Actions (profile.ts, records.ts, savedItems.ts)
prisma/                  schema + migrations
proxy.ts                 HTTP Basic Auth + rate limiting (ทุก route)
docs/                    DEPLOY.md (Docker) / DEPLOY-WINDOWS.md (native Windows)
deploy/windows/          สคริปต์ deploy แบบ native Windows (ไม่ใช้ Docker)
Dockerfile, docker-compose.yml, Caddyfile, backup.sh   deploy ผ่าน Docker บนเซิร์ฟเวอร์ภายในองค์กร
```

## หมายเหตุการออกแบบ

ค่าคงที่บางตัวที่ต้นฉบับ (dc.html) เปิดเป็น design-tool props (`rowsFA018`, `rowsFA017`, `showProjectField`, `tableFontSize`) ถูก hardcode ไว้ใน `lib/constants.ts` ตามค่า default เดิม เพราะเป็น prop ของเครื่องมือออกแบบ ไม่ใช่ requirement จากผู้ใช้จริง
