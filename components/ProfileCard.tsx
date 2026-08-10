"use client";

import { useState } from "react";
import { deleteSavedEmployee, saveEmployeeForReuse, updateProfile } from "@/actions/profile";
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
// Unlike the original (which persisted to localStorage on every keystroke),
// this saves to the shared database on blur so we're not writing on every
// keypress — same end result, fewer round-trips.
export default function ProfileCard({
  initialProfile,
  savedEmployees,
}: {
  initialProfile: EmployeeSnapshot;
  // Several different people share this login-less app — savedEmployees is
  // the list anyone has previously saved under their own name via "บันทึกไว้
  // ใช้ซ้ำ" below, distinct from this card's own single org-wide default.
  // Same feature/wiring as EntryEmployeeFields.tsx (the FA017/FA018 entry
  // forms' identical card) — kept here as its own copy rather than a shared
  // component since this one additionally has an Office field and commits
  // on blur immediately (this card IS the live default, not a draft still
  // waiting on an explicit save), neither of which EntryEmployeeFields does.
  savedEmployees: SavedEmployeeEntry[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // Local optimistic copy of savedEmployees, same rationale as
  // lib/useSavedItems.ts's own copy — a save/delete here is reflected in
  // this card's own datalist immediately, without waiting on a page reload.
  const [savedEmployeeList, setSavedEmployeeList] = useState<SavedEmployeeEntry[]>(savedEmployees);

  function set<K extends keyof EmployeeSnapshot>(key: K, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function commit(next: EmployeeSnapshot = profile) {
    const changed = (Object.keys(next) as (keyof EmployeeSnapshot)[]).some(
      (k) => next[k] !== saved[k]
    );
    if (!changed) return;
    setSaved(next);
    await updateProfile(next);
  }

  // A saved name was typed or picked from the datalist below — fill in
  // (and immediately persist) that person's whole saved snapshot, not just
  // the name field, since this card is the live shared default rather than
  // a draft waiting on a separate save step. `id` is dropped from what's
  // committed — `profile`/EmployeeProfile has no id field of its own, the
  // saved entry's id only matters for the saved-list's own bookkeeping.
  function selectSaved(entry: SavedEmployeeEntry) {
    const { id: _id, ...snapshot } = entry;
    setProfile(snapshot);
    commit(snapshot);
  }

  async function handleSaveForReuse() {
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

  const fields: {
    key: keyof EmployeeSnapshot;
    label: string;
    minWidth: number;
  }[] = [
    { key: "name", label: "ชื่อ-นามสกุล", minWidth: 180 },
    { key: "position", label: "ตำแหน่ง / Position", minWidth: 150 },
    { key: "department", label: "ฝ่าย / แผนก", minWidth: 150 },
    { key: "office", label: "Office", minWidth: 180 },
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
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        ข้อมูลพนักงาน (บันทึกไว้ใช้ซ้ำ)
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
        {fields.map((f) => (
          <div key={f.key} style={fieldWrap(f.minWidth)}>
            <label style={labelStyle}>{f.label}</label>
            <input
              value={profile[f.key]}
              onChange={(e) => {
                const value = e.target.value;
                set(f.key, value);
                if (f.key === "name") {
                  const entry = savedEmployeeList.find((s) => s.name === value);
                  if (entry) selectSaved(entry);
                }
              }}
              onBlur={() => commit()}
              placeholder={f.key === "name" ? "ชื่อ-นามสกุล" : undefined}
              list={f.key === "name" ? "saved-employee-names" : undefined}
              style={inputStyle}
            />
            {f.key === "name" && (
              <>
                <datalist id="saved-employee-names">
                  {savedEmployeeList.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={handleSaveForReuse}
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
    </div>
  );
}
