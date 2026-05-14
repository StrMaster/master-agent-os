import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { generateEtsyThumbnail } from "./thumbnail-generator";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type DigitalProductType =
  | "cv-template"
  | "invoice-template"
  | "planner-template"
  | "prompt-pack"
  | "mini-ebook"
  | "social-media-kit"
  | "bio-link-page"
  | "seo-audit-report"
  | "budget-tracker"
  | "meal-planner"
  | "habit-tracker"
  | "business-plan"
  | "social-media-calendar"
  | "wedding-checklist"
  | "study-guide"
  | "notion-template";

export type DigitalProduct = {
  id: string;
  type: DigitalProductType;
  title: string;
  description: string;
  htmlContent: string;
  thumbnailUrl?: string;
  etysListing?: EtsyListing;
  createdAt: string;
};

export type EtsyListing = {
  title: string;
  description: string;
  tags: string[];
  price: number;
  category: string;
};

// Design system tokens — consistent across all products
const DESIGN_SYSTEM = `
DESIGN SYSTEM (apply to ALL products):

Typography:
- Headings: 'Playfair Display', serif — for premium feel
- Body: 'Inter', sans-serif — for readability
- Accent: 'Poppins', sans-serif — for labels, badges

Color Palettes (choose ONE based on product type):
- Dark Premium: bg #0a0a0f, surface #13131a, accent #8b5cf6, text #f8fafc
- Warm Minimal: bg #fafaf8, surface #ffffff, accent #d4a853, text #1a1a1a
- Clean Professional: bg #f8fafc, surface #ffffff, accent #2563eb, text #0f172a
- Rose Wellness: bg #fdf2f8, surface #ffffff, accent #ec4899, text #1f2937

Spacing system: 8px base unit (8, 16, 24, 32, 48, 64px)
Border radius: 4px small, 8px medium, 16px large, 24px card
Shadows: 0 1px 3px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.08)

Print rules:
- @media print { body { -webkit-print-color-adjust: exact; } }
- Page breaks: avoid inside cards and sections
- A4: 210mm x 297mm, margin 15mm
`;

async function generateProductContent(context: {
  type: DigitalProductType;
  prompt: string;
  style?: string;
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: `You are a premium digital product content strategist.
Your job: create detailed content structure and copy for digital products.

Generate realistic, premium quality content that feels hand-crafted.
Focus on: emotional resonance, practical value, premium positioning.

Respond in structured format that will be used to build the HTML layout.`,
    messages: [
      {
        role: "user",
        content: `Product type: ${context.type}
Style: ${context.style ?? "dark, premium, modern"}
Requirements: ${context.prompt}

Generate detailed content structure:
1. Product title and tagline
2. All section headings and subheadings
3. Realistic placeholder content for each section
4. Color palette recommendation (from: Dark Premium / Warm Minimal / Clean Professional / Rose Wellness)
5. Key selling points (3-5 items)

Be specific and premium — no generic placeholders.`,
      },
    ],
  });

  return response.content[0]?.type === "text" ? response.content[0].text : "";
}

export async function generateDigitalProductHTML(context: {
  type: DigitalProductType;
  prompt: string;
  style?: string;
}): Promise<string> {
  const content = await generateProductContent(context);

  const response = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: `You are a world-class HTML/CSS engineer specializing in premium printable digital products.
Build beautiful, print-ready HTML using the provided content and design system.

${DESIGN_SYSTEM}

Technical rules:
- Google Fonts @import at very top (Inter, Playfair Display, Poppins)
- Inline CSS only — no external stylesheets
- Full A4 page (210mm x 297mm) with 15mm margins
- @media print rules for perfect PDF export
- Avoid overflow, text cutoff, broken layouts
- Use CSS Grid and Flexbox for stable layouts
- Every element must be visible and properly spaced
- Return ONLY the complete HTML document — no explanation`,
      },
      {
        role: "user",
        content: `Product type: ${context.type}
Style preference: ${context.style ?? "dark, premium, modern, professional"}

Content structure from strategist:
${content}

Build the complete premium HTML document using this content and the design system.
Return ONLY the HTML document.`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  return text.trim();
}

export async function generateEtsyListing(context: {
  type: DigitalProductType;
  title: string;
  description: string;
}): Promise<EtsyListing> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: `You are an Etsy SEO expert and copywriter who creates high-converting product listings.
Write compelling, keyword-rich listings that convert browsers into buyers.
Respond ONLY valid JSON, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Product type: ${context.type}
Product name: ${context.title}
Description hint: ${context.description}

Write an optimized Etsy listing. Respond ONLY JSON:
{
  "title": "SEO optimized title under 140 chars with main keywords first",
  "description": "Compelling 200-300 word description with benefits, features, what's included, instant download note",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],
  "price": 9.99,
  "category": "Templates"
}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function createDigitalProduct(context: {
  type: DigitalProductType;
  prompt: string;
  style?: string;
}): Promise<DigitalProduct> {
  const [htmlContent, listing] = await Promise.all([
    generateDigitalProductHTML(context),
    generateEtsyListing({
      type: context.type,
      title: context.prompt,
      description: `Professional ${context.type} digital download`,
    }),
  ]);

  const { detectPalette } = await import("./product-templates/design-system");
const detectedPalette = detectPalette(context.prompt, context.style);

const thumbnailUrl = await generateEtsyThumbnail({
  palette: detectedPalette,
    productType: context.type,
    productTitle: listing.title,
    niche: context.prompt,
  }).catch(() => "");

  return {
    id: `product-${Date.now()}`,
    type: context.type,
    title: listing.title,
    description: listing.description,
    htmlContent,
    thumbnailUrl,
    etysListing: listing,
    templateData: productData,
    createdAt: new Date().toISOString(),
  };
}
