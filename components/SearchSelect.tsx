"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A styled search-and-pick dropdown — the app's own list panel (not the
// browser's bare <datalist> popup), but filterable by typing. Shared by
// SavedEmployeePicker / SavedItemPicker (pick to fill a field) and
// SavedListManager (pick to stage for deletion). The list is portalled to
// <body> with fixed positioning so an ancestor's `overflow-hidden` (e.g.
// CollapsibleEntryRow) can't clip it; it closes on outside click, scroll,
// resize, or Escape.
export default function SearchSelect({
  options,
  onPick,
  placeholder,
  disabled,
  className,
  emptyText = "ไม่พบรายการ",
}: {
  options: string[];
  onPick: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
      setQuery("");
    }
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function pick(value: string) {
    onPick(value);
    setQuery("");
    setOpen(false);
  }

  return (
    <>
      <input
        ref={triggerRef}
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            if (open && filtered[active] != null) {
              e.preventDefault();
              pick(filtered[active]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
        className={className}
      />
      {open &&
        !disabled &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 max-h-[240px] max-w-[min(90vw,420px)] overflow-y-auto rounded-field border border-line bg-surface py-1 text-xs text-ink shadow-dropdown"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-muted">{emptyText}</li>
            ) : (
              filtered.map((o, i) => (
                <li key={o}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(o);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`ui-btn block w-full truncate px-3 py-2 text-left transition-colors ${
                      i === active ? "bg-hover" : ""
                    }`}
                  >
                    {o}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body
        )}
    </>
  );
}
