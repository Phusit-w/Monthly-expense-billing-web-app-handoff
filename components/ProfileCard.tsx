"use client";

import { useState } from "react";
import {
  deleteSavedEmployee,
  rememberLastEmployee,
  saveEmployeeForReuse,
} from "@/actions/profile";
import ConfirmDialog from "@/components/ConfirmDialog";
import SavedEmployeePicker from "@/components/SavedEmployeePicker";
import SavedListManager from "@/components/SavedListManager";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { EmployeeSnapshot, SavedEmployeeEntry } from "@/lib/types";

const inputClass =
  "w-full rounded-field border border-line bg-surface px-4 py-3 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:border-ink focus:shadow-[0_0_0_3px_var(--ring-focus)]";

// The "ข้อมูลพนักงาน (บันทึกไว้ใช้ซ้ำ)" card. Purely local React state:
// nothing is written anywhere just from typing. The only DB writes are the
// explicit "บันทึกไว้ใช้ซ้ำ" button (upsert keyed by name) and picking a
// saved name (remembers it as this browser's default — rememberLastEmployee).
export default function ProfileCard({
  initialProfile,
  savedEmployees,
}: {
  initialProfile: EmployeeSnapshot;
  savedEmployees: SavedEmployeeEntry[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [savedEmployeeList, setSavedEmployeeList] =
    useState<SavedEmployeeEntry[]>(savedEmployees);

  function set<K extends keyof EmployeeSnapshot>(key: K, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function selectSaved(entry: SavedEmployeeEntry) {
    const { id: _id, ...snapshot } = entry;
    void _id;
    setProfile(snapshot);
    void rememberLastEmployee(entry.name);
  }

  async function handleSaveForReuse() {
    setConfirmingSave(false);
    setSaving(true);
    setJustSaved(false);
    const savedEntry = await saveEmployeeForReuse(profile);
    setSaving(false);
    if (savedEntry) {
      setSavedEmployeeList((its) => {
        const next = its.filter((e) => e.name !== savedEntry.name);
        next.push(savedEntry);
        next.sort((a, b) => a.name.localeCompare(b.name, "th"));
        return next;
      });
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  async function removeSavedEmployeeEntry(id: string) {
    await deleteSavedEmployee(id);
    setSavedEmployeeList((its) => its.filter((e) => e.id !== id));
  }

  function clearProfile() {
    setProfile({
      name: "",
      position: "",
      department: "",
      office: "",
      employeeNo: "",
      projectCC: "",
    });
  }

  const fields: { key: keyof EmployeeSnapshot; label: string }[] = [
    { key: "name", label: "ชื่อ-นามสกุล" },
    { key: "position", label: "ตำแหน่ง / Position" },
    { key: "department", label: "ฝ่าย / แผนก" },
    { key: "employeeNo", label: "Employee No" },
  ];

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-base font-medium">
          ข้อมูลพนักงาน (บันทึกไว้ใช้ซ้ำ)
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmingSave(true)}
            disabled={saving || !profile.name.trim()}
            title={
              profile.name.trim()
                ? "บันทึกข้อมูลพนักงานชุดนี้ไว้ใช้ซ้ำ ค้นหาด้วยชื่อได้ในครั้งหน้า"
                : "กรอกชื่อ-นามสกุลก่อนจึงจะบันทึกได้"
            }
            className="ui-btn rounded-chip border border-dashed border-ink px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "กำลังบันทึก…"
              : justSaved
                ? "บันทึกแล้ว ✓"
                : "บันทึกไว้ใช้ซ้ำ"}
          </button>
          <SavedEmployeePicker
            savedEmployees={savedEmployeeList}
            onSelect={selectSaved}
          />
          <SavedListManager
            label="ชื่อที่บันทึกไว้"
            items={savedEmployeeList.map((s) => ({ id: s.id, text: s.name }))}
            onDelete={removeSavedEmployeeEntry}
          />
          <Button
            variant="danger"
            size="sm"
            onClick={clearProfile}
            title="ล้างข้อมูลที่กรอก โดยไม่ลบรายชื่อที่บันทึกไว้"
          >
            ล้างข้อมูล
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-[13px] font-medium text-label">
              {f.label}
            </label>
            <input
              value={profile[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.key === "name" ? "ชื่อ-นามสกุล" : undefined}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmingSave}
        title="ยืนยันการบันทึกไว้ใช้ซ้ำ"
        message={
          savedEmployeeList.some((e) => e.name === profile.name.trim())
            ? "มีข้อมูลพนักงานชื่อนี้บันทึกไว้แล้ว — บันทึกซ้ำจะเขียนทับข้อมูลเดิม ต้องการดำเนินการต่อหรือไม่?"
            : "บันทึกข้อมูลพนักงานชุดนี้ไว้ใช้ซ้ำหรือไม่?"
        }
        confirmLabel="บันทึก"
        busy={saving}
        onConfirm={handleSaveForReuse}
        onCancel={() => setConfirmingSave(false)}
      />
    </Card>
  );
}
