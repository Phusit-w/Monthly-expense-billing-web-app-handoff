import {
  ListIcon,
  CarIcon,
  ReceiptIcon,
  FileTextIcon,
  type IconProps,
} from "@/components/icons";

// Single source of truth for the app-shell sidebar. Replaces Header.tsx's
// four hand-written <Link>s with their duplicated inline styles and the
// `isHistory`/`isTravel`/… pathname sniffing. Add a route (Dashboard, the
// Applications launcher, a future subsystem) = add one entry here.
export interface NavItem {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  // Active when this returns true for the current pathname. Defaults to
  // exact match on `href`.
  match?: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "รายการทั้งหมด",
    icon: ListIcon,
    match: (p) => p === "/",
  },
  {
    href: "/travel",
    label: "คำนวณค่าเดินทาง",
    icon: CarIcon,
    match: (p) => p.startsWith("/travel"),
  },
  {
    // Short label to fit the 230px expanded rail — the mockup uses
    // "Expense Claim" here. The breadcrumb (AppTopBar) still shows the full
    // "กรอกข้อมูล Expense Claim".
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
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.match ? item.match(pathname) : pathname === item.href;
}
