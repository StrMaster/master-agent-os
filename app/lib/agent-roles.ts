export type AgentRole =
  | "planner"
  | "executor"
  | "reviewer"
  | "deploy";

export const AGENT_ROLE_DESCRIPTIONS: Record<
  AgentRole,
  string
> = {
  planner:
    "Analyzes the project and generates execution plans.",

  executor:
    "Executes engineering tasks and runtime operations.",

  reviewer:
    "Reviews execution quality, failures, and risks.",

  deploy:
    "Monitors deployments and production readiness.",
};