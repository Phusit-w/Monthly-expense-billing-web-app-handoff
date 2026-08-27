# บันทึกงานปรับ Design ใหม่ (2026 UI redesign)

เอกสารนี้เป็น **living log** ของงานเปลี่ยนหน้าตา/UI ของ `expense-billing-app` — ทำต่อเนื่องหลายเซสชัน
เริ่ม 2026-08-27 อัปเดตทุกครั้งที่ทำเพิ่ม

---

## เป้าหมาย

เปลี่ยนหน้าตาเป็นสไตล์ modern SaaS ตามที่ออกแบบไว้ใน Claude Design
(ชุด handoff `../../Web app selector UI mockups-handoff/` — artboard Turn 2–6)
**โดยระบบ/ตรรกะเดิมไม่แตะ** (data, server actions, auth, print/PDF, pagination)
และวางโครงให้ **เพิ่มระบบ/แอปอื่นในอนาคตได้ง่าย**

- Plan file (เครื่อง dev): `C:\Users\phusit.w\.claude\plans\melodic-waddling-puzzle.md`
- current-state audit ของเดิม: `docs/ux-audit/CURRENT-UI-AUDIT.md` (+ screenshots)
- Branch: **`redesign/foundation`** (แยกจาก `main`) — **ยังไม่ merge, ยังไม่ deploy**

---

## Decisions ที่เคาะแล้ว (จากการถาม-ตอบกับผู้ใช้)

| เรื่อง | สรุป |
|---|---|
| ระบบ token/สไตล์ | **เปิดใช้ Tailwind v4** (`@import "tailwindcss"` + `@theme` ใน `app/globals.css`) — inline `style={{}}` เดิมอยู่ร่วมกันได้ ทยอยแปลง |
| Login | **Split-panel เรียบ** (พาเนลดำซ้าย + ฟอร์มขาวขวา ปุ่มดำ) — **ไม่มี** mascot/animation (เก็บไว้เป็น polish รอบเสริม) |
| Dashboard | **เลื่อนออก** — การ์ดสถานะอนุมัติ/แจ้งเตือน/กราฟ/แอปที่ใช้ล่าสุด ไม่มี schema รองรับ; ทำตอนมี workflow อนุมัติจริง แล้วค่อยเพิ่ม `/dashboard` ดันเป็น `/` |
| `/` (landing) | **Applications launcher** (การ์ดเลือกเครื่องมือ) — หน้ารายการทั้งหมด (History) ย้ายไป **`/records`** |
| กระดาษ FA017/FA018 | **ไม่แตะ** — ตาราง 1px ดำ A4 1:1 (`FA017Form.tsx`/`FA018Form.tsx` ผูกกับ `lib/pagination.ts` + `lib/exportPdf.ts`) เปลี่ยนแค่ shell/toolbar รอบกระดาษ |
| Mobile/responsive เต็มแอป | ไม่อยู่ในขอบเขต (shell + login ทำ responsive พื้นฐานพอ) |
| Dark mode | ไม่อยู่ในขอบเขต |

---

## สิ่งที่ทำเสร็จ — 6 commit บน `redesign/foundation`

| commit | รอบ | เนื้อหา |
|---|---|---|
| `fe4dd1c` | **1 — ฐานราก + shell + login** | เปิด Tailwind v4 + `@theme` (สี/radius/shadow จาก mockup) · ฟอนต์ Poppins + IBM Plex Sans Thai ผ่าน `next/font` (ถอด Sarabun) · route group `app/(app)/` + `layout.tsx` กลาง · `AppSidebar` (rail ดำ floating 80↔230px hover overlay ไม่ดันเนื้อหา) · `AppTopBar` (breadcrumb + กระดิ่ง + avatar) · `lib/nav.ts` (config array แทน `<Link>` ตายตัว) · `components/icons.tsx` (inline SVG) · `components/ui/{Button,Card,Field}.tsx` · `LoginForm` split-panel (ตรรกะ auth เดิมไม่แตะ) · ลบ `Header.tsx` · `PageShell` โปร่ง · `next.config.ts` `images:{unoptimized:true}` (แก้ log spam โลโก้ standalone ค้างเดิมด้วย) · `public/icn-logo-white.png` + allow-list ใน `proxy.ts` |
| `30d4d05` | **2a — หน้ารายการทั้งหมด** | page header (Poppins) + ปุ่ม action + 4 stat card (คำนวณจาก records จริง) · `RecordsTable` (Card wrapper + segmented filter F-FA-017/F-FA-018) · `ProfileCard` · `components/ui/Modal.tsx` + `ConfirmDialog`/`ConfirmSaveModal`/`ConfirmLogoutModal` เขียนใหม่บน Modal · `Button` เพิ่ม variant `dangerSolid` · `SavedEmployeePicker`/`SavedListManager` |
| `0a262f8` | **2b — หน้ากรอกข้อมูล FA017/FA018** | `EntryEmployeeFields` + `EntryFormFA017` + `EntryFormFA018` เป็น token set (ฟอร์มหนัก 2 ตัวแก้ในที่ ตรรกะ draft/travel-handoff/saved-item ไม่แตะ) |
| `dc288ea` | **3 — คำนวณค่าเดินทาง** | `TravelCalculator` (`/travel`) + `TravelRowCalculatorPanel` (เวอร์ชันย่อในฟอร์ม) — hook / fixed+meter mode / sessionStorage handoff ไม่แตะ |
| `a7149ca` | **4 — toolbar หน้าฟอร์ม** | `EditorToolbar` → white `<Card>` เหนือกระดาษ (ปุ่มบันทึกส้ม, สร้างฟอร์มใบรับรอง lavender) · `BillEditor` ควบคุม "ประจำเดือน" FA018 · **กระดาษ A4 / `@page` / pagination / PDF export ไม่แตะ** |
| `9a3d769` | **5+6 — Applications launcher + ย้าย History** | `app/(app)/page.tsx` = launcher (การ์ด Expense Claim / ใบรับรองแทนใบเสร็จ / คำนวณค่าเดินทาง / รายการทั้งหมด + "ตรวจสอบ SOC — เร็วๆ นี้" disabled) · History → `app/(app)/records/page.tsx` (`/records`) · `BillEditor` `router.push("/")` → `/records` (2 จุด) · `lib/nav.ts` เพิ่ม flag `disabled` ("ตั้งค่า" เป็น placeholder เทา) · `globals.css` ย้าย `a { color }` เข้า `@layer base` (ไม่งั้น `text-ink` บน `<Link>` ที่ทำเป็นปุ่ม/การ์ด แพ้ rule ที่ไม่ layered → ลิงก์เป็นสีน้ำเงิน) · เพิ่ม `ShieldIcon` |

**สถานะ:** ทุกหน้าปรับเป็นสไตล์ใหม่ครบแล้ว — ที่เหลือเป็นของสร้างใหม่ล้วน (ดูหัวข้อถัดไป)

### Validation (ทุก commit)

- `npm run build` ผ่าน · `npm run typecheck` สะอาด
- `npm run lint` — **13 ปัญหา** (baseline เดิม 15; 6 error เดิมทั้งหมดใน `FA017Form`/`FA018Form` `remeasure` — pre-existing; ไฟล์ใหม่ไม่เพิ่มปัญหา บังเอิญเก็บ unused-var เดิมไป 2)
- เช็คในเบราว์เซอร์ทุกหน้า (`/`, `/records`, `/travel`, `/bill/entry/fa017`, `/bill/entry/fa018`, `/bill/new/fa018`, `/login`) — ไม่มี console error / CSP violation / hydration error

---

## ยังไม่ได้ทำ

- **Dashboard จริง** (Turn 2a) — เลื่อนตาม decision ข้างบน ต้องมี:
  - `ExpenseRecord.status` enum (Approved/Pending/Returned) + จุดที่เซ็ต
  - แหล่ง notification
  - aggregation query สำหรับกราฟยอดรายเดือน
  - log การใช้แอป (สำหรับ "แอปที่ใช้ล่าสุด")
  ทำเมื่อมี workflow อนุมัติในระบบจริง แล้วเพิ่ม `/dashboard` → ดันเป็น `/` (launcher ย้ายไป `/apps` หรือเป็น section ใน dashboard)
- **mascot login แบบ animated** (`Login.dc.html`) — polish รอบเสริม; ตอนนี้เป็น split-panel เรียบ
- เมนู "เอกสารเก่า" ใน mockup Turn 6a — ยังไม่ทำ (ความหมายไม่ชัด ไม่มีของจริงรองรับ); ใส่แค่ "ตั้งค่า" เป็น disabled placeholder
- avatar ใน topbar โชว์ "?" ตอนไม่มี session (เฉพาะ dev — prod มี session จริงจะโชว์ initials) — ปรับเป็น fallback icon ได้ถ้าอยาก

---

## วิธีทำต่อครั้งหน้า

### เปิด dev
```powershell
cd "...\expense-billing-app"
npx.cmd prisma dev start pilot-db -P 51218 --shadow-db-port 51219 -d   # ถ้ายังไม่ขึ้น
npm.cmd run dev
```
(ดู `docs/DEV-START.md` — dev ข้าม login อัตโนมัติ)
เช็ก branch: `git checkout redesign/foundation`

**หมายเหตุ dev:** อย่า `rm -rf .next` ตอน `next dev` รันอยู่ — server จะขึ้น "(stale)" ต้อง restart;
`npm run typecheck` แบบ standalone หลังลบ `.next` จะ error `Cannot find name 'LayoutProps'` (Next
gen types หาย) — รัน `npm run build` ก่อน 1 รอบให้มัน regenerate

### token / รูปแบบที่ใช้อยู่
- token อยู่ใน `@theme` ของ `app/globals.css` (`--color-*`, `--radius-*`, `--shadow-*`, `--font-display`/`--font-sans`)
- component กลาง: `components/ui/{Button,Card,Field,Modal}.tsx` · icon: `components/icons.tsx` · nav: `lib/nav.ts`
- ปุ่มใหม่ใช้ `<Button variant=... />` (มี class `ui-btn` ที่ globals.css ยกเว้นจาก rule hover ดำ)
- `<Link>` ที่ทำเป็นปุ่ม/การ์ด **ต้องใส่ `text-ink no-underline`** เอง

### merge + deploy (เมื่อรีวิวผ่าน)
1. `git checkout main && git merge redesign/foundation`
2. **ไม่มี migration** — แตะแค่ frontend + `next.config.ts` + `proxy.ts` (ไม่มี `prisma/`) → DB ไม่เปลี่ยน
3. deploy ตาม `docs/SESSION-LOG-2026-08-27.md` ส่วนที่ 4 (`update.ps1`)
4. **แจ้งผู้ใช้:** `/` เปลี่ยนเป็นหน้า launcher, หน้ารายการทั้งหมดย้ายไป `/records` — bookmark เดิมจะเปลี่ยน
5. ยัง diverge: remote `backup` (`git push backup main --force` ถ้าจะ sync — ค้างจาก session ก่อน)

### ไฟล์ที่แตะทั้งหมดในงานนี้ (`git diff --stat main..redesign/foundation`)
39 ไฟล์ · +2036 / −2034 — สรุป: สร้าง `app/(app)/{layout,page,records/page}.tsx`,
`components/{AppSidebar,AppTopBar,icons}.tsx`, `components/ui/*`, `lib/nav.ts`, `public/icn-logo-white.png`;
ลบ `components/Header.tsx`, `app/page.tsx` (ย้าย); เขียนใหม่/ปรับ component เดิมเกือบทั้งหมด +
`app/globals.css`, `app/layout.tsx`, `next.config.ts`, `proxy.ts`
