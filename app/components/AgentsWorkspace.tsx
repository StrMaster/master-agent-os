"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  SMART_AGENTS,
  type SmartAgent,
} from "../../agents/core/agent-registry";

type ActivityEvent = {
  id: string;
  timestamp: string;
  type: string;
  agentName?: string;
  agentRole?: string;
  summary?: string;
  reason?: string;
};

type AgentGroupKey = "core" | "specialist" | "business";

const GROUPS: Array<{ key: AgentGroupKey; label: string }> = [
  { key: "core", label: "Core Agents" },
  { key: "specialist", label: "Specialist Agents" },
  { key: "business", label: "Business Agents" },
];

export default function AgentsWorkspace({
  initialActivity = [],
}: {
  initialActivity?: ActivityEvent[];
}) {
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity);
  const [loading, setLoading] = useState(initialActivity.length === 0);
  const [selectedGroup, setSelectedGroup] = useState<AgentGroupKey | "all">("all");

  useEffect(() => {
    setActivity(initialActivity);
    if (initialActivity.length > 0) {
      setLoading(false);
    }
  }, [initialActivity]);

  async function loadActivity() {
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      const data = await res.json();

      if (data.ok) {
        setActivity(Array.isArray(data.activity) ? data.activity : []);
      }
    } catch {
      // Keep the workspace usable if the activity feed is unavailable.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();

    const interval = window.setInterval(loadActivity, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const groupedAgents = useMemo(() => {
    return SMART_AGENTS.reduce<Record<AgentGroupKey, SmartAgent[]>>(
      (acc, agent) => {
        const group = classifyAgentGroup(agent);
        acc[group].push(agent);
        return acc;
      },
      { core: [], specialist: [], business: [] }
    );
  }, []);

  const visibleGroups = selectedGroup === "all"
    ? GROUPS
    : GROUPS.filter((group) => group.key === selectedGroup);

  const latestActivityIndex = useMemo(() => {
    const index = new Map<string, ActivityEvent>();

    for (const entry of activity) {
      const agentRoleKey = entry.agentRole?.toLowerCase().trim();
      const agentNameKey = entry.agentName?.toLowerCase().trim();

      if (agentRoleKey && !index.has(agentRoleKey)) {
        index.set(agentRoleKey, entry);
      }

      if (agentNameKey && !index.has(agentNameKey)) {
        index.set(agentNameKey, entry);
      }
    }

    return index;
  }, [activity]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">
              Agents Workspace
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Available Master OS agents
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Structured view of core, specialist, and business agents with derived availability and latest activity.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <WorkspaceChip
              active={selectedGroup === "all"}
              onClick={() => setSelectedGroup("all")}
            >
              All ({SMART_AGENTS.length})
            </WorkspaceChip>
            {GROUPS.map((group) => (
              <WorkspaceChip
                key={group.key}
                active={selectedGroup === group.key}
                onClick={() => setSelectedGroup(group.key)}
              >
                {group.label}
              </WorkspaceChip>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricPill label="Core" value={groupedAgents.core.length} />
          <MetricPill label="Specialists" value={groupedAgents.specialist.length} />
          <MetricPill label="Business" value={groupedAgents.business.length} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-950/50 p-4 text-sm text-white/55">
          Future lanes for live agent activity, decisions, task influence, warnings, and configuration can attach here.
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
          Loading agent workspace...
        </div>
      )}

      <div className="space-y-6">
        {visibleGroups.map((group) => {
          const agents = groupedAgents[group.key];

          return (
            <section
              key={group.key}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">{group.label}</h3>
                  <p className="mt-1 text-sm text-white/50">
                    {groupDescription(group.key)}
                  </p>
                </div>
                <MetricPill label="Agents" value={agents.length} />
              </div>

              {agents.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-neutral-950/50 p-4 text-sm text-white/50">
                  No agents configured in this group.
                </div>
              ) : (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {agents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      latestActivity={findLatestActivity(agent, latestActivityIndex)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function AgentCard({
  agent,
  latestActivity,
}: {
  agent: SmartAgent;
  latestActivity?: ActivityEvent;
}) {
  const status = deriveStatus(latestActivity);

  return (
    <article className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{agent.name}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
            {agent.id}
          </div>
        </div>
        <StatusBadge status={status}>{status}</StatusBadge>
      </div>

      <p className="mt-3 text-sm leading-6 text-white/65">{agent.purpose}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <AgentTag label={capabilityLabel(agent)} />
        {agent.canCreateTasks && <AgentTag label="Creates tasks" />}
        {agent.canReviewCode && <AgentTag label="Reviews changes" />}
        {agent.canEditCode && <AgentTag label="Can edit code" />}
        {agent.canHandleDeploy && <AgentTag label="Deploy-sensitive" tone="warning" />}
        {agent.canHandleRecovery && <AgentTag label="Recovery-capable" tone="warning" />}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <AgentField label="Category" value={groupLabel(agent.id)} />
        <AgentField label="Role" value={agent.id} />
        <AgentField
          label="Last activity"
          value={
            latestActivity
              ? new Date(latestActivity.timestamp).toLocaleString()
              : "No recent activity"
          }
        />
        <AgentField
          label="Activity"
          value={latestActivity ? humanizeActivity(latestActivity) : "available"}
        />
      </div>

      {latestActivity && (
        <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-50">
          <div className="font-medium">Latest signal</div>
          <div className="mt-1 text-cyan-50/80">
            {latestActivity.summary ?? latestActivity.reason ?? latestActivity.type}
          </div>
        </div>
      )}

      {agent.rules.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs uppercase tracking-[0.18em] text-white/35">
            Recommendation
          </div>
          <div className="mt-1 text-sm text-white/70">{agent.rules[0]}</div>
        </div>
      )}
    </article>
  );
}

function WorkspaceChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition",
        active
          ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
          : "border-white/10 bg-neutral-950/60 text-white/70 hover:border-white/20 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/50 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function StatusBadge({
  children,
  status,
}: {
  children: ReactNode;
  status: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        status === "active"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          : status === "idle"
            ? "border-white/10 bg-white/5 text-white/70"
            : status === "not configured"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function AgentTag({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
          : "border-white/10 bg-white/5 text-white/70",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function AgentField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-xs uppercase tracking-[0.18em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-sm text-white/80">{value}</div>
    </div>
  );
}

function classifyAgentGroup(agent: SmartAgent): AgentGroupKey {
  if (agent.id.endsWith("-specialist")) {
    return "specialist";
  }

  if (agent.id.startsWith("business-")) {
    return "business";
  }

  return "core";
}

function groupLabel(role: string) {
  if (role.endsWith("-specialist")) {
    return "Specialist";
  }

  if (role.startsWith("business-")) {
    return "Business";
  }

  return "Core";
}

function groupDescription(group: AgentGroupKey) {
  switch (group) {
    case "core":
      return "Primary orchestration and control agents used across planning, execution, review, deploy, and recovery.";
    case "specialist":
      return "Focused support agents for frontend, backend, design, testing, security, and performance review.";
    case "business":
      return "Product or business-oriented agents. None are configured yet.";
  }
}

function deriveStatus(latestActivity?: ActivityEvent) {
  if (!latestActivity) {
    return "available";
  }

  const ageMinutes = (Date.now() - new Date(latestActivity.timestamp).getTime()) / 60000;

  if (ageMinutes <= 5) {
    return "active";
  }

  return "idle";
}

function humanizeActivity(event: ActivityEvent) {
  if (event.summary) {
    return event.summary;
  }

  if (event.reason) {
    return event.reason;
  }

  return event.type.replace(/-/g, " ");
}

function capabilityLabel(agent: SmartAgent) {
  if (agent.canHandleRecovery) {
    return "Recovery-focused";
  }

  if (agent.canHandleDeploy) {
    return "Deploy-sensitive";
  }

  if (agent.canReviewCode) {
    return "Review-ready";
  }

  if (agent.canCreateTasks) {
    return "Task planning";
  }

  return "Available";
}

function findLatestActivity(
  agent: SmartAgent,
  latestActivityIndex: Map<string, ActivityEvent>
) {
  return (
    latestActivityIndex.get(agent.id.toLowerCase()) ||
    latestActivityIndex.get(agent.name.toLowerCase())
  );
}
