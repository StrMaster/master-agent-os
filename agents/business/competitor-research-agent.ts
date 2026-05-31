import type { BusinessAnalysisRequest, BusinessAnalysisResult } from './types';

export function analyzeCompetitors(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: 'competitor-research-agent',
    title: `Competitor Research: ${input.businessName ?? input.industry ?? 'Market'}`,
    summary: 'Identifies competitors, positioning gaps and differentiation opportunities.',
    score: 74,
    strengths: [
      'Highlights what customers already have available.',
      'Helps avoid building a copy of an existing solution.',
      'Can reveal positioning opportunities faster than feature expansion.'
    ],
    problems: [
      'Competitor features are easy to copy but positioning is harder to replicate.',
      'The strongest competitor is often customer inertia, not another product.',
      'Many businesses underestimate distribution advantages held by incumbents.'
    ],
    priorityActions: [
      'List direct competitors.',
      'List indirect alternatives.',
      'Identify their strengths and weaknesses.',
      'Find positioning gaps.',
      'Define a unique advantage.'
    ],
    recommendedNextStep: 'Combine competitor research with market analysis and offer design.'
  };
}
