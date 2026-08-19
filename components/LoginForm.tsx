"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/actions/auth";

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid #ccc",
  borderRadius: 6,
  font: "inherit",
  fontSize: 14,
};

export default function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await login(username, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(next);
      // Header and any page-level data both need the freshly-set session
      // cookie reflected — router.push alone can serve a cached RSC
      // response from before login.
      router.refresh();
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#e7e5e0",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: 32,
          borderRadius: 8,
          border: "1px solid #d8d5cc",
          width: 320,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1c1c1c", textAlign: "center", marginBottom: 8 }}>
          เข้าสู่ระบบ
        </div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
          autoComplete="username"
          style={inputStyle}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          style={inputStyle}
        />
        {error && <div style={{ color: "#b3261e", fontSize: 13 }}>{error}</div>}
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "9px 16px",
            border: "1px solid #1c1c1c",
            borderRadius: 6,
            background: "#1c1c1c",
            color: "#fff",
            fontWeight: 600,
            font: "inherit",
            cursor: "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
