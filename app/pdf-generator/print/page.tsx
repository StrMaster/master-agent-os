"use client";

import { useEffect, useState } from "react";

import { PdfDocumentPreview } from "../../pdf-engine/render-preview";
import { testPdfDocument } from "../../pdf-engine/test-document";
import { pdfThemes } from "../../pdf-engine/themes";

type ThemeKey = keyof typeof pdfThemes;

export default function PdfPrintPage() {
  const [themeKey, setThemeKey] = useState<ThemeKey>("darkLuxury");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setThemeKey(
      params.get("theme") === "softWellness" ? "softWellness" : "darkLuxury",
    );
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 p-8 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        .pdf-document {
  display: block !important;
}

.pdf-page {
  width: 210mm !important;
  height: 297mm !important;
  min-width: 210mm !important;
  max-width: 210mm !important;
  min-height: 297mm !important;
  max-height: 297mm !important;
  overflow: hidden !important;
  page-break-after: always;
  break-after: page;
}

.pdf-page:last-child {
  page-break-after: auto;
  break-after: auto;
}

        @media print {
          body {
            margin: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-controls {
            display: none !important;
          }

          .shadow-2xl {
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="print-controls mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">
            PDF Export Test
          </p>
          <h1 className="mt-1 text-xl font-semibold">Print / Save as PDF</h1>
        </div>

        <button
          onClick={() => window.print()}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          Print PDF
        </button>
      </div>

      <div className="mx-auto flex justify-center print:block">
        <PdfDocumentPreview document={testPdfDocument} themeKey={themeKey} />
      </div>
    </main>
  );
}
