import type { SVGProps } from "react";

// Inline stroke icons for the 2026 redesign shell — 24×24, stroke-width 2,
// round caps, Lucide/Phosphor-ish. Kept as hand-rolled SVG rather than an
// icon-font/package: the app's CSP is strict same-origin and the set needed
// is tiny. Paths lifted from the Claude Design mockup artboards. `currentColor`
// so callers control colour via `color` / Tailwind text utilities.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 22, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Icon>
);

export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 6.5h10M8 12h10M8 17.5h10" />
    <circle cx="4.5" cy="6.5" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="17.5" r="1" />
  </Icon>
);

export const FileTextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
    <path d="M3.5 4.5h17v4h-17zM10 13h4" />
  </Icon>
);

export const ReceiptIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v15l-3.5-2.5-3.5 2.5-3.5-2.5L5 20V5a1.5 1.5 0 0 1 1.5-1.5z" />
    <path d="M9 8h6M9 12h6" />
  </Icon>
);

export const CarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12.5 8 6.5h8l3.5 6M5 12.5h14v5H5z" />
    <circle cx="8" cy="17.5" r="1.6" />
    <circle cx="16" cy="17.5" r="1.6" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 20.5H7a2 2 0 0 1-2-2v-2.4c-.9-.5-1.6-1.3-2-2.2l.5-2.5c.4-.9 1.1-1.7 2-2.2V6.8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 4.5v2M12 17.5v2M19 12h1.5M3.5 12H5M16.9 7.1l1-1M6.1 17.9l1-1M16.9 16.9l1 1M6.1 6.1l1 1" />
  </Icon>
);

export const LogOutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5H7A2 2 0 0 0 5 6.5v11a2 2 0 0 0 2 2h7" />
    <path d="M17 8.5 20.5 12 17 15.5M20.5 12H10" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.7-3.6 3.6-5.5 7-5.5s6.3 1.9 7 5.5" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icon>
);

export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.5 6.7A6.4 6.4 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a15 15 0 0 1-3 3.4" />
    <path d="M6.2 6.3A15 15 0 0 0 2.5 12S6 17.5 12 17.5a9 9 0 0 0 3.8-.8" />
    <path d="M3 3l18 18" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 6 15.5 12l-6 6" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9.5 12 15l6-5.5" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l7 3v5.5c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6.5z" />
    <path d="M9 12.5l2 2 4-4.5" />
  </Icon>
);

export type { IconProps };
