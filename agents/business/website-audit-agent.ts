import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export type WebsiteAuditInput = BusinessAnalysisRequest & {
  screenshotDescription?: string;
  pageContent?: string;
};

function getAnalysisText(input: WebsiteAuditInput): string {
  return `${input.prompt} ${input.pageContent ?? ""} ${input.screenshotDescription ?? ""}`.toLowerCase();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function scoreWebsite(input: WebsiteAuditInput): number {
  const text = getAnalysisText(input);
  let score = input.pageContent ? 68 : 60;

  if (input.url) score += 4;
  if (hasAny(text, ["title:", "meta description:", "headings:"])) score += 4;
  if (hasAny(text, ["cta", "call to action", "get started", "contact", "book", "try", "start", "join"])) score += 5;
  if (hasAny(text, ["trust", "review", "testimonial", "case", "project", "customer", "client"])) score += 5;
  if (hasAny(text, ["pricing", "price", "kaina", "plan", "subscription"])) score += 3;
  if (hasAny(text, ["mobile", "responsive"])) score += 2;

  return Math.max(1, Math.min(100, score));
}

function extractLine(input: WebsiteAuditInput, label: string): string {
  const source = input.pageContent || input.prompt;
  return source
    .split("\n")
    .find((line) => line.toLowerCase().startsWith(label.toLowerCase()))
    ?.replace(label, "")
    .trim() ?? "";
}

export function auditWebsite(input: WebsiteAuditInput): BusinessAnalysisResult {
  const score = scoreWebsite(input);
  const target = input.businessName ?? input.url ?? "Website";
  const title = extractLine(input, "Title:");
  const metaDescription = extractLine(input, "Meta description:");
  const headings = extractLine(input, "Headings:");
  const hasFetchedContent = Boolean(input.pageContent);
  const text = getAnalysisText(input);

  const strengths = [
    hasFetchedContent
      ? `Fetched page data is available${title ? `: title "${title}"` : ""}.`
      : "The website can be evaluated as a business asset, not only as a visual page.",
    metaDescription
      ? `Meta description exists: ${metaDescription.slice(0, 160)}`
      : "The audit focuses on first impression, trust, offer clarity and conversion readiness.",
    headings
      ? `Detected headings: ${headings.slice(0, 220)}`
      : "Recommendations can be converted into build tasks later if the user approves.",
  ];

  const problems = [
    !hasAny(text, ["testimonial", "review", "case study", "case", "customer", "client"])
      ? "Fetched content does not clearly show trust proof such as testimonials, customer proof, case studies or examples."
      : "Trust proof exists, but it should be checked for visibility and conversion impact.",
    !hasAny(text, ["get started", "contact", "book", "start", "try", "join", "call"])
      ? "Fetched content does not clearly show a strong primary CTA or next action."
      : "CTA language exists, but the flow should still be checked on desktop and mobile.",
    !headings
      ? "No clear headings were extracted, which may indicate weak page structure or JavaScript-heavy rendering."
      : "Heading structure exists, but the hero section still needs to clearly answer who it helps and what outcome it creates.",
  ];

  return {
    agentRole: "website-audit-agent",
    title: `Website Audit: ${target}`,
    summary: hasFetchedContent
      ? `Website audit based on fetched page content from ${input.url ?? target}.`
      : "Preliminary website audit based on available URL, prompt, page text or screenshot description.",
    score,
    strengths,
    problems,
    priorityActions: [
      title ? `Check whether the page title supports the main offer: "${title}".` : "Add or improve the page title for clearer first impression.",
      headings ? "Review the extracted headings and make the hero section more specific." : "Add clear H1/H2 structure around the main offer.",
      "Make the primary CTA visible and specific above the fold.",
      "Add trust proof: testimonials, examples, screenshots, results or founder credibility.",
      "Check mobile layout with a screenshot-based audit next."
    ],
    recommendedNextStep: hasFetchedContent
      ? "Run screenshot-based desktop and mobile UX review to validate visual hierarchy and CTA placement."
      : "Run a full website audit with URL content and screenshots for stronger UX, SEO and conversion scoring."
  };
}
