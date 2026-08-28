"use client";
import { useTransition } from "react";
import { restoreExpense, restoreSocJob } from "@/actions/admin";
import Button from "@/components/ui/Button";
export default function AdminRestoreButton({ id, kind }: { id: string; kind: "expense" | "soc" }) { const [pending, start] = useTransition(); return <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { if (kind === "expense") await restoreExpense(id); else await restoreSocJob(id); })}>{pending ? "กำลังกู้คืน…" : "กู้คืน"}</Button>; }
