import { routePromptToAgent, routePromptToAgentAI } from "./agent-router";
import { getAgentPrompt } from "../prompts";

export type DelegatedAgentTask = {
  role: string;
  agentName: string;
  systemPrompt: string;
  routingReason: string;
  confidence?: string;
};

export function delegateTaskToAgent(userPrompt: string): DelegatedAgentTask {
  const route = routePromptToAgent(userPrompt);

  return {
    role: route.role,
    agentName: route.agent.name,
    systemPrompt: getAgentPrompt(route.role),
    routingReason: route.reason,
    confidence: route.confidence,
  };
}

export async function delegateTaskToAgentAI(userPrompt: string): Promise<DelegatedAgentTask> {
  const route = await routePromptToAgentAI(userPrompt);

  return {
    role: route.role,
    agentName: route.agent.name,
    systemPrompt: getAgentPrompt(route.role),
    routingReason: route.reason,
    confidence: route.confidence,
  };
}
