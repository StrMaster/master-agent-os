import { getSmartAgent, type SmartAgent, type SmartAgentRole } from "./agent-registry";

export type AgentRouteDecision = {
  role: SmartAgentRole;
  agent: SmartAgent;
  confidence: "low" | "medium" | "high";
  reason: string;
};

export function routePromptToAgent(prompt: string): AgentRouteDecision {
  const text = prompt.toLowerCase();

  const isDesignSpecialist =
    text.includes("design specialist") ||
    text.includes("design review") ||
    text.includes("ux") ||
    text.includes("usability") ||
    text.includes("accessibility") ||
    text.includes("responsive") ||
    text.includes("mobile ux") ||
    text.includes("visual hierarchy") ||
    text.includes("contrast") ||
    text.includes("wireframe") ||
    text.includes("mockup");

  if (isDesignSpecialist) {
    return {
      role: "design-specialist",
      agent: getSmartAgent("design-specialist"),
      confidence: "high",
      reason: "Prompt asks for UI/UX or design safety guidance.",
    };
  }

  const isFrontendSpecialist =
    text.includes("frontend specialist") ||
    text.includes("frontend review") ||
    text.includes("front-end") ||
    text.includes("frontend task") ||
    text.includes("frontend") ||
    text.includes("visual only") ||
    text.includes("runtime coupling") ||
    text.includes("state/data") ||
    text.includes("design review");

  if (isFrontendSpecialist) {
    return {
      role: "frontend-specialist",
      agent: getSmartAgent("frontend-specialist"),
      confidence: "high",
      reason: "Prompt asks for frontend planning or UI safety guidance.",
    };
  }

  const isBackendSpecialist =
    text.includes("backend specialist") ||
    text.includes("backend review") ||
    text.includes("backend task") ||
    text.includes("server-side") ||
    text.includes("route handler") ||
    text.includes("api route") ||
    text.includes("runtime module") ||
    text.includes("orchestration") ||
    text.includes("deploy risk") ||
    text.includes("state helper") ||
    text.includes("recovery flow");

  if (isBackendSpecialist) {
    return {
      role: "backend-specialist",
      agent: getSmartAgent("backend-specialist"),
      confidence: "high",
      reason: "Prompt asks for backend, API, runtime, or orchestration guidance.",
    };
  }

  const isTestingSpecialist =
    text.includes("testing specialist") ||
    text.includes("testing review") ||
    text.includes("test coverage") ||
    text.includes("validation") ||
    text.includes("verification") ||
    text.includes("build verification") ||
    text.includes("qa") ||
    text.includes("regression") ||
    text.includes("lint") ||
    text.includes("ci") ||
    text.includes("deploy caution");

  if (isTestingSpecialist) {
    return {
      role: "testing-specialist",
      agent: getSmartAgent("testing-specialist"),
      confidence: "high",
      reason: "Prompt asks for validation, testing, or build verification guidance.",
    };
  }

  const isSecuritySpecialist =
    text.includes("security specialist") ||
    text.includes("security review") ||
    text.includes("secret") ||
    text.includes("token") ||
    text.includes("env") ||
    text.includes("permission") ||
    text.includes("authorization") ||
    text.includes("auth") ||
    text.includes("csrf") ||
    text.includes("xss") ||
    text.includes("unsafe external request") ||
    text.includes("runtime exposure") ||
    text.includes("deploy security");

  if (isSecuritySpecialist) {
    return {
      role: "security-specialist",
      agent: getSmartAgent("security-specialist"),
      confidence: "high",
      reason: "Prompt asks for security or runtime safety guidance.",
    };
  }

  const isPerformanceSpecialist =
    text.includes("performance specialist") ||
    text.includes("performance review") ||
    text.includes("slow") ||
    text.includes("bottleneck") ||
    text.includes("polling") ||
    text.includes("hot path") ||
    text.includes("rendering cost") ||
    text.includes("expensive loop") ||
    text.includes("throughput") ||
    text.includes("latency") ||
    text.includes("optimization") ||
    text.includes("cooldown increase");

  if (isPerformanceSpecialist) {
    return {
      role: "performance-specialist",
      agent: getSmartAgent("performance-specialist"),
      confidence: "high",
      reason: "Prompt asks for performance or bottleneck guidance.",
    };
  }

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

  const isRecoveryIntelligence =
    text.includes("recovery intelligence") ||
    text.includes("retry later") ||
    text.includes("cooldown runtime") ||
    text.includes("recovery loop") ||
    text.includes("stop execution");

  if (isRecoveryIntelligence) {
    return {
      role: "recovery-intelligence",
      agent: getSmartAgent("recovery-intelligence"),
      confidence: "high",
      reason: "Prompt asks for recovery decision support or loop analysis.",
    };
  }

  const isControlCommunication =
    text.includes("control summary") ||
    text.includes("runtime state") ||
    text.includes("execution guidance") ||
    text.includes("next actions") ||
    text.includes("blocked reasons");

  if (isControlCommunication) {
    return {
      role: "control-communication",
      agent: getSmartAgent("control-communication"),
      confidence: "high",
      reason: "Prompt asks for runtime explanation or communication guidance.",
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

export async function routePromptToAgentAI(prompt: string): Promise<AgentRouteDecision> {
  try {
    const res = await fetch("/api/route-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error("Routing API failed");

    const data = await res.json();
    const role = data.role as SmartAgentRole;
    const agent = getSmartAgent(role);

    return {
      role,
      agent,
      confidence: data.confidence ?? "medium",
      reason: data.reason ?? "AI routing decision",
    };
  } catch {
    return routePromptToAgent(prompt);
  }
}
