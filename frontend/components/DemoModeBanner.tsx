"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDemoMode } from "@/lib/api-client";

interface DemoModeBannerProps {
  onResetDemo?: () => void;
}

export default function DemoModeBanner({ onResetDemo }: DemoModeBannerProps) {
  const pathname = usePathname();
  if (!isDemoMode()) return null;

  const isTeacherRoute = pathname?.startsWith("/teacher");
  const isStudentRoute = pathname?.startsWith("/student");

  return (
    <aside
      role="status"
      aria-label="Demo Mode active"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#211f1b] bg-[#ffe08a]/65 px-4 py-3 text-sm text-[#211f1b] shadow-[2px_3px_0_rgba(33,31,27,0.12)]"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-[#211f1b] bg-[#211f1b] px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-[#ffe08a]">
          Demo Mode
        </span>
        <span className="font-semibold">
          Temporary demo access — using local mock data (FastAPI backend not
          connected).
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isTeacherRoute && (
          <Link
            href="/student"
            className="rounded-full border border-[#211f1b] bg-[#fffcf6] px-3.5 py-1 text-xs font-bold text-[#211f1b] transition-colors hover:bg-[#f2ece0]"
          >
            Switch to Student Demo
          </Link>
        )}
        {isStudentRoute && (
          <Link
            href="/teacher"
            className="rounded-full border border-[#211f1b] bg-[#fffcf6] px-3.5 py-1 text-xs font-bold text-[#211f1b] transition-colors hover:bg-[#f2ece0]"
          >
            Switch to Teacher Demo
          </Link>
        )}
        {onResetDemo && (
          <button
            type="button"
            onClick={onResetDemo}
            className="rounded-full border border-[#211f1b] bg-[#fffcf6] px-3.5 py-1 text-xs font-bold text-[#211f1b] transition-colors hover:bg-[#f2ece0]"
          >
            Reset mock data
          </button>
        )}
      </div>
    </aside>
  );
}
