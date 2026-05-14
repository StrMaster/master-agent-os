export type PdfFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfComponent =
  | {
      type: "text";
      id: string;
      frame: PdfFrame;
      text: string;
      variant?: "eyebrow" | "title" | "body";
    }
  | {
      type: "box";
      id: string;
      frame: PdfFrame;
      label?: string;
    };

export type PdfTheme = {
  name: string;
  pageBackground: string;
  safeBorder: string;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  overlay?: "none" | "tech-lines" | "soft-grain";
};

export type PdfPage = {
  id: string;
  widthMm: number;
  heightMm: number;
  paddingMm: number;
  background: string;
  components: PdfComponent[];
};

export type PdfDocument = {
  title: string;
  pages: PdfPage[];
};
