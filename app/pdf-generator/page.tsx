import { PdfDocumentPreview } from "../pdf-engine/render-preview";
import { testPdfDocument } from "../pdf-engine/test-document";
import { validateDocument } from "../pdf-engine/validate-document";


const themeKey = "darkLuxury";
export const dynamic = "force-dynamic";

export default function PdfGeneratorPage() {
    const validation = validateDocument(testPdfDocument);
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-white sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
          PDF Engine Playground
        </p>
        <h1 className="mt-3 text-3xl font-bold">PDF Generator</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Safe A4 preview sandbox. This page does not touch the active product generator.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Test Controls</h2>
          <p className="mt-2 text-sm text-white/50">
            Step 1.2 renders the A4 preview from pdf-engine data.
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
</div>
          </div>
        </aside>

        <section className="overflow-auto rounded-2xl border border-white/10 bg-neutral-900 p-6">
          <div className="mx-auto flex min-h-[900px] w-full items-start justify-center">
            <PdfDocumentPreview document={testPdfDocument} themeKey={themeKey} />
          </div>
        </section>
      </div>
    </div>
  );
}
