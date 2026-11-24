"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import DemoModeBanner from "@/components/DemoModeBanner";
import AccessibleDocumentReader from "@/components/student/AccessibleDocumentReader";
import { fetchDocumentById, fetchDocuments, isDemoMode } from "@/lib/api-client";
import type { DocumentRecord } from "@/types/document";

function StudentStudyInner() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");

  const [documentRecord, setDocumentRecord] = useState<DocumentRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStudyDoc() {
      try {
        let targetId = docId;
        if (!targetId) {
          const docs = await fetchDocuments();
          const published = isDemoMode()
            ? docs
            : docs.filter((d) => d.processingStatus === "published");
          targetId = published[0]?.id ?? null;
        }
        if (!targetId) {
          if (active) setDocumentRecord(null);
          return;
        }
        const full = await fetchDocumentById(targetId);
        if (active) setDocumentRecord(full);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load accessible document.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStudyDoc();
    return () => {
      active = false;
    };
  }, [docId]);

  return (
    <main className="min-h-screen p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d9d0c3] pb-5">
          <Link
            href="/student"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-1.5 text-sm font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
          >
            <Image
              src="/icons/keyboard-arrow-return.svg"
              alt=""
              width={18}
              height={18}
              aria-hidden="true"
            />
            <span>All materials</span>
          </Link>

          <Link
            href="/choose-role"
            className="inline-flex min-h-[42px] items-center rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-1.5 text-sm font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
          >
            Switch role
          </Link>
        </header>

        <div className="mt-5">
          <DemoModeBanner />
        </div>

        {error ? (
          <div
            role="alert"
            className="paper-card border-[#dc2626] bg-[#fff5f5] p-6 text-sm font-bold text-[#7f1d1d]"
          >
            {error}
          </div>
        ) : loading ? (
          <div className="paper-card p-8 text-center text-sm font-semibold text-[#3b362f]">
            Loading accessible study material...
          </div>
        ) : !documentRecord ? (
          <div className="paper-card p-8 text-center text-sm font-semibold text-[#3b362f]">
            No published study material found.
          </div>
        ) : (
          <>
            <section className="mb-6">
              <span className="rounded-full bg-[#f2ece0] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#3b362f]">
                {documentRecord.subject}
              </span>
              <h1 className="ink-heading mt-3 text-3xl sm:text-4xl">
                {documentRecord.title}
              </h1>
            </section>

            <AccessibleDocumentReader documentRecord={documentRecord} />
          </>
        )}
      </div>
    </main>
  );
}

export default function StudentStudyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8 text-center text-sm font-semibold text-[#3b362f]">
          Loading study material...
        </main>
      }
    >
      <StudentStudyInner />
    </Suspense>
  );
}
