import type { BusinessAgentDefinition } from "./types";

export const BUSINESS_AGENT_REGISTRY: BusinessAgentDefinition[] = [
  {
    id: "research-agent",
    name: "Research Agent",
    mode: "research",
    purpose: "Research markets, niches, trends and opportunities.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: ["Market research", "Trend discovery", "Industry research"],
    avoidWhen: ["Code changes", "Runner fixes"],
    outputFormat: "Research Report"
  },
  {
    id: "website-audit-agent",
    name: "Website Audit Agent",
    mode: "website-audit",
    purpose: "Audit websites for UX, trust, offer clarity and conversion opportunities.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: true,
    useWhen: ["Website audit", "Landing page review", "Conversion review"],
    avoidWhen: ["Backend debugging"],
    outputFormat: "Website Audit"
  },
  {
    id: "business-analyst-agent",
    name: "Business Analyst Agent",
    mode: "business-analysis",
    purpose: "Evaluate business models, products and monetization.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: ["Business analysis", "Startup ideas", "Monetization"],
    avoidWhen: ["UI fixes"],
    outputFormat: "Business Analysis"
  },
  {
    id: "seo-agent",
    name: "SEO Agent",
    mode: "seo-analysis",
    purpose: "SEO audits and search visibility analysis.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: true,
    useWhen: ["SEO", "Keywords", "Search traffic"],
    avoidWhen: ["Infrastructure work"],
    outputFormat: "SEO Report"
  },
  {
    id: "marketing-agent",
    name: "Marketing Agent",
    mode: "marketing-analysis",
    purpose: "Positioning, messaging and marketing strategy.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: ["Marketing", "Positioning", "Messaging"],
    avoidWhen: ["Code reviews"],
    outputFormat: "Marketing Report"
  }
];