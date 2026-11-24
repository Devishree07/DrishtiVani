import Link from "next/link";
import Image from "next/image";
import ReadAloudButton from "@/components/ReadAloudButton";

const PAGE_AUDIO_SUMMARY =
  "Welcome to DrishtiVani. Notes that speak. Accessible audio notes, spoken equations, and described diagrams, designed for blind and visually impaired students. Select Begin to choose your student or teacher role.";

const highlights = [
  { label: "Audio Notes", icon: "/icons/notes-book.svg" },
  { label: "Spoken Equations", icon: "/icons/accounting-calculator.svg" },
  { label: "Described Diagrams", icon: "/icons/programming-flowchart.svg" },
];

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Skip link for keyboard and screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:border-2 focus:border-[#211f1b] focus:bg-[#ffe08a] focus:px-5 focus:py-3 focus:text-base focus:font-bold focus:text-[#211f1b]"
      >
        Skip to main content
      </a>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-between px-6 py-8 text-center sm:px-10 sm:py-10">
        {/* Brand header */}
        <header className="reveal flex w-full items-center justify-between">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full px-3 py-1 transition-opacity hover:opacity-80"
            aria-label="DrishtiVani home"
          >
            <Image
              src="/icons/book-bookmark.svg"
              alt=""
              width={32}
              height={32}
              aria-hidden="true"
              draggable={false}
            />
            <span className="text-xl font-extrabold tracking-tight text-[#211f1b] sm:text-2xl">
              DrishtiVani
            </span>
          </Link>

          <Link
            href="/choose-role"
            className="inline-flex min-h-[44px] items-center rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-2 text-sm font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
          >
            Sign in
          </Link>
        </header>

        {/* Primary reading content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="my-12 flex flex-col items-center gap-7 focus:outline-none"
        >
          {/* Framed hero emblem */}
          <div
            className="reveal reveal-1 icon-medallion floating-icon h-24 w-24"
            aria-hidden="true"
          >
            <Image
              src="/icons/book-sound-audio.svg"
              alt=""
              width={56}
              height={56}
              priority
              draggable={false}
            />
          </div>

          <h1 className="reveal reveal-2 ink-heading text-5xl text-[#211f1b] sm:text-6xl lg:text-7xl">
            Notes that{" "}
            <span className="inline-block rounded-2xl bg-[#ffe08a]/70 px-3 pb-1">
              speak.
            </span>
          </h1>

          <p className="reveal reveal-2 max-w-lg text-lg leading-relaxed text-[#3b362f] sm:text-xl">
            Accessible audio notes, spoken equations, and described diagrams —
            designed for blind and visually impaired students.
          </p>

          {/* Primary actions */}
          <div className="reveal reveal-3 mt-1 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/choose-role"
              className="sketch-button group min-h-[52px] px-9 py-3.5 text-lg"
            >
              <span>Begin</span>
              <span className="sr-only">
                {" "}
                — choose your student or teacher role
              </span>
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-200 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>

            <ReadAloudButton text={PAGE_AUDIO_SUMMARY} />
          </div>

          {/* Crisp feature highlights */}
          <ul
            aria-label="Key accessibility features"
            className="reveal reveal-4 mt-4 flex flex-wrap items-center justify-center gap-3"
          >
            {highlights.map((item) => (
              <li
                key={item.label}
                className="inline-flex items-center gap-2.5 rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-2 text-sm font-semibold text-[#211f1b]"
              >
                <Image
                  src={item.icon}
                  alt=""
                  width={20}
                  height={20}
                  aria-hidden="true"
                  draggable={false}
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </main>

        {/* Accessible footer navigation */}
        <footer className="reveal reveal-4 w-full border-t border-[#e4dccf] pt-6">
          <nav
            className="flex flex-wrap items-center justify-center gap-6 text-base font-medium text-[#3b362f]"
            aria-label="Quick links"
          >
            <Link
              href="/login?role=student"
              className="inline-flex min-h-[44px] items-center underline underline-offset-4 transition-colors hover:text-[#211f1b]"
            >
              Student login
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/login?role=teacher"
              className="inline-flex min-h-[44px] items-center underline underline-offset-4 transition-colors hover:text-[#211f1b]"
            >
              Teacher login
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
