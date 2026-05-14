import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export async function generateDigitalProductHTML(context: {
  type: DigitalProductType;
  prompt: string;
  style?: string;
}): Promise<string> {
  const response = await client.chat.completions.create({
    model: "gpt-5.5",
    max_tokens: 8192,
    messages: [
      {
        role: "system",
        content: `You are a world-class digital product designer who creates premium, sellable templates worth $10-30.
Generate a complete, beautiful, print-ready HTML document.

Rules:
- Use inline CSS only — no external dependencies except Google Fonts @import at top
- Use Google Fonts: Inter, Playfair Display, or Poppins depending on style
- Make it visually stunning — gradients, shadows, proper spacing, premium feel
- Include realistic, detailed placeholder content (not generic Lorem ipsum)
- Optimize for A4 paper size (210mm x 297mm) with @media print rules
- Use sophisticated color schemes — not generic blue/white
- Every section must be fully designed with real content
- Return ONLY the complete HTML document, nothing else

Product type guidelines:
- cv-template: Clean, modern resume with experience, education, skills, photo placeholder, sidebar
- invoice-template: Professional invoice with company logo area, itemized table, payment terms, totals
- planner-template: Weekly/monthly planner with time blocks, priority matrix, habit tracker, notes
- prompt-pack: Beautifully formatted collection of 20 AI prompts with categories, descriptions, examples
- mini-ebook: 5-page guide with premium cover, table of contents, chapters, callout boxes, footer
- social-media-kit: Instagram/TikTok post templates, caption frameworks, hashtag strategy, brand kit
- bio-link-page: Premium link-in-bio with avatar, tagline, animated buttons, social icons, dark theme
- seo-audit-report: Professional SEO report with scores, recommendations, charts, action items
- budget-tracker: Monthly budget with income/expense categories, savings goals, visual progress bars
- meal-planner: Weekly meal plan with breakfast/lunch/dinner, shopping list, macros, prep notes
- habit-tracker: 30-day tracker with daily checkboxes, streaks counter, monthly stats, motivational quotes
- business-plan: Executive summary, market analysis, competitor matrix, financial projections, timeline
- social-media-calendar: Monthly content calendar grid with post ideas, captions, hashtags per day
- wedding-checklist: Complete planning checklist with 12-month timeline, budget tracker, vendor contacts
- study-guide: Study schedule, Cornell notes template, flashcard layout, progress tracker, mind map
- notion-template: Notion-style dashboard with sidebar navigation, kanban board, linked database views`,
      },
      {
        role: "user",
        content: `Create a ${context.type} digital product.
Style: ${context.style ?? "dark, premium, modern, professional"}
Requirements: ${context.prompt}

Return ONLY the complete HTML document.`,
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
  const response = await client.chat.completions.create({
    model: "gpt-5.5",
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are an Etsy SEO expert who writes high-converting listings.
Respond ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Product type: ${context.type}
Title hint: ${context.title}
Description hint: ${context.description}

Generate optimized listing. Respond ONLY JSON:
{
  "title": "SEO optimized title under 140 chars",
  "description": "Compelling description 150-300 words with keywords",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],
  "price": 9.99,
  "category": "Templates"
}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function createDigitalProduct(context: {
  type: DigitalProductType;
  prompt: string;
  style?: string;
}): Promise<DigitalProduct> {
  const htmlContent = await generateDigitalProductHTML(context);

  const listing = await generateEtsyListing({
    type: context.type,
    title: context.prompt,
    description: `Professional ${context.type} digital download`,
  });

  return {
    id: `product-${Date.now()}`,
    type: context.type,
    title: listing.title,
    description: listing.description,
    htmlContent,
    etysListing: listing,
    createdAt: new Date().toISOString(),
  };
}
