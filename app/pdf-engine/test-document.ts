import type { PdfDocument } from "./types";

export const testPdfDocument: PdfDocument = {
  title: "PDF Layout Test",
  pages: [
    {
      id: "page-1",
      widthMm: 210,
      heightMm: 297,
      paddingMm: 15,
      background: "#f7f1e8",
      components: [
        {
          type: "text",
          id: "eyebrow",
          frame: { x: 15, y: 18, width: 160, height: 8 },
          text: "A4 Preview Canvas",
          variant: "eyebrow",
        },
        {
          type: "text",
          id: "title",
          frame: { x: 15, y: 30, width: 160, height: 18 },
          text: "PDF Layout Test",
          variant: "title",
        },
        {
          type: "text",
          id: "body",
          frame: { x: 15, y: 52, width: 120, height: 14 },
          text: "This fixed A4 canvas is rendered from pdf-engine data.",
          variant: "body",
        },
        {
          type: "box",
          id: "zone-a",
          frame: { x: 15, y: 82, width: 85, height: 42 },
          label: "Zone A",
        },
        {
          type: "box",
          id: "zone-b",
          frame: { x: 110, y: 82, width: 85, height: 42 },
          label: "Zone B",
        },
        {
          type: "box",
          id: "main-frame",
          frame: { x: 15, y: 136, width: 180, height: 115 },
          label: "Main Content Frame",
        },
      ],
    },
  ],
};
