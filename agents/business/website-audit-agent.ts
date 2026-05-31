import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export type WebsiteAuditInput = BusinessAnalysisRequest & {
  screenshotDescription?: string;
  pageContent?: string;
};

function scoreWebsite(input: WebsiteAuditInput): number {
  let score = 60;
  const text = `${input.prompt} ${input.pageContent ?? ""} ${input.screenshotDescription ?? ""}`.toLowerCase();

  if (input.url) score += 5;
  if (text.includes("cta") || text.includes("call to action")) score += 5;
  if (text.includes("trust") || text.includes("review") || text.includes("testimonial")) score += 5;
  if (text.includes("pricing") || text.includes("price") || text.includes("kaina")) score += 5;
  if (text.includes("mobile") || text.includes("responsive")) score += 5;

  return Math.max(1, Math.min(100, score));
}

export function auditWebsite(input: WebsiteAuditInput): BusinessAnalysisResult {
  const score = scoreWebsite(input);
  const target = input.businessName ?? input.url ?? "Website";

  return {
    agentRole: "website-audit-agent",
    title: `Website Audit: ${target}`,
    summary:
      "Preliminary website audit based on available URL, prompt, page text or screenshot description. Full visual accuracy improves when URL data and screenshots are both available.",
    score,
    strengths: [
      "The website can be evaluated as a business asset, not only as a visual page.",
      "The audit focuses on first impression, trust, offer clarity and conversion readiness.",
      "Recommendations can be converted into build tasks later if the user approves."
    ],
    problems: [
      "If only a URL is provided, visual layout and mobile UX may be incomplete without screenshots.",
      "If only a screenshot is provided, SEO and content structure may be incomplete.",
      "Weak offer clarity, missing trust signals or unclear CTA should be treated as high-priority conversion issues."
    ],
    priorityActions: [
      "Check hero section: who it helps, what problem it solves and what action the visitor should take.",
      "Check trust layer: testimonials, proof, cases, location, credentials or project examples.",
      "Check CTA flow: primary action, contact method and friction on mobile.",
      "Check SEO basics: page title, headings, service keywords and local intent.",
      "Turn the top 3 issues into small build-safe tasks only after user approval."
    ],
    recommendedNextStep:
      "Run a full website audit with both URL content and screenshot/mobile screenshot for stronger UX, SEO and conversion scoring."
  };
}
