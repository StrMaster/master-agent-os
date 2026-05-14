import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type DigitalProductType =
  | "cv-template"
  | "invoice-template"
  | "planner-template"
  | "prompt-pack"
  | "mini-ebook"
  | "social-media-kit"
  | "bio-link-page"
  | "seo-audit-report";

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
  const raw = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: `You are a professional digital product designer.
Generate a complete, beautiful, print-ready HTML document.

Rules:
- Use inline CSS only — no external stylesheets
- Use professional fonts via Google Fonts @import
- Make it visually stunning and ready to sell
- Include realistic placeholder content
- Optimize for A4 paper size (210mm x 297mm)
- Use a cohesive color scheme
- Return ONLY the complete HTML document, no explanation

Product type guidelines:
- cv-template: Clean, modern resume with sections for experience, education, skills
- invoice-template: Professional invoice with company details, line items, totals
- planner-template: Weekly/monthly planner with time blocks, goals, notes
- prompt-pack: Formatted list of 20 high-quality AI prompts with descriptions
- mini-ebook: 5-page guide with cover, chapters, and professional layout
- social-media-kit: Post templates, caption frameworks, hashtag sets
- bio-link-page: Single page with links, avatar, bio, social icons
- seo-audit-report: Professional SEO analysis report template`,
    messages: [
      {
        role: "user",
        content: `Create a ${context.type} digital product.
Style preference: ${context.style ?? "modern, minimal, professional"}
Additional requirements: ${context.prompt}

Return complete HTML document only.`,
      },
    ],
  });

  const text = raw.content[0]?.type === "text" ? raw.content[0].text : "";
  return text.trim();
}

export async function generateEtsyListing(context: {
  type: DigitalProductType;
  title: string;
  description: string;
}): Promise<EtsyListing> {
  const raw = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You are an Etsy SEO expert who writes high-converting listings.
Generate optimized Etsy listing details.
Respond ONLY valid JSON, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Product type: ${context.type}
Title hint: ${context.title}
Description hint: ${context.description}

Generate Etsy listing. Respond ONLY JSON:
{
  "title": "SEO optimized title under 140 chars",
  "description": "Compelling description 150-300 words",
  "tags": ["tag1","tag2",...13 tags total],
  "price": 4.99,
  "category": "Templates"
}`,
      },
    ],
  });

  const text = raw.content[0]?.type === "text" ? raw.content[0].text : "";
  const clean = text.replace(/```json|```/g, "").trim();
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
