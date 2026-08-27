"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { fmt } from "@/lib/format";
import { RATES_EFFECTIVE_DATE, TRAVEL_ORIGIN, pendingTravelEntryKey } from "@/lib/travelRates";
import type { PendingTravelEntry } from "@/lib/travelRates";
import { useTravelCostCalculator } from "@/lib/useTravelCostCalculator";

const inputClass =
  "w-full rounded-field border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:border-[#181818] focus:shadow-[0_0_0_3px_rgb(0_0_0/0.04)]";

const labelClass = "mb-1.5 block text-[13px] font-medium text-label";

export default function TravelCalculator() {
  const router = useRouter();
  // State + calculation logic lives in useTravelCostCalculator (shared with
  // TravelRowCalculatorPanel's compact per-row version on the entry forms).
  const {
    mode,
    setMode,
    query,
    setQuery,
    showList,
    setShowList,
    selected,
    setSelected,
    filtered,
    selectDestination,
    distanceKm,
    setDistanceKm,
    trafficMinutes,
    setTrafficMinutes,
    vehicleType,
    setVehicleType,
    viaApp,
    setViaApp,
    airportPickup,
    setAirportPickup,
    meterResult,
    handleClear,
    hasResult,
    resultAmount,
    resultDesc,
  } = useTravelCostCalculator();

  // "ส่งไปฟอร์ม": hands the current result off to a full entry-form page via
  // sessionStorage — see PendingTravelEntry's comment in lib/travelRates.ts
  // for why resultDesc only comes along in "fixed" mode.
  function sendToForm(type: "FA018" | "FA017") {
    if (!hasResult) return;
    const payload: PendingTravelEntry = {
      amount: resultAmount,
      ...(resultDesc ? { desc: resultDesc } : {}),
    };
    sessionStorage.setItem(pendingTravelEntryKey(type), JSON.stringify(payload));
    router.push(`/bill/entry/${type.toLowerCase()}`);
  }

  function tabClass(active: boolean) {
    return `ui-btn rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
      active ? "bg-ink text-white" : "text-muted hover:text-ink"
    }`;
  }

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight">
            คำนวณค่าเดินทางกรณีปฏิบัติงานภายนอกบริษัท
          </h1>
          <p className="mt-1 text-sm text-muted">ตามระเบียบ Cir.HR-076/2022</p>
        </div>

        <div className="flex items-center gap-3 rounded-card bg-peach px-5 py-4">
          <span className="text-[13px] font-medium text-[#7a5a2e]">ต้นทาง:</span>
          <span className="text-sm">{TRAVEL_ORIGIN}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 self-start rounded-field bg-chip p-1.5">
          <button className={tabClass(mode === "fixed")} onClick={() => setMode("fixed")}>
            เลือกจากปลายทางตามประกาศบริษัท
          </button>
          <button className={tabClass(mode === "meter")} onClick={() => setMode("meter")}>
            เลือกระยะทางจากปลายทางอื่นๆ
          </button>
        </div>

        {mode === "fixed" ? (
          <Card className="p-6">
            <label className={labelClass}>ปลายทาง (พิมพ์เพื่อค้นหา)</label>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                  setShowList(true);
                }}
                onFocus={() => setShowList(true)}
                onBlur={() => setTimeout(() => setShowList(false), 150)}
                placeholder="พิมพ์ชื่อปลายทาง..."
                className={inputClass}
              />
              {showList && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-[260px] overflow-y-auto rounded-field border border-line bg-surface shadow-dropdown">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-2.5 text-[13px] text-muted">
                      ไม่พบปลายทางในรายการ — ลองใช้แท็บ &quot;เลือกระยะทางจากปลายทางอื่นๆ&quot; แทน
                    </div>
                  ) : (
                    filtered.map((d) => (
                      <div
                        key={d.name}
                        onClick={() => selectDestination(d)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="cursor-pointer border-b border-divider px-3 py-2.5 text-[13px] last:border-b-0 hover:bg-hover"
                      >
                        {d.name}
                        <span className="ml-2 text-muted">
                          ({d.distanceKm} กม. · {fmt(d.price)} บาท)
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {selected && (
              <div className="mt-4 rounded-field bg-[#f8f8f8] px-4 py-3.5">
                <div className="text-[13px] text-label">{selected.name}</div>
                <div className="mt-1 text-[13px] text-label">
                  ระยะทาง: {selected.distanceKm} กม.
                </div>
                <div className="mt-1.5 font-display text-[22px] font-bold">
                  {fmt(resultAmount, 0)} บาท
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[200px] flex-1">
                <label className={labelClass}>
                  ระยะทาง (กม.) —{" "}
                  <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">
                    ดูระยะทางจาก Google Maps
                  </a>
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="min-w-[200px] flex-1">
                <label className={labelClass}>นาทีรถติดเผื่อไว้ (ความเร็ว &lt;6 กม./ชม.)</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={trafficMinutes}
                  onChange={(e) => setTrafficMinutes(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>ประเภทรถ</label>
              <div className="flex gap-5 text-sm">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="vehicleType"
                    checked={vehicleType === "normal"}
                    onChange={() => setVehicleType("normal")}
                  />
                  รถปกติ
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="vehicleType"
                    checked={vehicleType === "large"}
                    onChange={() => setVehicleType("large")}
                  />
                  รถใหญ่ (สามตอน/แวน)
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={viaApp} onChange={(e) => setViaApp(e.target.checked)} />
                เรียกผ่าน Call center/แอพ (+20 บาท)
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={airportPickup}
                  onChange={(e) => setAirportPickup(e.target.checked)}
                />
                รับที่สนามบิน (ดอนเมือง/สุวรรณภูมิ) (+50 บาท)
              </label>
            </div>

            <div className="mt-4 rounded-field bg-[#f8f8f8] px-4 py-3.5">
              <div className="font-display text-[22px] font-bold">
                {fmt(resultAmount, 0)} บาท
              </div>
              {meterResult.breakdown.length > 0 && (
                <div className="mt-2.5 text-xs text-label">
                  {meterResult.breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span>{b.label}</span>
                      <span>{fmt(b.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2.5 text-[11.5px] text-danger">
                โปรแกรมคำนวณนี้ใช้เพื่อเป็นข้อมูลประกอบการตัดสินใจเบื้องต้นเท่านั้น
                ไม่สามารถนำมาเป็นหลักฐานอ้างอิงได้
              </div>
            </div>
          </Card>
        )}

        {hasResult && (
          <Card className="flex flex-col gap-2.5 p-6">
            <div className="text-base font-medium">ส่งค่านี้ไปกรอกในฟอร์ม</div>
            <div className="text-[13px] text-muted">
              จะไปเติมที่แถวว่างแรกของตารางรายการ (หรือเพิ่มแถวใหม่ถ้าไม่มีแถวว่างเหลือ) — แก้ไขต่อได้ตามปกติ
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => sendToForm("FA017")}>
                ส่งไปฟอร์ม Expense Claim →
              </Button>
              <Button variant="outline" size="sm" onClick={() => sendToForm("FA018")}>
                ส่งไปฟอร์ม ใบรับรองแทนใบเสร็จ →
              </Button>
            </div>
          </Card>
        )}

        <div>
          <Button variant="outline" size="sm" onClick={handleClear}>
            ล้างข้อมูล
          </Button>
        </div>

        <div className="mt-2 text-[11.5px] leading-relaxed text-muted">
          <div className="mb-1 font-medium text-label">หมายเหตุ</div>
          <div>
            1. ค่าเดินทางปฏิบัติงานนอกบริษัท หมายถึงค่าเดินทางโดยรถยนต์ส่วนตัว/แท็กซี่มิเตอร์/แกร็บแท็กซี่
            เป็นต้น
          </div>
          <div>
            2. อัตราตามตารางมีผล ณ วันที่ {RATES_EFFECTIVE_DATE} เป็นต้นไป จนกว่าจะมีการเปลี่ยนแปลง
          </div>
          <div>3. เป็นค่าเดินทางเที่ยวเดียว ไม่รวมค่าทางด่วน/ค่าที่จอดรถ</div>
          <div>4. พนักงานที่ได้รับสวัสดิการค่าเดินทางตามระเบียบบริษัทอยู่แล้ว ไม่เข้าเงื่อนไขนี้</div>
          <div>
            5. กรณีคำนวณด้วย Taxi Meter:
            โปรแกรมคำนวณนี้ใช้เพื่อเป็นข้อมูลประกอบการตัดสินใจเบื้องต้นเท่านั้น
            ไม่สามารถนำมาเป็นหลักฐานอ้างอิงได้
          </div>
        </div>
      </div>
    </PageShell>
  );
}
