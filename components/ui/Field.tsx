"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

// Label + framed input for the redesign (mockup: label 13/500 #6b6b6b,
// input radius 14, 1px #E4E4E4, focus ring 0 0 0 3px rgb(0 0 0 / .04)).
// Supports an optional leading icon and a trailing slot (e.g. the password
// show/hide toggle). The frame is a wrapper div so the icons sit inside the
// border; the real <input> is borderless within it.

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  containerClassName?: string;
}

export default function Field({
  label,
  leftIcon,
  rightSlot,
  containerClassName = "",
  id,
  className = "",
  ...rest
}: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={containerClassName}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-[13px] font-medium text-label"
      >
        {label}
      </label>
      <div
        className="flex items-center gap-2.5 rounded-field border border-line bg-surface px-4
          transition-[border-color,box-shadow] duration-150
          focus-within:border-[#181818] focus-within:shadow-[0_0_0_3px_rgb(0_0_0/0.04)]"
      >
        {leftIcon ? (
          <span className="shrink-0 text-muted">{leftIcon}</span>
        ) : null}
        <input
          id={inputId}
          className={`h-[52px] w-full border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted ${className}`}
          {...rest}
        />
        {rightSlot ? <span className="shrink-0">{rightSlot}</span> : null}
      </div>
    </div>
  );
}
