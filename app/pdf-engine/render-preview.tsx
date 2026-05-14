import type { PdfComponent, PdfDocument, PdfPage } from "./types";
import { pdfThemes } from "./themes";

function TechLinesOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
      <div className="absolute right-[-20mm] top-[25mm] h-[90mm] w-[90mm] rotate-45 border border-cyan-300/25" />
      <div className="absolute right-[8mm] top-[45mm] h-[1px] w-[95mm] bg-cyan-200/25" />
      <div className="absolute right-[18mm] top-[55mm] h-[1px] w-[80mm] bg-cyan-200/20" />
      <div className="absolute left-[18mm] top-[95mm] h-[1px] w-[55mm] bg-cyan-200/20" />
      <div className="absolute left-[30mm] top-[108mm] h-[1px] w-[38mm] bg-cyan-200/15" />
      <div className="absolute bottom-[32mm] right-[28mm] h-[55mm] w-[55mm] rounded-full border border-cyan-300/10" />
    </div>
  );
}

function renderComponent(component: PdfComponent) {
  const theme = pdfThemes.darkLuxury;

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
        ? "text-[10px] font-semibold uppercase tracking-[0.3em]"
        : component.variant === "title"
          ? "font-serif text-4xl font-bold"
          : "text-sm";

    return (
      <div
        key={component.id}
        style={{
          ...baseStyle,
          color:
            component.variant === "eyebrow"
              ? theme.accent
              : component.variant === "title"
                ? theme.textPrimary
                : theme.textMuted,
        }}
        className={className}
      >
        {component.text}
      </div>
    );
  }

  return (
    <div
      key={component.id}
      style={{
        ...baseStyle,
        background: theme.cardBackground,
        borderColor: theme.cardBorder,
        color: theme.textPrimary,
      }}
      className="rounded-2xl border p-5 shadow-2xl backdrop-blur-sm"
    >
      {component.label ? (
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: theme.accent }}
        >
          {component.label}
        </p>
      ) : null}

      <div
        className="mt-4 h-[calc(100%-32px)] rounded-xl border border-dashed"
        style={{ borderColor: theme.cardBorder }}
      />
    </div>
  );
}

function PdfPreviewPage({ page }: { page: PdfPage }) {
  const theme = pdfThemes.darkLuxury;

  return (
    <div
      className="relative overflow-hidden shadow-2xl"
      style={{
        width: `${page.widthMm}mm`,
        minHeight: `${page.heightMm}mm`,
        background: theme.pageBackground,
        color: theme.textPrimary,
      }}
    >
      {theme.overlay === "tech-lines" ? <TechLinesOverlay /> : null}

      <div
        className="absolute border"
        style={{
          left: `${page.paddingMm}mm`,
          top: `${page.paddingMm}mm`,
          right: `${page.paddingMm}mm`,
          bottom: `${page.paddingMm}mm`,
          borderColor: theme.safeBorder,
        }}
      />

      <div className="relative z-10">
        {page.components.map(renderComponent)}
      </div>
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
