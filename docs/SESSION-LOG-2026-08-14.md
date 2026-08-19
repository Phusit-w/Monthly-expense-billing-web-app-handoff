# สรุปการแก้ไขระบบ — เซสชัน 2026-08-14

โปรเจกต์: `expense-billing-app` (ระบบเบิกค่าใช้จ่ายพนักงานรายเดือน — Next.js 16 / React 19 / Prisma 7)

เอกสารนี้สรุปทุกอย่างที่คุยและแก้ไปในเซสชันนี้ เรียงตามลำดับเวลา เก็บไว้เป็นประวัติอ้างอิง ไม่ใช่คู่มือใช้งาน (คู่มือเปิดเว็บดูที่ `DEV-START.md`)

---

## 1. เปิดเว็บไม่ได้ — PrismaClientKnownRequestError

**ปัญหา:** `prisma.employeeProfile.upsert()` error ตอนเปิดหน้าแรก
**สาเหตุ:** `.env`'s `DATABASE_URL` ชี้ไปพอร์ตเก่าของ `prisma dev` (local ephemeral Postgres) ที่ไม่ได้รันอยู่แล้ว — พอร์ตสุ่มใหม่ทุกครั้งที่ไม่ pin ด้วย `-P`
**วิธีแก้:** รีสตาร์ท `prisma dev` แบบ pin พอร์ต (`-P 51218 --shadow-db-port 51219`) แล้วอัปเดต `.env` ให้ตรง, รีสตาร์ท `npm run dev` ที่ค้าง env เก่า

## 2. คู่มือเปิดเว็บ

สร้าง `docs/DEV-START.md` — ขั้นตอนเปิดเว็บทั้งหมดตั้งแต่เปิดเครื่อง พร้อมตารางแก้ปัญหา

## 3. บั๊กหน้าคำนวณค่าเดินทาง (`/travel`) — "ส่งค่านี้ไปที่ฟอร์ม" ไม่ทำงาน + ข้อมูลแถวหาย

**ปัญหา:** กดปุ่มส่งค่าไปฟอร์มแล้วค่า/ข้อความไม่เข้าแถว แถมข้อความที่เคยพิมพ์ไว้ในแถวก็หายไปด้วย
**สาเหตุ:** React Strict Mode (dev only) รัน mount effect ซ้ำ 2 รอบ — effect ที่ restore ข้อมูลจากฟอร์มเดิม (sessionStorage) รันซ้ำทับ effect ที่เพิ่ง apply ค่าจาก travel calculator เข้าไป
**วิธีแก้:** ใส่ `useRef` guard (ไม่ใช้ `useState` เพราะ ref รอดจาก Strict Mode remount) กันไม่ให้ restore-effect apply ซ้ำ
**ไฟล์:** `components/EntryFormFA017.tsx`, `components/EntryFormFA018.tsx`

## 4. ปุ่ม "สร้างฟอร์ม" สีตอนไม่กด

**คำขอ:** สีตอนยังไม่กด = ขาว, hover = ดำ (ให้ตรงกับ convention ของปุ่มอื่นในแอป)
**วิธีแก้:** เปลี่ยน inline style ปุ่มจาก `background:#1c1c1c` เป็น `background:#fff, color:#1c1c1c` แล้วปล่อยให้ global CSS hover rule (`app/globals.css`) จัดการ hover ให้เอง (มีอยู่แล้ว ใช้ `!important` ครอบทุกปุ่มในแอป)

## 5. ปุ่มคำนวณค่าเดินทางในแต่ละแถว (หน้ากรอกข้อมูล)

**คำขอ:** อยากให้แต่ละแถวในหน้ากรอกข้อมูลมีปุ่มคำนวณค่าเดินทาง คำนวณเสร็จกดวางลงแถวนั้นได้เลย ไม่ต้องไปหน้า `/travel` แยก
**การตัดสินใจ (ถามผู้ใช้):** ทำเฉพาะหน้ากรอกข้อมูล (Entry) และใช้แผงขยายแบบ inline ในหน้า (ไม่ใช้ modal เพราะแอปนี้ไม่มี modal library)
**สิ่งที่สร้าง:**
- `lib/useTravelCostCalculator.ts` — ดึง logic คำนวณจาก `TravelCalculator.tsx` มาเป็น hook กลาง ใช้ร่วมกันได้
- `components/TravelRowCalculatorPanel.tsx` — แผงคำนวณย่อในแต่ละแถว (toggle เปิด/ปิด, ปุ่ม "ใส่ในแถวนี้ →")
- เพิ่มปุ่ม "ล้างข้อมูล" (`btn-danger`) ในแผงนี้ตามคำขอเพิ่มเติม
- ผูกเข้ากับ `EntryFormFA017.tsx` / `EntryFormFA018.tsx` ทุกแถว

## 6. Pagination หน้าใหม่ไม่เต็ม A4 / เกิน A4 (แก้ 3 รอบ)

**รอบ 1 — คำขอเดิม:** พอขึ้นหน้าใหม่ แถวมีแค่ 1 แถว ดูสั้นเกินไป ไม่เต็ม A4
**แก้ครั้งที่ 1:** เพิ่ม step rebalance ใน `lib/pagination.ts` — แต่ scope แคบไป (rebalance เฉพาะตอนที่ step แก้ Total-block เป็นตัวทำให้เกิดหน้าใหม่)
**ผู้ใช้แจ้งว่ายังไม่พอ** → ขยาย condition เป็น rebalance ทุกครั้งที่มีมากกว่า 1 หน้า

**รอบ 2 — Regression:** ผู้ใช้แจ้งว่าตอนนี้กลับกลายเป็นเกิน A4 จริง ๆ (ไม่ใช่แค่ดูสั้น)
**สาเหตุที่แท้จริง (บั๊กเดิมที่ซ่อนมานาน):** `remeasure()` ใน `FA017Form.tsx`/`FA018Form.tsx` วัดระยะห่างจากขอบบนของกล่อง Remark ซึ่งมี CSS margin-collapse ทำให้ระยะ ~8-18px หายไปจากการคำนวณ ทำให้ยัดแถวเกินได้ 1 แถวก่อนจะ overflow จริง
**แก้:** เปลี่ยนจุดวัดเป็นขอบล่างของตารางแถวรายการ (`theadRef.current.closest("table")`) แทนขอบบนของกล่อง Remark ที่มี margin ทะลุ, ลบ `remarkTailRef` ที่ไม่ใช้แล้ว
**ไฟล์:** `components/FA017Form.tsx`, `components/FA018Form.tsx`

## 7. ระบบ Blank Rows เติมเต็มตาราง Expense ให้เท่ากันทุกหน้า A4

**คำขอละเอียด:** ทุกหน้าต้องขนาด A4 เท่ากัน, พื้นที่ตาราง Expense สูงเท่ากันทุกหน้า, ถ้าข้อมูลจริงไม่เต็มพื้นที่ให้เติม blank rows (border/ความสูง/ความกว้างคอลัมน์เหมือนแถวจริง), ห้ามยืดแถวจริงให้เต็ม, Total/Remark/Certification/Signature ต้องอยู่ตำแหน่งเดิมทุกหน้า, ห้ามตัดแถวครึ่งข้ามหน้า, ไม่แก้ font/design เดิมโดยไม่จำเป็น

**การออกแบบ:**
- ลบกลไก rebalance เดิมใน `lib/pagination.ts` (ย้ายแถวจริงข้ามหน้าเพื่อ "สมดุล") ออก เพราะขัดกับตัวอย่างที่ให้มา (หน้า 1 ควรเต็มด้วยข้อมูลจริงก่อนเสมอ)
- เพิ่ม `computeFillerCounts()`/`fillerCountsEqual()` ใน `lib/pagination.ts` — ฟังก์ชัน pure คำนวณว่าแต่ละหน้าควรเติมกี่แถวว่าง จากพื้นที่ที่เหลือจริงกับความสูงแถวว่างที่วัดจาก DOM จริง (ไม่ hardcode)
- แถวว่างใช้ `<textarea readOnly>` ตัวเดียวกับแถวจริง (คอลัมน์ Description/รายการ) — ได้ border/ความกว้าง/ความสูงตรงกับแถวจริงโดยอัตโนมัติ
- วัดความสูงแถวว่าง 1 แถว (probe) จาก DOM จริงทุกครั้ง แล้ว refine จำนวนแถวที่ต้องเติมให้แม่นขึ้นเรื่อย ๆ (converge แบบเดียวกับที่ pagination เดิมทำ)
- หน้าเดียว (ไม่มีการล้น) ไม่ถูกแตะต้องเลย ยังคงพฤติกรรมเดิม
- เพิ่ม `tr { break-inside: avoid }` ใน `app/globals.css` เป็นเซฟตี้เน็ตกันแถวขาดกลางหน้าตอนพิมพ์จริง (ของเดิมมี `@page`, `break-before: page`, `table { break-inside: avoid }`, การจัดกลุ่มข้อมูลลง `.paper` ชัดเจนอยู่แล้วครบตามคำขอ)

**ทดสอบจริงในเบราว์เซอร์:** FA017 (5 หน้า, ไม่เกิน budget), FA018 (2 หน้า, ไม่เกิน budget), ทดสอบ description หลายบรรทัดทำให้แถวโต — จัดหน้าใหม่ถูกต้อง ไม่ล้น, ตรวจตำแหน่ง Remark ตรงกันระหว่างหน้าที่ไม่ใช่หน้าสุดท้าย

**ไฟล์:** `lib/pagination.ts`, `components/FA017Form.tsx`, `components/FA018Form.tsx`, `app/globals.css`

## 8. บั๊ก: พิมพ์ในแถวว่างอัตโนมัติไม่ได้

**ปัญหา (ผู้ใช้แจ้งหลังใช้งานจริง):** แถวที่เติมอัตโนมัติ (ข้อ 7) บางแถวใส่ข้อความไม่ได้
**สาเหตุ:** แถวว่างตั้งใจทำเป็น `readOnly` เพราะไม่ใช่ส่วนหนึ่งของ `draft.items` จริง — เลยพิมพ์ไม่เข้าตามดีไซน์เดิม แต่ใช้งานจริงแล้วเป็นปัญหา (ผู้ใช้คาดหวังว่าคลิกแล้วพิมพ์ได้เหมือนกระดาษจริง)
**วิธีแก้:** ทำ "promote-on-focus" — คลิก/โฟกัสแถวว่างแถวไหนก็ได้ จะเรียก `addRow()` เพิ่มแถวข้อมูลจริงใหม่ (เหมือนกดปุ่ม "+ เพิ่มแถว") แล้วโยน focus ไปแถวใหม่ให้พิมพ์ต่อได้ทันที
**บั๊กเสริมที่เจอระหว่างแก้:** การโปรโมทแถวทำให้ตำแหน่งใน DOM เปลี่ยน 2 รอบ (จากหน้ารวมชั่วคราว → หน้าแยกจริง) แต่ละรอบทำให้ browser เผลอ blur focus ไปที่ `<body>` — แก้ด้วยการ retry focus ทุก commit จนกว่าการจัดหน้าจะนิ่ง แต่จะไม่แย่ง focus ถ้าผู้ใช้ไปคลิกที่อื่นแล้ว (เช็คว่า `document.activeElement === document.body` ก่อนค่อย refocus)
**ทดสอบจริง:** คลิกแถวว่างแถวแรก/กลาง/ท้ายใกล้ Total ทั้ง FA017 และ FA018 — โปรโมทถูกต้อง พิมพ์ได้ focus ไม่หลุด ไม่เกิน A4 budget
**ไฟล์:** `components/BillEditor.tsx`, `components/FA017Form.tsx`, `components/FA018Form.tsx`

---

## สถานะการตรวจสอบล่าสุด

- `npm run typecheck` — ผ่านสะอาด
- `npm run lint` — มี error/warning 6/9 จุด แต่ทั้งหมด**มีอยู่ก่อนเซสชันนี้แล้ว** ในไฟล์ที่ไม่เกี่ยวกับงานที่ทำ (`EntryFormFA017.tsx`, `EntryFormFA018.tsx`, `ProfileCard.tsx`, `actions/savedItems.ts`) และ pattern `remeasure` accessed-before-declared ที่เป็นโครงสร้างเดิมของ `FA017Form.tsx`/`FA018Form.tsx` (ไม่ได้ย้ายตำแหน่งประกาศ แค่เพิ่มโค้ดข้างในฟังก์ชัน) — ยังไม่ได้แก้ ถ้าต้องการให้ไล่แก้ lint เดิมพวกนี้ด้วยแจ้งได้

## รายการไฟล์ที่แก้ทั้งเซสชัน

- `.env` — พอร์ต DB
- `docs/DEV-START.md` — ใหม่
- `components/EntryFormFA017.tsx`, `components/EntryFormFA018.tsx`
- `components/TravelCalculator.tsx`
- `lib/useTravelCostCalculator.ts` — ใหม่
- `components/TravelRowCalculatorPanel.tsx` — ใหม่
- `lib/pagination.ts`
- `components/FA017Form.tsx`, `components/FA018Form.tsx`
- `components/BillEditor.tsx`
- `app/globals.css`

---

# เซสชันที่ 2 (บ่าย-เย็นวันเดียวกัน) — หลายคนใช้งานพร้อมกันไม่ทับกัน + ตั้ง pilot ให้คนนอกทดลอง

หัวข้อหลัก: "ถ้าอยากให้คนอื่นใช้งานเว็บนี้ด้วย มีวิธีไหนบ้าง" นำไปสู่การตรวจสอบและแก้ปัญหา concurrency, เปิด pilot จริงผ่าน ngrok, เจอ+แก้บั๊กที่โผล่มาตอนเปิด production mode, เพิ่มฟีเจอร์ใหม่ 1 อย่าง, และเริ่มคุยเรื่อง deploy ขึ้นเซิร์ฟเวอร์บริษัทจริงกับ IT

## 1. สำรวจตัวเลือก deploy ให้คนอื่นใช้งาน

คุยตัวเลือกทั้งหมด: Docker on-prem (`docs/DEPLOY.md`), native Windows (`docs/DEPLOY-WINDOWS.md`), รันจากเครื่อง dev ชั่วคราว — สรุปว่าของจริงต้องมีเซิร์ฟเวอร์ที่เปิดทิ้งไว้ตลอด ระหว่างรอเซิร์ฟเวอร์จริง ใช้วิธีรันบนแล็ปท็อป dev + ngrok ไปพลางก่อนสำหรับ pilot

ระหว่างคุยเรื่องหาเซิร์ฟเวอร์บริษัท ตรวจสอบ `192.168.99.1` (IP ที่ผู้ใช้สงสัย) ด้วยการ ping + port scan (ไม่ใช่ hack เจาะระบบ แค่เช็คพอร์ตเปิดของเครื่องในเครือข่ายตัวเอง) พบพอร์ต 80/445/3389 เปิด → เดาว่าน่าจะเป็น Windows Server จริงของบริษัท (ยังไม่ยืนยันกับ IT ณ ตอนจบเซสชัน)

## 2. บั๊ก: บันทึกบิลใบเดียวกันพร้อมกันทับกันเงียบๆ (lost update)

**ปัญหา:** `saveRecord` (`actions/records.ts`) เดิมทำ `update` ตรงๆ ไม่เช็คว่ามีคนอื่นแก้ไปก่อนหรือยัง — สองคนเปิดบิลใบเดียวกันมาแก้พร้อมกัน คนบันทึกทีหลังทับข้อมูลคนแรกทั้งแถวแบบไม่มีการเตือน
**วิธีแก้:** เพิ่ม optimistic locking โดยใช้ `updatedAt` ที่มีอยู่แล้วเป็น version token — เปลี่ยนจาก `update` เป็น `updateMany` เช็ค `where: { id, updatedAt: <ค่าตอนโหลดมา> }`, `count === 0` = ชนกัน คืนผลลัพธ์แบบ `{ ok: false, reason: "conflict" }` แทนการ throw
**ฝั่ง UI:** `BillEditor.tsx`'s `handleSave` เจอ conflict แล้วไม่พาออกจากหน้า (ข้อมูลที่พิมพ์ค้างไม่หาย) ขึ้น `window.alert` แจ้งให้โหลดหน้าใหม่ก่อนแก้ต่อ
**ทดสอบจริง:** สร้างบิลทดสอบ ยืนยัน SQL compare-and-swap ทำงานถูกต้อง (บันทึกแรกสำเร็จ `count:1`, บันทึกที่สองด้วยข้อมูลเก่า `count:0` ถูกปฏิเสธถูกต้อง) ลบข้อมูลทดสอบออกแล้ว
**ไฟล์:** `lib/types.ts` (`Draft.updatedAt`), `actions/records.ts`, `components/BillEditor.tsx`, `app/bill/[id]/page.tsx`, `app/bill/new/[type]/page.tsx`, `components/EntryFormFA017.tsx`, `components/EntryFormFA018.tsx` (ทุกจุดที่สร้าง `Draft` ต้องใส่ `updatedAt` เพิ่ม)

## 3. บั๊ก: ช่อง "ข้อมูลพนักงาน" ทับกันข้ามคน

**ปัญหา:** `ProfileCard.tsx` เดิม auto-save ทุกครั้งที่คลิกออกจากช่อง (`onBlur`) ลงแถวเดียวใน DB ที่ทุกคนแชร์กัน (`EmployeeProfile` singleton) — คนพิมพ์ทีหลังทับคนก่อนหน้าแบบไม่รู้ตัว แค่คลิกออกจากช่องก็บันทึกแล้ว
**วิธีแก้ (เลือก "ทางเบา" ไม่ทำระบบ login):** เอา auto-save-on-blur ออกทั้งหมด เปลี่ยนกลไก prefill จาก DB row ที่แชร์กัน เป็น **cookie ต่อเบราว์เซอร์** ที่จำว่าเบราว์เซอร์นี้เลือก/บันทึกชื่อไหนไว้ล่าสุด แล้วดึงข้อมูลจริงจาก `SavedEmployee` (ปลอดภัยอยู่แล้ว unique key = ชื่อ) — จะบันทึกจริงลง DB ก็ต่อเมื่อกดปุ่ม "บันทึกไว้ใช้ซ้ำ" หรือเลือกชื่อจากลิสต์เท่านั้น
**ผลที่เปลี่ยน:** เบราว์เซอร์ที่ไม่เคยกดบันทึก/เลือกชื่อ ช่องจะเริ่มว่างเปล่า (ดีกว่าเดิมที่โชว์ชื่อคนอื่นค้างไว้) พอเลือก/บันทึกครั้งแรก จำได้เองทุกครั้งถัดไป (~400 วัน)
**ทดสอบจริง:** พิมพ์เฉยๆ ไม่กดปุ่ม → reload → หาย (ไม่บันทึก) ✅ / เลือกชื่อจากลิสต์ → reload → จำได้ ✅ / หน้ากรอกฟอร์มก็ prefill ชื่อเดียวกันถูกต้อง ✅
**ไฟล์:** `actions/profile.ts` (เขียนใหม่ทั้งไฟล์ — เอา `updateProfile`/`EmployeeProfile` singleton ออก เพิ่ม cookie-based `getProfile`/`rememberLastEmployee`), `components/ProfileCard.tsx`, `components/EntryFormFA017.tsx`/`EntryFormFA018.tsx` (`selectSavedEmployee` เรียก `rememberLastEmployee` ด้วย), คอมเมนต์ใน `prisma/schema.prisma` อธิบายว่า `EmployeeProfile` เลิกใช้แล้ว (ไม่ได้ลบตาราง ไม่มี migration)

## 4. เปิด production mode ทดสอบจริง → เจอ 2 บั๊กที่ไม่เคยโผล่ตอน dev

**เปลี่ยนจาก `npm run dev` เป็น `npm run build && npm run start`** เพื่อให้ Basic Auth (`proxy.ts`) ทำงานจริง (ก่อนหน้านี้ dev mode ข้าม auth เสมอไม่ว่าตั้งรหัสไว้หรือไม่)

**บั๊ก A — รูปโลโก้ไม่ขึ้น:** `next/image` ทำ internal fetch กลับไปหา `/icn-logo.png` เพื่อ optimize รูป แต่ request ภายในนี้ไม่มี Basic Auth header แนบไปด้วย โดน `proxy.ts` บล็อกเป็น 401 → Next ได้ error กลับมาแทนไฟล์รูป ("The requested resource isn't a valid image") ไม่เจอตอน dev เพราะข้าม auth ทั้งหมด
**วิธีแก้:** เพิ่ม `icn-logo.png` เข้า matcher ที่ยกเว้น Basic Auth ใน `proxy.ts` (เหมือนที่ `_next/static`/`_next/image`/`favicon.ico` ได้รับการยกเว้นอยู่แล้ว) — ตรวจแล้วว่าไม่ใช่ปัญหาจาก `sharp` (native binary) เพราะทดสอบแยกทำงานปกติ
**ไฟล์:** `proxy.ts`

**บั๊ก B — เข้าเว็บได้จากวง LAN ทั้งหมดโดยไม่มีรหัสผ่าน (ตอนยังเป็น dev mode):** เจอระหว่างตรวจสอบว่า dev server bind กับทุก network interface (`::`) และ `proxy.ts` ข้าม auth เสมอตอน dev — ไม่ใช่บั๊กที่ต้องแก้โค้ด แค่ต้องเปลี่ยนมาใช้ production mode เวลาจะให้คนอื่นเข้า (แก้ไปแล้วในข้อ 4 บนสุด)

## 5. ตั้ง pilot ให้คนนอกทดลองผ่าน ngrok

ทดลองให้คนอื่นเข้าผ่าน LAN IP ตรงๆ ก่อน → เจอ Windows Firewall บล็อก (WiFi ของเครื่องนี้เป็นโปรไฟล์ "Public" ไม่มี inbound rule ให้พอร์ต 3000) → ไม่มีสิทธิ์ admin แก้ Firewall เองไม่ได้ → เปลี่ยนไปใช้ **ngrok** แทน (เชื่อมต่อขาออกอย่างเดียว ไม่ต้องมี admin, มี authtoken ผูกไว้ในเครื่องนี้อยู่แล้ว, ได้โดเมนจองไว้เดิมกลับมา: `jokingly-gills-antler.ngrok-free.dev`)

ทดสอบยืนยันครบ: ไม่ใส่รหัส → 401, ใส่รหัสถูก → 200, โลโก้ขึ้นถูกต้อง

**เอกสารใหม่:** `docs/PILOT-NGROK.md` (วิธีเปิด/ปิดทั้งหมด + เช็กลิสต์แก้ปัญหา)

## 6. ฟีเจอร์ใหม่: ปุ่ม "สร้างฟอร์มใบรับรองแทนใบเสร็จ" ในฟอร์ม FA017 ที่สร้างแล้ว

**คำขอ:** อยากให้กดปุ่มสร้างฟอร์ม FA018 จากฟอร์ม FA017 ที่สร้าง/บันทึกไปแล้วได้เลย (ไม่ใช่แค่ตอนกรอกข้อมูลครั้งแรกในหน้า entry ซึ่งมีปุ่มนี้อยู่แล้ว)
**สิ่งที่ทำ:** เพิ่มปุ่มในทูลบาร์ของ `BillEditor.tsx` (ข้าง "ดาวน์โหลด PDF") แสดงเฉพาะตอนดู FA017 เท่านั้น — กดแล้ว map ข้อมูล (วันที่/Description/Local Currency Amount + ข้อมูลพนักงาน) ไปสร้างเป็น draft FA018 ใหม่ในหน้าเดียวกันทันที (เหมือน pattern ที่ `EntryFormFA017.tsx`'s `handleCreateFA018` มีอยู่แล้ว) — ตั้งใจให้ `id: null` เสมอ แม้ FA017 ต้นทางจะบันทึกไปแล้วก็ตาม เพื่อไม่ให้กด "บันทึก" แล้วไปทับบิล FA017 เดิมโดยไม่ได้ตั้งใจ
**ทดสอบจริง:** กรอกข้อมูลทดสอบในฟอร์ม FA017 → กดปุ่ม → สลับเป็นฟอร์ม FA018 ถูกต้อง ข้อมูลแม็ปมาครบ ปุ่มหายไปเองหลังสลับ (เพราะตอนนี้เป็น FA018 แล้ว) ทดสอบผ่าน temporary dev server แยกพอร์ต (3001) ไม่กระทบ pilot จริงที่รันอยู่
**ไฟล์:** `components/BillEditor.tsx`, `components/EditorToolbar.tsx`
**Deploy แล้ว:** build + restart production เข้า pilot จริงเรียบร้อย

## 7. เอกสารสรุปเพิ่มเติมที่สร้างไว้

- `docs/PROJECT-OVERVIEW.md` — องค์ประกอบหลักของแอป + สิ่งที่ต้องทำต่อ (ข้อมูล pilot อยู่ใน DB ชั่วคราวไม่มี backup, รหัส pilot ต้อง rotate, ต้องเลือก deploy path ถาวร ฯลฯ)
- `docs/ARCHITECTURE.md` — โครงสร้าง frontend/backend/database (ทั้งหมดอยู่ใน Next.js process เดียว ไม่ใช่ 2 เซิร์ฟเวอร์แยก) + ขั้นตอนย้ายไปเซิร์ฟเวอร์บริษัทจริง

## 8. เริ่มคุยกับ IT เรื่องเซิร์ฟเวอร์จริง (ยังไม่เสร็จ ณ จบเซสชัน)

IT แจ้งว่าจะเตรียมเซิร์ฟเวอร์ (WS) แยกต่างหากให้ ไม่ใช้ Docker — ใช้ **Apache** เป็น reverse proxy แทน (คู่กับ native Windows deploy path, `docs/DEPLOY-WINDOWS.md`)

ให้คำแนะนำไปแล้ว (ยังไม่ได้ลงมือทำจริง เพราะเซิร์ฟเวอร์เป็นเครื่องของ IT ไม่ใช่เครื่องนี้):
- จัดการ PostgreSQL: แนะนำ pgAdmin (ติดมากับตัวติดตั้ง PostgreSQL for Windows อยู่แล้ว) + `psql` สำหรับ backup/restore ตามที่ `docs/DEPLOY-WINDOWS.md` เตรียมสคริปต์ไว้แล้ว
- Apache reverse proxy: ให้ตัวอย่าง config (`mod_proxy`/`mod_proxy_http`/`mod_ssl`, `ProxyPass`/`ProxyPassReverse` ไปที่ `http://127.0.0.1:3000/`)
- ชี้จุดสำคัญ: สคริปต์ deploy ปัจจุบัน (`deploy/windows/run-loop.ps1`, `install-service.ps1`) ตั้ง `HOSTNAME=0.0.0.0` ให้แอปฟังทุก interface — ถ้าใช้ Apache ทำ HTTPS ด้านหน้า ต้องเปลี่ยนเป็น `127.0.0.1` (เฉพาะเครื่องตัวเอง) ไม่งั้นคนจะเข้าพอร์ต 3000 ตรงๆ แบบไม่ผ่าน Apache/HTTPS ได้ — **ยังไม่ได้แก้สคริปต์จริง** เสนอไว้ว่าจะแก้ให้ รอผู้ใช้ยืนยัน
- เสนอเพิ่มหัวข้อ "ใช้ Apache เป็น reverse proxy" ใน `docs/DEPLOY-WINDOWS.md` — **ยังไม่ได้เขียน** รอผู้ใช้ยืนยัน

---

## สถานะการตรวจสอบล่าสุด (เซสชันที่ 2)

- `npm run typecheck` — ผ่านสะอาดทุกครั้งที่แก้
- `npm run lint` — error/warning เท่าเดิมกับ baseline เดิม (6/9 จุด) ไม่มีจุดใหม่จากงานเซสชันนี้
- `npm run build` — ผ่านทุกครั้ง, deploy เข้า production จริงแล้ว 2 รอบ (รอบแรกตอนเปิด pilot, รอบสองตอนเพิ่มปุ่ม FA018)

## รายการไฟล์ที่แก้ทั้งเซสชันที่ 2

- `lib/types.ts` — `Draft.updatedAt`
- `actions/records.ts` — optimistic locking
- `components/BillEditor.tsx` — จัดการ conflict ตอนบันทึก + ปุ่ม/handler สร้าง FA018
- `app/bill/[id]/page.tsx`, `app/bill/new/[type]/page.tsx` — ส่ง `updatedAt` เข้า `Draft`
- `actions/profile.ts` — เขียนใหม่ทั้งไฟล์ (cookie-based แทน shared singleton)
- `components/ProfileCard.tsx` — เอา auto-save-on-blur ออก
- `components/EntryFormFA017.tsx`, `components/EntryFormFA018.tsx` — `updatedAt` ใน `Draft` + `rememberLastEmployee`
- `prisma/schema.prisma` — คอมเมนต์อธิบาย `EmployeeProfile` เลิกใช้ (ไม่มี migration)
- `proxy.ts` — ยกเว้น `icn-logo.png` จาก Basic Auth
- `components/EditorToolbar.tsx` — ปุ่ม "สร้างฟอร์มใบรับรองแทนใบเสร็จ"
- `docs/PILOT-NGROK.md`, `docs/PROJECT-OVERVIEW.md`, `docs/ARCHITECTURE.md` — เอกสารใหม่

## สิ่งที่ยังค้างอยู่ ณ จบเซสชัน

1. ยังไม่ยืนยันกับ IT ว่าเซิร์ฟเวอร์ไหนใช้ได้จริง (`192.168.99.1` เป็นแค่ข้อสงสัยจากการเช็คพอร์ต ไม่ได้ยืนยันแล้ว) — ล่าสุด IT แจ้งจะเตรียม WS แยกให้ ใช้ Apache แทน Docker
2. รหัสผ่าน pilot (`pilot`/`Qtt4kVoG189O` ใน `.env`) เป็นของชั่วคราว ต้อง rotate/ลบทิ้งหลังทดลองเสร็จ
3. ข้อมูลที่กรอกช่วง pilot อยู่ใน DB ชั่วคราว (`npx prisma dev`) ไม่มี backup — ถ้าอยากเก็บต้อง export/import ไปเซิร์ฟเวอร์จริงตอนย้าย
4. สคริปต์ `deploy/windows/*.ps1` ยังตั้ง `HOSTNAME=0.0.0.0` — ต้องแก้เป็น `127.0.0.1` ก่อนใช้งานจริงร่วมกับ Apache reverse proxy (เสนอไว้แล้ว รอยืนยัน)
5. `docs/DEPLOY-WINDOWS.md` ยังไม่มีหัวข้อ Apache reverse proxy โดยเฉพาะ (เสนอไว้แล้ว รอยืนยัน)
6. ไม่มี automated test ในโปรเจกต์ — การทดสอบทั้งหมดที่ทำไปเป็น manual + ตรวจ SQL โดยตรง
