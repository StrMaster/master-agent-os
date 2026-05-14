import Anthropic from "@anthropic-ai/sdk";
import { renderHabitTrackerTemplate, type HabitTrackerData } from "./product-templates/habit-tracker";
import type { DigitalProductType } from "./digital-product-generator";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateFromTemplate(context: {
  type: DigitalProductType;
  prompt: string;
  style?: string;
}): Promise<{ html: string; data: unknown }> {
  if (context.type === "habit-tracker") {
    return generateHabitTracker(context);
  }

  // Fallback to free generation for other types
  const { generateDigitalProductHTML } = await import("./digital-product-generator");
  const html = await generateDigitalProductHTML(context);
  return { html, data: null };
}

async function generateHabitTracker(context: {
  prompt: string;
  style?: string;
}): Promise<{ html: string; data: HabitTrackerData }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: `You are a digital product content generator.
Generate structured content data for a habit tracker template.
Respond ONLY valid JSON, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Create habit tracker content for: ${context.prompt}
Style: ${context.style ?? "dark, premium, minimal"}

Respond ONLY JSON:
{
  "title": "Product title (2-5 words, powerful)",
  "tagline": "One line tagline (max 80 chars)",
  "subtitle": "2-3 sentence description of the system",
  "brandName": "Brand name (2 words max, uppercase)",
  "colorPalette": "dark-premium|warm-minimal|clean-professional|rose-wellness (choose based on style preference)",
  "habits": [
    {"id": "h1", "label": "Habit name (2-3 words)", "description": "Short description (max 40 chars)"},
    {"id": "h2", "label": "Habit name", "description": "Short description"},
    {"id": "h3", "label": "Habit name", "description": "Short description"},
    {"id": "h4", "label": "Habit name", "description": "Short description"},
    {"id": "h5", "label": "Habit name", "description": "Short description"},
    {"id": "h6", "label": "Habit name", "description": "Short description"},
    {"id": "h7", "label": "Habit name", "description": "Short description"}
  ],
  "weeklyReviews": [
    {"week": 1, "theme": "Initiation", "subtitle": "Week theme subtitle"},
    {"week": 2, "theme": "Resistance", "subtitle": "Week theme subtitle"},
    {"week": 3, "theme": "Integration", "subtitle": "Week theme subtitle"},
    {"week": 4, "theme": "Automation", "subtitle": "Week theme subtitle"}
  ]
}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  const data = JSON.parse(clean) as HabitTrackerData;
  const html = renderHabitTrackerTemplate(data);
  return { html, data };
}
