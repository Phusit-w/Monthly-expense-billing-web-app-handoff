"use client";

import { useState } from "react";
import {
  FIXED_DESTINATIONS,
  calcTaxiMeter,
  type FixedDestination,
  type VehicleType,
} from "@/lib/travelRates";

// Shared state + calculation logic behind "คำนวณค่าเดินทาง" — extracted out of
// TravelCalculator.tsx (the standalone /travel page) so the same math/state
// shape can also back TravelRowCalculatorPanel.tsx's compact per-row version
// on the roomy entry forms. Both callers get identical numbers for free;
// only the JSX/styling differs between the full page and the compact panel.
export function useTravelCostCalculator() {
  type Mode = "fixed" | "meter";
  const [mode, setMode] = useState<Mode>("fixed");

  // Mode 1: pre-priced destination lookup (searchable combobox).
  const [query, setQuery] = useState("");
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<FixedDestination | null>(null);

  const filtered =
    query.trim() === ""
      ? FIXED_DESTINATIONS
      : FIXED_DESTINATIONS.filter((d) => d.name.includes(query.trim()));

  function selectDestination(d: FixedDestination) {
    setSelected(d);
    setQuery(d.name);
    setShowList(false);
  }

  // Mode 2: taxi-meter estimate for anything not in the fixed list.
  const [distanceKm, setDistanceKm] = useState("");
  const [trafficMinutes, setTrafficMinutes] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("normal");
  const [viaApp, setViaApp] = useState(false);
  const [airportPickup, setAirportPickup] = useState(false);

  const meterResult = calcTaxiMeter({
    distanceKm: Number(distanceKm) || 0,
    trafficMinutes: Number(trafficMinutes) || 0,
    vehicleType,
    viaApp,
    airportPickup,
  });

  function handleClear() {
    if (mode === "fixed") {
      setQuery("");
      setSelected(null);
      setShowList(false);
    } else {
      setDistanceKm("");
      setTrafficMinutes("");
      setVehicleType("normal");
      setViaApp(false);
      setAirportPickup(false);
    }
  }

  // Whichever mode is active, this is the single result callers act on.
  // Rounded UP to a whole number (Math.ceil, not nearest) per request — see
  // TravelCalculator.tsx's original comment on resultAmount for the full
  // rationale (still stored/printed with 2 decimals downstream).
  const hasResult = mode === "fixed" ? selected !== null : meterResult.total > 0;
  const resultAmount = Math.ceil(mode === "fixed" ? (selected?.price ?? 0) : meterResult.total);
  // Only a named fixed destination gets a description label — the
  // taxi-meter tab has no single named place to build one from, so callers
  // leave the row's own Description of Expenses for the user to type
  // themselves, same as before this was extracted into a hook.
  const resultDesc = mode === "fixed" && selected ? `เดินทางไป ${selected.name}` : undefined;

  return {
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
  };
}
