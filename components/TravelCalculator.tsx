"use client";

import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import PageShell from "@/components/PageShell";
import { fmt } from "@/lib/format";
import { RATES_EFFECTIVE_DATE, TRAVEL_ORIGIN, pendingTravelEntryKey } from "@/lib/travelRates";
import type { PendingTravelEntry } from "@/lib/travelRates";
import { useTravelCostCalculator } from "@/lib/useTravelCostCalculator";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8d5cc",
  borderRadius: 8,
  padding: "18px 22px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 8px",
  border: "1px solid #ccc",
  borderRadius: 4,
  font: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#555",
  marginBottom: 4,
};

// Styled after EditorToolbar's button conventions (dashed/outline for
// secondary actions, filled black for the primary one) so this page reads
// consistently with the rest of the app despite not being part of the
// bill-editing flow.
function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 18px",
    border: "1px solid #1c1c1c",
    borderRadius: 6,
    background: active ? "#1c1c1c" : "#fff",
    color: active ? "#fff" : "#1c1c1c",
    fontWeight: 600,
    font: "inherit",
    fontSize: 14,
    cursor: "pointer",
  };
}

// Matches EntryFormFA017/EntryFormFA018's "สร้างฟอร์ม →" primary button —
// this is the same kind of "hand off to the form" action.
const primaryBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  border: "1px solid #1c1c1c",
  background: "#1c1c1c",
  color: "#fff",
  borderRadius: 6,
  font: "inherit",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

export default function TravelCalculator() {
  const router = useRouter();
  // State + calculation logic lives in useTravelCostCalculator (shared with
  // TravelRowCalculatorPanel's compact per-row version on the entry forms)
  // — this component only owns page-level concerns (routing the result to
  // a specific entry-form type via sessionStorage).
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

  return (
    <PageShell>
      <Header />
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            คำนวณค่าเดินทางกรณีปฏิบัติงานภายนอกบริษัท
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>ตามระเบียบ Cir.HR-076/2022</div>
        </div>

        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#555" }}>ต้นทาง:</span>
          <span style={{ fontSize: 14 }}>{TRAVEL_ORIGIN}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={tabButtonStyle(mode === "fixed")} onClick={() => setMode("fixed")}>
            เลือกจากปลายทางตามประกาศบริษัท
          </button>
          <button style={tabButtonStyle(mode === "meter")} onClick={() => setMode("meter")}>
            เลือกระยะทางจากปลายทางอื่นๆ
          </button>
        </div>

        {mode === "fixed" ? (
          <div style={cardStyle}>
            <label style={labelStyle}>ปลายทาง (พิมพ์เพื่อค้นหา)</label>
            <div style={{ position: "relative" }}>
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
                style={inputStyle}
              />
              {showList && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    maxHeight: 260,
                    overflowY: "auto",
                    background: "#fff",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    zIndex: 10,
                  }}
                >
                  {filtered.length === 0 ? (
                    <div style={{ padding: "10px 12px", color: "#999", fontSize: 13 }}>
                      ไม่พบปลายทางในรายการ — ลองใช้แท็บ &quot;เลือกระยะทางจากปลายทางอื่นๆ&quot; แทน
                    </div>
                  ) : (
                    filtered.map((d) => (
                      <div
                        key={d.name}
                        onClick={() => selectDestination(d)}
                        style={{
                          padding: "9px 12px",
                          fontSize: 13,
                          cursor: "pointer",
                          borderBottom: "1px solid #f0efe9",
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {d.name}
                        <span style={{ color: "#999", marginLeft: 8 }}>
                          ({d.distanceKm} กม. · {fmt(d.price)} บาท)
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {selected && (
              <div
                style={{
                  marginTop: 16,
                  padding: "14px 16px",
                  background: "#f7f6f1",
                  border: "1px solid #e3e0d8",
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: 13, color: "#555" }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                  ระยะทาง: {selected.distanceKm} กม.
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{fmt(resultAmount, 0)} บาท</div>
              </div>
            )}
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={labelStyle}>
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
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={labelStyle}>นาทีรถติดเผื่อไว้ (ความเร็ว &lt;6 กม./ชม.)</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={trafficMinutes}
                  onChange={(e) => setTrafficMinutes(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>ประเภทรถ</label>
              <div style={{ display: "flex", gap: 20, fontSize: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="vehicleType"
                    checked={vehicleType === "normal"}
                    onChange={() => setVehicleType("normal")}
                  />
                  รถปกติ
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
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

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={viaApp} onChange={(e) => setViaApp(e.target.checked)} />
                เรียกผ่าน Call center/แอพ (+20 บาท)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={airportPickup}
                  onChange={(e) => setAirportPickup(e.target.checked)}
                />
                รับที่สนามบิน (ดอนเมือง/สุวรรณภูมิ) (+50 บาท)
              </label>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                background: "#f7f6f1",
                border: "1px solid #e3e0d8",
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(resultAmount, 0)} บาท</div>
              {meterResult.breakdown.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                  {meterResult.breakdown.map((b, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span>{b.label}</span>
                      <span>{fmt(b.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 11.5, color: "#b3261e" }}>
                โปรแกรมคำนวณนี้ใช้เพื่อเป็นข้อมูลประกอบการตัดสินใจเบื้องต้นเท่านั้น
                ไม่สามารถนำมาเป็นหลักฐานอ้างอิงได้
              </div>
            </div>
          </div>
        )}

        {hasResult && (
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>ส่งค่านี้ไปกรอกในฟอร์ม</div>
            <div style={{ fontSize: 12, color: "#777" }}>
              จะไปเติมที่แถวว่างแรกของตารางรายการ (หรือเพิ่มแถวใหม่ถ้าไม่มีแถวว่างเหลือ) — แก้ไขต่อได้ตามปกติ
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => sendToForm("FA017")} style={primaryBtnStyle}>
                ส่งไปฟอร์ม Expense Claim →
              </button>
              <button onClick={() => sendToForm("FA018")} style={primaryBtnStyle}>
                ส่งไปฟอร์ม ใบรับรองแทนใบเสร็จ →
              </button>
            </div>
          </div>
        )}

        <div>
          <button
            onClick={handleClear}
            style={{
              padding: "9px 16px",
              border: "1px solid #999",
              borderRadius: 6,
              background: "#fff",
              font: "inherit",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ล้างข้อมูล
          </button>
        </div>

        <div style={{ fontSize: 11.5, lineHeight: 1.7, color: "#777", marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: "#555", marginBottom: 4 }}>หมายเหตุ</div>
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
