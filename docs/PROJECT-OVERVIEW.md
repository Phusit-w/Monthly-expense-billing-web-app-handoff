# ภาพรวมโปรเจกต์ + สิ่งที่ต้องทำต่อ

สรุปสำหรับดูรวดเร็วว่าแอปนี้ประกอบด้วยอะไรบ้าง และเหลืออะไรที่ต้องตัดสินใจ/ทำต่อ (อัปเดตล่าสุด: 2026-08-17) รายละเอียดเชิงลึกของแต่ละเรื่องดูได้จากไฟล์ที่อ้างถึง

## องค์ประกอบหลักของเว็บแอป

**คืออะไร:** ระบบกรอก/บันทึก/พิมพ์แบบฟอร์มเบิกค่าใช้จ่ายรายเดือน 2 ชนิดของบริษัท ICN — F-FA-017 (Employee Expense Claim) และ F-FA-018 (รายงานค่าใช้จ่ายไม่มีบิล) พอร์ตมาจาก design prototype (`localStorage`) ให้เป็นแอปจริงที่เก็บข้อมูลลง PostgreSQL มีระบบ login รายบุคคลแบบเบา (username/password แยกคน ไม่มีระดับสิทธิ์ต่างกัน — ดูข้อ 7 ด้านล่าง) และการอนุมัติยังเป็นเซ็นชื่อบนกระดาษหลังพิมพ์

**Stack:** Next.js 16 (App Router + Server Actions) + TypeScript, PostgreSQL ผ่าน Prisma ORM 7, ไม่มี CSS framework (สไตล์ inline พอร์ตตรงจาก design source)

**หน้า/ฟีเจอร์หลัก (`app/`, `components/`):**
- **History (`/`)** — ตารางรายการบิลทั้งหมด (`RecordsTable.tsx`) + การ์ด "ข้อมูลพนักงาน" สำหรับ prefill (`ProfileCard.tsx`)
- **กรอกข้อมูล (`/bill/entry/[type]`)** — ฟอร์มกรอกแบบง่าย (`EntryFormFA017.tsx`/`018.tsx`) มีปุ่มคำนวณค่าเดินทางในแถว (`TravelRowCalculatorPanel.tsx`) และระบบ "บันทึกไว้ใช้ซ้ำ" ทั้งชื่อพนักงานและรายการค่าใช้จ่าย
- **บิล/แก้ไขบิล (`/bill/new/[type]`, `/bill/[id]`)** — ฟอร์มแบบตาราง pixel-perfect สำหรับพิมพ์/PDF (`FA017Form.tsx`/`018Form.tsx`, `BillEditor.tsx`) พร้อมระบบจัดหน้า A4 อัตโนมัติ (`lib/pagination.ts`) และ export PDF (`lib/exportPdf.ts`)
- **คำนวณค่าเดินทาง (`/travel`)** — เครื่องคำนวณแยก (`TravelCalculator.tsx`, `lib/useTravelCostCalculator.ts`)

**ข้อมูล (`prisma/schema.prisma`):** `ExpenseRecord` (บิลจริง), `SavedEmployee`/`SavedItem` (รายการที่บันทึกไว้ใช้ซ้ำ ผูกกับคีย์ชื่อ/desc ไม่ชนกันข้ามคน), `EmployeeProfile` (ตารางเดิม เลิกใช้แล้ว — ดูหัวข้อความปลอดภัยด้านล่าง)

**ความปลอดภัย/multi-user (`proxy.ts`, `lib/auth.ts`, `actions/*.ts`):**
- Login รายคน (username/password แยกคน, ไม่มีระดับสิทธิ์ต่างกัน) + rate limiting ต่อ IP — ทำงานเฉพาะตอนรันแบบ production (`npm run start`) เท่านั้น, `npm run dev` ข้ามไปเสมอ ทุกบิลบันทึกไว้ว่าใครสร้าง/แก้ไขล่าสุด (`ExpenseRecord.createdByName`/`updatedByName`) — ดูข้อ 7 ด้านล่างสำหรับที่มา
- แก้ไปแล้ว (2026-08-14): บันทึกบิลใบเดียวกันพร้อมกันไม่ทับกันเงียบๆ อีกต่อไป (optimistic locking ผ่าน `updatedAt`, `actions/records.ts`) และช่อง "ข้อมูลพนักงาน" เลิกบันทึกอัตโนมัติลง DB ที่แชร์กัน เปลี่ยนเป็นจำต่อเบราว์เซอร์ผ่าน cookie แทน (`actions/profile.ts`)

**Deploy/แชร์ให้คนอื่นใช้:**
- Dev บนเครื่อง: `docs/DEV-START.md`
- Deploy จริงถาวร: `docs/DEPLOY.md` (Docker, มี HTTPS) หรือ `docs/DEPLOY-WINDOWS.md` (native, ไม่มี virtualization)
- ให้คนนอกทดลองชั่วคราว: `docs/PILOT-NGROK.md` (production build + ngrok)

## สิ่งที่ต้องทำต่อ

### ควรรู้/ตัดสินใจเร็ว

1. **ข้อมูลระหว่าง pilot อยู่ใน DB ชั่วคราว ไม่มี backup** — ตอนนี้ `.env` ชี้ไปที่ `npx prisma dev` (Postgres ชั่วคราวสำหรับ dev เท่านั้น ไม่ใช่ของจริง) ถ้าเพื่อนร่วมงานกรอกบิลจริงระหว่างทดลองผ่านลิงก์ ngrok ข้อมูลนั้นเสี่ยงหายถ้าเครื่องนี้รีสตาร์ท/ปิด terminal ผิด — ถ้าอยากเก็บข้อมูลที่กรอกช่วง pilot ไว้จริง ต้องย้ายไป deploy จริง (`docs/DEPLOY.md`) ก่อน ไม่ใช่ทดลองบนเครื่องนี้ต่อเนื่องนาน
2. **บัญชี pilot เป็นของชั่วคราว** — ตั้งแต่เปลี่ยนมาใช้ login รายคน (ข้อ 7) ผู้ทดลองแต่ละคนต้องมีบัญชีของตัวเอง (สร้างผ่าน Prisma Studio, ดู `docs/DEPLOY.md`/`docs/PILOT-NGROK.md`) ลบบัญชีที่สร้างไว้สำหรับช่วงทดลองทิ้งหลังทดลองเสร็จ (หรือเปลี่ยนรหัสผ่านถ้าจะใช้บัญชีเดิมต่อจริงจัง) และ `.env`'s `SESSION_SECRET` ที่ใช้ตอนนี้ก็ควรสุ่มค่าใหม่ตอน deploy จริง (เปลี่ยนค่านี้ = ทุกคน login ค้างอยู่หลุดหมดทันที)
3. **ถ้าจะใช้ต่อเนื่องจริงจัง ต้องเลือก deploy path ถาวร** — ตอนนี้รันบนเครื่อง dev ส่วนตัว + ngrok ซึ่งเหมาะกับ "ทดลองชั่วคราว" เท่านั้น (ต้องเปิดเครื่อง+3 terminal ค้างตลอด, ไม่มี backup อัตโนมัติ) ของจริงควรไปทาง Docker บนเซิร์ฟเวอร์บริษัท (`docs/DEPLOY.md`) ซึ่งมี HTTPS + backup รายวันในตัว — ต้องหาเซิร์ฟเวอร์ที่จะรันด้วย (คุยไว้ก่อนหน้าว่า `192.168.99.1` น่าจะใช่เซิร์ฟเวอร์บริษัท แต่ยังไม่ได้ยืนยันกับ IT)

### ไม่เร่งด่วน

4. **อัปเดต session log** — งานที่แก้วันนี้ (bill-edit conflict fix, profile card fix, รูปโลโก้ไม่ขึ้นตอน production, ตั้ง pilot ผ่าน ngrok) ยังไม่ถูกบันทึกใน `docs/SESSION-LOG-2026-08-14.md` ตามธรรมเนียมโปรเจกต์นี้
5. **Windows Firewall บล็อกวง LAN** — ถ้าอยากให้เข้าได้จาก LAN ตรงๆ โดยไม่ผ่าน ngrok (ไม่เปิดสู่อินเทอร์เน็ต) ต้องให้ IT เปิดพอร์ต 3000 ผ่าน Firewall หรือเปลี่ยนโปรไฟล์เครือข่ายเป็น Private (ต้องสิทธิ์ admin ที่เครื่องนี้ไม่มี)
6. ไม่มี automated test ในโปรเจกต์ — การทดสอบที่ทำไปทั้งหมดเป็น manual + ตรวจ SQL โดยตรง ถ้าอยากมี regression test กันบั๊กเดิมกลับมาในอนาคต ต้องตั้ง test framework ก่อน (ยังไม่มีเลยตอนนี้)
7. **(2026-08-17) ทำระบบ login รายคนแล้ว** — เดิมเคยตัดสินใจ "ไม่ทำ" ไว้ (เลือก Basic Auth รหัสเดียวใช้ร่วมกันแทน) แต่กลับมาทำเพราะอยากรู้ว่าใครกรอก/แก้บิลแต่ละใบ (audit trail), กำลังจะย้ายไป deploy จริงถาวรเลยอยากได้ auth ที่เป็นทางการกว่าเดิม, และกังวลความปลอดภัยของรหัสผ่านที่แชร์กันทั้งออฟฟิศ — ทำแบบเบา (username/password แยกคน, **ไม่มี role/สิทธิ์ต่างระดับ**, ไม่มี self-service signup) ไม่ใช่เต็มรูปแบบ เพราะทีมเล็ก (5–20 คน) และยังไม่มีใครต้องการ digital approval workflow (การอนุมัติยังเซ็นกระดาษเหมือนเดิม) รายละเอียด: schema `User` (`prisma/schema.prisma`), การเซ็น/ตรวจ session cookie (`lib/auth.ts`, `lib/session.ts`), login/logout action (`actions/auth.ts`), หน้า `/login` (`app/login/`), การเพิ่มผู้ใช้ผ่าน Prisma Studio (`docs/DEPLOY.md`/`docs/DEPLOY-WINDOWS.md` หัวข้อ "การเพิ่มผู้ใช้") — role/สิทธิ์ต่างระดับและ digital approval workflow ยังเก็บไว้เป็นตัวเลือกอนาคตถ้าวันหนึ่งต้องการจริง ๆ
