export type BusinessAgentRole =
  | "research-agent"
  | "website-audit-agent"
  | "business-analyst-agent"
  | "market-analysis-agent"
  | "competitor-research-agent"
  | "seo-agent"
  | "marketing-agent"
  | "offer-agent"
  | "proposal-agent"
  | "outreach-agent"
  | "follow-up-agent"
  | "client-report-agent"
  | "pricing-agent";

export type BusinessAgentMode =
  | "research"
  | "website-audit"
  | "business-analysis"
  | "market-analysis"
  | "competitor-research"
  | "seo-analysis"
  | "marketing-analysis"
  | "offer-building"
  | "proposal-building"
  | "outreach"
  | "follow-up"
  | "client-report"
  | "pricing";

export type BusinessAgentDefinition = {
  id: BusinessAgentRole;
  name: string;
  mode: BusinessAgentMode;
  purpose: string;
  canUseWebResearch: boolean;
  canCreateClientOutput: boolean;
  canRecommendBuildTasks: boolean;
  useWhen: string[];
  avoidWhen: string[];
  outputFormat: string;
};

export type BusinessAnalysisRequest = {
  prompt: string;
  url?: string;
  businessName?: string;
  industry?: string;
  targetCustomer?: string;
  goal?: string;
};

export type BusinessAnalysisResult = {
  agentRole: BusinessAgentRole;
  title: string;
  summary: string;
  score?: number;
  strengths: string[];
  problems: string[];
  priorityActions: string[];
  recommendedNextStep: string;
};
