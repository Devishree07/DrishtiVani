"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import DemoModeBanner from "@/components/DemoModeBanner";
import BlockEditorControls from "@/components/review/BlockEditorControls";
import ExtractedBlocksPanel from "@/components/review/ExtractedBlocksPanel";
import PagePreviewCanvas from "@/components/review/PagePreviewCanvas";
import {
  fetchDocumentById,
  fetchDocuments,
  publishDocument,
  resetDemoDocuments,
  updateBlockVerification,
} from "@/lib/api-client";
import type {
  BlockVerificationUpdate,
  DocumentRecord,
} from "@/types/document";

function ReviewConsoleInner() {
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get("docId");

  const [docList, setDocList] = useState<DocumentRecord[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocumentRecord | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function loadLayout(docId: string) {
    setError(null);
    const fullDoc = await fetchDocumentById(docId);
    setCurrentDoc(fullDoc);
    setCurrentPageNum(1);
    const firstBlock = fullDoc?.blocks.find((b) => b.pageNumber === 1);
    setSelectedBlockId(firstBlock?.id ?? null);
  }

  useEffect(() => {
    let active = true;
    fetchDocuments()
      .then(async (docs) => {
        if (!active) return;
        setDocList(docs);
        const match =
          docs.find((d) => d.id === initialDocId) ?? docs[0] ?? null;
        if (match) {
          setSelectedDocId(match.id);
          const fullDoc = await fetchDocumentById(match.id);
          if (!active) return;
          setCurrentDoc(fullDoc);
          setCurrentPageNum(1);
          const firstBlock = fullDoc?.blocks.find((b) => b.pageNumber === 1);
          setSelectedBlockId(firstBlock?.id ?? null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load document layout.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialDocId]);

  const currentPage =
    currentDoc?.pages.find((p) => p.pageNumber === currentPageNum) ??
    currentDoc?.pages[0] ??
    null;

  const pageBlocks = currentDoc
    ? currentDoc.blocks
        .filter((b) => b.pageNumber === (currentPage?.pageNumber ?? 1))
        .sort((a, b) => a.order - b.order)
    : [];

  const selectedBlock =
    pageBlocks.find((b) => b.id === selectedBlockId) ?? pageBlocks[0] ?? null;

  async function handleSelectDocument(docId: string) {
    setSelectedDocId(docId);
    setPublishMessage(null);
    setLoading(true);
    try {
      await loadLayout(docId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load document layout.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChangePage(pageNumber: number) {
    setCurrentPageNum(pageNumber);
    const firstBlock = currentDoc?.blocks.find(
      (b) => b.pageNumber === pageNumber,
    );
    setSelectedBlockId(firstBlock?.id ?? null);
  }

  async function handleUpdateBlock(
    blockId: string,
    update: BlockVerificationUpdate,
  ) {
    if (!currentDoc) return;
    await updateBlockVerification(currentDoc.id, blockId, update);
    const refreshed = await fetchDocumentById(currentDoc.id);
    setCurrentDoc(refreshed);
  }

  async function handlePublish() {
    if (!currentDoc || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await publishDocument(currentDoc.id);
      setPublishMessage(res.message);
      const refreshed = await fetchDocumentById(currentDoc.id);
      setCurrentDoc(refreshed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish document.",
      );
    } finally {
      setPublishing(false);
    }
  }

  function handleResetDemo() {
    const fresh = resetDemoDocuments();
    setDocList(fresh);
    if (fresh[0]) {
      setSelectedDocId(fresh[0].id);
      setCurrentDoc(fresh[0]);
      setCurrentPageNum(1);
      setSelectedBlockId(fresh[0].blocks[0]?.id ?? null);
    }
  }

  return (
    <main className="min-h-screen p-5 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d9d0c3] pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-1.5 text-sm font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
            >
              <Image
                src="/icons/keyboard-arrow-return.svg"
                alt=""
                width={18}
                height={18}
                aria-hidden="true"
              />
              <span>Dashboard</span>
            </Link>
            <h1 className="ink-heading text-2xl sm:text-3xl">
              Teacher Review Console
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {docList.length > 0 && (
              <label className="flex items-center gap-2 text-sm font-semibold">
                <span className="sr-only">Select document</span>
                <select
                  value={selectedDocId}
                  onChange={(e) => void handleSelectDocument(e.target.value)}
                  className="paper-input px-3.5 py-2 text-sm font-bold"
                >
                  {docList.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename || doc.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {currentDoc && (
              <button
                type="button"
                disabled={publishing}
                onClick={() => void handlePublish()}
                className="sketch-button px-4 py-2 text-xs"
              >
                {publishing
                  ? "Publishing..."
                  : currentDoc.processingStatus === "published"
                    ? "Published"
                    : "Publish for students"}
              </button>
            )}
            <Link
              href="/student"
              className="inline-flex min-h-[42px] items-center rounded-full border border-[#d9d0c3] bg-[#fffcf6] px-4 py-1.5 text-sm font-semibold text-[#211f1b] transition-colors hover:border-[#211f1b] hover:bg-[#f2ece0]"
            >
              Student portal
            </Link>
          </div>
        </header>

        <div className="mt-5">
          <DemoModeBanner onResetDemo={handleResetDemo} />
        </div>

        {error && (
          <div
            role="alert"
            className="paper-card mb-5 border-[#dc2626] bg-[#fff5f5] p-4 text-sm font-bold text-[#7f1d1d]"
          >
            {error}
          </div>
        )}

        {publishMessage && (
          <div
            role="status"
            className="paper-card mb-5 border-[#16a34a] bg-[#e3f2d9] p-4 text-sm font-bold text-[#213a18]"
          >
            {publishMessage}
          </div>
        )}

        {loading ? (
          <div className="paper-card p-8 text-center text-sm font-semibold text-[#3b362f]">
            Loading review console...
          </div>
        ) : !currentDoc || !currentPage ? (
          <div className="paper-card p-8 text-center text-sm font-semibold text-[#3b362f]">
            No parsed documents available to review yet. Upload a PDF from the{" "}
            <Link href="/teacher" className="underline">
              Teacher Dashboard
            </Link>
            .
          </div>
        ) : (
          <>
            {/* Page pagination bar */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#3b362f]">
                {currentDoc.title} · Status:{" "}
                <span className="font-extrabold text-[#211f1b]">
                  {currentDoc.processingStatus}
                </span>
              </p>
              <div className="flex items-center gap-2">
                {currentDoc.pages.map((p) => {
                  const active = p.pageNumber === currentPage.pageNumber;
                  return (
                    <button
                      key={p.pageNumber}
                      type="button"
                      onClick={() => handleChangePage(p.pageNumber)}
                      className={`rounded-full border-2 px-3.5 py-1 text-xs font-bold transition-colors ${
                        active
                          ? "border-[#211f1b] bg-[#ffe08a] text-[#211f1b]"
                          : "border-[#d9d0c3] bg-[#fffcf6] text-[#3b362f] hover:border-[#211f1b]"
                      }`}
                    >
                      Page {p.pageNumber}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Two-column Review Workspace */}
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <PagePreviewCanvas
                  page={currentPage}
                  blocks={pageBlocks}
                  selectedBlockId={selectedBlock?.id ?? null}
                  onSelectBlock={setSelectedBlockId}
                />
              </div>

              <div className="flex flex-col gap-5 lg:col-span-5">
                <ExtractedBlocksPanel
                  blocks={pageBlocks}
                  selectedBlockId={selectedBlock?.id ?? null}
                  onSelectBlock={setSelectedBlockId}
                />
                <BlockEditorControls
                  key={selectedBlock?.id ?? "none"}
                  block={selectedBlock}
                  onUpdateBlock={handleUpdateBlock}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function ReviewConsolePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8 text-center text-sm font-semibold text-[#3b362f]">
          Loading review console...
        </main>
      }
    >
      <ReviewConsoleInner />
    </Suspense>
  );
}
