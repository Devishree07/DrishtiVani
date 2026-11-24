import Link from "next/link";
import Image from "next/image";
import { countLowConfidenceBlocks } from "@/lib/api-client";
import type { DocumentRecord, ProcessingStatus } from "@/types/document";

interface DocumentQueueListProps {
  documents: DocumentRecord[];
}

const STATUS_LABELS: Record<
  ProcessingStatus,
  { label: string; className: string }
> = {
  uploaded: {
    label: "Uploaded",
    className: "bg-[#f2ece0] text-[#3b362f]",
  },
  queued: {
    label: "Queued",
    className: "bg-[#f2ece0] text-[#3b362f]",
  },
  processing: {
    label: "Processing",
    className: "bg-[#e2ecff] text-[#1d3b75]",
  },
  parsed: {
    label: "Parsed (Ready)",
    className: "bg-[#ffe08a]/85 text-[#211f1b]",
  },
  awaiting_review: {
    label: "Awaiting review",
    className: "bg-[#ffe08a]/85 text-[#211f1b]",
  },
  published: {
    label: "Published",
    className: "bg-[#e3f2d9] text-[#213a18]",
  },
  approved: {
    label: "Approved",
    className: "bg-[#e3f2d9] text-[#213a18]",
  },
  failed: {
    label: "Failed",
    className: "bg-[#fde2e1] text-[#7f1d1d]",
  },
};

export default function DocumentQueueList({
  documents,
}: DocumentQueueListProps) {
  const awaitingDocs = documents.filter(
    (d) =>
      d.processingStatus === "awaiting_review" ||
      d.processingStatus === "parsed",
  );

  return (
    <article className="paper-card flex flex-col justify-between p-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">Uploaded documents</h2>
          {awaitingDocs.length > 0 && (
            <span className="rounded-full border border-[#211f1b] bg-[#ffe08a] px-3 py-0.5 text-xs font-bold text-[#211f1b]">
              {awaitingDocs.length} awaiting review
            </span>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#d9d0c3] bg-[#faf7f0] p-6 text-center text-sm text-[#3b362f]">
            No documents uploaded to the backend yet. Upload a PDF on the left to
            start ingestion.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-[#e4dccf]">
            {documents.map((doc) => {
              const statusMeta = STATUS_LABELS[doc.processingStatus];
              const warnings = countLowConfidenceBlocks(doc);
              const blockCount =
                doc.blocks.length > 0 ? doc.blocks.length : (doc.totalBlocks ?? 0);

              return (
                <div
                  key={doc.id}
                  className="flex flex-col gap-3 py-4 transition-colors hover:bg-[#faf7f0]/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Image
                        src="/icons/notes-paper.svg"
                        alt=""
                        width={22}
                        height={22}
                        aria-hidden="true"
                        draggable={false}
                      />
                      <span className="truncate text-sm font-bold text-[#211f1b]">
                        {doc.filename || doc.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#3b362f]">
                      {doc.title} · {doc.totalPages}{" "}
                      {doc.totalPages === 1 ? "page" : "pages"} · {blockCount}{" "}
                      {blockCount === 1 ? "block" : "blocks"}
                    </p>
                    {warnings > 0 && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#fde8cc] px-2.5 py-0.5 text-xs font-bold text-[#7c2d12]">
                        <Image
                          src="/icons/alerts-warning-triangle.svg"
                          alt=""
                          width={14}
                          height={14}
                          aria-hidden="true"
                        />
                        <span>
                          {warnings} flagged{" "}
                          {warnings === 1 ? "block" : "blocks"} for review
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                    <Link
                      href={`/teacher/review?docId=${encodeURIComponent(doc.id)}`}
                      className="rounded-full border-2 border-[#211f1b] bg-[#fffcf6] px-3.5 py-1.5 text-xs font-bold text-[#211f1b] transition-colors hover:bg-[#ffe08a]"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {awaitingDocs[0] && (
        <Link
          href={`/teacher/review?docId=${encodeURIComponent(awaitingDocs[0].id)}`}
          className="sketch-button group mt-5 w-full"
        >
          <span>Open review console</span>
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-200 group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      )}
    </article>
  );
}
