import Link from "next/link";
import Image from "next/image";

const roles = [
  {
    name: "Teacher",
    href: "/login?role=teacher",
    icon: "/icons/meeting-presentation.svg",
    description: "Upload PDFs and review accessible study materials.",
  },
  {
    name: "Student",
    href: "/login?role=student",
    icon: "/icons/headphones-human.svg",
    description: "Listen to notes, spoken equations, and described diagrams.",
  },
];

export default function ChooseRole() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-between px-6 py-8 text-center sm:px-10 sm:py-10">
        {/* Back + logo */}
        <header className="reveal flex w-full items-center justify-between">
          <Link
            href="/"
            aria-label="Go back to home"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-transparent transition-colors hover:border-[#d9d0c3] hover:bg-[#fffcf6]"
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
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight"
          >
            <Image
              src="/icons/book-bookmark.svg"
              alt=""
              width={30}
              height={30}
              aria-hidden="true"
              draggable={false}
            />
            <span>DrishtiVani</span>
          </Link>
          <span className="w-11" aria-hidden="true" />
        </header>

        {/* Center section */}
        <div className="my-10 flex w-full flex-col items-center gap-9">
          <div className="reveal reveal-1">
            <h1 className="ink-heading text-4xl sm:text-5xl">Who are you?</h1>
            <p className="mt-3 text-lg text-[#3b362f]">
              Choose your role to continue.
            </p>
          </div>

          {/* Role cards */}
          <div className="reveal reveal-2 grid w-full gap-6 sm:grid-cols-2">
            {roles.map((role) => (
              <Link
                key={role.name}
                href={role.href}
                className="paper-card paper-card-interactive group flex flex-col items-center gap-4 p-8 text-center"
              >
                <div className="icon-medallion h-20 w-20 group-hover:scale-105">
                  <Image
                    src={role.icon}
                    alt=""
                    width={48}
                    height={48}
                    aria-hidden="true"
                    draggable={false}
                  />
                </div>
                <span className="mt-1 text-2xl font-extrabold text-[#211f1b]">
                  {role.name}
                </span>
                <p className="text-sm leading-relaxed text-[#3b362f]">
                  {role.description}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-[#211f1b]">
                  Continue
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <span className="h-4" aria-hidden="true" />
      </div>
    </main>
  );
}
