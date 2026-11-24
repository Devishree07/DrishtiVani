"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getRoleFromQuery = (): "teacher" | "student" => {
  if (typeof window === "undefined") return "student";
  const selected = new URLSearchParams(window.location.search).get("role");
  return selected === "teacher" ? "teacher" : "student";
};
const getServerRole = (): "teacher" | "student" => "student";

export default function LoginPage() {
  const initialRole = useSyncExternalStore(
    emptySubscribe,
    getRoleFromQuery,
    getServerRole,
  );
  const [roleOverride, setRoleOverride] = useState<"teacher" | "student" | null>(
    null,
  );
  const role = roleOverride ?? initialRole;

  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoChoices, setShowDemoChoices] = useState(false);

  const iconSrc =
    role === "teacher"
      ? "/icons/meeting-presentation.svg"
      : "/icons/headphones-human.svg";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="paper-card reveal w-full max-w-md p-6 sm:p-9">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/choose-role"
            aria-label="Go back to role selection"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-transparent transition-colors hover:border-[#d9d0c3] hover:bg-[#f2ece0]"
          >
            <Image
              src="/icons/keyboard-arrow-return.svg"
              alt=""
              width={24}
              height={24}
              aria-hidden="true"
              draggable={false}
            />
          </Link>
          <Link href="/" className="flex items-center gap-2 font-extrabold">
            <Image
              src="/icons/book-bookmark.svg"
              alt=""
              width={28}
              height={28}
              aria-hidden="true"
              draggable={false}
            />
            <span>DrishtiVani</span>
          </Link>
          <span className="w-11" aria-hidden="true" />
        </div>

        {/* Role switcher pill */}
        <div
          role="tablist"
          aria-label="Select role"
          className="mt-6 grid grid-cols-2 rounded-full border border-[#d9d0c3] bg-[#f2ece0] p-1"
        >
          {(["student", "teacher"] as const).map((r) => {
            const active = role === r;
            return (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRoleOverride(r)}
                className={`rounded-full py-2 text-sm font-bold capitalize transition-all duration-200 ${
                  active
                    ? "bg-[#fffcf6] text-[#211f1b] shadow-sm"
                    : "text-[#3b362f] hover:text-[#211f1b]"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>

        {/* Role icon + title */}
        <div className="mt-7 flex flex-col items-center gap-3">
          <div className="icon-medallion h-20 w-20">
            <Image
              src={iconSrc}
              alt=""
              width={48}
              height={48}
              aria-hidden="true"
              draggable={false}
            />
          </div>
          <h1 className="ink-heading text-3xl capitalize">{role}</h1>
          <p className="text-base text-[#3b362f]">
            {isSignup ? "Create your account" : "Welcome back"}
          </p>
        </div>

        {/* Form */}
        <form
          className="mt-7 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            alert("Authentication will be connected next.");
          }}
        >
          {isSignup && (
            <label className="block text-sm font-semibold">
              Name
              <input
                required
                autoComplete="name"
                placeholder="Your name"
                className="paper-input mt-2 w-full px-4 py-3"
              />
            </label>
          )}

          <label className="block text-sm font-semibold">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="paper-input mt-2 w-full px-4 py-3"
            />
          </label>

          <label className="block text-sm font-semibold">
            Password
            <span className="paper-input mt-2 flex items-center">
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="••••••••"
                className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-xl transition-colors hover:bg-[#f2ece0]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Image
                  src={
                    showPassword
                      ? "/icons/view-eye-off.svg"
                      : "/icons/view-eye-1.svg"
                  }
                  alt=""
                  width={22}
                  height={22}
                  aria-hidden="true"
                  draggable={false}
                />
              </button>
            </span>
          </label>

          <button type="submit" className="sketch-button mt-2 min-h-[50px] w-full">
            <Image
              src="/icons/login-rectangle.svg"
              alt=""
              width={20}
              height={20}
              aria-hidden="true"
              draggable={false}
            />
            <span>{isSignup ? "Sign up" : "Log in"}</span>
          </button>
        </form>

        {/* OR divider */}
        <div className="my-5 flex items-center gap-3 text-sm text-[#3b362f]">
          <span className="h-px flex-1 bg-[#d9d0c3]" />
          OR
          <span className="h-px flex-1 bg-[#d9d0c3]" />
        </div>

        <button
          type="button"
          onClick={() => alert("Google sign-in coming next.")}
          className="sketch-button-secondary min-h-[48px] w-full text-sm"
        >
          Continue with Google
        </button>

        {/* Toggle signup/login */}
        <p className="mt-6 text-center text-sm text-[#3b362f]">
          {isSignup ? "Have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="font-bold text-[#211f1b] underline underline-offset-4 transition-opacity hover:opacity-75"
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>

        {/* Temporary Demo Access (no auth required) */}
        <div className="mt-6 rounded-2xl border-2 border-dashed border-[#211f1b] bg-[#ffe08a]/35 p-4 text-center">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#211f1b]">
            Temporary Demo Access
          </p>
          <p className="mt-1 text-xs text-[#3b362f]">
            Explore the frontend with local mock data — no email, password, or
            backend login required.
          </p>

          {!showDemoChoices ? (
            <button
              type="button"
              onClick={() => setShowDemoChoices(true)}
              className="sketch-button mt-3 min-h-[44px] w-full text-sm"
            >
              Enter Demo Mode
            </button>
          ) : (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <Link
                href="/teacher"
                className="sketch-button min-h-[44px] px-3 py-2 text-xs"
              >
                Continue as Teacher
              </Link>
              <Link
                href="/student"
                className="sketch-button-secondary min-h-[44px] px-3 py-2 text-xs"
              >
                Continue as Student
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
