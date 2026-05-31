import type { BusinessAnalysisRequest, BusinessAnalysisResult } from './types';

export function analyzeBusinessIdea(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: 'business-analyst-agent',
    title: `Business Analysis: ${input.businessName ?? 'Opportunity'}`,
    summary: 'Evaluates business potential, customer value, monetization and execution risk.',
    score: 75,
    strengths: [
      'Focuses on customer problems before product features.',
      'Can be combined with market, competitor and marketing agents.',
      'Supports AI consultant, SaaS and service-based business models.'
    ],
    problems: [
      'Ideas often overestimate demand before validating customer pain.',
      'Distribution is usually harder than building the product.',
      'Monetization should be tested early.'
    ],
    priorityActions: [
      'Define target customer.',
      'Define painful problem.',
      'Validate willingness to pay.',
      'Analyze competitors.',
      'Create a clear offer.'
    ],
    recommendedNextStep: 'Run market analysis and competitor research before committing significant development effort.'
  };
}
