import ApprovePreviewTaskButton from "../components/ApprovePreviewTaskButton";
import ApprovePlannerWaveButton from "../components/ApprovePlannerWaveButton";
import ApprovalExecutionCenter from "../components/ApprovalExecutionCenter";
import AgentsWorkspace from "../components/AgentsWorkspace";
import ActivityFeed from "../components/ActivityFeed";
import RecoveryControlCard from "../components/RecoveryControlCard";
import RuntimeControlPanel from "../components/RuntimeControlPanel";
import RuntimeDashboard from "../components/RuntimeDashboard";
import { readActivityFile } from "../api/agent-runner/activity";


export const dynamic = "force-dynamic";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

type AgentTask = {
  id: string;
  title?: string;
  summary?: string;
  status?: string;
  priority?: "low" | "medium" | "high";
  source?: string;
  targetFile?: string;
  intent?: string;
  riskLevel?: "low" | "medium" | "high";
  executionMode?: "single-file" | "multi-step";
  wave?: number;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  waveStatus?: "ready" | "blocked" | "completed";
  parentTaskId?: string;
  plannerNotes?: string;
  retryCount?: number;
  lastRetryAt?: string;
  error?: string;
  createdAt?: string;
  result?: {
    branchName?: string;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
    merged?: boolean;
  };
};

async function readTasks(): Promise<AgentTask[]> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return [];
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${TASKS_PATH}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return [];
  }

  const file = await res.json();
  const content = Buffer.from(file.content, "base64").toString("utf-8");
  const parsed = JSON.parse(content);

  return Array.isArray(parsed) ? parsed : [];
}

async function syncMergedPrTasks(tasks: AgentTask[]) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return tasks;
  }

  return Promise.all(
    tasks.map(async (task) => {
      const prNumber = task.result?.pullRequestNumber;

      if (!prNumber || task.result?.merged === true) {
        return task;
      }

      const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${prNumber}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        }
      );

      if (!res.ok) {
        return task;
      }

      const pr = await res.json();

      if (pr.merged === true) {
        return {
          ...task,
          status: "done",
          result: {
            ...task.result,
            merged: true,
          },
        };
      }

      return task;
    })
  );
}

export default async function TasksPage() {
  const [rawTasks, activityFile] = await Promise.all([
    readTasks(),
    readActivityFile(),
  ]);
  const tasks = await syncMergedPrTasks(rawTasks);
  const activity = Array.isArray(activityFile.activity)
    ? activityFile.activity
    : [];

  const plannerRequired = tasks.filter(
    (task) =>
      task.status === "planner-required" ||
      (task.executionMode === "multi-step" && task.riskLevel === "high")
  );

  const plannerSplit = tasks.filter((task) => task.status === "planner-split");

  const waveTasks = tasks.filter(
  (task) =>
    (typeof task.wave === "number" || task.parentTaskId) &&
    task.status !== "done" &&
    task.status !== "completed" &&
    task.result?.merged !== true
);

  const todoTasks = tasks.filter(
    (task) => task.status === "todo" || task.status === "queued"
  );

  const failedTasks = tasks.filter((task) => task.status === "failed");

  const completedTasks = tasks
  .filter(
    (task) =>
      task.status === "done" ||
      task.status === "completed" ||
      task.result?.merged === true
  )
  .slice(0, 2);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="mt-2 text-sm text-white/60">
          Planner queue and orchestration board for Master Agent OS.
        </p>
      </div>

      <RuntimeDashboard tasks={tasks} activity={activity} />

      <RuntimeControlPanel />

      <ApprovalExecutionCenter tasks={tasks} activity={activity} />

      <AgentsWorkspace initialActivity={activity} />

      <ActivityFeed initialActivity={activity} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RecoveryControlCard />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={tasks.length} />
        <StatCard label="Todo" value={todoTasks.length} />
        <StatCard label="Waves" value={waveTasks.length} />
        <StatCard label="Failed" value={failedTasks.length} />
      </div>

      <TaskSection
        title="Planner Required"
        description="High-risk or multi-step tasks that need planner waves before execution."
        tasks={plannerRequired}
        empty="No tasks currently require planner waves."
      />

      <TaskSection
        title="Planner Split"
        description="Parent tasks that were split into smaller execution waves."
        tasks={plannerSplit}
        empty="No parent tasks have been split yet."
      />

      <TaskSection
        title="Wave Tasks"
        description="Ordered wave tasks created by the planner."
        tasks={waveTasks}
        empty="No wave tasks yet."
      />

      <TaskSection
        title="Todo"
        description="Tasks waiting for the runner."
        tasks={todoTasks}
        empty="No todo tasks."
      />

      <TaskSection
        title="Failed"
        description="Tasks that failed and may need recovery."
        tasks={failedTasks}
        empty="No failed tasks."
      />

      <TaskSection
        title="Completed"
        description="Tasks that are done, completed, or merged."
        tasks={completedTasks}
        empty="No completed tasks."
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function TaskSection({
  title,
  description,
  tasks,
  empty,
}: {
  title: string;
  description: string;
  tasks: AgentTask[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/50">{description}</p>
      </div>

      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4 text-sm text-white/50">
            {empty}
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </section>
  );
}

function TaskCard({ task }: { task: AgentTask }) {
  const needsApproval = task.previewOnly || task.requiresApproval;

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">
            {task.title ?? "Untitled task"}
          </div>

          {task.summary && (
            <p className="mt-2 text-sm text-white/60">{task.summary}</p>
          )}
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
        <Meta
          label="Retries"
          value={
            typeof task.retryCount === "number"
              ? String(task.retryCount)
              : undefined
          }
        />
      </div>

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

      {task.result?.pullRequestUrl && (
        <a
          href={task.result.pullRequestUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm text-blue-300 underline underline-offset-4 hover:text-blue-200"
        >
          Open pull request
        </a>
      )}

      {needsApproval && (
        <ApprovePreviewTaskButton taskId={task.id} />
      )}

      {typeof task.wave === "number" &&
        task.parentTaskId &&
        (task.previewOnly || task.requiresApproval) && (
          <ApprovePlannerWaveButton taskId={task.id} />
        )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60">
      {children}
    </span>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <span className="text-white/30">{label}: </span>
      <span>{value}</span>
    </div>
  );
}
