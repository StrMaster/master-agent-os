import type { AgentTask } from "./types";
import { getRuntimeQueueTasks } from "../lib/runtime-queue";
import { getPullRequestNumber } from "./task-utils";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

async function readGithubTasks(): Promise<AgentTask[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

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

  if (!res.ok) return [];

  const file = await res.json();
  const content = Buffer.from(file.content, "base64").toString("utf-8");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

export async function readTasks(): Promise<AgentTask[]> {
  const githubTasks = await readGithubTasks();
  let redisTasks: AgentTask[] = [];

  try {
    redisTasks = (await getRuntimeQueueTasks()) as unknown as AgentTask[];
  } catch (error) {
    console.warn("[tasks-page] failed to load Redis runtime tasks", error);
  }

  const redisIds = new Set(redisTasks.map((task) => task.id));
  return [
    ...redisTasks,
    ...githubTasks.filter((task) => !redisIds.has(task.id ?? "")),
  ];
}

export async function syncMergedPrTasks(tasks: AgentTask[]): Promise<AgentTask[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return tasks;

  return Promise.all(
    tasks.map(async (task) => {
      const prNumber = getPullRequestNumber(task);
      if (!prNumber || task.result?.merged === true) return task;

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

      if (!res.ok) return task;

      const pr = await res.json();
      if (pr.merged === true) {
        return {
          ...task,
          status: "done",
          result: { ...task.result, pullRequestNumber: prNumber, merged: true },
        };
      }

      return { ...task, result: { ...task.result, pullRequestNumber: prNumber } };
    })
  );
}
