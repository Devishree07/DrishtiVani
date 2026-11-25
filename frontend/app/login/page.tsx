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

  const roleDescription =
    role === "teacher"
      ? "Upload engineering PDFs, inspect bounding boxes, resolve confidence warnings (< 0.88), and publish verified study materials."
      : "Read and listen to accessible engineering notes, spoken equations, structured tables, and described circuit diagrams with full keyboard navigation.";

  return (
    <main className="min-h-screen px-6 py-6 sm:px-10 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between gap-6">
        {/* Desktop Top Navigation Bar */}
        <header className="reveal flex items-center justify-between border-b border-[#d9d0c3] pb-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-[#211f1b]"
          >
            <Image
              src="/icons/book-bookmark.svg"
              alt=""
              width={32}
              height={32}
              aria-hidden="true"
              draggable={false}
            />
            <span>DrishtiVani</span>
          </Link>

          <Link
            href="/choose-role"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-1.5 text-sm font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
          >
            <Image
              src="/icons/keyboard-arrow-return.svg"
              alt=""
              width={18}
              height={18}
              aria-hidden="true"
              draggable={false}
            />
            <span>Back to role selection</span>
          </Link>
        </header>

        {/* Desktop Split-Pane Login Card */}
        <section className="paper-card reveal my-auto grid w-full overflow-hidden lg:grid-cols-12">
          {/* Left Column: Role Context + Temporary Demo Access */}
          <div className="flex flex-col justify-between border-b border-[#d9d0c3] bg-[#f2ece0]/65 p-7 sm:p-10 lg:col-span-5 lg:border-b-0 lg:border-r">
            <div>
              <span className="inline-block rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#3b362f]">
                {role === "teacher" ? "Educator Portal" : "Student Portal"}
              </span>

              <div className="mt-6 flex items-center gap-4">
                <div className="icon-medallion h-20 w-20 shrink-0">
                  <Image
                    src={iconSrc}
                    alt=""
                    width={48}
                    height={48}
                    aria-hidden="true"
                    draggable={false}
                  />
                </div>
                <div>
                  <h1 className="ink-heading text-3xl capitalize sm:text-4xl">
                    {role}
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-[#3b362f]">
                    {isSignup ? "Create your account" : "Welcome back"}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-[#3b362f] sm:text-base">
                {roleDescription}
              </p>
            </div>

            {/* Temporary Demo Access — always visible without scrolling on desktop */}
            <div className="mt-8 rounded-2xl border-2 border-dashed border-[#211f1b] bg-[#ffe08a]/45 p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#211f1b]">
                Temporary Demo Access
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#3b362f]">
                Open the Teacher or Student workspace directly — no email,
                password, or backend login required.
              </p>

              {!showDemoChoices ? (
                <button
                  type="button"
                  onClick={() => setShowDemoChoices(true)}
                  className="sketch-button mt-4 min-h-[44px] w-full text-sm"
                >
                  Enter Demo Mode
                </button>
              ) : (
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
          </div>

          {/* Right Column: Sign-in / Sign-up Form */}
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:col-span-7">
            <div className="mx-auto w-full max-w-lg">
              {/* Role switcher pill */}
              <div
                role="tablist"
                aria-label="Select role"
                className="grid grid-cols-2 rounded-full border border-[#d9d0c3] bg-[#f2ece0] p-1"
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
                      className={`rounded-full py-2.5 text-sm font-bold capitalize transition-all duration-200 ${
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

              <h2 className="mt-6 text-2xl font-extrabold text-[#211f1b]">
                {isSignup
                  ? `Sign up as a ${role}`
                  : `Log in to your ${role} workspace`}
              </h2>

              {/* Form */}
              <form
                className="mt-5 space-y-4"
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold sm:col-span-2">
                    Email
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="paper-input mt-2 w-full px-4 py-3"
                    />
                  </label>

                  <label className="block text-sm font-semibold sm:col-span-2">
                    Password
                    <span className="paper-input mt-2 flex items-center">
                      <input
                        required
                        minLength={8}
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          isSignup ? "new-password" : "current-password"
                        }
                        placeholder="••••••••"
                        className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-xl transition-colors hover:bg-[#f2ece0]"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
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
                </div>

                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <button
                    type="submit"
                    className="sketch-button min-h-[48px] w-full text-sm"
                  >
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

                  <button
                    type="button"
                    onClick={() => alert("Google sign-in coming next.")}
                    className="sketch-button-secondary min-h-[48px] w-full text-sm"
                  >
                    Continue with Google
                  </button>
                </div>
              </form>

              {/* Toggle signup/login */}
              <p className="mt-6 text-sm text-[#3b362f]">
                {isSignup ? "Have an account?" : "New here?"}{" "}
                <button
                  type="button"
                  onClick={() => setIsSignup(!isSignup)}
                  className="font-bold text-[#211f1b] underline underline-offset-4 transition-opacity hover:opacity-75"
                >
                  {isSignup ? "Log in" : "Sign up"}
                </button>
              </p>
            </div>
          </div>
        </section>

        <span className="h-2" aria-hidden="true" />
      </div>
    </main>
  );
}
