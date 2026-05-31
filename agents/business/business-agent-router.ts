import { getBusinessAgent } from "./business-agent-registry";
import type { BusinessAgentDefinition, BusinessAgentRole } from "./types";

export type BusinessAgentRouteDecision = {
  role: BusinessAgentRole;
  agent: BusinessAgentDefinition;
  confidence: "low" | "medium" | "high";
  reason: string;
};

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function routePromptToBusinessAgent(prompt: string): BusinessAgentRouteDecision {
  const text = prompt.toLowerCase();

  if (hasAny(text, ["seo", "google", "keyword", "keywords", "paieška", "paieska", "search traffic", "organic traffic"])) {
    const role: BusinessAgentRole = "seo-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for SEO, search visibility or keyword analysis."
    };
  }

  if (hasAny(text, ["website", "puslap", "svetain", "landing", "homepage", "ux", "ui", "conversion", "cta", "trust", "dizain", "design"])) {
    const role: BusinessAgentRole = "website-audit-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for website, UX, conversion, trust or landing page audit."
    };
  }

  if (hasAny(text, ["competitor", "konkur", "alternative", "alternatyv", "compare", "palygink", "rivals"])) {
    const role: BusinessAgentRole = "competitor-research-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for competitor research or market alternatives."
    };
  }

  if (hasAny(text, ["market", "rinka", "niche", "niša", "nisa", "demand", "paklausa", "audience", "target customer"])) {
    const role: BusinessAgentRole = "market-analysis-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for market, niche, demand or audience analysis."
    };
  }

  if (hasAny(text, ["price", "pricing", "kaina", "kiek imti", "charge", "margins", "margin", "breakeven"])) {
    const role: BusinessAgentRole = "pricing-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for pricing, margin or packaging guidance."
    };
  }

  if (hasAny(text, ["offer", "pasiūlym", "pasiulym", "package", "paketas", "value proposition", "deliverables"])) {
    const role: BusinessAgentRole = "offer-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for offer or package creation."
    };
  }

  if (hasAny(text, ["proposal", "pasiūlymo dokument", "pasiulymo dokument", "quote", "client proposal", "scope"] )) {
    const role: BusinessAgentRole = "proposal-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for a client proposal or structured pitch."
    };
  }

  if (hasAny(text, ["outreach", "linkedin", "email", "cold message", "dm", "žinut", "zinut", "parašyk klientui", "parasyk klientui"])) {
    const role: BusinessAgentRole = "outreach-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for outreach or client contact messaging."
    };
  }

  if (hasAny(text, ["follow up", "follow-up", "priminti", "neatraš", "neatras", "no reply", "atsakym", "objection"])) {
    const role: BusinessAgentRole = "follow-up-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for follow-up or reply handling."
    };
  }

  if (hasAny(text, ["report", "ataskaita", "client report", "summary for client", "santrauka klientui"])) {
    const role: BusinessAgentRole = "client-report-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "high",
      reason: "Prompt asks for a client-facing report."
    };
  }

  if (hasAny(text, ["marketing", "positioning", "pozicion", "hook", "copy", "cta", "message", "brand", "content"])) {
    const role: BusinessAgentRole = "marketing-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "medium",
      reason: "Prompt asks for marketing, positioning or messaging guidance."
    };
  }

  if (hasAny(text, ["business", "versl", "monetization", "monetiz", "product idea", "saas idea", "idėja", "ideja", "ai consultant", "product builder"])) {
    const role: BusinessAgentRole = "business-analyst-agent";
    return {
      role,
      agent: getBusinessAgent(role),
      confidence: "medium",
      reason: "Prompt asks for business, product or monetization analysis."
    };
  }

  const role: BusinessAgentRole = "research-agent";
  return {
    role,
    agent: getBusinessAgent(role),
    confidence: "low",
    reason: "Default business route for broad research or unclear business request."
  };
}
