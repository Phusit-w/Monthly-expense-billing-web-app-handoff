# สรุปเซสชัน 2026-08-28 — ปรับ hover/press ของปุ่มให้สม่ำเสมอ + เปลี่ยนไอคอนเมนู/launcher ให้ตรงชื่อ

โปรเจกต์: `expense-billing-app` (Next.js 16 / React 19 / Prisma 7) — งานต่อจากการรีดีไซน์ UI 2026 (ดู `docs/REDESIGN-LOG.md`)

เซสชันนี้เป็นงาน polish ล้วน ไม่มี migration ไม่แตะ logic **ยังไม่ได้ commit / push / deploy**

> หมายเหตุ: ระหว่างเซสชันนี้ working tree มีงานค้างของอีกสายหนึ่งอยู่ด้วย (Admin Center / SOC / change-password — ดู `docs/HANDOFF-2026-08-28-ADMIN-SOC-TESTING.md`) เช่น `LoginForm.tsx` มีการแก้ `mustChangePassword` redirect + ตัด brand-panel ที่ **ไม่ใช่ของเซสชันนี้** เซสชันนี้แตะ `LoginForm.tsx` แค่ปุ่มลูกตาบรรทัดเดียว

---

## ส่วนที่ 1 — ปรับสถานะ hover / กดค้าง (`:active`) ของปุ่มให้สอดคล้องกัน

ที่มา: ผู้ใช้ให้ไล่เช็คว่าปุ่มไหน "ก่อน / ระหว่าง / หลัง กดค้าง" สีเพี้ยนหรือต่างจากปุ่มอื่น โดยเฉพาะปุ่มที่ไม่มีการเปลี่ยนสีเลย

### ผลการตรวจ (สรุป)

- `components/ui/Button.tsx`: variant `primary` / `dark` / `dangerSolid` มี `:active` (สีเข้มขึ้นตอนกด) ครบ — แต่ `outline` / `ghost` / `danger` **ไม่มี `:active`** → กดค้างหน้าตาเท่ากับ hover
- **ไม่มี feedback เลยทั้ง hover และ active:** สวิตช์สลับธีม (`ThemeToggle`), ปุ่มลูกตาแสดง/ซ่อนรหัสผ่าน (`LoginForm`)
- **หลุดธีม:** ปุ่ม 💾 บันทึกแถวบนกระดาษ A4 (`FA017Form` / `FA018Form`) เป็น `<button>` ธรรมดา (ไม่ใช่ `.ui-btn`) จึงโดนกฎ global `button:not(.ui-btn):hover` ใน `globals.css:153` เด้งเป็นพื้นดำสนิท `#1c1c1c`
- **วิธี hover แปลกกว่าเพื่อน:** ปุ่ม lavender "สร้างฟอร์มใบรับรองแทนใบเสร็จ →" ใช้ `hover:brightness-95` (ปุ่มเดียวในแอปที่ใช้ filter — หรี่ 5% แทบมองไม่เห็น)

### สิ่งที่แก้

| ไฟล์ | เปลี่ยน |
|---|---|
| `components/ui/Button.tsx` | `outline` + `ghost` เติม `active:bg-line` · `danger` เติม `active:bg-[#8f1e17] active:text-white` (สีเดียวกับ `dangerSolid`) → ทุก variant มีจังหวะกดครบ ครอบปุ่ม outline/danger ~10 ตัว (ย้อนกลับ/ยกเลิก/พิมพ์/ดาวน์โหลด PDF/แก้ไข/ทำซ้ำ/ลบ/ลบแถว/ลบรายการ/ล้างข้อมูลแถวนี้) |
| `components/EditorToolbar.tsx` | ปุ่ม lavender: `hover:brightness-95` → `hover:bg-[#a3abf3] active:bg-[#8f99ee]` (เป็น bg swap เห็นชัด) |
| `components/ThemeToggle.tsx` | เติม `hover:bg-hover hover:border-muted` (เดิม hover ไม่มี feedback) |
| `components/LoginForm.tsx` | ปุ่มลูกตา: เติม `transition-colors hover:text-ink` (เดิมไม่มี feedback) |
| `components/FA017Form.tsx` | ปุ่ม 💾: ลบ `background:"transparent"` ออกจาก `saveIconBtn`, เพิ่ม class `ui-btn rounded-[3px] bg-transparent transition-colors hover:bg-black/5` → เลิกเด้งเป็นดำสนิท เปลี่ยนเป็นเทาจาง (ยังเป็น `.no-print` ไม่อยู่ใน PDF) |
| `components/FA018Form.tsx` | เหมือน FA017Form |

**ไม่แตะ:** `lib/pagination.ts`, `lib/exportPdf.ts`, A4 `.paper`, `@page` · ปุ่ม `ui-btn` เขียนมือน้ำหนักเบา (บันทึกไว้ใช้ซ้ำ, กระดิ่ง, แท็บ segmented) ที่มีแค่ hover — ตกลงกับผู้ใช้ว่าไม่จำเป็น · "+ เพิ่มแถว" vs "− ลบแถว" น้ำหนักไม่เท่ากัน — ไม่แก้

### หมายเหตุ dead code
หลังแก้ปุ่ม 💾 เป็น `.ui-btn` แล้ว กฎ `button:not(:disabled):not(.ui-btn):hover` (`globals.css:153`) **ไม่ match ปุ่มไหนในแอปเลย** (เหมือน `.nav-btn` / `button.btn-danger` ที่คอมเมนต์ระบุไว้ว่า kept-for-completeness) — ปล่อยไว้ได้ ลบตอน cleanup รอบหน้า

---

## ส่วนที่ 2 — เปลี่ยนไอคอนเมนู sidebar + การ์ด launcher ให้ตรงกับชื่อ

ที่มา: ผู้ใช้บอก "รูปไอคอนยังอยู่ไม่ตรง" ของ คำนวณค่าเดินทาง / Expense Claim / ใบรับรองแทนใบเสร็จ / ตรวจสอบ SOC / Admin Center / ตั้งค่า

| รายการ | ไอคอนเดิม | ไอคอนใหม่ | เหตุผล |
|---|---|---|---|
| คำนวณค่าเดินทาง | `CarIcon` (รถ) | `CalculatorIcon` (เครื่องคิดเลข) | "คำนวณ" คือคำหลัก |
| Expense Claim (F-FA-017) | `ReceiptIcon` | `BanknoteIcon` (ธนบัตร) | "เบิกค่าใช้จ่าย" → เงิน (ไอคอนใบเสร็จเดิมดูเหมือนที่คั่นหนังสือ) |
| ใบรับรองแทนใบเสร็จ (F-FA-018) | `FileTextIcon` | `FileCheckIcon` (เอกสาร + ถูก) | "ใบรับรอง" = เอกสารรับรอง |
| ตรวจสอบ SOC | `ShieldIcon` (โล่) | `ClipboardCheckIcon` (คลิปบอร์ด + ถูก) | "ตรวจสอบ" = audit + เลิกใช้โล่ซ้ำกับ Admin |
| Admin Center (adminOnly) | `ShieldIcon` (โล่ ซ้ำ SOC) | `ShieldUserIcon` (โล่ + คน) | สิทธิ์ผู้ดูแล / จัดการผู้ใช้ ไม่ซ้ำใคร |
| ตั้งค่า | `SettingsIcon` (เฟืองครึ่งซีก แหว่ง) | `SettingsIcon` วาดใหม่เป็นเฟืองเต็มวง (Lucide-style) | path เดิมไม่สมบูรณ์ |

### ไฟล์ที่แก้

- `components/icons.tsx` — เพิ่ม 5 ไอคอนใหม่: `CalculatorIcon`, `BanknoteIcon`, `FileCheckIcon`, `ClipboardCheckIcon`, `ShieldUserIcon` · วาด `SettingsIcon` ใหม่ (เฟืองเต็มวง + วงกลมกลาง) · วาด `ReceiptIcon` ใหม่ให้เป็นใบเสร็จชัดขึ้น (ตอนนี้เป็น spare ไม่ถูก import ที่ไหน)
- `lib/nav.ts` — เปลี่ยน `icon:` ของเมนู sidebar 6 รายการ + ปรับ import
- `app/(app)/page.tsx` — เปลี่ยน `icon:` ของการ์ด launcher 4 ใบ (fa017 / fa018 / travel / soc) + ปรับ import

`CarIcon` / `FileTextIcon` / `ShieldIcon` ยังนิยามใน `icons.tsx` แต่ไม่ถูก import แล้ว — ปล่อยเป็น spare เหมือน `HomeIcon` / `UserIcon` เดิม (ไม่กระทบ bundle เพราะ tree-shake)

---

## Validation

| คำสั่ง | ผล |
|---|---|
| `npx tsc --noEmit` | ผ่าน (exit 0) |
| `npx eslint` (ไฟล์ที่แตะ) | ผ่าน ไม่มี unused import ค้าง |
| dev server `localhost:3000` `/login` | 200 คอมไพล์ผ่าน (LoginForm class ใหม่ถูก serve จริง) |
| รูปทรงไอคอน 6 ตัว | ตรวจผ่าน preview แยก (HTML + screenshot) — อ่านออกตรงชื่อทุกตัว |
| `npm run build` | **ยังไม่รัน** — ผู้ใช้ขอตรวจแค่ระดับ dev พอ เพราะทั้งหมดเป็น utility class / SVG path ไม่กระทบ compile/routing/logic |

## สถานะ ณ จบเซสชัน / ทำต่อ

- แก้ 9 ไฟล์ (ปุ่ม 6 + ไอคอน 3) ยังไม่ commit — อยู่ปนกับงานค้างสาย Admin/SOC ใน working tree
- หน้า launcher / sidebar อยู่หลัง auth ยังไม่ได้ดูของจริงในเบราว์เซอร์ (dev ไม่มี login creds ในมือ) — ถ้าจะดู ให้ login เข้า `localhost:3000` แล้วดูแถบซ้าย + หน้า `/`
- ก่อน commit/deploy: รัน `npm run build` ให้ผ่านสักครั้ง แล้วรวมกับงานสาย Admin/SOC
