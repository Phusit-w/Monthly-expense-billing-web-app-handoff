import TravelCalculator from "@/components/TravelCalculator";

// Pure client-side calculator — no DB/server data needed, so unlike the
// other routes (app/bill/*) this page has nothing to fetch server-side.
export default function TravelPage() {
  return <TravelCalculator />;
}
