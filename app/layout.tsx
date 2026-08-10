import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

// Matches the design source's Google Fonts <link> for Sarabun 400/500/600/700.
const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sarabun",
});

export const metadata: Metadata = {
  title: "ระบบบิลค่าใช้จ่ายรายเดือน",
  description: "ระบบกรอกและพิมพ์แบบฟอร์มเบิกค่าใช้จ่ายรายเดือน (F-FA-017 / F-FA-018)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#e7e5e0",
          fontFamily: "var(--font-sarabun), Arial, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
