"use client";

import { useState } from "react";

import { PdfDocumentPreview } from "../pdf-engine/render-preview";
import { testPdfDocument } from "../pdf-engine/test-document";
import { validateDocument } from "../pdf-engine/validate-document";

export const dynamic = "force-dynamic";

export default function PdfGeneratorPage() {
  const [themeKey, setThemeKey] = useState<
    "darkLuxury" | "softWellness"
  >("darkLuxury");

  const validation = validateDocument(testPdfDocument);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-white sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
          PDF Engine Playground
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          PDF Generator
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Safe A4 preview sandbox. This page does not touch the active product generator.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">
            Test Controls
          </h2>

          <p className="mt-2 text-sm text-white/50">
            Theme switching now tests layout separation from design rendering.
          </p>

          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              Format: A4 Portrait
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              Source: pdf-engine/test-document.ts
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              Export: Disabled
            </div>

            <div
              className={`rounded-xl border p-3 ${
                validation.valid
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              Validation: {validation.valid ? "Passed" : "Failed"}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              Warnings: {validation.warnings.length}
              {validation.warnings.length > 0 ? (
  <div className="mt-3 space-y-2">
    {validation.warnings.map((warning, index) => (
      <div
        key={index}
        className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-200"
      >
        {warning.componentId}: {warning.message}
      </div>
    ))}
  </div>
) : null}
            </div>
          </div>

          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Themes
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setThemeKey("darkLuxury")}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  themeKey === "darkLuxury"
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                    : "border-white/10 bg-black/20 text-white/70 hover:border-white/20"
                }`}
              >
                Dark Luxury
              </button>

              <button
                onClick={() => setThemeKey("softWellness")}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  themeKey === "softWellness"
                    ? "border-stone-400/40 bg-stone-400/10 text-stone-200"
                    : "border-white/10 bg-black/20 text-white/70 hover:border-white/20"
                }`}
              >
                Soft Wellness
              </button>
              <a
  href={`/pdf-generator/print?theme=${themeKey}`}
  target="_blank"
  rel="noreferrer"
  className="block rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-400/20"
>
  Open Print Export
</a>
            </div>
          </div>
        </aside>

        <section className="overflow-auto rounded-2xl border border-white/10 bg-neutral-900 p-6">
          <div className="mx-auto flex min-h-[900px] w-full items-start justify-center">
            <PdfDocumentPreview
  document={testPdfDocument}
  themeKey={themeKey}
  warnings={validation.warnings}
/>
          </div>
        </section>
      </div>
    </div>
  );
}
