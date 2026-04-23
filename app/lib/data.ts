import type { Agent, ExecutionRun, Goal, Task } from "./types";

export const activeGoal: Goal = {
  id: "goal_001",
  title: "Build Master Agent OS MVP",
  description: "Create a responsive orchestration dashboard",
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
    role: "Orchestrates goals, tasks, and processes",
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
    lastOutput: "No recent output",
  },
  {
    id: "agent_004",
    name: "Analyst Agent",
    type: "analyst",
    role: "Tracks progress and bottlenecks",
    status: "idle",
    currentTask: "Waiting for system data",
    lastOutput: "No analysis yet",
  },
];

export const tasks: Task[] = [
  {
    id: "task_001",
    title: "Create data model mock file",
    description: "Set up types and data source",
    status: "backlog",
    priority: "high",
    assignedAgent: "Tool Builder",
  },
  {
    id: "task_002",
    title: "Build page navigation structure",
    description: "Unify layout and route navigation",
    status: "doing",
    priority: "high",
    assignedAgent: "Master Agent",
  },
  {
    id: "task_003",
    title: "Refine dashboard layout",
    description: "Improve top-level stats and layout",
    status: "doing",
    priority: "medium",
    assignedAgent: "Master Agent",
  },
  {
    id: "task_004",
    title: "Connect task actions to state",
    description: "Prepare interactive task system",
    status: "waiting",
    priority: "medium",
    assignedAgent: "Tool Builder",
  },
  {
    id: "task_005",
    title: "Initialize Next.js app",
    description: "Create app and verify local setup",
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
    prompt: "Create a structured data model",
    response: "Waiting for model response...",
  },
  {
    id: "run_002",
    source: "Tool Builder",
    status: "draft",
    prompt: "Prepare component structure",
    response: "Not sent yet.",
  },
];