import type { BusinessAgentDefinition, BusinessAgentRole } from "./types";

export const BUSINESS_AGENT_REGISTRY: BusinessAgentDefinition[] = [
  {
    id: "research-agent",
    name: "Research Agent",
    mode: "research",
    purpose: "Researches markets, industries, trends, customer problems and opportunity signals.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user asks to research a market, niche, company, industry, customer segment or trend.",
      "The system needs external context before making a business recommendation.",
      "The request is about discovery rather than code execution."
    ],
    avoidWhen: [
      "The user asks for a direct code change or runner fix.",
      "The request requires editing repository files."
    ],
    outputFormat: "Research Report: summary, key findings, sources/signals, risks, recommended next step"
  },
  {
    id: "website-audit-agent",
    name: "Website Audit Agent",
    mode: "website-audit",
    purpose: "Audits websites and landing pages for UX, trust, offer clarity, conversion and business value.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: true,
    useWhen: [
      "The user asks to analyze or evaluate a website, landing page, homepage or screenshot.",
      "The request mentions UX, design, conversion, trust, CTA or page quality.",
      "The user wants practical website improvement recommendations."
    ],
    avoidWhen: [
      "The task is only about backend code or runtime systems.",
      "The user asks for market-wide research without a specific website."
    ],
    outputFormat: "Website Audit: score, first impression, UX, trust, offer clarity, conversion issues, top fixes"
  },
  {
    id: "business-analyst-agent",
    name: "Business Analyst Agent",
    mode: "business-analysis",
    purpose: "Evaluates business ideas, products, monetization, positioning and operational viability.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: true,
    useWhen: [
      "The user asks whether a business idea is good.",
      "The request involves product strategy, monetization, business model or customer value.",
      "The system needs to turn an idea into a practical business direction."
    ],
    avoidWhen: [
      "The user only needs SEO, outreach copy or technical implementation.",
      "The request is a narrow code bug."
    ],
    outputFormat: "Business Analysis: opportunity, target customer, value proposition, risks, monetization, next action"
  },
  {
    id: "market-analysis-agent",
    name: "Market Analysis Agent",
    mode: "market-analysis",
    purpose: "Analyzes market size, demand, timing, niche quality and adoption potential.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user asks about market potential, demand or niche strength.",
      "The request needs market timing and customer pain validation.",
      "The system needs to compare market attractiveness before building."
    ],
    avoidWhen: [
      "The task is about a single page UX audit.",
      "The user asks for specific outreach text or proposal writing."
    ],
    outputFormat: "Market Analysis: demand, audience, pain intensity, competition level, timing, recommendation"
  },
  {
    id: "competitor-research-agent",
    name: "Competitor Research Agent",
    mode: "competitor-research",
    purpose: "Finds and compares competitors, alternatives, positioning gaps and market openings.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user asks to find or compare competitors.",
      "The request involves differentiation, positioning gaps or competitive advantages.",
      "The business needs to understand what others already offer."
    ],
    avoidWhen: [
      "The user wants internal code review.",
      "The request is only about pricing calculation without competitor context."
    ],
    outputFormat: "Competitor Report: competitors, strengths, weaknesses, gaps, differentiation strategy"
  },
  {
    id: "seo-agent",
    name: "SEO Agent",
    mode: "seo-analysis",
    purpose: "Analyzes SEO structure, keywords, search intent, content gaps and discoverability.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: true,
    useWhen: [
      "The user asks about SEO, keywords, Google visibility or organic traffic.",
      "A website audit needs search visibility recommendations.",
      "The business needs content topics or search intent analysis."
    ],
    avoidWhen: [
      "The task is only about visual design with no search component.",
      "The request is backend/runtime focused."
    ],
    outputFormat: "SEO Report: technical basics, keyword opportunities, content gaps, page improvements, priorities"
  },
  {
    id: "marketing-agent",
    name: "Marketing Agent",
    mode: "marketing-analysis",
    purpose: "Improves positioning, messaging, offers, hooks, CTAs and customer-facing communication.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: true,
    useWhen: [
      "The user asks for marketing strategy, messaging, hooks or positioning.",
      "A page or product needs clearer value communication.",
      "The system needs to turn analysis into persuasive copy direction."
    ],
    avoidWhen: [
      "The user asks for pure technical implementation.",
      "The request is only about market sizing."
    ],
    outputFormat: "Marketing Report: positioning, message, hook, CTA, objections, recommended copy changes"
  },
  {
    id: "offer-agent",
    name: "Offer Agent",
    mode: "offer-building",
    purpose: "Creates clear client offers, service packages and value propositions from business analysis.",
    canUseWebResearch: false,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user wants to create an offer for a client or niche.",
      "A business audit needs to become a sellable package.",
      "The system needs to define scope, promise, deliverables and price logic."
    ],
    avoidWhen: [
      "The request needs fresh market research first.",
      "The user only asks for technical website fixes."
    ],
    outputFormat: "Offer: target customer, problem, promise, deliverables, pricing angle, guarantee/risk reversal"
  },
  {
    id: "proposal-agent",
    name: "Proposal Agent",
    mode: "proposal-building",
    purpose: "Builds client-facing proposals based on research, audit findings and offer strategy.",
    canUseWebResearch: false,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user wants a proposal for a potential client.",
      "An audit result needs to be turned into a professional offer document.",
      "The business needs a structured pitch with scope and next steps."
    ],
    avoidWhen: [
      "No client, business or offer context exists yet.",
      "The request is only internal planning."
    ],
    outputFormat: "Proposal: problem, opportunity, solution, deliverables, timeline, next step"
  },
  {
    id: "outreach-agent",
    name: "Outreach Agent",
    mode: "outreach",
    purpose: "Creates personalized outreach messages for email, LinkedIn, Instagram and cold contact.",
    canUseWebResearch: false,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user asks for outreach, cold message, LinkedIn message or email copy.",
      "A lead or client needs a short personalized first contact message.",
      "The business needs clear, non-pushy client communication."
    ],
    avoidWhen: [
      "The user has not provided enough target/customer context.",
      "The request needs market research before messaging."
    ],
    outputFormat: "Outreach Message: short version, professional version, follow-up option"
  },
  {
    id: "follow-up-agent",
    name: "Follow-up Agent",
    mode: "follow-up",
    purpose: "Creates follow-up sequences and reply handling guidance for leads and prospects.",
    canUseWebResearch: false,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user asks what to send after no reply.",
      "A lead sequence needs second, third or final follow-up messages.",
      "The business needs reply handling for objections or interest."
    ],
    avoidWhen: [
      "No original outreach or lead context exists.",
      "The request is about product build tasks."
    ],
    outputFormat: "Follow-up Sequence: message 1, message 2, final message, objection handling"
  },
  {
    id: "client-report-agent",
    name: "Client Report Agent",
    mode: "client-report",
    purpose: "Turns analysis, audit and project findings into clear client-facing reports.",
    canUseWebResearch: false,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user wants a professional report for a client.",
      "Website, SEO or business audit findings need a polished summary.",
      "The system needs to package results into a readable deliverable."
    ],
    avoidWhen: [
      "The analysis has not been done yet.",
      "The request is a raw code execution task."
    ],
    outputFormat: "Client Report: executive summary, findings, priorities, recommendations, next step"
  },
  {
    id: "pricing-agent",
    name: "Pricing Agent",
    mode: "pricing",
    purpose: "Estimates pricing, packaging, margins, break-even and offer positioning.",
    canUseWebResearch: true,
    canCreateClientOutput: true,
    canRecommendBuildTasks: false,
    useWhen: [
      "The user asks how much to charge.",
      "A product, service or AI consultant needs pricing logic.",
      "The business needs minimum, recommended and premium price options."
    ],
    avoidWhen: [
      "The request has no product, service or customer context.",
      "The task is only about technical implementation."
    ],
    outputFormat: "Pricing Report: cost assumptions, price tiers, margin logic, risks, recommendation"
  }
];

export function getBusinessAgent(role: BusinessAgentRole): BusinessAgentDefinition {
  return BUSINESS_AGENT_REGISTRY.find((agent) => agent.id === role) ?? BUSINESS_AGENT_REGISTRY[0];
}

export function listBusinessAgents(): BusinessAgentDefinition[] {
  return BUSINESS_AGENT_REGISTRY;
}
