import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export function buildFollowUp(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: "follow-up-agent",
    title: `Follow-up Strategy: ${input.businessName ?? "Prospect"}`,
    summary: "Creates follow-up sequences and reply-handling guidance for leads, prospects and client conversations.",
    score: 74,
    strengths: [
      "Keeps outreach active without sounding desperate or pushy.",
      "Helps handle no-response situations professionally.",
      "Can connect first-contact outreach to proposal or audit delivery."
    ],
    problems: [
      "Following up without new value can feel spammy.",
      "Too many follow-ups can damage trust.",
      "Weak original outreach limits follow-up effectiveness."
    ],
    priorityActions: [
      "Reference the previous message briefly.",
      "Add one new useful observation or reason to reply.",
      "Keep the message shorter than the first outreach.",
      "Use a low-pressure question.",
      "Stop after a reasonable final follow-up if there is no response."
    ],
    recommendedNextStep: "Use client-report-agent if the prospect requests details or wants to see findings."
  };
}
