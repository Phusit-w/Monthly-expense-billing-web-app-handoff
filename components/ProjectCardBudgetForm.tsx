"use client";

import { useState, useTransition } from "react";
import { verifyProjectCardBudget } from "@/actions/projectCard";
import Button from "@/components/ui/Button";
import { fmt } from "@/lib/format";

// Unverified rows open straight into the confirm form (there's nothing
// verified yet to show collapsed); verified rows show the value with a
// "แก้ไข" to reopen it — see CONTEXT.md's Budget entry for why an
// unverified number is never presented as settled.
export default function ProjectCardBudgetForm({
  id,
  budgetAmount,
  budgetVerified,
}: {
  id: string;
  budgetAmount: string | null;
  budgetVerified: boolean;
}) {
  const [editing, setEditing] = useState(!budgetVerified);
  const [value, setValue] = useState(budgetAmount ?? "");
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-ink">{budgetAmount ? `${fmt(budgetAmount, 2)} บาท` : "ยังไม่ระบุ"}</span>
        <span className="rounded-full bg-chip px-2 py-0.5 text-xs text-muted">ยืนยันแล้ว</span>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
          แก้ไข
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        const parsed = trimmed === "" ? null : Number(trimmed);
        if (parsed !== null && !Number.isFinite(parsed)) return;
        startTransition(async () => {
          await verifyProjectCardBudget(id, parsed);
          setEditing(false);
        });
      }}
    >
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="จำนวนเงิน (บาท)"
        className="h-9 w-40 rounded-field border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink"
      />
      <Button type="submit" size="sm" variant="primary" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "ยืนยันงบประมาณ"}
      </Button>
      {budgetVerified ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setValue(budgetAmount ?? "");
            setEditing(false);
          }}
        >
          ยกเลิก
        </Button>
      ) : null}
    </form>
  );
}
