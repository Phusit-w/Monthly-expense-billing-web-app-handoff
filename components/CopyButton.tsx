"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

// Project Card's folder_path is a UNC path meant to be pasted into
// Explorer's address bar (see docs/adr/0003-project-card-drop-file-level-
// search.md) — there's no reliable in-browser way to open it directly, so
// copy-to-clipboard is the whole affordance.
export default function CopyButton({ value, label = "คัดลอก" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard API can be unavailable (non-secure context, denied
          // permission) — the path is still selectable text next to this
          // button, so failing silently here isn't a dead end for the user.
        }
      }}
    >
      {copied ? "คัดลอกแล้ว" : label}
    </Button>
  );
}
