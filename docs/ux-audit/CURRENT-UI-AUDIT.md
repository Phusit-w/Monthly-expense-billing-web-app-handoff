# ข้อมูลเตรียมสำหรับปรับ UX/UI (Current-State Audit)

สรุปสถานะ UI ปัจจุบันของแอปทั้งหมด เตรียมไว้ล่วงหน้าก่อนเริ่มปรับหน้าตา (2026-08-19) — **ขอบเขต: เปลี่ยนเฉพาะรูปแบบหน้าตา/UI ระบบ (data, forms, actions, print/PDF) ยังใช้ของเดิมทั้งหมด** อาจมีเพิ่มหน้าใหม่ เช่น Dashboard หลัก

ภาพหน้าจอทั้งหมดอยู่ที่ `docs/ux-audit/screenshots/`

---

## 1. Inventory หน้าจอปัจจุบัน

| # | Route | หน้าจอ | Component หลัก | Screenshot |
|---|---|---|---|---|
| 1 | `/login` | เข้าสู่ระบบ | `LoginForm.tsx` | `05-login.jpg` |
| 2 | `/` | History — รายการบิลทั้งหมด + การ์ดข้อมูลพนักงาน | `RecordsTable.tsx`, `ProfileCard.tsx`, `Header.tsx` | `01-history.jpg` |
| 3 | `/bill/entry/fa017` | กรอกข้อมูล Expense Claim (ฟอร์มกรอกง่าย) | `EntryFormFA017.tsx`, `EntryEmployeeFields.tsx`, `TravelRowCalculatorPanel.tsx` | `02-entry-fa017.jpg` |
| 4 | `/bill/entry/fa018` | กรอกข้อมูลใบรับรองแทนใบเสร็จ (ฟอร์มกรอกง่าย) | `EntryFormFA018.tsx` | `03-entry-fa018.jpg` |
| 5 | `/travel` | คำนวณค่าเดินทาง (เครื่องคำนวณแยก ไม่ผูกกับบิล) | `TravelCalculator.tsx` | `04-travel-calculator.jpg` |
| 6 | `/bill/new/[type]`, `/bill/[id]` | บิล/แก้ไขบิล — ตาราง pixel-perfect สำหรับพิมพ์/PDF | `BillEditor.tsx`, `EditorToolbar.tsx`, `FA017Form.tsx`/`FA018Form.tsx` | `06-bill-editor-print-table.jpg` |

**Flow การใช้งานจริง:** History → กด "+ กรอกข้อมูล..." → กรอกในฟอร์มง่าย (`/bill/entry/[type]`) → กด "บันทึก" → เข้าสู่ตาราง pixel-perfect (`/bill/[id]`) เพื่อตรวจ/ปรับ/พิมพ์/ดาวน์โหลด PDF ทางเข้าตรง `/bill/new/[type]` ถูกปิดไปแล้ว (ตั้งใจให้ทุกคนกรอกผ่านฟอร์มง่ายก่อนเสมอ)

**Modal/Dialog ที่ใช้ซ้ำทั่วแอป:** `ConfirmDialog.tsx` (ยืนยันทั่วไป เช่น ลบ), `ConfirmSaveModal.tsx`, `ConfirmLogoutModal.tsx` — ดีไซน์เดียวกันทั้ง 3 ตัว (การ์ดกลางจอ, ปุ่มยกเลิก/ยืนยัน)

---

## 2. Design token ปัจจุบัน (ดึงจากโค้ดจริง — ยังไม่มีไฟล์ theme กลาง)

**สำคัญ:** ไม่มี CSS framework, ไม่มีไฟล์ token กลาง — สีเป็น hex string พิมพ์ซ้ำตรงๆ ใน `style={{}}` ของแต่ละไฟล์เป็นร้อยจุด นี่คือจุดที่ต้องทำเป็น token/theme กลางตอนปรับ UI ใหม่

| การใช้งาน | ค่า |
|---|---|
| สีหลัก (ปุ่ม active, ข้อความหลัก) | `#1c1c1c` |
| พื้นหลังหน้า | `#e7e5e0` |
| พื้นผิวการ์ด/input | `#fff` |
| เส้นขอบ | `#d8d5cc`, `#ccc` |
| สีอันตราย (ลบ) | `#b3261e` |
| ข้อความรอง | `#555`, `#888`, `#999`, `#aaa` |
| Hover/พื้นหลังรอง | `#e3e0d8`, `#f0efe9`, `#faf9f6` |
| หัวตาราง | `#f4f2ec` |
| เตือน (warning) | `#9a6700` |
| ฟอนต์ | Sarabun (`--font-sarabun`) fallback Arial, sans-serif |
| Layout width | Header กว้าง `1280px`, เนื้อหาอื่น (ProfileCard/RecordsTable/EditorToolbar) กว้าง `1160px` แยกกันคนละค่า hardcode อิสระ ไม่ใช้ grid กลาง |
| Spacing/radius | ไม่มีระบบ scale — ค่า px แยกจุด (`padding: "9px 13px"`, `borderRadius: 6/8` ทั่วไป) |

---

## 3. Content/ข้อความในระบบ (สำหรับก็อปไปทำ copy deck)

**Nav หลัก (Header):** รายการทั้งหมด · คำนวณค่าเดินทาง · + กรอกข้อมูล Expense Claim · + กรอกข้อมูลใบรับรองแทนใบเสร็จ · ออกจากระบบ

**History table columns:** ประเภทฟอร์ม · ประจำเดือน · ชื่อพนักงาน · ยอดรวม · แก้ไขล่าสุดโดย · จัดการ (แก้ไข/ทำซ้ำ/ลบ)

**ข้อมูลพนักงาน (ProfileCard + ทุกฟอร์ม):** ชื่อ-นามสกุล · ตำแหน่ง/Position · ฝ่าย/แผนก · Employee No · ปุ่ม "บันทึกไว้ใช้ซ้ำ" / "เลือกรายชื่อที่บันทึกไว้" / "จัดการชื่อที่บันทึกไว้"

**ฟอร์ม FA017 (Expense Claim) รายการค่าใช้จ่าย:** วันที่ · Description of Expenses · Receipt (Yes/No) · Project/CC · Gasoline · Hotel · Entertain · Mobile · Transport & Express way · Other · Local Currency Amount · Thai Baht Total

**ฟอร์ม FA018 (ใบรับรองแทนใบเสร็จ) รายการค่าใช้จ่าย:** วันที่ · รายการ · เลขที่โครงการ · จำนวนเงิน

**Travel calculator:** "คำนวณค่าเดินทางกรณีปฏิบัติงานภายนอกบริษัท" (ตามระเบียบ Cir.HR-076/2022) · ต้นทาง (คงที่: บมจ.อินฟอร์เมชั่น แอนด์ คอมมิวนิเคชั่น เน็ทเวิร์คส) · เลือกจากปลายทางตามประกาศบริษัท / เลือกระยะทางจากปลายทางอื่นๆ · หมายเหตุ 5 ข้อ (นิยามค่าเดินทาง, อัตราตามประกาศ 14 ก.ย. 2565, ไป-กลับวันเดียว, ไม่รวมค่าที่พัก, taxi meter)

**Bill editor toolbar:** + เพิ่มแถว / − ลบแถว · ← ย้อนกลับ · ยกเลิก · พิมพ์/PDF · ดาวน์โหลด PDF · สร้างฟอร์มใบรับรองแทนใบเสร็จ → · บันทึก · จัดการรายการที่บันทึกไว้

**Empty/error states:** "ยังไม่มีรายการ กดปุ่มด้านบนเพื่อสร้างบิลใหม่" · "ไม่พบรายการที่ตรงกับคำค้นหา" · ลบรายการ: "ลบรายการ '...' ใช่หรือไม่? การลบนี้ย้อนกลับไม่ได้"

---

## 4. ข้อจำกัดเชิงเทคนิคที่ต้องรู้ก่อนออกแบบใหม่

1. **`FA017Form.tsx`/`FA018Form.tsx` (ตารางพิมพ์) ต้อง pixel-perfect ตาม A4** — มี logic จัดหน้าอัตโนมัติ (`lib/pagination.ts`) + export PDF (`lib/exportPdf.ts`, ใช้ html2canvas/jsPDF) ผูกกับ layout ตารางตรงนี้แน่น ถ้าจะเปลี่ยนหน้าตาโซนนี้ ต้องเช็ค `lib/pagination.ts` ก่อนว่ากระทบการตัดหน้าไหม — หน้าอื่น (History, ฟอร์มกรอกง่าย, Travel) อิสระกว่ามาก เปลี่ยนได้เต็มที่โดยไม่กระทบ print
2. **ไม่มี responsive/mobile design เลย** — ทุกหน้าใช้ `maxWidth` คงที่ (1160/1280px), ปุ่มบางจุด `whiteSpace: "nowrap"`, ตาราง `RecordsTable`/`FA017Form` ไม่มี scroll container หรือ breakpoint ใดๆ — ถ้าต้องรองรับจอเล็ก ต้องออกแบบใหม่ทั้งหมด ไม่ใช่ปรับแต่ง
3. **สไตล์ทั้งหมดเป็น inline `style={{}}`** ไม่มี CSS Modules/Tailwind/styled-components — เปลี่ยน design token ต้องไล่แก้ทีละไฟล์ (หรือ refactor เป็นระบบ theme กลางก่อน ถ้าต้องการแก้ทีเดียวทั้งแอป)
4. **Header ใช้ query `pathname` เช็ค active state เอง** (`isHistory`/`isTravel`/`isFA017Entry`/`isFA018Entry`) — โครงสร้าง nav แบบนี้เพิ่มหน้าใหม่ (เช่น Dashboard) ได้ไม่ยาก แค่เพิ่ม case
5. **ยังไม่มี automated test / storybook** — ปรับ UI แล้วต้องเช็คด้วยตาในเบราว์เซอร์จริงเท่านั้น (ตาม `AGENTS.md` ของโปรเจกต์)

---

## 5. Pain point ที่สังเกตได้จากโค้ด/หน้าจอ (ยังไม่ได้ถามผู้ใช้จริงเพิ่ม)

- **สี/ระยะห่างไม่รวมศูนย์** — โทนสีเดียวกันแต่พิมพ์ hex ซ้ำหลายร้อยจุด เสี่ยงเพี้ยนทีละนิดเมื่อแก้ไฟล์เดียวไม่ครบทุกจุด
- **ฟอร์มกรอกง่ายกับตารางพิมพ์หน้าตาไม่ match กัน** — ฟอร์ม entry (การ์ดขาวเรียบง่าย) กับ FA017Form/018Form (ตารางเส้นดำ pixel-perfect ตาม design เดิม) เป็นคนละสไตล์ภาพชัดเจน อาจดูเหมือนคนละแอป
- **ไม่มี dashboard/ภาพรวมเชิงสรุป** — มีแต่ตาราง list ดิบ ไม่มีสรุปยอดรวมต่อเดือน/ต่อคน/ต่อแผนก ทั้งที่ข้อมูลใน `ExpenseRecord` รองรับอยู่แล้ว (ดูข้อ 6)
- **ไม่มี mobile support** — ถ้าพนักงานอยากกรอกบิลผ่านมือถือยังทำไม่ได้เลยตอนนี้
- **Login form เรียบมาก** ไม่มี branding/โลโก้ ต่างจากหน้าอื่นที่มีโลโก้ ICN ชัดเจน

---

## 6. ข้อมูลที่มีอยู่แล้วในระบบ — ใช้ทำ Dashboard ได้ (schema `ExpenseRecord`)

ฟิลด์ที่มีพร้อมสำหรับสร้างหน้า Dashboard หลักโดยไม่ต้องแก้ backend:

- `type` (FA017/FA018), `monthName`+`monthYear`, `total` → สรุปยอดรวมต่อเดือน/ต่อประเภทฟอร์มได้ทันที
- `employeeName`, `employeeDepartment`, `employeeOffice` → สรุปยอดต่อคน/ต่อแผนกได้
- `createdByName`/`updatedByName`, `createdAt`/`updatedAt` → กิจกรรมล่าสุด/audit trail บนหน้า dashboard ได้
- `items` (Json) → ถ้าต้องการ breakdown ตามหมวดค่าใช้จ่าย (Gasoline/Hotel/Transport ฯลฯ) ต้อง parse จาก Json นี้ ยังไม่มี aggregation query สำเร็จรูป — ต้องเขียนใหม่ถ้าต้องการกราฟระดับนี้

**ข้อควรรู้:** ตอนนี้ query ทั้งหมดดึง records ทั้งก้อนมา filter/sort ฝั่ง client (จำนวนบิลยังน้อย) — ถ้า dashboard ต้องการ aggregate จำนวนมากขึ้นในอนาคต อาจต้องย้าย logic ไปทำที่ DB แทน

---

## 7. คำถามเปิดที่ควรตัดสินใจก่อนเริ่มดีไซน์

1. ต้องการรองรับจอมือถือ/แท็บเล็ตด้วยไหม หรือยังคง desktop-only ต่อไป?
2. หน้า Dashboard หลักที่จะเพิ่ม อยากเห็นอะไรบ้าง (ยอดรวมต่อเดือน/ต่อแผนก/กิจกรรมล่าสุด/กราฟ breakdown ตามหมวด)? และควรอยู่ที่ path ไหน (แทน `/` เดิม หรือเป็นหน้าใหม่แยก)?
3. ตาราง pixel-perfect (FA017Form/FA018Form) จะคงหน้าตาเดิมทั้งหมดไว้เพื่อพิมพ์/เซ็นกระดาษต่อ หรือจะปรับสไตล์ตรงนี้ด้วย (ต้องระวังผลกับ `lib/pagination.ts`/PDF export)?
4. จะ refactor สไตล์เป็นระบบ token/theme กลางไปพร้อมกันเลยไหม (แก้ทีเดียวทั้งแอปในอนาคตง่ายขึ้น) หรือจะปรับเฉพาะหน้าตาแบบ inline ต่อไปตามของเดิม?
5. หน้า Login จะปรับให้มี branding เพิ่มไหม หรือคงความเรียบง่ายแบบนี้?
