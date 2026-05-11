"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

type ActivityEvent = {
  id: string;
  timestamp: string;
  type: string;
  runId?: string;
  taskId?: string;
  summary?: string;
  reason?: string;
  message?: string;
  targetFile?: string;
  priority?: string;
  reasoning?: string;
  wave?: number;
  agentName?: string;
  agentRole?: string;
  changedLines?: number;
  safe?: boolean;
  branch?: string;
  merged?: boolean;
  pullRequestUrl?: string;
  lockAgeMs?: number;
  retryAfterMs?: number;
  provider?: string;
  status?: string;
};

type RunnerHealthState = {
  runnerHealthStatus: "healthy" | "degraded" | "blocked";
  consecutiveFailures: number;
  failedRuns?: number;
  lastFailureAt?: string;
  runtimeBlockedUntil?: string;
  recoveryActive?: boolean;
  overnightModeActive?: boolean;
  deployStatus?: "pending" | "success" | "failed";
};

type ActivityCategory =
  | "planner"
  | "review"
  | "approval"
  | "execution"
  | "deploy"
  | "recovery"
  | "runtime"
  | "observability"
  | "other";

type ActivityTone =
  | "success"
  | "warning"
  | "blocked"
  | "recovery"
  | "deploy"
  | "approval-required"
  | "neutral";

const CATEGORY_FILTERS: Array<{ key: ActivityCategory | "all"; label: string }> =
  [
    { key: "all", label: "All" },
    { key: "planner", label: "Planner" },
    { key: "review", label: "Review" },
    { key: "approval", label: "Approval" },
    { key: "execution", label: "Execution" },
    { key: "deploy", label: "Deploy" },
    { key: "recovery", label: "Recovery" },
    { key: "runtime", label: "Runtime" },
    { key: "observability", label: "Observability" },
  ];

const TONE_STYLES: Record<
  ActivityTone,
  { border: string; background: string; text: string }
> = {
  success: {
    border: "border-emerald-500/25",
    background: "bg-emerald-500/10",
    text: "text-emerald-100",
  },
  warning: {
    border: "border-amber-500/25",
    background: "bg-amber-500/10",
    text: "text-amber-100",
  },
  blocked: {
    border: "border-red-500/25",
    background: "bg-red-500/10",
    text: "text-red-100",
  },
  recovery: {
    border: "border-orange-500/25",
    background: "bg-orange-500/10",
    text: "text-orange-100",
  },
  deploy: {
    border: "border-cyan-500/25",
    background: "bg-cyan-500/10",
    text: "text-cyan-100",
  },
  "approval-required": {
    border: "border-violet-500/25",
    background: "bg-violet-500/10",
    text: "text-violet-100",
  },
  neutral: {
    border: "border-white/10",
    background: "bg-white/5",
    text: "text-white",
  },
};

const CATEGORY_STYLES: Record<
  ActivityCategory,
  { label: string; dot: string; chip: string }
> = {
  planner: {
    label: "Planner",
    dot: "bg-blue-400",
    chip: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  },
  review: {
    label: "Review",
    dot: "bg-indigo-400",
    chip: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
  },
  approval: {
    label: "Approval",
    dot: "bg-violet-400",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  },
  execution: {
    label: "Execution",
    dot: "bg-emerald-400",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  },
  deploy: {
    label: "Deploy",
    dot: "bg-cyan-400",
    chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  },
  recovery: {
    label: "Recovery",
    dot: "bg-orange-400",
    chip: "border-orange-500/30 bg-orange-500/10 text-orange-100",
  },
  runtime: {
    label: "Runtime",
    dot: "bg-amber-400",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  },
  observability: {
    label: "Observability",
    dot: "bg-sky-400",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  },
  other: {
    label: "Other",
    dot: "bg-slate-400",
    chip: "border-white/10 bg-white/5 text-white/70",
  },
};

type NormalizedEvent = ActivityEvent & {
  category: ActivityCategory;
  tone: ActivityTone;
  label: string;
};

type ActivityFeedProps = {
  initialActivity?: ActivityEvent[];
};

export default function ActivityFeed({
  initialActivity = [],
}: ActivityFeedProps) {
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity);
  const [runnerHealth, setRunnerHealth] = useState<RunnerHealthState | null>(
    null
  );
  const [loading, setLoading] = useState(initialActivity.length === 0);
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");

  useEffect(() => {
    setActivity(initialActivity);
    if (initialActivity.length > 0) {
      setLoading(false);
    }
  }, [initialActivity]);

  async function loadActivity() {
    try {
      const [activityRes, controlStateRes] = await Promise.all([
        fetch("/api/activity", { cache: "no-store" }),
        fetch("/api/control-state", { cache: "no-store" }),
      ]);
      const activityData = await activityRes.json();
      const controlStateData = await controlStateRes.json();

      if (activityData.ok) {
        setActivity(Array.isArray(activityData.activity) ? activityData.activity : []);
      }

      if (controlStateData.ok && controlStateData.state) {
        setRunnerHealth({
          runnerHealthStatus:
            controlStateData.state.runnerHealthStatus ?? "healthy",
          consecutiveFailures:
            controlStateData.state.consecutiveFailures ?? 0,
          failedRuns: controlStateData.state.failedRuns ?? 0,
          lastFailureAt: controlStateData.state.lastFailureAt,
          runtimeBlockedUntil: controlStateData.state.runtimeBlockedUntil,
          recoveryActive: controlStateData.state.recoveryActive ?? false,
          overnightModeActive:
            controlStateData.state.overnightModeActive ?? false,
          deployStatus: controlStateData.state.deployStatus,
        });
      }
    } catch {
      // Keep the timeline usable if one of the lightweight reads fails.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();

    const interval = window.setInterval(() => {
      loadActivity();
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const normalizedEvents = useMemo(
    () => activity.map(normalizeEvent),
    [activity]
  );

  const visibleEvents = useMemo(() => {
    if (filter === "all") {
      return normalizedEvents;
    }

    return normalizedEvents.filter((event) => event.category === filter);
  }, [filter, normalizedEvents]);

  const categoryCounts = useMemo(
    () =>
      normalizedEvents.reduce<Record<ActivityCategory, number>>(
        (acc, event) => {
          acc[event.category] += 1;
          return acc;
        },
        {
          planner: 0,
          review: 0,
          approval: 0,
          execution: 0,
          deploy: 0,
          recovery: 0,
          runtime: 0,
          observability: 0,
          other: 0,
        }
      ),
    [normalizedEvents]
  );

  const runtimePill = runnerHealth
    ? runnerHealth.runnerHealthStatus
    : "unknown";

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">
              Activity Timeline
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Live orchestration timeline
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Structured planner, review, approval, execution, deploy, recovery, and runtime events in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusChip tone="neutral">Live updates</StatusChip>
            <StatusChip tone={runtimeTone(runtimePill)}>
              {runnerHealth ? runtimePill : "loading"}
            </StatusChip>
            {runnerHealth?.recoveryActive && (
              <StatusChip tone="recovery">Recovery active</StatusChip>
            )}
            {runnerHealth?.overnightModeActive && (
              <StatusChip tone="warning">Overnight active</StatusChip>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatPill label="Events" value={normalizedEvents.length} />
          <StatPill label="Planner" value={categoryCounts.planner} />
          <StatPill label="Execution" value={categoryCounts.execution} />
          <StatPill label="Runtime" value={categoryCounts.runtime} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatPill label="Review" value={categoryCounts.review} />
          <StatPill label="Approval" value={categoryCounts.approval} />
          <StatPill label="Deploy" value={categoryCounts.deploy} />
          <StatPill label="Recovery" value={categoryCounts.recovery} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((item) => {
            const count =
              item.key === "all"
                ? normalizedEvents.length
                : categoryCounts[item.key];

            return (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                  filter === item.key
                    ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-neutral-950/60 text-white/70 hover:border-white/20 hover:text-white",
                ].join(" ")}
              >
                <span>{item.label}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/55">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {runnerHealth && (
          <div className="mt-4 grid gap-2 lg:grid-cols-4">
            <StateChip label="Consecutive failures" value={runnerHealth.consecutiveFailures} />
            <StateChip label="Failed runs" value={runnerHealth.failedRuns ?? 0} />
            <StateChip
              label="Runtime blocked"
              value={runnerHealth.runtimeBlockedUntil ? "Yes" : "No"}
            />
            <StateChip
              label="Deploy"
              value={runnerHealth.deployStatus ?? "idle"}
            />
          </div>
        )}
      </div>

      {runnerHealth?.runtimeBlockedUntil && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          Runtime blocked until{" "}
          {new Date(runnerHealth.runtimeBlockedUntil).toLocaleString()}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
          Loading activity timeline...
        </div>
      )}

      {!loading && visibleEvents.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
          No activity events yet.
        </div>
      )}

      <div className="space-y-3">
        {visibleEvents.slice(0, 24).map((event) => (
          <TimelineCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function TimelineCard({
  event,
}: {
  event: NormalizedEvent;
}) {
  const tone = TONE_STYLES[event.tone];
  const category = CATEGORY_STYLES[event.category];
  const timeLabel = new Date(event.timestamp).toLocaleString();

  return (
    <article className="relative pl-7">
      <span
        className={[
          "absolute left-0 top-4 h-3 w-3 rounded-full ring-4 ring-neutral-950",
          category.dot,
        ].join(" ")}
      />
      <div className="absolute left-[5px] top-6 h-full w-px bg-white/10" />

      <div className={["rounded-2xl border p-4", tone.border, tone.background].join(" ")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                category.chip,
              ].join(" ")}
            >
              {category.label}
            </span>
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                statusChipClasses(event.tone),
              ].join(" ")}
            >
              {event.tone.replace("-", " ")}
            </span>
            <span className="text-sm font-semibold text-white">{event.label}</span>
          </div>

          <div className="text-xs text-white/45">{timeLabel}</div>
        </div>

        {event.summary && (
          <p className="mt-3 text-sm leading-6 text-white/80">{event.summary}</p>
        )}

        {(event.message || event.reason || event.reasoning) && (
          <p className="mt-2 text-sm leading-6 text-white/60">
            {event.message ?? event.reason ?? event.reasoning}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {event.taskId && <MetaChip label={`Task ${shorten(event.taskId, 10)}`} />}
          {event.runId && <MetaChip label={`Run ${shorten(event.runId, 10)}`} />}
          {typeof event.wave === "number" && <MetaChip label={`Wave ${event.wave}`} />}
          {event.targetFile && <MetaChip label={shorten(event.targetFile, 42)} />}
          {event.priority && <MetaChip label={`Priority ${event.priority}`} />}
          {event.agentName && <MetaChip label={shorten(event.agentName, 24)} />}
          {event.agentRole && <MetaChip label={shorten(event.agentRole, 24)} />}
          {event.branch && <MetaChip label={`Branch ${shorten(event.branch, 20)}`} />}
          {typeof event.changedLines === "number" && (
            <MetaChip label={`${event.changedLines} lines`} />
          )}
          {typeof event.lockAgeMs === "number" && (
            <MetaChip label={`Lock ${Math.round(event.lockAgeMs / 1000)}s`} />
          )}
          {typeof event.retryAfterMs === "number" && (
            <MetaChip label={`Retry ${Math.ceil(event.retryAfterMs / 1000)}s`} />
          )}
          {typeof event.merged === "boolean" && (
            <MetaChip label={event.merged ? "Merged" : "Not merged"} />
          )}
          {event.status && <MetaChip label={event.status} />}
          {event.pullRequestUrl && (
            <a
              href={event.pullRequestUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
            >
              Open PR
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function normalizeEvent(event: ActivityEvent): NormalizedEvent {
  const category = classifyCategory(event.type);
  const tone = classifyTone(event.type, category);

  return {
    ...event,
    category,
    tone,
    label: humanizeEventType(event.type),
  };
}

function classifyCategory(type: string): ActivityCategory {
  const normalized = type.toLowerCase();

  if (
    normalized.startsWith("planner-") ||
    normalized === "manual-task-created" ||
    normalized === "recovery-task-created" ||
    normalized === "deploy-recovery-created"
  ) {
    return "planner";
  }

  if (
    normalized.startsWith("review-") ||
    normalized.endsWith("-review-completed") ||
    normalized === "architecture-review-completed" ||
    normalized === "code-review-completed" ||
    normalized === "frontend-review-completed" ||
    normalized === "backend-review-completed" ||
    normalized === "design-review-completed" ||
    normalized === "testing-review-completed" ||
    normalized === "security-review-completed" ||
    normalized === "performance-review-completed"
  ) {
    return "review";
  }

  if (
    normalized.startsWith("approval-") ||
    normalized.includes("approved") ||
    normalized === "pending-pr"
  ) {
    return "approval";
  }

  if (
    normalized.startsWith("deploy-") ||
    normalized.includes("pull-request")
  ) {
    return "deploy";
  }

  if (normalized.startsWith("recovery-")) {
    return "recovery";
  }

  if (
    normalized.startsWith("runtime-") ||
    normalized.startsWith("runner-") ||
    normalized === "blocked" ||
    normalized === "cooldown" ||
    normalized === "auto-paused"
  ) {
    return "runtime";
  }

  if (
    normalized.startsWith("observability-") ||
    normalized === "runtime-anomaly-detected" ||
    normalized === "control-summary-generated" ||
    normalized === "repo-context-updated"
  ) {
    return "observability";
  }

  if (
    normalized.startsWith("execution-") ||
    normalized === "proposal" ||
    normalized === "apply" ||
    normalized === "retry" ||
    normalized === "failed" ||
    normalized === "pending-pr"
  ) {
    return "execution";
  }

  return "other";
}

function classifyTone(type: string, category: ActivityCategory): ActivityTone {
  const normalized = type.toLowerCase();

  if (
    normalized.includes("blocked") ||
    normalized.includes("failed") ||
    normalized.includes("unsafe") ||
    normalized.includes("stopped") ||
    normalized.includes("merge-failed") ||
    normalized.includes("validation-failed")
  ) {
    return "blocked";
  }

  if (normalized.includes("recovery")) {
    return "recovery";
  }

  if (category === "deploy") {
    if (normalized.includes("success") || normalized.includes("merged")) {
      return "success";
    }

    if (normalized.includes("pending")) {
      return "warning";
    }

    return "deploy";
  }

  if (category === "approval") {
    if (normalized.includes("approved") || normalized.includes("validated")) {
      return "success";
    }

    return "approval-required";
  }

  if (normalized.includes("warning") || normalized.includes("degraded")) {
    return "warning";
  }

  if (normalized.includes("retry") || normalized.includes("cooldown")) {
    return "warning";
  }

  if (normalized.includes("completed") || normalized.includes("created")) {
    return "success";
  }

  if (category === "observability") {
    return "warning";
  }

  if (category === "runtime") {
    return "warning";
  }

  return "neutral";
}

function humanizeEventType(type: string) {
  return type
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shorten(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3)}...`;
}

function runtimeTone(value: string): ActivityTone {
  if (value === "blocked") {
    return "blocked";
  }

  if (value === "degraded") {
    return "warning";
  }

  return "neutral";
}

function statusChipClasses(tone: ActivityTone) {
  switch (tone) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    case "blocked":
      return "border-red-500/30 bg-red-500/10 text-red-100";
    case "recovery":
      return "border-orange-500/30 bg-orange-500/10 text-orange-100";
    case "deploy":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
    case "approval-required":
      return "border-violet-500/30 bg-violet-500/10 text-violet-100";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: ActivityTone;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium capitalize",
        statusChipClasses(tone),
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/55 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function StateChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/50 px-3 py-2">
      <div className="text-xs uppercase tracking-[0.18em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
      {label}
    </span>
  );
}
