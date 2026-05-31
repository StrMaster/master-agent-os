import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export function analyzeSeo(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: "seo-agent",
    title: `SEO Analysis: ${input.url ?? input.businessName ?? input.industry ?? "Website"}`,
    summary: "Reviews search visibility basics, local intent, keyword clarity and content gaps.",
    score: 70,
    strengths: [
      "SEO analysis can reveal traffic opportunities before paid marketing.",
      "Local/service businesses often improve quickly with clearer service pages and location intent.",
      "SEO findings can be converted into small build-safe page/content tasks."
    ],
    problems: [
      "Missing service keywords reduce search intent clarity.",
      "Weak headings and thin content make it harder for search engines to understand the page.",
      "No location or niche-specific content can reduce local lead quality."
    ],
    priorityActions: [
      "Check title, meta description and H1 clarity.",
      "Map primary service keywords to pages.",
      "Add location-specific trust and service content where relevant.",
      "Improve internal structure with clear sections and headings.",
      "Create practical content topics based on customer questions."
    ],
    recommendedNextStep: "Combine SEO analysis with website audit and marketing positioning before changing copy."
  };
}
