import { getSmartAgent, type SmartAgent, type SmartAgentRole } from "./agent-registry";

export type AgentRouteDecision = {
  role: SmartAgentRole;
  agent: SmartAgent;
  confidence: "low" | "medium" | "high";
  reason: string;
};

export function routePromptToAgent(prompt: string): AgentRouteDecision {
  const text = prompt.toLowerCase();

  const isUi =
    text.includes("ui") ||
    text.includes("layout") ||
    text.includes("mobile") ||
    text.includes("button") ||
    text.includes("spacing") ||
    text.includes("tarp") ||
    text.includes("mygtuk") ||
    text.includes("design") ||
    text.includes("ux");

  if (isUi) {
    return {
      role: "senior-ui",
      agent: getSmartAgent("senior-ui"),
      confidence: "high",
      reason: "Prompt is about UI/layout/mobile/design behavior.",
    };
  }

  const isDeploy =
    text.includes("deploy") ||
    text.includes("vercel") ||
    text.includes("build error") ||
    text.includes("build failed") ||
    text.includes("production");

  if (isDeploy) {
    return {
      role: "senior-deploy",
      agent: getSmartAgent("senior-deploy"),
      confidence: "high",
      reason: "Prompt is about build/deploy/release stability.",
    };
  }

  const isRepoContext =
    text.includes("repo context") ||
    text.includes("active runtime areas") ||
    text.includes("legacy zones") ||
    text.includes("file hints") ||
    text.includes("architecture map");

  if (isRepoContext) {
    return {
      role: "repo-context",
      agent: getSmartAgent("repo-context"),
      confidence: "high",
      reason: "Prompt asks for repository structure or architecture context.",
    };
  }

  const isArchitectureReview =
    text.includes("architecture") ||
    text.includes("scope size") ||
    text.includes("risky files") ||
    text.includes("runtime core") ||
    text.includes("split task");

  if (isArchitectureReview) {
    return {
      role: "architecture-reviewer",
      agent: getSmartAgent("architecture-reviewer"),
      confidence: "high",
      reason: "Prompt asks for architecture review or structural safety guidance.",
    };
  }

  const isCodeReview =
    text.includes("code review") ||
    text.includes("merge safety") ||
    text.includes("pull request review") ||
    text.includes("execution caution") ||
    text.includes("review generated changes");

  if (isCodeReview) {
    return {
      role: "code-reviewer",
      agent: getSmartAgent("code-reviewer"),
      confidence: "high",
      reason: "Prompt asks for code review or merge/execution safety guidance.",
    };
  }

  const isObservability =
    text.includes("observability") ||
    text.includes("runtime anomaly") ||
    text.includes("stability") ||
    text.includes("stalled execution") ||
    text.includes("runner health");

  if (isObservability) {
    return {
      role: "observability",
      agent: getSmartAgent("observability"),
      confidence: "high",
      reason: "Prompt asks for runtime monitoring or anomaly detection.",
    };
  }

  const isRecovery =
    text.includes("recover") ||
    text.includes("recovery") ||
    text.includes("broken") ||
    text.includes("neveikia") ||
    text.includes("sugedo") ||
    text.includes("failed");

  if (isRecovery) {
    return {
      role: "senior-recovery",
      agent: getSmartAgent("senior-recovery"),
      confidence: "high",
      reason: "Prompt is about recovery or broken behavior.",
    };
  }

  const isReview =
    text.includes("review") ||
    text.includes("check") ||
    text.includes("perziurek") ||
    text.includes("peržiūrėk") ||
    text.includes("patikrink");

  if (isReview) {
    return {
      role: "senior-reviewer",
      agent: getSmartAgent("senior-reviewer"),
      confidence: "medium",
      reason: "Prompt asks for review/checking.",
    };
  }

  const isPlanning =
    text.includes("plan") ||
    text.includes("roadmap") ||
    text.includes("stage") ||
    text.includes("step") ||
    text.includes("suplanuok");

  if (isPlanning) {
    return {
      role: "senior-planner",
      agent: getSmartAgent("senior-planner"),
      confidence: "medium",
      reason: "Prompt asks for planning.",
    };
  }

  return {
    role: "senior-execution",
    agent: getSmartAgent("senior-execution"),
    confidence: "medium",
    reason: "Default executable engineering task.",
  };
}
