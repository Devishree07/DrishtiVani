"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import DemoModeBanner from "@/components/DemoModeBanner";
import DocumentQueueList from "@/components/teacher/DocumentQueueList";
import DocumentUploadCard from "@/components/teacher/DocumentUploadCard";
import TeacherStatsGrid from "@/components/teacher/TeacherStatsGrid";
import {
  API_BASE_URL,
  checkBackendHealth,
  fetchDocuments,
  fetchDocumentStatus,
  isDemoMode,
  resetDemoDocuments,
  uploadDocument,
} from "@/lib/api-client";
import type { DocumentRecord } from "@/types/document";

export default function TeacherDashboard() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<string>(
    isDemoMode() ? "demo" : "checking",
  );
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  async function loadDashboard() {
    setError(null);
    try {
      const [health, docs] = await Promise.all([
        checkBackendHealth(),
        fetchDocuments(),
      ]);
      setBackendStatus(
        isDemoMode()
          ? "demo"
          : health.status === "healthy"
            ? "connected"
            : "unhealthy",
      );
      setDocuments(docs);
    } catch (err) {
      setBackendStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : `Could not connect to backend at ${API_BASE_URL}.`,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([checkBackendHealth(), fetchDocuments()])
      .then(([health, docs]) => {
        if (!active) return;
        setBackendStatus(
          isDemoMode()
            ? "demo"
            : health.status === "healthy"
              ? "connected"
              : "unhealthy",
        );
        setDocuments(docs);
      })
      .catch((err) => {
        if (!active) return;
        setBackendStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : `Could not connect to backend at ${API_BASE_URL}.`,
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleUpload(file: File) {
    setUploadProgress(`Uploading ${file.name}...`);
    const { documentId, status } = await uploadDocument(file);

    if (!isDemoMode() && status !== "parsed" && status !== "failed") {
      setUploadProgress("Uploaded (HTTP 202). Polling processing status...");
      for (let attempt = 0; attempt < 45; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));
        const st = await fetchDocumentStatus(documentId);
        if (st.status === "parsed") {
          setUploadProgress(
            `Parsed ${st.page_count} page(s) successfully.`,
          );
          break;
        }
        if (st.status === "failed") {
          throw new Error(
            st.error_message || "Document processing failed on backend.",
          );
        }
      }
    } else {
      setUploadProgress("Queued in Demo Mode.");
    }

    const updated = await fetchDocuments();
    setDocuments(updated);
  }

  function handleResetDemo() {
    const fresh = resetDemoDocuments();
    setDocuments(fresh);
  }

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
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                backendStatus === "connected"
                  ? "bg-[#e3f2d9] text-[#213a18]"
                  : backendStatus === "error" || backendStatus === "unhealthy"
                    ? "bg-[#fde2e1] text-[#7f1d1d]"
                    : "bg-[#f2ece0] text-[#3b362f]"
              }`}
            >
              {backendStatus === "connected"
                ? `Backend connected (${API_BASE_URL})`
                : backendStatus === "demo"
                  ? "Teacher workspace (Demo)"
                  : backendStatus === "checking"
                    ? "Checking backend..."
                    : "Backend unreachable"}
            </span>
            <Link
              href="/teacher/review"
              className="inline-flex min-h-[42px] items-center rounded-full border-2 border-[#211f1b] bg-[#ffe08a] px-4 py-1.5 font-bold text-[#211f1b] transition-colors hover:bg-[#ffd35c]"
            >
              Review console
            </Link>
            <Link
              href="/student"
              className="inline-flex min-h-[42px] items-center rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-1.5 font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
            >
              Student portal
            </Link>
            <Link
              href="/choose-role"
              className="inline-flex min-h-[42px] items-center rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-1.5 font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
            >
              Switch role
            </Link>
          </div>
        </header>

        <div className="mt-5">
          <DemoModeBanner onResetDemo={handleResetDemo} />
        </div>

        {/* Greeting */}
        <section className="reveal reveal-1 flex items-center gap-5 pb-8 pt-2">
          <div className="icon-medallion h-18 w-18 shrink-0 p-3">
            <Image
              src="/icons/meeting-presentation.svg"
              alt=""
              width={44}
              height={44}
              aria-hidden="true"
              draggable={false}
            />
          </div>
          <div>
            <h1 className="ink-heading text-4xl">Hello, Teacher!</h1>
            <p className="mt-1.5 text-base text-[#3b362f]">
              Upload PDFs, monitor processing status, and review flagged blocks
              before publishing to students.
            </p>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="paper-card mb-6 flex flex-wrap items-center justify-between gap-3 border-[#dc2626] bg-[#fff5f5] p-5 text-sm text-[#7f1d1d]"
          >
            <div>
              <p className="font-extrabold">Backend Connection Error</p>
              <p className="mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="sketch-button-secondary px-4 py-2 text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="paper-card p-8 text-center text-sm font-semibold text-[#3b362f]">
            Loading documents from {isDemoMode() ? "Demo Store" : API_BASE_URL}
            ...
          </div>
        ) : (
          <>
            <TeacherStatsGrid documents={documents} />

            <section className="reveal reveal-3 mt-8 grid gap-6 lg:grid-cols-2">
              <DocumentUploadCard
                onUploadFile={handleUpload}
                uploadProgress={uploadProgress}
              />
              <DocumentQueueList documents={documents} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
