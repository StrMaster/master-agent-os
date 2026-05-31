export type ProjectArea =
  | "dashboard"
  | "tasks"
  | "execution"
  | "agents"
  | "business"
  | "api"
  | "runner"
  | "layout"
  | "unknown";

export type ProjectFileRole = {
  path: string;
  area: ProjectArea;
  role: string;
  risk: "low" | "medium" | "high";
  safeForAutonomousPatch: boolean;
  notes: string[];
};

const FILE_ROLES: ProjectFileRole[] = [
  {
    path: "app/page.tsx",
    area: "dashboard",
    role: "Main dashboard UI page",
    risk: "medium",
    safeForAutonomousPatch: true,
    notes: ["Best first target for dashboard visual polish.", "Prefer small component-level edits."],
  },
  {
    path: "app/tasks/page.tsx",
    area: "tasks",
    role: "Tasks UI page",
    risk: "medium",
    safeForAutonomousPatch: true,
    notes: ["Use for task list, queue, wave task, and task status UI improvements."],
  },
  {
    path: "app/execution/page.tsx",
    area: "execution",
    role: "Execution monitoring UI page",
    risk: "medium",
    safeForAutonomousPatch: true,
    notes: ["Use for execution status, runner output, and activity display UI improvements."],
  },
  {
    path: "app/agents/page.tsx",
    area: "agents",
    role: "Agents UI page",
    risk: "medium",
    safeForAutonomousPatch: true,
    notes: ["Use for visible agent registry or agent status UI improvements."],
  },
  {
    path: "app/layout.tsx",
    area: "layout",
    role: "Root app shell and document layout",
    risk: "high",
    safeForAutonomousPatch: false,
    notes: [
      "Avoid for generic dashboard/UI polish tasks.",
      "Only edit when the task explicitly asks for global layout, metadata, providers, nav shell, html or body changes.",
      "JSX mistakes here can break the whole app.",
    ],
  },
  {
    path: "app/api/agent-runner/route.ts",
    area: "runner",
    role: "Primary execution engine",
    risk: "high",
    safeForAutonomousPatch: false,
    notes: ["Critical PR-only runner. Edit only with explicit runner/stability task and strong validation."],
  },
  {
    path: "app/api/master-agent/route.ts",
    area: "api",
    role: "Master Agent chat API route",
    risk: "high",
    safeForAutonomousPatch: false,
    notes: ["Critical conversation and tool routing file. Keep changes small and build-safe."],
  },
  {
    path: "agents/business",
    area: "business",
    role: "Business Intelligence agent layer",
    risk: "low",
    safeForAutonomousPatch: true,
    notes: ["Safe area for business agent additions and analysis logic."],
  },
];

export function getProjectContextSummary(): string {
  return [
    "Master OS developer context:",
    "- app/page.tsx is the main dashboard UI target.",
    "- app/tasks/page.tsx is the task/wave/queue UI target.",
    "- app/execution/page.tsx is the execution monitoring UI target.",
    "- app/agents/page.tsx is the agents UI target.",
    "- app/layout.tsx is high-risk root layout and should not be used for generic UI polish.",
    "- app/api/agent-runner/route.ts is the primary PR-only execution engine and is high risk.",
    "- app/api/master-agent/route.ts is the Master Agent tool/chat route and is high risk.",
    "- agents/business/* is the Business Intelligence layer and is generally safe for business analysis work.",
  ].join("\n");
}

export function getFileRole(path: string): ProjectFileRole {
  const exact = FILE_ROLES.find((file) => file.path === path);
  if (exact) return exact;

  const prefix = FILE_ROLES.find((file) => path.startsWith(file.path));
  if (prefix) return prefix;

  if (path.startsWith("app/api/")) {
    return {
      path,
      area: "api",
      role: "API route",
      risk: "high",
      safeForAutonomousPatch: false,
      notes: ["API routes can affect production behavior. Require explicit backend task and validation."],
    };
  }

  if (path.startsWith("app/") && path.endsWith("page.tsx")) {
    return {
      path,
      area: "dashboard",
      role: "App Router page UI",
      risk: "medium",
      safeForAutonomousPatch: true,
      notes: ["Page files are acceptable UI targets when selected intentionally."],
    };
  }

  if (path.startsWith("components/")) {
    return {
      path,
      area: "dashboard",
      role: "Reusable UI component",
      risk: "medium",
      safeForAutonomousPatch: true,
      notes: ["Component edits are acceptable for focused UI tasks."],
    };
  }

  return {
    path,
    area: "unknown",
    role: "Unknown project file",
    risk: "medium",
    safeForAutonomousPatch: false,
    notes: ["Unknown file role. Read file and classify before patching."],
  };
}

export function isHighRiskFile(path: string): boolean {
  return getFileRole(path).risk === "high";
}

export function canAutonomouslyPatch(path: string): boolean {
  return getFileRole(path).safeForAutonomousPatch;
}
