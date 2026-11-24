import Image from "next/image";
import { countLowConfidenceBlocks } from "@/lib/api-client";
import type { DocumentRecord } from "@/types/document";

interface TeacherStatsGridProps {
  documents: DocumentRecord[];
}

export default function TeacherStatsGrid({ documents }: TeacherStatsGridProps) {
  const totalDocs = documents.length;
  const awaitingReview = documents.filter(
    (d) =>
      d.processingStatus === "awaiting_review" ||
      d.processingStatus === "parsed" ||
      d.processingStatus === "processing" ||
      d.processingStatus === "uploaded" ||
      d.processingStatus === "queued",
  ).length;
  const approvedDocs = documents.filter(
    (d) =>
      d.processingStatus === "published" || d.processingStatus === "approved",
  ).length;
  const confidenceWarnings = documents.reduce(
    (sum, doc) => sum + countLowConfidenceBlocks(doc),
    0,
  );

  const stats = [
    {
      label: "Uploaded documents",
      value: String(totalDocs),
      icon: "/icons/notes-paper.svg",
    },
    {
      label: "Awaiting review",
      value: String(awaitingReview),
      icon: "/icons/time-clock-circle.svg",
    },
    {
      label: "Published / Approved",
      value: String(approvedDocs),
      icon: "/icons/form-validation-check-square-1.svg",
    },
    {
      label: "Flagged blocks",
      value: String(confidenceWarnings),
      icon: "/icons/alerts-warning-triangle.svg",
      highlight: confidenceWarnings > 0,
    },
  ];

  return (
    <div className="reveal reveal-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((item) => (
        <article
          key={item.label}
          className={`paper-card paper-card-interactive p-5 ${
            item.highlight ? "bg-[#fff6dc]" : ""
          }`}
        >
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d9d0c3] bg-[#faf7f0]">
            <Image
              src={item.icon}
              alt=""
              width={28}
              height={28}
              aria-hidden="true"
              draggable={false}
            />
          </div>
          <p className="mt-4 text-sm font-semibold text-[#3b362f]">
            {item.label}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-[#211f1b]">
            {item.value}
          </p>
        </article>
      ))}
    </div>
  );
}
