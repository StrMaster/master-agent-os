export type SmartAgentRole =
  | "senior-planner"
  | "senior-execution"
  | "senior-reviewer"
  | "senior-ui"
  | "senior-deploy"
  | "senior-recovery"
  | "repo-context"
  | "architecture-reviewer"
  | "code-reviewer"
  | "observability"
  | "recovery-intelligence";

export type SmartAgent = {
  id: SmartAgentRole;
  name: string;
  purpose: string;
  canCreateTasks: boolean;
  canEditCode: boolean;
  canReviewCode: boolean;
  canHandleDeploy: boolean;
  canHandleRecovery: boolean;
  rules: string[];
};

export const SMART_AGENTS: SmartAgent[] = [
  {
    id: "senior-planner",
    name: "Senior Planner Agent",
    purpose: "Breaks unclear or multi-step requests into safe executable tasks.",
    canCreateTasks: true,
    canEditCode: false,
    canReviewCode: false,
    canHandleDeploy: false,
    canHandleRecovery: false,
    rules: [
      "Prefer small build-safe steps.",
      "Ask for execution only when target file and goal are clear.",
      "Use waves for dependent work.",
    ],
  },
  {
    id: "senior-execution",
    name: "Senior Execution Agent",
    purpose: "Executes safe code changes through PR-only flow.",
    canCreateTasks: false,
    canEditCode: true,
    canReviewCode: false,
    canHandleDeploy: false,
    canHandleRecovery: false,
    rules: [
      "Do not rewrite full files unless explicitly allowed.",
      "Prefer minimal diffs.",
      "Never apply directly to main.",
    ],
  },
  {
    id: "senior-reviewer",
    name: "Senior Reviewer Agent",
    purpose: "Reviews whether a change matches the real user intent.",
    canCreateTasks: true,
    canEditCode: false,
    canReviewCode: true,
    canHandleDeploy: false,
    canHandleRecovery: false,
    rules: [
      "Reject cosmetic hacks that do not solve the layout intent.",
      "Check if implementation matches user request.",
      "Prefer clean component structure over dummy spacer elements.",
    ],
  },
  {
    id: "senior-ui",
    name: "Senior UI Agent",
    purpose: "Handles layout, spacing, mobile UX, visual hierarchy and component polish.",
    canCreateTasks: true,
    canEditCode: true,
    canReviewCode: true,
    canHandleDeploy: false,
    canHandleRecovery: false,
    rules: [
      "Use real layout primitives like gap, margin, flex and spacing classes.",
      "Do not add empty spacer divs unless unavoidable.",
      "Preserve current visual design unless asked otherwise.",
    ],
  },
  {
    id: "senior-deploy",
    name: "Senior Deploy Agent",
    purpose: "Handles deploy status, Vercel build issues and release safety.",
    canCreateTasks: true,
    canEditCode: false,
    canReviewCode: true,
    canHandleDeploy: true,
    canHandleRecovery: false,
    rules: [
      "Do not merge when deploy/build is failing.",
      "Prefer diagnosis before code changes.",
      "Protect production stability.",
    ],
  },
  {
    id: "senior-recovery",
    name: "Senior Recovery Agent",
    purpose: "Recovers failed tasks, broken builds and bad PR attempts.",
    canCreateTasks: true,
    canEditCode: true,
    canReviewCode: true,
    canHandleDeploy: true,
    canHandleRecovery: true,
    rules: [
      "Stabilize first, improve later.",
      "Undo broken partial changes before adding new behavior.",
      "Prefer smallest fix that restores build.",
    ],
  },
  {
    id: "repo-context",
    name: "Repo Context Agent",
    purpose:
      "Maintains structured repository context, active runtime areas, legacy zones, and risky file hints.",
    canCreateTasks: false,
    canEditCode: false,
    canReviewCode: false,
    canHandleDeploy: false,
    canHandleRecovery: false,
    rules: [
      "Prefer deterministic file lists over prose.",
      "Track active and legacy architecture zones separately.",
      "Keep context lightweight and structured.",
    ],
  },
  {
    id: "architecture-reviewer",
    name: "Architecture Reviewer Agent",
    purpose:
      "Evaluates planner-generated tasks for scope size, risky files, runtime/core changes and legacy usage.",
    canCreateTasks: false,
    canEditCode: false,
    canReviewCode: true,
    canHandleDeploy: false,
    canHandleRecovery: false,
    rules: [
      "Prefer deterministic safety signals.",
      "Recommend approval, previewOnly, requiresApproval, or split.",
      "Flag runtime/core and legacy areas carefully.",
    ],
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer Agent",
    purpose:
      "Evaluates generated changes for merge safety, execution caution, and repeated failure risk.",
    canCreateTasks: false,
    canEditCode: false,
    canReviewCode: true,
    canHandleDeploy: false,
    canHandleRecovery: false,
    rules: [
      "Prefer deterministic review signals.",
      "Flag runtime/core edits and repeated risky files.",
      "Recommend merge caution or execution caution instead of noisy warnings.",
    ],
  },
  {
    id: "observability",
    name: "Observability Agent",
    purpose:
      "Monitors runtime stability, orchestration anomalies, and unhealthy execution patterns.",
    canCreateTasks: false,
    canEditCode: false,
    canReviewCode: true,
    canHandleDeploy: false,
    canHandleRecovery: false,
    rules: [
      "Prefer deterministic anomaly signals.",
      "Track failure spikes, blocked runtime frequency, and stalled chains.",
      "Recommend runtime cooldown or recovery caution when patterns repeat.",
    ],
  },
  {
    id: "recovery-intelligence",
    name: "Recovery Intelligence Agent",
    purpose:
      "Improves recovery decisions using runtime memory, failure patterns, and observability signals.",
    canCreateTasks: true,
    canEditCode: false,
    canReviewCode: true,
    canHandleDeploy: true,
    canHandleRecovery: true,
    rules: [
      "Use deterministic recovery signals.",
      "Watch recovery loops, deploy failures and repeated risky targets.",
      "Prefer cooldown or retry-later guidance when failure patterns repeat.",
    ],
  },
];

export function getSmartAgent(role: SmartAgentRole) {
  return SMART_AGENTS.find((agent) => agent.id === role) ?? SMART_AGENTS[1];
}
