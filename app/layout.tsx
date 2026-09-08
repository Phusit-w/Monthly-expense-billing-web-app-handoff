import type { Metadata } from "next";
import { Poppins, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

// 2026 redesign typography (Claude Design handoff "Web app selector UI
// mockups"): Poppins for display/numerals/brand, IBM Plex Sans Thai for all
// Thai UI/body text. Both self-hosted by next/font at build time — the app's
// CSP is `default-src 'self'`, so a Google Fonts <link> would be blocked.
// Exposed as CSS variables consumed by @theme in globals.css
// (--font-display / --font-sans). Replaces Sarabun.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ICN APPS",
  description: "ระบบกรอกและพิมพ์แบบฟอร์มเบิกค่าใช้จ่ายรายเดือน (F-FA-017 / F-FA-018)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="th"
      className={`${poppins.variable} ${ibmPlexSansThai.variable}`}
    >
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          // Legacy screens still render their own #e7e5e0 backdrop via
          // PageShell; the redesigned app shell paints --color-ground over
          // its own area. This is only ever a load flash.
          background: "#e7e5e0",
          fontFamily: "var(--font-sans), Arial, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
