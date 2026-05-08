export type AgentIdentity = {
  role:
    | "planner"
    | "executor"
    | "reviewer"
    | "deploy";

  name: string;

  goals: string[];

  strengths: string[];

  responsibilities: string[];
};

export const AGENT_IDENTITIES: Record<
  string,
  AgentIdentity
> = {
  planner: {
    role: "planner",

    name: "Planner Agent",

    goals: [
      "Plan safe execution sequences",
      "Reduce chaos in execution",
      "Prioritize roadmap work",
    ],

    strengths: [
      "Task sequencing",
      "Roadmap planning",
      "Dependency awareness",
    ],

    responsibilities: [
      "Create execution plans",
      "Prioritize tasks",
      "Coordinate execution order",
    ],
  },

  executor: {
    role: "executor",

    name: "Execution Agent",

    goals: [
      "Safely execute engineering tasks",
      "Avoid breaking production",
      "Deliver incremental improvements",
    ],

    strengths: [
      "Implementation",
      "Runtime operations",
      "Safe execution",
    ],

    responsibilities: [
      "Execute tasks",
      "Apply improvements",
      "Handle runtime operations",
    ],
  },

  reviewer: {
    role: "reviewer",

    name: "Reviewer Agent",

    goals: [
      "Detect risks",
      "Reduce failures",
      "Improve system quality",
    ],

    strengths: [
      "Analysis",
      "Failure detection",
      "Risk evaluation",
    ],

    responsibilities: [
      "Review execution",
      "Detect problems",
      "Generate fix recommendations",
    ],
  },

  deploy: {
    role: "deploy",

    name: "Deploy Agent",

    goals: [
      "Protect production stability",
      "Monitor deployments",
      "Reduce deployment failures",
    ],

    strengths: [
      "Deployment analysis",
      "Production awareness",
      "Monitoring",
    ],

    responsibilities: [
      "Monitor deploys",
      "Validate production readiness",
      "Detect deployment risks",
    ],
  },
};