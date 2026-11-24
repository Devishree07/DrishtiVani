"use client";

import Image from "next/image";
import { useState } from "react";
import { isDemoMode } from "@/lib/api-client";

interface DocumentUploadCardProps {
  onUploadFile: (file: File) => Promise<void>;
  uploadProgress?: string | null;
}

export default function DocumentUploadCard({
  onUploadFile,
  uploadProgress,
}: DocumentUploadCardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleQueueUpload() {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      await onUploadFile(selectedFile);
      setSelectedFile(null);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload PDF.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  const demo = isDemoMode();

  return (
    <article className="paper-card flex flex-col justify-between p-6">
      <div>
        <h2 className="text-xl font-extrabold">Upload new notes</h2>
        <p className="mt-2 text-sm leading-6 text-[#3b362f]">
          Upload an engineering PDF to render pages, detect layout regions, and
          prepare accessible materials.
        </p>
        <label className="mt-5 flex flex-col items-center rounded-2xl border-2 border-dashed border-[#c9c0b4] bg-[#faf7f0]/70 p-8 text-center transition-all duration-200 hover:border-[#211f1b] hover:bg-[#ffe08a]/15">
          <Image
            src="/icons/upload-brackets.svg"
            alt=""
            width={44}
            height={44}
            aria-hidden="true"
            draggable={false}
          />
          <span className="mt-3 text-base font-bold text-[#211f1b]">
            {selectedFile ? selectedFile.name : "Choose a PDF"}
          </span>
          <span className="mt-1 text-xs font-medium text-[#3b362f]">
            {selectedFile
              ? `${(selectedFile.size / 1024).toFixed(1)} KB — ready to upload`
              : "PDF files only"}
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              setUploadError(null);
            }}
          />
          <span className="sketch-button-secondary mt-4 px-5 py-2 text-sm">
            Browse files
          </span>
        </label>

        {uploadProgress && (
          <p
            role="status"
            className="mt-3 rounded-xl bg-[#e2ecff] px-3 py-2 text-xs font-bold text-[#1d3b75]"
          >
            {uploadProgress}
          </p>
        )}

        {uploadError && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-[#fde2e1] px-3 py-2 text-xs font-bold text-[#7f1d1d]"
          >
            {uploadError}
          </p>
        )}
      </div>

      {selectedFile && (
        <button
          type="button"
          onClick={handleQueueUpload}
          disabled={isUploading}
          className="sketch-button mt-5 w-full"
        >
          {isUploading
            ? "Uploading & processing..."
            : demo
              ? "Queue PDF (Demo Mode)"
              : "Upload & Process PDF"}
        </button>
      )}
    </article>
  );
}
