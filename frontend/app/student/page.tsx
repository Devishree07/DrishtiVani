"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import DemoModeBanner from "@/components/DemoModeBanner";
import { fetchDocuments, isDemoMode } from "@/lib/api-client";
import type { DocumentRecord } from "@/types/document";

const categories = ["All", "Notes", "Equations", "Diagrams"] as const;

function getDocumentCategories(doc: DocumentRecord): string[] {
  const tags = ["Notes"];
  if (doc.blocks.some((b) => b.type === "equation")) tags.push("Equations");
  if (doc.blocks.some((b) => b.type === "diagram")) tags.push("Diagrams");
  return tags;
}

export default function StudentDashboard() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] =
    useState<(typeof categories)[number]>("All");

  useEffect(() => {
    let active = true;
    fetchDocuments()
      .then((docs) => {
        if (!active) return;
        const visible = isDemoMode()
          ? docs
          : docs.filter((d) => d.processingStatus === "published");
        setDocuments(visible);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load published materials.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = documents.filter((doc) => {
    const docTags = getDocumentCategories(doc);
    const matchesCategory = category === "All" || docTags.includes(category);
    const matchesQuery = `${doc.title} ${doc.subject} ${doc.filename}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <main className="min-h-screen p-5 sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="reveal flex flex-wrap items-center justify-between gap-4 border-b border-[#d9d0c3] pb-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight"
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
          <div className="flex items-center gap-3">
            <Link
              href="/teacher"
              className="inline-flex min-h-[44px] items-center rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-2 text-sm font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
            >
              Teacher portal
            </Link>
            <Link
              href="/choose-role"
              className="inline-flex min-h-[44px] items-center rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-2 text-sm font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
            >
              Switch role
            </Link>
          </div>
        </header>

        <div className="mt-5">
          <DemoModeBanner />
        </div>

        {/* Greeting */}
        <section className="reveal reveal-1 flex items-center gap-5 pb-8 pt-2">
          <div className="icon-medallion h-18 w-18 shrink-0 p-3">
            <Image
              src="/icons/headphones-human.svg"
              alt=""
              width={44}
              height={44}
              aria-hidden="true"
              draggable={false}
            />
          </div>
          <div>
            <h1 className="ink-heading text-4xl">Hi, Student!</h1>
            <p className="mt-1.5 text-base text-[#3b362f]">
              Search or pick a published study material to listen and navigate
              with your keyboard.
            </p>
          </div>
        </section>

        {/* Search & filters */}
        <div className="reveal reveal-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full max-w-xl">
            <span className="sr-only">Search study materials</span>
            <Image
              src="/icons/app-window-search-text.svg"
              alt=""
              width={22}
              height={22}
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search published materials…"
              className="paper-input w-full py-3.5 pl-12 pr-4 text-base"
            />
          </label>

          <div
            role="tablist"
            aria-label="Filter by material type"
            className="flex flex-wrap gap-2"
          >
            {categories.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(cat)}
                  className={`min-h-[42px] rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-all duration-200 ${
                    active
                      ? "border-[#211f1b] bg-[#ffe08a] text-[#211f1b]"
                      : "border-[#d9d0c3] bg-[#fffcf6] text-[#3b362f] hover:border-[#211f1b]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Materials grid */}
        <section className="reveal reveal-3 mt-8">
          <h2 className="text-xl font-extrabold">Published Materials</h2>

          {error ? (
            <div
              role="alert"
              className="paper-card mt-4 border-[#dc2626] bg-[#fff5f5] p-6 text-sm font-bold text-[#7f1d1d]"
            >
              {error}
            </div>
          ) : loading ? (
            <div className="paper-card mt-4 p-8 text-center text-sm font-semibold text-[#3b362f]">
              Loading published materials...
            </div>
          ) : filtered.length === 0 ? (
            <div className="paper-card mt-4 p-8 text-center">
              <p className="text-base font-semibold text-[#211f1b]">
                {documents.length === 0
                  ? "No published materials available yet. Ask your teacher to review and publish a document."
                  : "No matching materials found."}
              </p>
              {documents.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("All");
                  }}
                  className="sketch-button-secondary mt-4 text-sm"
                >
                  Reset search
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((doc) => {
                const hasDiagram = doc.blocks.some((b) => b.type === "diagram");
                const icon = hasDiagram
                  ? "/icons/programming-flowchart.svg"
                  : "/icons/notes-book.svg";
                const blockCount =
                  doc.blocks.length > 0
                    ? doc.blocks.length
                    : (doc.totalBlocks ?? 0);

                return (
                  <article
                    key={doc.id}
                    className="paper-card paper-card-interactive group flex flex-col items-center p-7 text-center"
                  >
                    <div className="icon-medallion h-18 w-18 p-3 group-hover:scale-105">
                      <Image
                        src={icon}
                        alt=""
                        width={42}
                        height={42}
                        aria-hidden="true"
                        draggable={false}
                      />
                    </div>
                    <span className="mt-5 rounded-full bg-[#f2ece0] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#3b362f]">
                      {doc.subject}
                    </span>
                    <h3 className="mt-2.5 text-lg font-extrabold leading-snug text-[#211f1b]">
                      {doc.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-[#3b362f]">
                      {doc.totalPages}{" "}
                      {doc.totalPages === 1 ? "page" : "pages"} · {blockCount}{" "}
                      accessible blocks
                    </p>
                    <Link
                      href={`/student/study?docId=${encodeURIComponent(doc.id)}`}
                      className="sketch-button mt-6 w-full"
                    >
                      <span>Open reader</span>
                      <span
                        aria-hidden="true"
                        className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
