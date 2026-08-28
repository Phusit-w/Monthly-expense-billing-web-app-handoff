# Handoff: Admin roles และ SOC testing

อัปเดตล่าสุด: 2026-08-28 (Asia/Bangkok)

## สิ่งที่ทำเสร็จแล้ว

- เพิ่มระบบตรวจ SOC: Word `.docx` เทียบ Datasheet/Catalog `.pdf`, background worker, หน้าตรวจทาน และส่งออก DOCX
- เพิ่ม role `USER` และ `ADMIN`
- USER เห็น/แก้ไข/ทำสำเนา/ย้ายเข้าถังขยะได้เฉพาะ Expense และ SOC ของตนเอง
- ADMIN เห็นข้อมูลทุกคนและมี Admin Center ที่ `/admin`
- เพิ่มหน้าจัดการผู้ใช้, Audit Log, CSV export, ถังขยะ และ System Status
- เพิ่ม temporary password และบังคับเปลี่ยนรหัสผ่านสำหรับบัญชีที่สร้างใหม่หรือถูก reset
- การปิดบัญชีหรือเปลี่ยน role เพิ่ม `sessionVersion` เพื่อตัด session เดิม
- ป้องกัน Admin ปิดบัญชีหรือลดสิทธิ์ตนเอง และป้องกันไม่ให้ไม่มี active Admin เหลืออยู่
- ถังขยะเก็บ 30 วัน; Audit Log เก็บ 2 ปี
- เพิ่ม Worker heartbeat และงาน cleanup อัตโนมัติ
- Logo ICN ใช้ `/icn-logo-white.png` และแสดงถูกต้องบนหน้า Login/Sidebar
- Prisma migration `20260828112000_add_admin_audit_and_trash` ลงฐานข้อมูลแล้ว

## บัญชีและ role ปัจจุบัน

ADMIN:

- `UserTest` — display name `User` — active

USER (active ทุกบัญชี):

- `phusit.w` — Phusit W.
- `nopphadol.j` — Nopphadol J.
- `yaowarat.s` — Yaowarat S.
- `apisit.t` — Apisit T.
- `naiyana.w` — Naiyana W.
- `chanikarn.s` — Chanikarn S.
- `yada.w` — Yada W.
- `jitkrit.k` — Jitkrit K.

รหัสผ่านเดิมไม่ได้ถูกเปลี่ยนหรือ reset และทุกบัญชีมี `mustChangePassword = false` ณ เวลาที่ตรวจ ห้ามบันทึกรหัสผ่านลงไฟล์นี้

## ผลตรวจทางเทคนิค

- `npx prisma generate` ผ่าน
- `npx tsc --noEmit` ผ่าน
- ESLint สำหรับไฟล์ใหม่/ไฟล์ที่แก้ผ่าน
- `python -m py_compile soc-worker/worker.py` ผ่าน
- Production build ผ่านทุก route
- `npx prisma migrate status` ระบุว่า database schema เป็นเวอร์ชันล่าสุด

## การทดสอบที่เริ่มแล้ว

- เปิด Next.js development server สำเร็จที่ `http://localhost:3000`
- เปิด SOC worker สำเร็จ
- ตรวจหน้า Login ผ่าน Chrome: หน้าแสดง Logo ICN และช่อง Login ถูกต้อง
- ตรวจ `/admin` โดยไม่มี session: ถูก redirect กลับ `/login` ด้วย HTTP 307 ถูกต้อง
- ระหว่างเปิด worker แบบ local แก้ให้ `soc-worker/worker.py` โหลด `.env` เอง และตัด query parameters ของ Prisma ออกจาก PostgreSQL URL ก่อนส่งให้ psycopg

## ขั้นต่อไปในรอบหน้า

1. ตรวจว่า development server และ SOC worker ยังทำงานอยู่หรือไม่; ถ้าไม่ ให้เปิดใหม่:
   - `npm run dev`
   - `npm run soc:worker`
2. ขออนุญาตก่อนกรอกข้อมูลเข้าสู่ระบบใน browser แล้วล็อกอินด้วย `UserTest`
3. ทดสอบ Admin flow:
   - เห็นเมนู Admin Center
   - `/admin`, `/admin/users`, `/admin/activity`, `/admin/trash`, `/admin/system`
   - Worker heartbeat ต้องแสดงสถานะล่าสุด
   - ทดสอบ create/reset/disable user ด้วยบัญชีทดสอบที่ไม่กระทบผู้ใช้จริง และขออนุญาตก่อนทำ mutation
4. ทดสอบ USER flow ด้วยบัญชี USER:
   - ไม่เห็นเมนู Admin Center
   - เข้า `/admin` ไม่ได้
   - เห็นเฉพาะ Expense/SOC ของตนเอง
5. ทดสอบ SOC end-to-end ด้วยไฟล์ทดสอบที่ไม่มีข้อมูลจริง:
   - upload Word SOC + PDF
   - worker ประมวลผล
   - ตรวจทาน/ยืนยันผล
   - ดาวน์โหลด DOCX
   - ตรวจ Audit Log
6. ทดสอบถังขยะและกู้คืนด้วยข้อมูลทดสอบ โดยขออนุญาตก่อนย้ายข้อมูลเข้าถังขยะ
7. ตรวจ browser console/server logs และแก้ runtime error ที่พบ
8. รัน `npx tsc --noEmit`, focused ESLint, Python compile และ production build รอบสุดท้าย
9. เมื่อ UAT ผ่าน จึงวางแผน deploy/restart production; ห้าม deploy โดยไม่ได้รับคำสั่งชัดเจน

## หมายเหตุการเปิดระบบ

- Docker Compose ยังไม่ถูกใช้ในรอบนี้ เพราะ `POSTGRES_PASSWORD` สำหรับ Compose ยังไม่ได้กำหนดใน environment
- ฐานข้อมูล development ที่ใช้อยู่เป็น PostgreSQL บน localhost ตาม `DATABASE_URL` ใน `.env`
- อย่า commit `.env`, รหัสผ่าน, session cookie หรือไฟล์ SOC/Datasheet จริง
