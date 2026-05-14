export const dynamic = "force-dynamic";

export default function PdfGeneratorPage() {
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
            Step 1.1 only creates the preview tab and A4 canvas.
          </p>

          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              Format: A4 Portrait
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              Status: Preview only
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              Export: Disabled
            </div>
          </div>
        </aside>

        <section className="overflow-auto rounded-2xl border border-white/10 bg-neutral-900 p-6">
          <div className="mx-auto flex min-h-[900px] w-full items-start justify-center">
            <div
              className="relative bg-[#f7f1e8] text-neutral-900 shadow-2xl"
              style={{
                width: "210mm",
                minHeight: "297mm",
                padding: "15mm",
              }}
            >
              <div className="absolute inset-[8mm] border border-neutral-300/70" />

              <div className="relative z-10">
                <div className="border-b border-neutral-300 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
                    A4 Preview Canvas
                  </p>
                  <h2 className="mt-3 font-serif text-4xl font-bold">
                    PDF Layout Test
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-neutral-600">
                    This fixed A4 canvas will become the source of truth before PDF export.
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-neutral-300 bg-white/60 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Zone A
                    </p>
                    <div className="mt-4 h-32 rounded-xl border border-dashed border-neutral-300" />
                  </div>

                  <div className="rounded-2xl border border-neutral-300 bg-white/60 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Zone B
                    </p>
                    <div className="mt-4 h-32 rounded-xl border border-dashed border-neutral-300" />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-neutral-300 bg-white/60 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Main Content Frame
                  </p>
                  <div className="mt-4 h-[420px] rounded-xl border border-dashed border-neutral-300" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
