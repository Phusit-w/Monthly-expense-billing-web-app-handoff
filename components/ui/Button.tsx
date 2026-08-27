import type { ButtonHTMLAttributes } from "react";

// Shared button for the 2026 redesign. Carries the `ui-btn` class, which
// globals.css's site-wide `button:hover → solid black` scaffolding rule
// explicitly excludes, so each variant keeps its own hover treatment.
// Legacy screens keep their inline-styled <button>s until they're converted.

type Variant = "primary" | "dark" | "outline" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "ui-btn inline-flex items-center justify-center gap-2 rounded-input font-medium " +
  "transition-colors disabled:opacity-60 disabled:pointer-events-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const sizes: Record<Size, string> = {
  md: "h-[46px] px-5 text-sm",
  sm: "h-9 px-3.5 text-[13px]",
};

const variants: Record<Variant, string> = {
  // Poppins, orange — the mockup's primary CTA
  primary:
    "bg-accent text-ink font-display font-bold hover:bg-[#f08d10] active:bg-[#e08207]",
  dark: "bg-ink text-white hover:bg-[#1a1a1a] active:bg-[#050505]",
  outline:
    "border border-line bg-surface text-label hover:bg-hover hover:text-ink",
  ghost: "bg-transparent text-label hover:bg-hover hover:text-ink",
  danger:
    "border border-danger-border bg-surface text-danger hover:bg-danger hover:text-white",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
