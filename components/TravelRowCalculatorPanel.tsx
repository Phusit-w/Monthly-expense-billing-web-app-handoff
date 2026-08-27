"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { fmt } from "@/lib/format";
import { useTravelCostCalculator } from "@/lib/useTravelCostCalculator";

// Compact per-row companion to the full /travel page (TravelCalculator.tsx)
// — same calculation via useTravelCostCalculator, scoped to one row of
// EntryFormFA017/EntryFormFA018. Collapsed by default; expands in-flow below
// (no overlay/portal), matching SavedListManager's toggle+expand idiom.
//
// Deliberately doesn't touch sessionStorage or navigate — applying here is a
// same-render setState the caller's onApply performs directly on this row.
const compactInputClass =
  "w-full rounded-input border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none " +
  "focus:border-[#181818]";

export default function TravelRowCalculatorPanel({
  onApply,
}: {
  // Caller decides which field(s) the amount/desc land in — FA017 uses
  // "transport", FA018 uses "amount" — and whether to overwrite an existing
  // description (both current callers only fill desc when the row's own
  // description is still blank).
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

  function tabClass(active: boolean) {
    return `ui-btn rounded-input px-2.5 py-1 text-[11px] font-medium transition-colors ${
      active ? "bg-ink text-white" : "text-muted hover:text-ink"
    }`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="คำนวณค่าเดินทางแล้วใส่ค่าลงแถวนี้โดยตรง"
        className="ui-btn rounded-chip border border-dashed border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-label transition-colors hover:bg-hover"
      >
        คำนวณค่าเดินทาง {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-2 w-full rounded-field border border-line bg-[#f8f8f8] px-3 py-2.5">
          <div className="mb-2 flex gap-1.5 rounded-input bg-chip p-1">
            <button
              type="button"
              onClick={() => calc.setMode("fixed")}
              className={tabClass(calc.mode === "fixed")}
            >
              เลือกปลายทาง
            </button>
            <button
              type="button"
              onClick={() => calc.setMode("meter")}
              className={tabClass(calc.mode === "meter")}
            >
              Taxi Meter
            </button>
          </div>

          {calc.mode === "fixed" ? (
            <div className="relative">
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
                className={compactInputClass}
              />
              {calc.showList && (
                <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-10 max-h-[180px] overflow-y-auto rounded-input border border-line bg-surface shadow-dropdown">
                  {calc.filtered.length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-muted">
                      ไม่พบปลายทางในรายการ — ลองแท็บ Taxi Meter แทน
                    </div>
                  ) : (
                    calc.filtered.map((d) => (
                      <div
                        key={d.name}
                        onClick={() => calc.selectDestination(d)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="cursor-pointer border-b border-divider px-2.5 py-1.5 text-[11px] last:border-b-0 hover:bg-hover"
                      >
                        {d.name}{" "}
                        <span className="text-muted">
                          ({d.distanceKm} กม. · {fmt(d.price)} บาท)
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="ระยะทาง (กม.)"
                  value={calc.distanceKm}
                  onChange={(e) => calc.setDistanceKm(e.target.value)}
                  className={compactInputClass}
                />
                <input
                  type="number"
                  min={0}
                  step="1"
                  placeholder="นาทีรถติด"
                  value={calc.trafficMinutes}
                  onChange={(e) => calc.setTrafficMinutes(e.target.value)}
                  className={compactInputClass}
                />
              </div>
              <div className="flex gap-2.5 text-[11px]">
                <label className="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    checked={calc.vehicleType === "normal"}
                    onChange={() => calc.setVehicleType("normal")}
                  />
                  รถปกติ
                </label>
                <label className="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    checked={calc.vehicleType === "large"}
                    onChange={() => calc.setVehicleType("large")}
                  />
                  รถใหญ่
                </label>
              </div>
              <div className="flex gap-2.5 text-[11px]">
                <label className="flex cursor-pointer items-center gap-1">
                  <input
                    type="checkbox"
                    checked={calc.viaApp}
                    onChange={(e) => calc.setViaApp(e.target.checked)}
                  />
                  เรียกผ่านแอพ (+20)
                </label>
                <label className="flex cursor-pointer items-center gap-1">
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

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-bold">
              {calc.hasResult ? `${fmt(calc.resultAmount, 0)} บาท` : "—"}
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="danger"
                size="sm"
                className="!h-7 !px-3 !text-[11px]"
                onClick={calc.handleClear}
              >
                ล้างข้อมูล
              </Button>
              <Button
                variant="dark"
                size="sm"
                className="!h-7 !px-3 !text-[11px]"
                onClick={handleApply}
                disabled={!calc.hasResult}
              >
                ใส่ในแถวนี้ →
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
