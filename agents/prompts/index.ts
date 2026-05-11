import type { SmartAgentRole } from "../core/agent-registry";
import { PLANNER_AGENT_PROMPT } from "./planner";
import { EXECUTION_AGENT_PROMPT } from "./execution";
import { REVIEWER_AGENT_PROMPT } from "./reviewer";
import { UI_AGENT_PROMPT } from "./ui";
import { DEPLOY_AGENT_PROMPT } from "./deploy";
import { RECOVERY_AGENT_PROMPT } from "./recovery";
import { REPO_CONTEXT_AGENT_PROMPT } from "./repo-context";

export function getAgentPrompt(role: SmartAgentRole) {
  switch (role) {
    case "senior-planner":
      return PLANNER_AGENT_PROMPT;
    case "senior-reviewer":
      return REVIEWER_AGENT_PROMPT;
    case "senior-ui":
      return UI_AGENT_PROMPT;
    case "senior-deploy":
      return DEPLOY_AGENT_PROMPT;
    case "senior-recovery":
      return RECOVERY_AGENT_PROMPT;
    case "repo-context":
      return REPO_CONTEXT_AGENT_PROMPT;
    case "senior-execution":
    default:
      return EXECUTION_AGENT_PROMPT;
  }
}
