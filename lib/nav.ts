import {
  GridIcon,
  ListIcon,
  CarIcon,
  ReceiptIcon,
  FileTextIcon,
  SettingsIcon,
  type IconProps,
} from "@/components/icons";

// Single source of truth for the app-shell sidebar. Add a route (a future
// subsystem, a settings page) = add one entry here. `disabled` entries
// render greyed-out with a "เร็วๆ นี้" tooltip and no navigation.
export interface NavItem {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  // Active when this returns true for the current pathname. Defaults to
  // exact match on `href`.
  match?: (pathname: string) => boolean;
  disabled?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    // The Applications launcher — the portal front door ("ศูนย์รวมระบบงานภายใน").
    href: "/",
    label: "หน้าหลัก",
    icon: GridIcon,
    match: (p) => p === "/",
  },
  {
    href: "/records",
    label: "รายการทั้งหมด",
    icon: ListIcon,
    match: (p) => p.startsWith("/records"),
  },
  {
    href: "/travel",
    label: "คำนวณค่าเดินทาง",
    icon: CarIcon,
    match: (p) => p.startsWith("/travel"),
  },
  {
    // Short label to fit the 230px expanded rail — the mockup uses
    // "Expense Claim" here.
    href: "/bill/entry/fa017",
    label: "Expense Claim",
    icon: ReceiptIcon,
    match: (p) => p.startsWith("/bill/entry/fa017"),
  },
  {
    href: "/bill/entry/fa018",
    label: "ใบรับรองแทนใบเสร็จ",
    icon: FileTextIcon,
    match: (p) => p.startsWith("/bill/entry/fa018"),
  },
  {
    // No settings screen yet — shown for the "expandable system" shape.
    href: "#",
    label: "ตั้งค่า",
    icon: SettingsIcon,
    disabled: true,
  },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.disabled) return false;
  return item.match ? item.match(pathname) : pathname === item.href;
}
