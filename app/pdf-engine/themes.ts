import type { PdfTheme } from "./types";

export const darkLuxuryTheme: PdfTheme = {
  name: "Dark Luxury",
  pageBackground:
    "radial-gradient(circle at 20% 15%, rgba(18, 96, 150, 0.45), transparent 32%), linear-gradient(135deg, #06121f 0%, #020611 58%, #071a2d 100%)",
  safeBorder: "rgba(232, 185, 111, 0.55)",
  cardBackground: "rgba(3, 13, 24, 0.72)",
  cardBorder: "rgba(232, 185, 111, 0.55)",
  textPrimary: "#f8f3ea",
  textMuted: "rgba(248, 243, 234, 0.72)",
  accent: "#e8b96f",
  overlay: "tech-lines",
};

export const softWellnessTheme: PdfTheme = {
  name: "Soft Wellness",
  pageBackground: "#f6efe6",
  safeBorder: "rgba(120, 110, 98, 0.22)",
  cardBackground: "rgba(255,255,255,0.62)",
  cardBorder: "rgba(120, 110, 98, 0.24)",
  textPrimary: "#171717",
  textMuted: "#5f6368",
  accent: "#8b6f52",
  overlay: "soft-grain",
};

export const pdfThemes = {
  darkLuxury: darkLuxuryTheme,
  softWellness: softWellnessTheme,
};
