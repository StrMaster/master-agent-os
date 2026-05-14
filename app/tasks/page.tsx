import HiddenTaskCleaner from "../components/HiddenTaskCleaner";
import ApprovePreviewTaskButton from "../components/ApprovePreviewTaskButton";
import ApprovePlannerWaveButton from "../components/ApprovePlannerWaveButton";
import RemoveTaskButton from "../components/RemoveTaskButton";
import RunNowButton from "../components/RunNowButton";
import MergePrButton from "../components/MergePrButton";

import { readTasks, syncMergedPrTasks } from "./task-data";
import { uniqueById, isActiveTask, isCompletedTask, getSafetyReviews } from "./task-utils";
import type { AgentTask } from "./types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const rawTasks = await readTasks();
  const tasks = await syncMergedPrTasks(rawTasks);

  const activeTasks = uniqueById(tasks.filter(isActiveTask));
  const activeTaskIds = new Set(activeTasks.map((t) => t.id));

  const plannerRequired = uniqueById(tasks.filter(
    (t) => !activeTaskIds.has(t.id) && !isCompletedTask(t) &&
      (t.status === "planner-required" || (t.executionMode === "multi-step" && t.riskLevel === "high"))
  ));
  const plannerRequiredIds = new Set(plannerRequired.map((t) => t.id));

  const plannerSplit = uniqueById(tasks.filter(
    (t) => t.status === "planner-split" && !plannerRequiredIds.has(t.id) && !activeTaskIds.has(t.id) && !isCompletedTask(t)
  ));
  const plannerSplitIds = new Set(plannerSplit.map((t) => t.id));

  const waveTasks = uniqueById(tasks.filter(
    (t) => (typeof t.wave === "number" || t.parentTaskId) &&
      !isActiveTask(t) && !isCompletedTask(t) && !plannerRequiredIds.has(t.id) && !plannerSplitIds.has(t.id)
  ));
  const waveTaskIds = new Set(waveTasks.map((t) => t.id));

  const todoTasks = uniqueById(tasks.filter(
    (t) => (t.status === "todo" || t.status === "queued") &&
      !isActiveTask(t) && !isCompletedTask(t) &&
      !plannerRequiredIds.has(t.id) && !plannerSplitIds.has(t.id) && !waveTaskIds.has(t.id)
  ));

  const failedTasks = uniqueById(tasks.filter((t) => t.status === "failed"));
  const completedTasks = uniqueById(tasks.filter(isCompletedTask)).slice(0, 2);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <HiddenTaskCleaner />
      <div>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="mt-2 text-sm text-white/60">
          Planner queue and orchestration board for Master Agent OS.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={tasks.length} />
        <StatCard label="Active" value={activeTasks.length} />
        <StatCard label="Todo" value={todoTasks.length} />
        <StatCard label="Waves" value={waveTasks.length} />
        <StatCard label="Failed" value={failedTasks.length} />
      </div>

      <TaskSection title="Running" description="Tasks currently being executed or waiting in PR review." tasks={activeTasks} empty="No tasks are currently running." />
      <TaskSection title="Planner Required" description="High-risk or multi-step tasks that need planner waves before execution." tasks={plannerRequired} empty="No tasks currently require planner waves." />
      <TaskSection title="Planner Split" description="Parent tasks that were split into smaller execution waves." tasks={plannerSplit} empty="No parent tasks have been split yet." />
      <TaskSection title="Wave Tasks" description="Ordered wave tasks created by the planner." tasks={waveTasks} empty="No wave tasks yet." />
      <TaskSection title="Todo" description="Tasks waiting for the runner." tasks={todoTasks} empty="No todo tasks." />
      <TaskSection title="Failed" description="Tasks that failed and may need recovery." tasks={failedTasks} empty="No failed tasks." />
      <TaskSection title="Completed" description="Tasks that are done, completed, or merged." tasks={completedTasks} empty="No completed tasks." />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function TaskSection({ title, description, tasks, empty }: { title: string; description: string; tasks: AgentTask[]; empty: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/50">{description}</p>
      </div>
      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4 text-sm text-white/50">{empty}</div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </section>
  );
}

function TaskCard({ task }: { task: AgentTask }) {
  const safetyReviews = getSafetyReviews(task);
  const passedReviews = safetyReviews.filter((r) => r.passed);
  const needsAttention = safetyReviews.some((r) => !r.passed);
  const readyForRun = !needsAttention && passedReviews.length > 0 && !task.result?.pullRequestUrl;

  const canDelete = ["todo", "queued", "planner-required", "planner-split", "failed", "running"].includes(task.status ?? "");

  return (
    <div data-task-id={task.id} className="rounded-xl border border-white/10 bg-neutral-950/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{task.title ?? "Untitled task"}</div>
          {task.summary && <p className="mt-2 text-sm text-white/60">{task.summary}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{task.status ?? "unknown"}</Badge>
          {task.priority && <Badge>{task.priority}</Badge>}
          {task.riskLevel && <Badge>{task.riskLevel} risk</Badge>}
          {task.executionMode && <Badge>{task.executionMode}</Badge>}
          {typeof task.wave === "number" && <Badge>Wave {task.wave}</Badge>}
          {task.waveStatus && <Badge>{task.waveStatus}</Badge>}
          {task.previewOnly && <Badge>Preview</Badge>}
          {task.requiresApproval && <Badge>Approval required</Badge>}
          {passedReviews.length > 0 && (
            <SafeBadge>Safe: {passedReviews.length}/{safetyReviews.length} passed</SafeBadge>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-white/45 sm:grid-cols-2">
        <Meta label="Task ID" value={task.id} />
        <Meta label="Source" value={task.source} />
        <Meta label="Intent" value={task.intent} />
        <Meta label="Target" value={task.targetFile} />
        <Meta label="Parent" value={task.parentTaskId} />
        <Meta label="Approved by" value={task.approvedBy} />
        <Meta label="Approved at" value={task.approvedAt} />
        <Meta label="Wave status" value={task.waveStatus} />
        <Meta label="Retries" value={typeof task.retryCount === "number" ? String(task.retryCount) : undefined} />
      </div>

      {safetyReviews.length > 0 && (
        <div className={`mt-4 rounded-lg border p-3 text-xs ${needsAttention ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-100/90" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100/90"}`}>
          <div className="font-semibold">{needsAttention ? "Safety review: needs attention" : "Safe code: passed review gates"}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {safetyReviews.map((review) => (
              <span key={review.label} className={`rounded-md border px-2 py-1 ${review.passed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-100"}`}>
                {review.label}: {review.passed ? "Passed" : "Review"}
              </span>
            ))}
          </div>
        </div>
      )}

      {readyForRun && (
        <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-100/90">
          Ready for manual run. Auto-run is off, so approve or run this task from the operator controls when you are ready.
        </div>
      )}

      {task.plannerNotes && (
        <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/10 p-3 text-xs text-purple-100/80">
          {task.plannerNotes}
        </div>
      )}

      {task.error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
          {task.error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(task.status === "queued" || task.status === "todo") && <RunNowButton taskId={task.id} />}
        {(task.previewOnly || task.requiresApproval) && task.status !== "done" && <ApprovePreviewTaskButton taskId={task.id} />}
        {task.result?.pullRequestUrl && (
          <a href={task.result.pullRequestUrl} target="_blank" rel="noreferrer" className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200 hover:bg-blue-500/20">
            View PR
          </a>
        )}
        {task.result?.pullRequestUrl && task.result.merged !== true && (
          <MergePrButton taskId={task.id} pullRequestUrl={task.result.pullRequestUrl} />
        )}
        {canDelete && <RemoveTaskButton taskId={task.id} />}
      </div>

      {typeof task.wave === "number" && task.parentTaskId && (task.previewOnly || task.requiresApproval) && (
        <ApprovePlannerWaveButton taskId={task.id} />
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60">{children}</span>;
}

function SafeBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">{children}</span>;
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div><span className="text-white/30">{label}: </span><span>{value}</span></div>;
}
