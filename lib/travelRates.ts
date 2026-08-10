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
// Only the calculated amount crosses over — no description text. The
// travel-calculator's own auto-built label ("ค่าเดินทาง: ต้นทาง →
// ปลายทาง"/"...Taxi Meter...") was deliberately dropped from the handoff:
// the destination/description on the actual claim is left for the user to
// type themselves on the form side.
export interface PendingTravelEntry {
  amount: number;
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
export const FIXED_DESTINATIONS: FixedDestination[] = [
  { name: "บมจ. โทรคมนาคมแห่งชาติ สำนักงานใหญ่ (TOT)", distanceKm: 11, price: 95 },
  { name: "ชุมสายโทรศัพท์กรุงเกษม", distanceKm: 22, price: 190 },
  { name: "ชุมสายโทรศัพท์พระโขนง", distanceKm: 25, price: 215 },
  { name: "บมจ. โทรคมนาคมแห่งชาติ สำนักงานใหญ่ (CAT)", distanceKm: 13, price: 115 },
  { name: "ศูนย์โทรคมนาคม บางรัก", distanceKm: 25, price: 215 },
  { name: "ศูนย์โทรคมนาคม นนทบุรี", distanceKm: 14, price: 120 },
  { name: "การไฟฟ้าส่วนภูมิภาค สำนักงานใหญ่ ถนนงามวงศ์วาน", distanceKm: 12, price: 105 },
  { name: "การไฟฟ้านครหลวง สำนักงานใหญ่ คลองเตย", distanceKm: 23, price: 200 },
  { name: "การไฟฟ้านครหลวง สำนักงานเพลินจิต", distanceKm: 26, price: 225 },
  { name: "การไฟฟ้านครหลวง เขตวัดเลียบ", distanceKm: 25, price: 215 },
  { name: "การไฟฟ้านครหลวง เขตราษฎร์บูรณะ", distanceKm: 32, price: 275 },
  { name: "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย สำนักงานใหญ่ บางกรวย", distanceKm: 18, price: 155 },
  { name: "บมจ. เอสวีโอเอ สำนักงานใหญ่ ถนนพระราม 3", distanceKm: 27, price: 230 },
  { name: "บมจ. แอ็ดวานซ์อินฟอร์เมชั่นเทคโนโลยี สำนักงานใหญ่ ถนนสุทธิสารวินิจฉัย", distanceKm: 12, price: 105 },
  { name: "บมจ. ฟอร์ท คอร์ปอเรชั่น สำนักงานใหญ่ พญาไท", distanceKm: 16, price: 140 },
  { name: "บจก. ไวร์เออ แอนด์ ไวร์เลส ห้วยขวาง", distanceKm: 12, price: 105 },
  { name: "คลังสินค้า บจก. โนเกีย (ประเทศไทย) ถนนบางนา-ตราด", distanceKm: 16, price: 140 },
  { name: "กรมพัฒนาธุรกิจการค้า กระทรวงพาณิชย์ (สนามบินน้ำ)", distanceKm: 20, price: 170 },
  { name: "สำนักงานพัฒนาฝีมือแรงงานกรุงเทพมหานคร พื้นที่ 2 (ไอทีสแควร์)", distanceKm: 16, price: 140 },
  { name: "สำนักงานสรรพากรพื้นที่กรุงเทพมหานคร 8 (ลาดปลาเค้า)", distanceKm: 6, price: 55 },
  { name: "สำนักงานสรรพากรพื้นที่สาขาลาดพร้าว", distanceKm: 5, price: 45 },
  { name: "สำนักงานสวัสดิการและคุ้มครองแรงงานกรุงเทพมหานคร พื้นที่ 4 (อาคารนวพาร์ค)", distanceKm: 7, price: 60 },
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
