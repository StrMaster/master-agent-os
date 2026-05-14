import type { PdfDocument } from "./types";
import { pdfThemes } from "./themes";

type ThemeKey = keyof typeof pdfThemes;

export function renderPdfHtmlString(
  document: PdfDocument,
  themeKey: ThemeKey = "darkLuxury",
) {
  const theme = pdfThemes[themeKey];

  const pages = document.pages
    .map((page) => {
      const components = page.components
        .map((component) => {
          const base = `
            position:absolute;
            left:${component.frame.x}mm;
            top:${component.frame.y}mm;
            width:${component.frame.width}mm;
            height:${component.frame.height}mm;
            box-sizing:border-box;
          `;

          if (component.type === "text") {
            const color =
              component.variant === "eyebrow"
                ? theme.accent
                : component.variant === "title"
                  ? theme.textPrimary
                  : theme.textMuted;

            const fontSize =
              component.variant === "title"
                ? "34px"
                : component.variant === "eyebrow"
                  ? "10px"
                  : "14px";

            const weight = component.variant === "title" ? "700" : "600";

            return `
              <div style="${base} color:${color}; font-size:${fontSize}; font-weight:${weight}; letter-spacing:${component.variant === "eyebrow" ? "0.25em" : "0"};">
                ${component.text}
              </div>
            `;
          }

          return `
            <div style="${base} background:${theme.cardBackground}; border:1px solid ${theme.cardBorder}; color:${theme.textPrimary}; border-radius:18px; padding:20px;">
              ${
                component.label
                  ? `<div style="font-size:11px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:${theme.accent};">${component.label}</div>`
                  : ""
              }

              ${
                component.variant === "hero"
                  ? `<div style="margin-top:18px; max-width:58%;">
                      <div style="font-size:24px; font-weight:700;">${component.title ?? ""}</div>
                      <div style="margin-top:10px; font-size:13px; line-height:1.6; color:${theme.textMuted};">${component.description ?? ""}</div>
                    </div>`
                  : ""
              }

              ${
                component.variant === "info"
                  ? `<div style="margin-top:18px;">
                      <div style="font-size:18px; font-weight:700;">${component.title ?? ""}</div>
                      <div style="margin-top:10px; font-size:13px; line-height:1.6; color:${theme.textMuted};">${component.description ?? ""}</div>
                    </div>`
                  : ""
              }

              ${
                component.variant === "quote"
                  ? `<div style="height:100%; display:flex; align-items:center;">
                      <div style="max-width:70%; font-size:22px; font-style:italic; line-height:1.5;">“${component.quote ?? ""}”</div>
                    </div>`
                  : ""
              }
            </div>
          `;
        })
        .join("");

      return `
        <section class="pdf-page" style="
          width:${page.widthMm}mm;
          height:${page.heightMm}mm;
          position:relative;
          overflow:hidden;
          background:${theme.pageBackground};
          color:${theme.textPrimary};
          page-break-after:always;
          break-after:page;
        ">
          <div style="
            position:absolute;
            left:${page.paddingMm}mm;
            top:${page.paddingMm}mm;
            right:${page.paddingMm}mm;
            bottom:${page.paddingMm}mm;
            border:1px solid ${theme.safeBorder};
          "></div>

          <div style="position:absolute; inset:0; opacity:.55;">
            <div style="position:absolute; right:-20mm; top:25mm; height:90mm; width:90mm; transform:rotate(45deg); border:1px solid rgba(125,211,252,.25);"></div>
            <div style="position:absolute; right:8mm; top:45mm; height:1px; width:95mm; background:rgba(125,211,252,.25);"></div>
            <div style="position:absolute; right:18mm; top:55mm; height:1px; width:80mm; background:rgba(125,211,252,.2);"></div>
          </div>

          ${components}
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: Arial, sans-serif;
          }
          .pdf-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        </style>
      </head>
      <body>${pages}</body>
    </html>
  `;
}