import type { PdfComponent, PdfDocument, PdfPage } from "./types";

function renderComponent(component: PdfComponent) {
  const baseStyle = {
    position: "absolute" as const,
    left: `${component.frame.x}mm`,
    top: `${component.frame.y}mm`,
    width: `${component.frame.width}mm`,
    height: `${component.frame.height}mm`,
  };

  if (component.type === "text") {
    const className =
      component.variant === "eyebrow"
        ? "text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500"
        : component.variant === "title"
          ? "font-serif text-4xl font-bold text-neutral-900"
          : "text-sm text-neutral-600";

    return (
      <div key={component.id} style={baseStyle} className={className}>
        {component.text}
      </div>
    );
  }

  return (
    <div
      key={component.id}
      style={baseStyle}
      className="rounded-2xl border border-neutral-300 bg-white/60 p-5"
    >
      {component.label ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {component.label}
        </p>
      ) : null}
      <div className="mt-4 h-[calc(100%-32px)] rounded-xl border border-dashed border-neutral-300" />
    </div>
  );
}

function PdfPreviewPage({ page }: { page: PdfPage }) {
  return (
    <div
      className="relative text-neutral-900 shadow-2xl"
      style={{
        width: `${page.widthMm}mm`,
        minHeight: `${page.heightMm}mm`,
        background: page.background,
      }}
    >
      <div
        className="absolute border border-neutral-300/70"
        style={{
          left: `${page.paddingMm}mm`,
          top: `${page.paddingMm}mm`,
          right: `${page.paddingMm}mm`,
          bottom: `${page.paddingMm}mm`,
        }}
      />

      {page.components.map(renderComponent)}
    </div>
  );
}

export function PdfDocumentPreview({ document }: { document: PdfDocument }) {
  return (
    <div className="space-y-8">
      {document.pages.map((page) => (
        <PdfPreviewPage key={page.id} page={page} />
      ))}
    </div>
  );
}
