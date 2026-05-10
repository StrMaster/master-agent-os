import { routePromptToAgent } from "./agent-router";
import { getAgentPrompt } from "../prompts";

export type DelegatedAgentTask = {
  role: string;
  agentName: string;
  systemPrompt: string;
  routingReason: string;
};

export function delegateTaskToAgent(userPrompt: string): DelegatedAgentTask {
  const route = routePromptToAgent(userPrompt);

  return {
    role: route.role,
    agentName: route.agent.name,
    systemPrompt: getAgentPrompt(route.role),
    routingReason: route.reason,
  };
}