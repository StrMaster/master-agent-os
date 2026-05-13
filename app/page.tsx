import { activeGoal, agents } from "./lib/data";
import StatCard from "./components/StatCard";
import SectionHeader from "./components/SectionHeader";
import StatusBadge from "./components/StatusBadge";
import ActionButton from "./components/ActionButton";
import RuntimeOverview from "./components/RuntimeOverview";
import DeployStatusCard from "./components/DeployStatusCard";
import AutoRunTrigger from "./components/AutoRunTrigger";

export const dynamic = "force-dynamic";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

type DashboardTask = {
  id: string;
  title?: string;
  description?: string;
  summary?: string;
  status?: string;
  error?: string;
  result?: {
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  merged?: boolean;
};
};

async function syncDashboardMergedPrTasks(tasks: DashboardTask[]) {
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

async function readDashboardTasks(): Promise<DashboardTask[]> {
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


export default async function HomePage() {
  const tasks = await syncDashboardMergedPrTasks(await readDashboardTasks());

  const openTasks = tasks.filter(
    (task) =>
      task.status !== "done" &&
      task.status !== "completed" &&
      task.result?.merged !== true
  );

  const pendingRuns = tasks.filter(
    (task) =>
      !task.error &&
      task.result?.merged !== true &&
      (task.status === "pending-pr" || task.status === "running")
  );

  const llmUsageCount: number = 3; // Hardcoded count of LLMs used or supported

  const stats = [
    { label: "Active Goal", value: "1", subtext: activeGoal.title },
    { label: "Active Agents", value: String(agents.length), subtext: "System registry loaded" },
    {
  label: "Open Tasks",
  value: String(openTasks.length),
  subtext: "Live workload",
},
{
  label: "Pending Runs",
  value: String(pendingRuns.length),
  subtext: "Execution queue",
},
  ];

  const focusItems = tasks
    .filter((task) => task.status === "doing" || task.status === "backlog")
    .slice(0, 3);

  const recentActivity = [
    "Master Agent created MVP roadmap",
    "UI structure task moved to Doing",
    "Execution prompt prepared for dashboard build",
    "Agent registry initialized",
    "First local app launched successfully",
  ];

  return (
    <section className="p-4 pb-20 md:p-8 lg:pb-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <SectionHeader
          eyebrow="Dashboard"
          title="Master Agent Overview"
          description="This is the operating view of your orchestration system. It shows the active goal, task pressure, execution state, and current focus."
        />

        <div className="flex gap-2 items-center">
          <ActionButton label="New Goal" />
          <ActionButton label="Ask Master" variant="primary" />
          <div className="relative group ml-2 cursor-default">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>
            <div className="absolute bottom-full mb-2 hidden w-max max-w-xs rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-300 group-hover:block">
              {llmUsageCount} LLM{llmUsageCount !== 1 ? "s" : ""} currently used/supported
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            subtext={stat.subtext}
          />
        ))}
      </div>
      
      <div className="mt-4 space-y-4 md:space-y-0 md:flex md:gap-6">
        <div className="my-2 w-full md:w-auto">
          <RuntimeOverview />
        </div>
        <div className="my-2 w-full md:w-auto">
          <DeployStatusCard />
        </div>
      </div>
      <div className="my-4">
        <AutoRunTrigger />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-medium uppercase tracking-wide text-blue-300">
              Control Center
            </div>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Autonomous Engineering Core
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Master Agent OS is currently running in protected PR-only execution
              mode with runtime stabilization and manual merge safety enabled.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              PR-only mode enabled
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
              Runner cooldown active
            </div>

            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
              Duplicate PR protection enabled
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-sm text-purple-200">
              Manual merge confirmation required
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                Today Focus
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Priority Actions
              </h3>
            </div>
            <StatusBadge label="High Focus" />
          </div>

          <div className="mt-5 space-y-6">
            {focusItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-start gap-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 sm:p-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-300">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Recent Activity
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            System Timeline
          </h3>

          <div className="mt-5 space-y-8">
            {recentActivity.map((item) => (
              <div key={item} className="flex gap-2">
                <div className="mt-2 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                <p className="text-sm leading-6 text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:gap-4">
        <ActionButton label="Send to Master Agent" variant="success" />
        <div className="sm:hidden h-4" />
        <ActionButton label="Run Agent" />
      </div>
    </section>
  );
}