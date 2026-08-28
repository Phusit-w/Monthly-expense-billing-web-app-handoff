"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { login } from "@/actions/auth";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import { UserIcon, LockIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

// 2026 redesign login — split panel (Claude Design "Turn 3d" +
// "Claude Prompt - ICN Animated Login.md"): a dark ICN panel on the left, a
// clean white form on the right, floating inside the viewport with a 24px
// margin all round. Deliberately WITHOUT the animated mascot / entrance
// motion from Login.dc.html — that's a later, optional pass.
//
// Auth is untouched: still the `login()` server action, the sanitised
// `next` target, and router.push + router.refresh so the freshly-set
// session cookie is reflected everywhere.
export default function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      router.push(result.mustChangePassword ? "/change-password" : next);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#e8e8e8] p-6 font-sans">
      <div className="flex w-full max-w-[1500px] overflow-hidden rounded-shell md:min-h-[680px]">
        {/* Left: ICN brand panel — hidden on narrow screens */}
        <div className="hidden w-[42%] shrink-0 flex-col justify-center gap-5 rounded-shell bg-[#050505] p-11 text-white md:flex">
          <div className="flex items-center gap-3">
            <Image
              src="/icn-logo-white.png"
              alt="ICN"
              width={96}
              height={96}
              priority
              className="h-12 w-12 object-contain"
            />
          </div>
          <div className="font-display text-4xl font-bold leading-tight">
            ICN Apps
          </div>
        </div>

        {/* Right: form */}
        <div className="flex flex-1 items-center justify-center rounded-shell bg-surface p-6 md:ml-3">
          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-[420px] flex-col gap-5 px-2"
          >
            <div className="mb-1 flex flex-col items-center gap-1.5 text-center md:hidden">
              <Image
                src="/icn-logo-white.png"
                alt="ICN"
                width={80}
                height={80}
                priority
                className="mb-2 h-14 w-14 object-contain"
              />
            </div>

            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="font-display text-3xl font-bold leading-tight text-ink">
                เข้าสู่ระบบ
              </div>
              <div className="text-sm text-muted">
                ใช้บัญชีพนักงานของคุณเพื่อเริ่มใช้งาน
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Field
                label="Username"
                aria-label="Username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                leftIcon={<UserIcon size={18} />}
              />
              <Field
                label="Password"
                aria-label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<LockIcon size={18} />}
                rightSlot={
                  <button
                    type="button"
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="ui-btn flex items-center p-1 text-muted transition-colors hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOffIcon size={18} />
                    ) : (
                      <EyeIcon size={18} />
                    )}
                  </button>
                }
              />
            </div>

            {error ? (
              <div className="text-[13px] font-medium text-danger">{error}</div>
            ) : null}

            <Button
              type="submit"
              variant="dark"
              disabled={pending}
              className="h-[52px] w-full font-display font-bold"
            >
              {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>

            <div className="text-center text-[13px] text-muted">
              ลืมรหัสผ่าน? ติดต่อฝ่าย IT
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
