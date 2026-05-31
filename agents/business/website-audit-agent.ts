import Anthropic from "@anthropic-ai/sdk";
import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type WebsiteAuditInput = BusinessAnalysisRequest & {
  screenshotDescription?: string;
  pageContent?: string;
};

export async function auditWebsite(input: WebsiteAuditInput): Promise<BusinessAnalysisResult> {
  const context = [
    input.url ? `URL: ${input.url}` : "",
    input.pageContent ? `Page content:\n${input.pageContent.slice(0, 2000)}` : "",
    input.screenshotDescription ? `Screenshot: ${input.screenshotDescription}` : "",
  ].filter(Boolean).join("\n\n");

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: `You are a conversion rate optimization (CRO) and UX expert. Audit websites for:
- First impression and hero clarity
- CTA strength and placement
- Trust signals (testimonials, social proof)
- Mobile and page structure
- SEO basics

Return ONLY valid JSON (no markdown):
{
  "title": "Website Audit: [site name]",
  "summary": "2-3 sentence overview",
  "score": 0-100,
  "strengths": ["specific strength 1", "specific strength 2"],
  "problems": ["specific problem 1", "specific problem 2", "specific problem 3"],
  "priorityActions": ["action 1", "action 2", "action 3", "action 4"],
  "recommendedNextStep": "one clear next step"
}`,
    messages: [{
      role: "user",
      content: `Audit this website:\n${context || input.prompt}`,
    }],
  });

  const raw = res.content[0]?.type === "text" ? res.content[0].text : "{}";

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as Omit<BusinessAnalysisResult, "agentRole">;
    return { ...parsed, agentRole: "website-audit-agent" };
  } catch {
    return {
      agentRole: "website-audit-agent",
      title: `Website Audit: ${input.url ?? input.businessName ?? "Site"}`,
      summary: raw.slice(0, 200),
      score: 65,
      strengths: ["Audit completed"],
      problems: ["Could not parse structured response"],
      priorityActions: ["Review summary above"],
      recommendedNextStep: "Run full audit with page content",
    };
  }
}
