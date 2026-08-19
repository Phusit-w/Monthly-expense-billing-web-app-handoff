"use client";

import { useState } from "react";
import { deleteSavedEmployee, rememberLastEmployee, saveEmployeeForReuse } from "@/actions/profile";
import ConfirmDialog from "@/components/ConfirmDialog";
import SavedEmployeePicker from "@/components/SavedEmployeePicker";
import SavedListManager from "@/components/SavedListManager";
import type { EmployeeSnapshot, SavedEmployeeEntry } from "@/lib/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 8px",
  border: "1px solid #ccc",
  borderRadius: 4,
  font: "inherit",
};

const fieldWrap = (minWidth: number): React.CSSProperties => ({
  flex: 1,
  minWidth,
});

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#555",
  marginBottom: 4,
};

// Ported from the "ข้อมูลพนักงาน (บันทึกไว้ใช้ซ้ำ)" card in the design source.
// Used to auto-save every field to one shared DB row on blur — with no
// login, two people at the office at once could silently overwrite each
// other's name/position/etc, and every new visitor inherited whatever the
// last person left behind (see actions/profile.ts's comment for the full
// story). Now purely local React state: nothing is written anywhere just
// from typing. The only DB writes this card triggers are the explicit
// "บันทึกไว้ใช้ซ้ำ" button (saves under your own name, keyed so it can never
// collide with anyone else's) and picking a saved name from the picker below
// (just remembers it as this browser's default for next time — see
// rememberLastEmployee).
export default function ProfileCard({
  initialProfile,
  savedEmployees,
}: {
  initialProfile: EmployeeSnapshot;
  // Several different people share this login-less app — savedEmployees is
  // the list anyone has previously saved under their own name via "บันทึกไว้
  // ใช้ซ้ำ" below. Same feature/wiring as EntryEmployeeFields.tsx (the
  // FA017/FA018 entry forms' identical card) — kept here as its own copy
  // rather than a shared component for layout/prop-shape reasons, not
  // behavioral ones; both are now equally "local until explicitly saved".
  savedEmployees: SavedEmployeeEntry[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // saveEmployeeForReuse (actions/profile.ts) upserts keyed by name, so
  // re-saving an existing one silently overwrites it — confirm first.
  const [confirmingSave, setConfirmingSave] = useState(false);
  // Local optimistic copy of savedEmployees, same rationale as
  // lib/useSavedItems.ts's own copy — a save/delete here is reflected in
  // this card's own datalist immediately, without waiting on a page reload.
  const [savedEmployeeList, setSavedEmployeeList] = useState<SavedEmployeeEntry[]>(savedEmployees);

  function set<K extends keyof EmployeeSnapshot>(key: K, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  // A saved name was typed or picked from the datalist below — fill in the
  // rest of that person's saved snapshot too, not just the name field, and
  // remember them as this browser's default for next visit. `id` is
  // dropped from what's kept in local state — `profile` is a plain
  // EmployeeSnapshot, the saved entry's id only matters for the saved-list's
  // own bookkeeping (delete button) below.
  function selectSaved(entry: SavedEmployeeEntry) {
    const { id: _id, ...snapshot } = entry;
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

  // Just clears what's showing in this browser right now — doesn't touch
  // any saved name or this browser's remembered default, matching the
  // button's own label ("ล้างข้อมูลที่กรอก โดยไม่ลบรายชื่อที่บันทึกไว้").
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

  const fields: {
    key: keyof EmployeeSnapshot;
    label: string;
    minWidth: number;
  }[] = [
    { key: "name", label: "ชื่อ-นามสกุล", minWidth: 180 },
    { key: "position", label: "ตำแหน่ง / Position", minWidth: 150 },
    { key: "department", label: "ฝ่าย / แผนก", minWidth: 150 },
    { key: "employeeNo", label: "Employee No", minWidth: 120 },
  ];

  return (
    <div
      style={{
        maxWidth: 1160,
        margin: "0 auto 16px",
        background: "#fff",
        border: "1px solid #d8d5cc",
        borderRadius: 8,
        padding: "18px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          ข้อมูลพนักงาน (บันทึกไว้ใช้ซ้ำ)
        </div>
        <button
          type="button"
          onClick={clearProfile}
          className="btn-danger"
          title="ล้างข้อมูลที่กรอก โดยไม่ลบรายชื่อที่บันทึกไว้"
          style={{
            padding: "5px 10px",
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
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
        {fields.map((f) => (
          <div key={f.key} style={fieldWrap(f.minWidth)}>
            <label style={labelStyle}>{f.label}</label>
            <input
              value={profile[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.key === "name" ? "ชื่อ-นามสกุล" : undefined}
              style={inputStyle}
            />
            {f.key === "name" && (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setConfirmingSave(true)}
                    disabled={saving || !profile.name.trim()}
                    title={
                      profile.name.trim()
                        ? "บันทึกข้อมูลพนักงานชุดนี้ไว้ใช้ซ้ำ ค้นหาด้วยชื่อได้ในครั้งหน้า"
                        : "กรอกชื่อ-นามสกุลก่อนจึงจะบันทึกได้"
                    }
                    style={{
                      marginTop: 6,
                      padding: "5px 10px",
                      border: "1px dashed #1c1c1c",
                      borderRadius: 4,
                      background: "#fff",
                      font: "inherit",
                      fontSize: 11,
                      color: "#1c1c1c",
                      cursor: saving || !profile.name.trim() ? "not-allowed" : "pointer",
                      opacity: saving || !profile.name.trim() ? 0.5 : 1,
                    }}
                  >
                    {saving ? "กำลังบันทึก…" : justSaved ? "บันทึกแล้ว ✓" : "บันทึกไว้ใช้ซ้ำ"}
                  </button>
                  <SavedEmployeePicker savedEmployees={savedEmployeeList} onSelect={selectSaved} />
                </div>
                <div style={{ marginTop: 6 }}>
                  <SavedListManager
                    label="ชื่อที่บันทึกไว้"
                    items={savedEmployeeList.map((s) => ({ id: s.id, text: s.name }))}
                    onDelete={removeSavedEmployeeEntry}
                  />
                </div>
              </>
            )}
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
    </div>
  );
}
