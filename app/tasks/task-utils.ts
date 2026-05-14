import type { AgentTask, SafetyReview } from "./types";

export const ACTIVE_TASK_STATUSES = new Set([
  "in-progress",
  "running",
  "pending-pr",
  "execution-started",
  "queued",
]);

export function uniqueById(tasks: AgentTask[]) {
  return [...new Map(tasks.map((task) => [task.id, task])).values()];
}

export function isCompletedTask(task: AgentTask) {
  return (
    task.status === "done" ||
    task.status === "completed" ||
    task.result?.merged === true
  );
}

export function isActiveTask(task: AgentTask) {
  return !isCompletedTask(task) && ACTIVE_TASK_STATUSES.has(task.status ?? "");
}

export function getPullRequestNumber(task: AgentTask) {
  if (task.result?.pullRequestNumber) {
    return task.result.pullRequestNumber;
  }
  const pullRequestUrl = task.result?.pullRequestUrl;
  if (!pullRequestUrl) return null;
  const match = pullRequestUrl.match(/\/pull\/(\d+)/);
  const parsed = match?.[1] ? Number(match[1]) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function getSafetyReviews(task: AgentTask): SafetyReview[] {
  const notes = String(task.plannerNotes ?? "").toLowerCase();
  return [
    { label: "Architecture", passed: notes.includes("architecture review: approve") },
    { label: "Code", passed: notes.includes("code review: approve") },
    { label: "Backend", passed: notes.includes("backend review: approve") },
    { label: "Frontend", passed: notes.includes("frontend review: approve") || notes.includes("frontend review: design-review") },
    { label: "Design", passed: notes.includes("design review: approve") || notes.includes("design review: design-review") },
    { label: "Testing", passed: notes.includes("testing review: approve") || notes.includes("testing review: build-verification") },
    { label: "Performance", passed: notes.includes("performance review: approve") },
    { label: "Observability", passed: notes.includes("observability: ok") },
  ].filter((review) => notes.includes(review.label.toLowerCase()));
}
