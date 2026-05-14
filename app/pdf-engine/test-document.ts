import type { PdfDocument } from "./types";

export const testPdfDocument: PdfDocument = {
  title: "Luxury Wellness Design Board",
  pages: [
    {
      id: "design-board",
      widthMm: 210,
      heightMm: 297,
      paddingMm: 15,
      background: "#f6efe6",
      components: [
        {
          type: "text",
          id: "eyebrow",
          frame: { x: 20, y: 22, width: 120, height: 8 },
          text: "PREMIUM WELLNESS COLLECTION",
          variant: "eyebrow",
        },

        {
          type: "text",
          id: "title",
          frame: { x: 20, y: 34, width: 150, height: 18 },
          text: "Luxury PDF Engine",
          variant: "title",
        },

        {
          type: "text",
          id: "body",
          frame: { x: 20, y: 56, width: 120, height: 14 },
          text: "Testing layered A4 composition before dynamic generation.",
          variant: "body",
        },

        {
  type: "box",
  id: "hero-card",
  variant: "hero",
  frame: { x: 20, y: 84, width: 170, height: 42 },
  label: "Hero Card",
  title: "Premium composition system",
  description:
    "Structured rendering layers create stable luxury PDF layouts.",
},

        {
  type: "box",
  id: "left-card",
  variant: "info",
   frame: { x: 20, y: 138, width: 82, height: 52 },
  label: "Soft Neutral",
  title: "Elegant balance",
  description:
    "Soft gradients and clean spacing reduce visual noise.",
},

        {
  type: "box",
  id: "right-card",
  variant: "info",
  frame: { x: 108, y: 138, width: 82, height: 52 },
  label: "Minimal Luxury",
  title: "Premium hierarchy",
  description:
    "Typography and spacing establish a refined visual structure.",
},

        {
          type: "box",
          id: "quote-box",
          frame: { x: 20, y: 194, width: 170, height: 26 },
          label: "Quote Block",
        },
      ],
    },
  ],
};
