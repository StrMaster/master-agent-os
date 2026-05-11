import ActivityFeed from "../components/ActivityFeed";
import AgentsWorkspace from "../components/AgentsWorkspace";
import RuntimeControlPanel from "../components/RuntimeControlPanel";
import PendingPRQueue from "../components/PendingPRQueue";
import DeleteTaskButton from "../components/DeleteTaskButton";
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
  targetFile?: string;
  branchName?: string;
  parentTaskId?: string;
  wave?: number;
  waveStatus?: "ready" | "blocked" | "completed";
  previewOnly?: boolean;
  requiresApproval?: boolean;
  approvedAt?: string;
  plannerNotes?: string;
  result?: {
    branchName?: string;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
    merged?: boolean;
  };
  error?: string;
  agentName?: string;
agentRole?: string;
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

export default async function ExecutionPage() {
  const [tasks, activityFile] = await Promise.all([readTasks(), readActivityFile()]);
  const activity = Array.isArray(activityFile.activity)
    ? activityFile.activity
    : [];

  const runningTasks = tasks.filter((task) => task.status === "running");

  const todoTasks = tasks.filter(
    (task) =>
      task.status === "todo" ||
      task.status === "queued" ||
      task.status === "planner-required" ||
      task.status === "planner-split"
  );

  const pendingPrTasks = tasks.filter(
  (task) =>
    task.status === "pending-pr" &&
    task.result?.merged !== true &&
    !task.error
);

  const failedTasks = tasks.filter((task) => task.status === "failed");

  const completedTasks = tasks.filter(
    (task) =>
      task.status === "done" ||
      task.status === "completed" ||
      task.result?.merged === true
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Execution</h1>
        <p className="mt-2 text-sm text-white/60">
          Manage and monitor task execution.
        </p>
      </div>

      <RuntimeDashboard tasks={tasks} activity={activity} />

      <RuntimeControlPanel />

      <AgentsWorkspace initialActivity={activity} />

      <ActivityFeed initialActivity={activity} />

      <PendingPRQueue />

      <TaskSection title="Running" tasks={runningTasks} empty="No tasks are currently running." />

      <TaskSection title="Todo" tasks={todoTasks} empty="No pending tasks at the moment." />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  empty,
}: {
  title: string;
  tasks: AgentTask[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-semibold">{title}</h2>

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
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-4">
      <div className="text-sm font-semibold text-white">
        {task.title ?? "Untitled task"}
      </div>

      {task.summary && (
        <div className="mt-2 text-sm text-white/60">{task.summary}</div>
      )}

      <div className="mt-3 space-y-1 text-xs text-white/45">
        <div>Status: {task.status ?? "unknown"}</div>

        {task.agentName && (
  <div className="text-cyan-300">
    Agent: {task.agentName}
  </div>
)}

        {task.priority && <div>Priority: {task.priority}</div>}

        {task.targetFile && <div>Target: {task.targetFile}</div>}

        {task.result?.branchName && <div>Branch: {task.result.branchName}</div>}

        {task.result?.pullRequestNumber && (
          <div>PR: #{task.result.pullRequestNumber}</div>
        )}

        {typeof task.wave === "number" && <div>Wave: {task.wave}</div>}

        {task.waveStatus && <div>Wave status: {task.waveStatus}</div>}

        {task.previewOnly && <div className="text-amber-300">Preview only</div>}

        {task.requiresApproval && <div className="text-amber-300">Approval required</div>}

        {task.approvedAt && <div className="text-emerald-300">Approved: {task.approvedAt}</div>}

        {task.parentTaskId && <div>Parent task: {task.parentTaskId}</div>}

        {task.error && <div className="text-red-300">Error: {task.error}</div>}
      </div>

      {task.plannerNotes && (
        <div className="mt-3 rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 text-xs text-purple-100/80">
          {task.plannerNotes}
        </div>
      )}

      {task.result?.pullRequestUrl && (
        <a
          href={task.result.pullRequestUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-blue-300 underline underline-offset-4 hover:text-blue-200"
        >
          Open pull request
        </a>
      )}
        <DeleteTaskButton taskId={task.id} status={task.status} />
    </div>
  );
}
