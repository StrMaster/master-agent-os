import { NextResponse } from "next/server";
import { generateRecoveryPlan } from "@/app/lib/ai-task-planner";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";

async function readGithubJson(path: string, fallback: unknown) {
  try {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error("Missing GITHUB_TOKEN");
    }

    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return fallback;
    }

    const file = await res.json();
    const content = Buffer.from(file.content, "base64").toString("utf-8");

    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const [tasks, activity, memory] = await Promise.all([
      readGithubJson(".agent/tasks.json", []),
      readGithubJson(".agent/activity.json", []),
      readGithubJson(".agent/memory.json", {}),
    ]);

    const failedTask =
      Array.isArray(tasks)
        ? [...tasks].reverse().find((task: any) => task.status === "failed")
        : null;

    if (!failedTask) {
      return NextResponse.json({
        ok: false,
        mode: "no-failed-task",
        message: "No failed task found",
      });
    }

    const recoveryTask = await generateRecoveryPlan({
      failedTask,
      recentActivity: Array.isArray(activity) ? activity.slice(0, 30) : [],
      memory,
    });

const tasksArray = Array.isArray(tasks) ? tasks : [];

const queuedRecoveryTask = {
  id: `recovery-task-${Date.now()}`,
  title: recoveryTask.title,
  summary: recoveryTask.summary,
  targetFile: recoveryTask.targetFile,
  status: "todo",
  priority: recoveryTask.priority,
  source: "recovery",
  createdAt: new Date().toISOString(),
  dependsOn: failedTask?.id ? [failedTask.id] : [],
};

const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("Missing GITHUB_TOKEN");
}

const tasksRes = await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/tasks.json?ref=${BRANCH}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  }
);

const tasksFile = await tasksRes.json();

const updatedTasks = [
  ...tasksArray,
  queuedRecoveryTask,
];

await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/tasks.json`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Queue recovery task for ${failedTask.id}`,
      content: Buffer.from(
        JSON.stringify(updatedTasks, null, 2) + "\n"
      ).toString("base64"),
      sha: tasksFile.sha,
      branch: BRANCH,
    }),
  }
);

const activityRes = await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/activity.json?ref=${BRANCH}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  }
);

const activityFile = await activityRes.json();

const activityContent = Buffer.from(
  activityFile.content,
  "base64"
).toString("utf-8");

const activity = JSON.parse(activityContent);

const updatedActivity = [
  {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: "recovery-task-created",
    taskId: queuedRecoveryTask.id,
    summary: queuedRecoveryTask.title,
    targetFile: queuedRecoveryTask.targetFile,
    priority: queuedRecoveryTask.priority,
    reason: recoveryTask.reasoning,
  },
  ...(Array.isArray(activity) ? activity : []),
].slice(0, 100);

await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/activity.json`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Log recovery task ${queuedRecoveryTask.id}`,
      content: Buffer.from(
        JSON.stringify(updatedActivity, null, 2) + "\n"
      ).toString("base64"),
      sha: activityFile.sha,
      branch: BRANCH,
    }),
  }
);

    return NextResponse.json({
  ok: true,
  mode: "recovery-plan",
  failedTask,
  recoveryTask: queuedRecoveryTask,
});
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}