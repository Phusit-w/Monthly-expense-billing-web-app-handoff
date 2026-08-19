"use client";

import { useState } from "react";
import { fmt } from "@/lib/format";
import { useTravelCostCalculator } from "@/lib/useTravelCostCalculator";

// Compact per-row companion to the full /travel page (TravelCalculator.tsx)
// — same calculation via useTravelCostCalculator, but scoped to one row of
// EntryFormFA017/EntryFormFA018 instead of a whole page. Collapsed by
// default, styled after SavedListManager.tsx's toggle+expand idiom (dashed
// toggle button, bordered panel expands in-flow below when open — no
// overlay/backdrop/portal, matching this app's only other lightweight
// expandable-UI precedent) so it slots visually next to that row's existing
// "บันทึกไว้ใช้ซ้ำ"/"ล้างข้อมูลแถวนี้" buttons.
//
// Deliberately doesn't touch sessionStorage or navigate anywhere — unlike
// the /travel page's "ส่งไปฟอร์ม" cross-page handoff, applying here is a
// same-render setState call the caller's onApply performs directly on this
// exact row, so there's no "which row does this land in" ambiguity and
// nothing for a remount/double-effect to race with.
const compactInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "4px 6px",
  border: "1px solid #ccc",
  borderRadius: 4,
  font: "inherit",
  fontSize: 12,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    border: "1px solid #1c1c1c",
    borderRadius: 4,
    background: active ? "#1c1c1c" : "#fff",
    color: active ? "#fff" : "#1c1c1c",
    fontWeight: 600,
    font: "inherit",
    fontSize: 11,
    cursor: "pointer",
  };
}

export default function TravelRowCalculatorPanel({
  onApply,
}: {
  // Caller decides which field(s) the amount/desc land in — FA017 uses
  // "transport" (Transport & Express way), FA018 uses "amount" — and
  // whether to overwrite an existing description (both current callers
  // only fill desc when the row's own description is still blank).
  onApply: (amount: number, desc: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const calc = useTravelCostCalculator();

  function handleApply() {
    if (!calc.hasResult) return;
    onApply(calc.resultAmount, calc.resultDesc);
    calc.handleClear();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="คำนวณค่าเดินทางแล้วใส่ค่าลงแถวนี้โดยตรง"
        style={{
          marginTop: 6,
          marginLeft: 6,
          padding: "4px 8px",
          border: "1px dashed #999",
          borderRadius: 4,
          background: "#fff",
          font: "inherit",
          fontSize: 11,
          color: "#555",
          cursor: "pointer",
        }}
      >
        คำนวณค่าเดินทาง {open ? "▲" : "▼"}
      </button>
      {open && (
        // Both callers render this inside the Description field's own
        // container (a plain block <div>, not a flex row) alongside the
        // toggle button above and the existing "บันทึกไว้ใช้ซ้ำ"/"ล้างข้อมูลแถวนี้"
        // buttons — so this <div>, being block-level by default, naturally
        // lands on its own full-width line below them and pushes the rest
        // of the row down, the same "expand in place" effect
        // SavedListManager.tsx gets, with no flex/positioning tricks needed.
        <div
          style={{
            marginTop: 8,
            border: "1px solid #e3e0d8",
            borderRadius: 4,
            padding: "10px 12px",
            background: "#faf9f6",
          }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button type="button" onClick={() => calc.setMode("fixed")} style={tabStyle(calc.mode === "fixed")}>
              เลือกปลายทาง
            </button>
            <button type="button" onClick={() => calc.setMode("meter")} style={tabStyle(calc.mode === "meter")}>
              Taxi Meter
            </button>
          </div>

          {calc.mode === "fixed" ? (
            <div style={{ position: "relative" }}>
              <input
                value={calc.query}
                onChange={(e) => {
                  calc.setQuery(e.target.value);
                  calc.setSelected(null);
                  calc.setShowList(true);
                }}
                onFocus={() => calc.setShowList(true)}
                onBlur={() => setTimeout(() => calc.setShowList(false), 150)}
                placeholder="พิมพ์ชื่อปลายทาง..."
                style={compactInputStyle}
              />
              {calc.showList && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 2px)",
                    left: 0,
                    right: 0,
                    maxHeight: 180,
                    overflowY: "auto",
                    background: "#fff",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                    zIndex: 10,
                  }}
                >
                  {calc.filtered.length === 0 ? (
                    <div style={{ padding: "8px 10px", color: "#999", fontSize: 11 }}>
                      ไม่พบปลายทางในรายการ — ลองแท็บ Taxi Meter แทน
                    </div>
                  ) : (
                    calc.filtered.map((d) => (
                      <div
                        key={d.name}
                        onClick={() => calc.selectDestination(d)}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          padding: "6px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                          borderBottom: "1px solid #f0efe9",
                        }}
                      >
                        {d.name}{" "}
                        <span style={{ color: "#999" }}>
                          ({d.distanceKm} กม. · {fmt(d.price)} บาท)
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="ระยะทาง (กม.)"
                  value={calc.distanceKm}
                  onChange={(e) => calc.setDistanceKm(e.target.value)}
                  style={compactInputStyle}
                />
                <input
                  type="number"
                  min={0}
                  step="1"
                  placeholder="นาทีรถติด"
                  value={calc.trafficMinutes}
                  onChange={(e) => calc.setTrafficMinutes(e.target.value)}
                  style={compactInputStyle}
                />
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={calc.vehicleType === "normal"}
                    onChange={() => calc.setVehicleType("normal")}
                  />
                  รถปกติ
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={calc.vehicleType === "large"}
                    onChange={() => calc.setVehicleType("large")}
                  />
                  รถใหญ่
                </label>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={calc.viaApp}
                    onChange={(e) => calc.setViaApp(e.target.checked)}
                  />
                  เรียกผ่านแอพ (+20)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={calc.airportPickup}
                    onChange={(e) => calc.setAirportPickup(e.target.checked)}
                  />
                  รับสนามบิน (+50)
                </label>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {calc.hasResult ? `${fmt(calc.resultAmount, 0)} บาท` : "—"}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {/* Clears only the active mode's own fields (destination
                  search or taxi-meter inputs) — same scope as
                  useTravelCostCalculator's handleClear and the identically
                  labeled button on the full /travel page. Doesn't touch the
                  row itself (that's "ล้างข้อมูลแถวนี้" above, a separate
                  button), and doesn't close this panel — just resets the
                  calculator to try again. */}
              <button
                type="button"
                onClick={calc.handleClear}
                className="btn-danger"
                style={{
                  padding: "5px 12px",
                  border: "1px solid #b3261e",
                  color: "#b3261e",
                  borderRadius: 4,
                  background: "#fff",
                  font: "inherit",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                ล้างข้อมูล
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!calc.hasResult}
                style={{
                  padding: "5px 12px",
                  border: "1px solid #1c1c1c",
                  background: calc.hasResult ? "#1c1c1c" : "#e3e0d8",
                  color: calc.hasResult ? "#fff" : "#999",
                  borderRadius: 4,
                  font: "inherit",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: calc.hasResult ? "pointer" : "not-allowed",
                }}
              >
                ใส่ในแถวนี้ →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
