export type ColorPalette =
  | "dark-premium"
  | "warm-minimal"
  | "clean-professional"
  | "rose-wellness"
  | "forest-calm"
  | "ocean-focus"
  | "gold-luxury"
  | "soft-lavender"
  | "sunset-energy";

export type PaletteTokens = {
  bg: string;
  surface: string;
  surface2: string;
  accent: string;
  accentLight: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
};

export const PALETTES: Record<ColorPalette, PaletteTokens> = {
  "dark-premium": {
    bg: "#0a0a0f", surface: "#13131a", surface2: "#1a1a24",
    accent: "#8b5cf6", accentLight: "#a78bfa",
    text: "#f8fafc", textMuted: "#94a3b8", textDim: "#64748b",
    border: "#1e1e2e",
  },
  "warm-minimal": {
    bg: "#fafaf8", surface: "#ffffff", surface2: "#f5f5f0",
    accent: "#d4a853", accentLight: "#e8c87a",
    text: "#1a1a1a", textMuted: "#6b6b6b", textDim: "#9b9b9b",
    border: "#e8e8e0",
  },
  "clean-professional": {
    bg: "#f8fafc", surface: "#ffffff", surface2: "#f1f5f9",
    accent: "#2563eb", accentLight: "#3b82f6",
    text: "#0f172a", textMuted: "#475569", textDim: "#94a3b8",
    border: "#e2e8f0",
  },
  "rose-wellness": {
    bg: "#fdf2f8", surface: "#ffffff", surface2: "#fce7f3",
    accent: "#ec4899", accentLight: "#f472b6",
    text: "#1f2937", textMuted: "#6b7280", textDim: "#9ca3af",
    border: "#fce7f3",
  },
  "forest-calm": {
    bg: "#1a2418", surface: "#243020", surface2: "#2d3d28",
    accent: "#7ab648", accentLight: "#9cd463",
    text: "#f0f4ec", textMuted: "#a8bc9a", textDim: "#6b8560",
    border: "#2d3d28",
  },
  "ocean-focus": {
    bg: "#0a1628", surface: "#0f2040", surface2: "#162952",
    accent: "#38bdf8", accentLight: "#7dd3fc",
    text: "#f0f9ff", textMuted: "#93c5fd", textDim: "#3b82f6",
    border: "#162952",
  },
  "gold-luxury": {
    bg: "#0c0a00", surface: "#1a1500", surface2: "#241e00",
    accent: "#d4a853", accentLight: "#f0c96a",
    text: "#fefce8", textMuted: "#ca8a04", textDim: "#92400e",
    border: "#2d2600",
  },
  "soft-lavender": {
    bg: "#f5f3ff", surface: "#ffffff", surface2: "#ede9fe",
    accent: "#7c3aed", accentLight: "#a78bfa",
    text: "#1e1b4b", textMuted: "#4c1d95", textDim: "#7c3aed",
    border: "#ddd6fe",
  },
  "sunset-energy": {
    bg: "#1c0a00", surface: "#2d1200", surface2: "#3d1a00",
    accent: "#f97316", accentLight: "#fb923c",
    text: "#fff7ed", textMuted: "#fed7aa", textDim: "#c2410c",
    border: "#431407",
  },
};

export const PALETTE_NICHE_MAP: Record<string, ColorPalette> = {
  // Dark/Elite
  "habit tracker": "dark-premium",
  "productivity": "dark-premium",
  "high performance": "dark-premium",
  "discipline": "dark-premium",
  "morning routine": "dark-premium",
  // Business
  "business plan": "clean-professional",
  "invoice": "clean-professional",
  "cv": "clean-professional",
  "resume": "clean-professional",
  "seo": "clean-professional",
  // Wellness/Feminine
  "wellness": "rose-wellness",
  "beauty": "rose-wellness",
  "glow up": "rose-wellness",
  "self care": "rose-wellness",
  "meal planner": "rose-wellness",
  // Fitness
  "workout": "sunset-energy",
  "fitness": "sunset-energy",
  "gym": "sunset-energy",
  "training": "sunset-energy",
  // Study/Focus
  "study": "ocean-focus",
  "focus": "ocean-focus",
  "deep work": "ocean-focus",
  "learning": "ocean-focus",
  // Nature/Mindfulness
  "meditation": "forest-calm",
  "yoga": "forest-calm",
  "mindfulness": "forest-calm",
  "nature": "forest-calm",
  // Sleep/Calm
  "sleep": "soft-lavender",
  "calm": "soft-lavender",
  "journal": "soft-lavender",
  "gratitude": "soft-lavender",
  // Premium/Wealth
  "budget": "gold-luxury",
  "finance": "gold-luxury",
  "wealth": "gold-luxury",
  "wedding": "warm-minimal",
  "planner": "warm-minimal",
};

export function detectPalette(prompt: string, style?: string): ColorPalette {
  const text = `${prompt} ${style ?? ""}`.toLowerCase();

  // Style override
  if (text.includes("light") || text.includes("white")) return "clean-professional";
  if (text.includes("pink") || text.includes("rose") || text.includes("feminine")) return "rose-wellness";
  if (text.includes("dark") || text.includes("cyber") || text.includes("black")) return "dark-premium";
  if (text.includes("green") || text.includes("forest") || text.includes("nature")) return "forest-calm";
  if (text.includes("blue") || text.includes("ocean") || text.includes("focus")) return "ocean-focus";
  if (text.includes("gold") || text.includes("luxury") || text.includes("premium")) return "gold-luxury";
  if (text.includes("purple") || text.includes("lavender") || text.includes("sleep")) return "soft-lavender";
  if (text.includes("orange") || text.includes("energy") || text.includes("workout")) return "sunset-energy";

  // Niche map
  for (const [keyword, palette] of Object.entries(PALETTE_NICHE_MAP)) {
    if (text.includes(keyword)) return palette;
  }

  return "dark-premium";
}
