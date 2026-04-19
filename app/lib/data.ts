import type { Agent, ExecutionRun, Goal, Task } from "./types";

export const activeGoal: Goal = {
  id: "goal_001",
  title: "Build Master Agent OS MVP",
  description:
    "Create a responsive orchestration dashboard with screens for chat, agents, tasks, and execution flow.",
  status: "active",
  priority: "high",
  currentPhase: "ui-foundation",
  tags: ["mvp", "ui", "local-dev"],
  successCriteria: [
    "Dashboard works",
    "Navigation works",
    "Agents page works",
    "Tasks page works",
    "Execution page works",
  ],
};

export const agents: Agent[] = [
  {
    id: "agent_001",
    name: "Master Agent",
    type: "master",
    role: "Orchestrates goals, tasks, and planning",
    status: "active",
    currentTask: "Coordinate MVP build",
    lastOutput: "Created initial architecture",
  },
  {
    id: "agent_002",
    name: "Tool Builder",
    type: "tool",
    role: "Creates technical structure and tools",
    status: "idle",
    currentTask: "Waiting assignment",
    lastOutput: "No recent output",
  },
  {
    id: "agent_003",
    name: "Chatbot Builder",
    type: "builder",
    role: "Designs chatbot logic and flow",
    status: "waiting",
    currentTask: "Pending future use",
    lastOutput: "Template not started",
  },
  {
    id: "agent_004",
    name: "Analyst Agent",
    type: "analyst",
    role: "Tracks progress, bottlenecks, and next actions",
    status: "idle",
    currentTask: "Waiting for system data",
    lastOutput: "No analysis yet",
  },
];

export const tasks: Task[] = [
  {
    id: "task_001",
    title: "Create data model mock file",
    description: "Set up types and data source for the UI pages.",
    status: "backlog",
    priority: "high",
    assignedAgent: "Tool Builder",
  },
  {
    id: "task_002",
    title: "Build page navigation structure",
    description: "Unify layout and route navigation across all screens.",
    status: "doing",
    priority: "high",
    assignedAgent: "Master Agent",
  },
  {
    id: "task_003",
    title: "Refine dashboard layout",
    description: "Improve top-level stats and operating view.",
    status: "doing",
    priority: "medium",
    assignedAgent: "Master Agent",
  },
  {
    id: "task_004",
    title: "Connect task actions to state",
    description: "Prepare interactive task controls for next phase.",
    status: "waiting",
    priority: "medium",
    assignedAgent: "Tool Builder",
  },
  {
    id: "task_005",
    title: "Initialize Next.js app",
    description: "Create app and verify local dev server.",
    status: "done",
    priority: "high",
    assignedAgent: "Master Agent",
  },
];

export const executionRuns: ExecutionRun[] = [
  {
    id: "run_001",
    source: "Master Agent",
    status: "ready",
    prompt: "Create a structured data model for Goal, Agent, Task, and ExecutionRun.",
    response: "Waiting for model response...",
  },
  {
    id: "run_002",
    source: "Tool Builder",
    status: "draft",
    prompt: "Prepare component structure for dashboard and navigation.",
    response: "Not sent yet.",
  },
];