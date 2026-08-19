// Data + calculation for the "คำนวณค่าเดินทางกรณีปฏิบัติงานภายนอกบริษัท"
// page, per ระเบียบ Cir.HR-076/2022. Origin is always the company HQ — see
// TRAVEL_ORIGIN below, used as the fixed "ต้นทาง" display on that page.
export const TRAVEL_ORIGIN = "บมจ.อินฟอร์เมชั่น แอนด์ คอมมิวนิเคชั่น เน็ทเวิร์คส";

// Rates effective from this date "จนกว่าจะมีการเปลี่ยนแปลง" (until changed) —
// shown as a note on the page, not enforced/checked against the current date.
export const RATES_EFFECTIVE_DATE = "14 กันยายน 2565";

// Handoff payload from TravelCalculator ("ส่งไปฟอร์ม") to EntryFormFA017/
// EntryFormFA018: a genuine cross-route navigation (/travel → /bill/entry/
// [type]), unlike EntryFlow's same-tree render swap into BillEditor, so
// sessionStorage is the transport here — there's no shared component tree
// to just pass this through as state. One shared key-builder + payload type
// so neither side can drift from the other's key format/shape.
//
// `desc` only comes along when the amount was looked up from
// FIXED_DESTINATIONS (the "เลือกจากปลายทางตามประกาศบริษัท" tab) — it's the
// literal "เดินทางไป <short name>" text, built once on the calculator side so
// both entry forms don't have to duplicate that string. The taxi-meter tab
// has no single named destination to build a label from, so it still hands
// off amount only and the form-side description is left for the user to
// type, same as before.
export interface PendingTravelEntry {
  amount: number;
  desc?: string;
}

export function pendingTravelEntryKey(type: "FA017" | "FA018"): string {
  return `pendingTravelEntry:${type}`;
}

export interface FixedDestination {
  name: string;
  distanceKm: number;
  price: number;
}

// Pre-priced destinations (ตารางปลายทางที่กำหนดราคาไว้แล้ว), data as of
// RATES_EFFECTIVE_DATE above. Selecting one of these is a flat lookup — no
// taxi-meter calculation involved.
//
// `name` uses the short names (ชื่อย่อแนะนำ) from the company's destination-
// naming announcement, since this list is a search/select UI (see
// TravelCalculator.tsx) and the short form reads faster there. The full
// legal/address name from that same announcement is kept in the trailing
// comment on each line for reference.
export const FIXED_DESTINATIONS: FixedDestination[] = [
  { name: "NT (TOT) สนญ.", distanceKm: 11, price: 95 }, // บมจ. โทรคมนาคมแห่งชาติ สำนักงานใหญ่ (TOT)
  { name: "ชุมสายฯ กรุงเกษม", distanceKm: 22, price: 190 }, // ชุมสายโทรศัพท์กรุงเกษม
  { name: "ชุมสายฯ พระโขนง", distanceKm: 25, price: 215 }, // ชุมสายโทรศัพท์พระโขนง
  { name: "NT (CAT) สนญ.", distanceKm: 13, price: 115 }, // บมจ. โทรคมนาคมแห่งชาติ สำนักงานใหญ่ (CAT)
  { name: "ศูนย์โทรคมฯ บางรัก", distanceKm: 25, price: 215 }, // ศูนย์โทรคมนาคม บางรัก
  { name: "ศูนย์โทรคมฯ นนทบุรี", distanceKm: 14, price: 120 }, // ศูนย์โทรคมนาคม นนทบุรี
  { name: "PEA สนญ.", distanceKm: 12, price: 105 }, // การไฟฟ้าส่วนภูมิภาค สำนักงานใหญ่ ถนนงามวงศ์วาน
  { name: "MEA สนญ.", distanceKm: 23, price: 200 }, // การไฟฟ้านครหลวง สำนักงานใหญ่ คลองเตย
  { name: "MEA เพลินจิต", distanceKm: 26, price: 225 }, // การไฟฟ้านครหลวง สำนักงานเพลินจิต
  { name: "MEA วัดเลียบ", distanceKm: 25, price: 215 }, // การไฟฟ้านครหลวง เขตวัดเลียบ
  { name: "MEA ราษฎร์บูรณะ", distanceKm: 32, price: 275 }, // การไฟฟ้านครหลวง เขตราษฎร์บูรณะ
  { name: "EGAT สนญ. บางกรวย", distanceKm: 18, price: 155 }, // การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย สำนักงานใหญ่ บางกรวย
  { name: "SVOA สนญ. พระราม 3", distanceKm: 27, price: 230 }, // บมจ. เอสวีโอเอ สำนักงานใหญ่ ถนนพระราม 3
  { name: "AIT สนญ. สุทธิสารวินิจฉัย", distanceKm: 12, price: 105 }, // บมจ. แอ็ดวานซ์อินฟอร์เมชั่นเทคโนโลยี สำนักงานใหญ่ ถนนสุทธิสารวินิจฉัย
  { name: "FORTH สนญ. พญาไท", distanceKm: 16, price: 140 }, // บมจ. ฟอร์ท คอร์ปอเรชั่น สำนักงานใหญ่ พญาไท
  { name: "Wire & Wireless ห้วยขวาง", distanceKm: 12, price: 105 }, // บจก. ไวร์เออ แอนด์ ไวร์เลส ห้วยขวาง
  { name: "Nokia คลังสินค้า  บางนา-ตราด", distanceKm: 16, price: 140 }, // คลังสินค้า บจก. โนเกีย (ประเทศไทย) ถนนบางนา-ตราด
  { name: "DBD สนามบินน้ำ", distanceKm: 20, price: 170 }, // กรมพัฒนาธุรกิจการค้า กระทรวงพาณิชย์ (สนามบินน้ำ)
  { name: "สพร.กทม. 2", distanceKm: 16, price: 140 }, // สำนักงานพัฒนาฝีมือแรงงานกรุงเทพมหานคร พื้นที่ 2 (ไอทีสแควร์)
  { name: "สรรพากร กทม. 8", distanceKm: 6, price: 55 }, // สำนักงานสรรพากรพื้นที่กรุงเทพมหานคร 8 (ลาดปลาเค้า)
  { name: "สรรพากร ลาดพร้าว", distanceKm: 5, price: 45 }, // สำนักงานสรรพากรพื้นที่สาขาลาดพร้าว
  { name: "สสค.กทม. 4", distanceKm: 7, price: 60 }, // สำนักงานสวัสดิการและคุ้มครองแรงงานกรุงเทพมหานคร พื้นที่ 4 (อาคารนวพาร์ค)
];

export type VehicleType = "normal" | "large";

export interface TaxiMeterInput {
  distanceKm: number;
  trafficMinutes: number;
  vehicleType: VehicleType;
  viaApp: boolean; // เรียกผ่าน Call center/แอพ
  airportPickup: boolean; // รับที่สนามบิน
}

export interface TaxiMeterBreakdownItem {
  label: string;
  amount: number;
}

export interface TaxiMeterResult {
  total: number;
  breakdown: TaxiMeterBreakdownItem[];
}

// Distance-based tiers past the flat first km, per the DLT (กรมการขนส่งทางบก)
// taxi meter rate structure referenced by Cir.HR-076/2022 (ม.ค. 2566). Each
// tier's `upTo` is the cumulative distance (km) where that rate stops
// applying — e.g. the 6.50 บาท/กม. tier covers the km *span* from 1 to 10
// (9 km), not "10 km at 6.50".
const TIERS: { upTo: number; rate: number }[] = [
  { upTo: 10, rate: 6.5 },
  { upTo: 20, rate: 7.0 },
  { upTo: 40, rate: 8.0 },
  { upTo: 60, rate: 8.5 },
  { upTo: 80, rate: 9.0 },
  { upTo: Infinity, rate: 10.5 },
];

const FLAT_FIRST_KM = { normal: 35, large: 40 } as const;
const TRAFFIC_RATE_PER_MIN = 3;
const VIA_APP_SURCHARGE = 20;
const AIRPORT_SURCHARGE = 50;

// Taxi-meter estimate for a destination not in FIXED_DESTINATIONS. The first
// km is a flat/minimum fare (not a per-km rate), so it's subtracted from the
// total distance before the remainder is walked through the tiered rates
// above — mixing that in as "just another tier" would double-count it.
export function calcTaxiMeter(input: TaxiMeterInput): TaxiMeterResult {
  const distanceKm = Math.max(input.distanceKm || 0, 0);
  const breakdown: TaxiMeterBreakdownItem[] = [];

  if (distanceKm <= 0) {
    return { total: 0, breakdown };
  }

  const flatFirstKm = FLAT_FIRST_KM[input.vehicleType];
  breakdown.push({ label: "กม.แรก (เหมา)", amount: flatFirstKm });

  let remaining = distanceKm - 1;
  let prevBoundary = 1;
  let total = flatFirstKm;

  for (const tier of TIERS) {
    if (remaining <= 0) break;
    const tierSpan = tier.upTo - prevBoundary;
    const kmInTier = Math.min(remaining, tierSpan);
    const amount = kmInTier * tier.rate;
    breakdown.push({
      label: `กม.ที่ ${prevBoundary}–${tier.upTo === Infinity ? "80+" : tier.upTo} (${kmInTier.toFixed(2)} กม. × ${tier.rate.toFixed(2)})`,
      amount,
    });
    total += amount;
    remaining -= kmInTier;
    prevBoundary = tier.upTo;
  }

  if (input.trafficMinutes > 0) {
    const amount = TRAFFIC_RATE_PER_MIN * input.trafficMinutes;
    breakdown.push({ label: `รถติด (${input.trafficMinutes} นาที × 3)`, amount });
    total += amount;
  }

  if (input.viaApp) {
    breakdown.push({ label: "เรียกผ่าน Call center/แอพ", amount: VIA_APP_SURCHARGE });
    total += VIA_APP_SURCHARGE;
  }

  if (input.airportPickup) {
    breakdown.push({ label: "รับที่สนามบิน", amount: AIRPORT_SURCHARGE });
    total += AIRPORT_SURCHARGE;
  }

  return { total: Math.round(total * 100) / 100, breakdown };
}
