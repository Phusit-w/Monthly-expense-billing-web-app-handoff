import { num } from "@/lib/format";
import type { FA017Item, FA018Item } from "@/lib/types";

// Ported from Component.fa018Total / fa017RowTotal / fa017Totals.

export function fa018Total(items: FA018Item[]): number {
  return items.reduce((s, it) => s + num(it.amount), 0);
}

export function fa017RowTotal(it: FA017Item): number {
  return (
    num(it.gasoline) +
    num(it.hotel) +
    num(it.entertain) +
    num(it.mobile) +
    num(it.transport) +
    num(it.other) +
    num(it.localAmt)
  );
}

export interface FA017Totals {
  gasoline: number;
  hotel: number;
  entertain: number;
  mobile: number;
  transport: number;
  other: number;
  localAmt: number;
  thb: number;
}

export function fa017Totals(items: FA017Item[]): FA017Totals {
  const t: FA017Totals = {
    gasoline: 0,
    hotel: 0,
    entertain: 0,
    mobile: 0,
    transport: 0,
    other: 0,
    localAmt: 0,
    thb: 0,
  };
  for (const it of items) {
    t.gasoline += num(it.gasoline);
    t.hotel += num(it.hotel);
    t.entertain += num(it.entertain);
    t.mobile += num(it.mobile);
    t.transport += num(it.transport);
    t.other += num(it.other);
    t.localAmt += num(it.localAmt);
    t.thb += fa017RowTotal(it);
  }
  return t;
}
