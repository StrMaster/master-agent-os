import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

type SeoInput = BusinessAnalysisRequest & {
  pageContent?: string;
};

function getSource(input: SeoInput): string {
  return input.pageContent || input.prompt || "";
}

function extractLine(input: SeoInput, label: string): string {
  return getSource(input)
    .split("\n")
    .find((line) => line.toLowerCase().startsWith(label.toLowerCase()))
    ?.replace(label, "")
    .trim() ?? "";
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function scoreSeo(input: SeoInput): number {
  const source = getSource(input).toLowerCase();
  const title = extractLine(input, "Title:");
  const meta = extractLine(input, "Meta description:");
  const headings = extractLine(input, "Headings:");

  let score = input.pageContent ? 62 : 55;
  if (title.length >= 20 && title.length <= 70) score += 8;
  if (meta.length >= 70 && meta.length <= 170) score += 8;
  if (headings.length > 0) score += 8;
  if (hasAny(source, ["question", "questions", "faq", "how", "why", "start", "build"])) score += 4;
  if (hasAny(source, ["life operating system", "life os", "ai-powered", "self improvement", "progress"])) score += 6;
  if (hasAny(source, ["testimonial", "case study", "review", "result"])) score += 4;

  return Math.max(1, Math.min(100, score));
}

export function analyzeSeo(input: SeoInput): BusinessAnalysisResult {
  const title = extractLine(input, "Title:");
  const meta = extractLine(input, "Meta description:");
  const headings = extractLine(input, "Headings:");
  const source = getSource(input).toLowerCase();
  const hasFetchedContent = Boolean(input.pageContent);
  const score = scoreSeo(input);

  return {
    agentRole: "seo-agent",
    title: `SEO Analysis: ${input.url ?? input.businessName ?? input.industry ?? "Website"}`,
    summary: hasFetchedContent
      ? `SEO review based on fetched page content${title ? ` with title: "${title}"` : ""}.`
      : "Reviews search visibility basics, local intent, keyword clarity and content gaps.",
    score,
    strengths: [
      title ? `Page title detected: ${title}` : "SEO analysis can reveal traffic opportunities before paid marketing.",
      meta ? `Meta description detected: ${meta.slice(0, 180)}` : "Meta description should clearly sell the page promise in search results.",
      headings ? `Extracted headings: ${headings.slice(0, 240)}` : "Clear headings help search engines and users understand the page faster."
    ],
    problems: [
      !title ? "No title was extracted from the fetched HTML." : title.length > 70 ? "Title may be too long for search results." : "Title exists, but should be checked for primary keyword clarity.",
      !meta ? "No meta description was extracted from the fetched HTML." : meta.length > 170 ? "Meta description may be too long for search snippets." : "Meta description exists, but should be checked for conversion strength.",
      !hasAny(source, ["faq", "question", "questions", "how", "why"])
        ? "Fetched content does not clearly show FAQ or question-based SEO content."
        : "Question-style content exists and can be expanded into SEO sections."
    ],
    priorityActions: [
      title ? `Optimize title around the main search intent: "${title}".` : "Add a clear SEO title.",
      meta ? "Rewrite meta description as a stronger click promise." : "Add a compelling meta description.",
      "Define 3-5 primary keyword themes for the page.",
      "Add FAQ/question sections based on real customer objections.",
      "Create supporting pages for specific use cases, customer segments or problems."
    ],
    recommendedNextStep: "Create an SEO keyword map from the extracted title, headings and visible page copy."
  };
}
