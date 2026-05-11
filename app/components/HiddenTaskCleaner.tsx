"use client";

import { useEffect } from "react";

const HIDDEN_TASKS_KEY = "master-agent-hidden-task-ids";

function readHiddenTaskIds() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(HIDDEN_TASKS_KEY) ?? "[]"
    );

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function HiddenTaskCleaner() {
  useEffect(() => {
    const hiddenTaskIds = readHiddenTaskIds();

    for (const taskId of hiddenTaskIds) {
      document
        .querySelectorAll(`[data-task-id="${taskId}"]`)
        .forEach((element) => element.remove());
    }
  }, []);

  return null;
}
