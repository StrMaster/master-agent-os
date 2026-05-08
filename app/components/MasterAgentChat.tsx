"use client";

import { useState } from "react";

type ChatMessage = {
  role: "user" | "agent" | "system";
  content: string;
  status?: "info" | "success" | "warning" | "error";
};

type ActivityEvent = {
  id: string;
  type: string;
  taskId?: string;
  summary?: string;
  targetFile?: string;
  priority?: string;
  status?: string;
  merged?: boolean;
  branch?: string;
};

export default function MasterAgentChat() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function addMessage(
  role: ChatMessage["role"],
  content: string,
  status: ChatMessage["status"] = "info"
) {
  setMessages((prev) => [
    ...prev,
    {
      role,
      content,
      status,
    },
  ]);
}

  async function pollExecution(taskIds: string[]) {
    const seenEvents = new Set<string>();

    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const res = await fetch("/api/activity", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!data.ok || !Array.isArray(data.activity)) {
        continue;
      }

      const relatedEvents = data.activity
        .filter((event: ActivityEvent) =>
          taskIds.includes(String(event.taskId))
        )
        .reverse();

      for (const event of relatedEvents) {
        if (!event.id || seenEvents.has(event.id)) {
          continue;
        }

        seenEvents.add(event.id);

        if (event.type === "manual-task-created") {
          addMessage(
  "system",
  `⚡ Queued: ${event.summary ?? event.taskId}`,
  "info"
);
        }

        if (event.type === "proposal") {
          addMessage(
  "system",
  `🧠 Proposal generated for ${event.taskId}`,
  "info"
);
        }

        if (event.type === "retry") {
          addMessage(
  "system",
  `🔁 Retry started for ${event.taskId}`,
  "warning"
);
        }

        if (event.type === "apply") {
          addMessage(
  "system",
  event.merged
    ? `✅ Changes merged for ${event.taskId}`
    : `⚠️ Apply completed without merge for ${event.taskId}`,
  event.merged ? "success" : "warning"
);
        }

        if (event.type === "deploy-pending") {
          addMessage(
  "system",
  `🚀 Deploy pending for ${event.taskId}`,
  "success"
);

try {
  const deployRes = await fetch(
    "/api/deploy-status",
    {
      cache: "no-store",
    }
  );

  const deployData =
    await deployRes.json();

  if (
    deployData.ok &&
    deployData.deployment
  ) {
    const deployment =
      deployData.deployment;

    if (
      deployment.state === "READY"
    ) {
      addMessage(
        "system",
        `🌍 Production deploy successful: https://${deployment.url}`,
        "success"
      );
    }

    if (
      deployment.state === "ERROR"
    ) {
      addMessage(
        "system",
        `❌ Deploy failed: https://${deployment.url}`,
        "error"
      );
    }

    if (
      deployment.state ===
      "BUILDING"
    ) {
      addMessage(
        "system",
        "🏗️ Deployment is building...",
        "info"
      );
    }
  }
} catch (error) {
  console.error(
    "Deploy monitoring failed",
    error
  );
}
        }

        if (event.type === "blocked") {
          addMessage(
  "system",
  `⛔ Blocked by safety rules: ${event.taskId}`,
  "error"
);
        }

        if (event.type === "failed") {
          addMessage(
  "system",
  `❌ Execution failed for ${event.taskId}`,
  "error"
);
        }

        if (event.type === "cooldown") {
          addMessage(
            "system",
            "Cooldown active. Agent is slowing down to avoid repeated failures."
          );
        }

        if (event.type === "auto-paused") {
          addMessage(
            "system",
            "Agent auto-paused after repeated failures."
          );
        }
      }
    }
  }

  async function handleSend() {
    if (!message.trim()) {
      return;
    }

    const currentMessage = message;

    const normalizedMessage = currentMessage.toLowerCase();

if (
  normalizedMessage.includes("project status") ||
  normalizedMessage.includes("current status") ||
  normalizedMessage.includes("kas dabar") ||
  normalizedMessage.includes("kas vyksta") ||
  normalizedMessage.includes("status")
) {
  addMessage("user", currentMessage);
  setMessage("");
  setLoading(true);

  try {
    const res = await fetch("/api/project-status", {
      cache: "no-store",
    });

    const data = await res.json();

    addMessage(
      "agent",
      data.summary || "I could not generate a project status summary."
    );
  } catch {
    addMessage("agent", "Failed to read project status.");
  } finally {
    setLoading(false);
  }

  return;
}

if (
  normalizedMessage.includes(
    "what should we improve"
  ) ||
  normalizedMessage.includes(
    "what to improve"
  ) ||
  normalizedMessage.includes(
    "next improvements"
  ) ||
  normalizedMessage.includes(
    "self improvement"
  ) ||
  normalizedMessage.includes(
    "ką pagerinti"
  ) ||
  normalizedMessage.includes(
    "ka pagerinti"
  ) ||
  normalizedMessage.includes(
    "ką toliau"
  ) ||
  normalizedMessage.includes(
    "ka toliau"
  )
) {
  addMessage("user", currentMessage);

  setMessage("");
  setLoading(true);

  try {
    const res = await fetch(
      "/api/generate-improvement-tasks",
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    addMessage(
      "agent",
      data.suggestions ||
        "No suggestions available."
    );

    if (
      Array.isArray(
        data.generatedTasks
      ) &&
      data.generatedTasks.length > 0
    ) {
      const formattedTasks =
        data.generatedTasks
          .map(
            (
              task: {
                title: string;
                priority: string;
                targetFile: string;
              },
              index: number
            ) =>
              `${index + 1}. ${
                task.title
              }\nPriority: ${
                task.priority
              }\nTarget: ${
                task.targetFile
              }`
          )
          .join("\n\n");

      addMessage(
        "system",
        `🛠️ Suggested execution tasks:\n\n${formattedTasks}`,
        "success"
      );
for (const task of data.generatedTasks) {
  try {
    await fetch(
      "/api/create-task",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          title: task.title,
          summary: task.summary,
          targetFile:
            task.targetFile,
          priority:
            task.priority,
          autoGenerated: true,
        }),
      }
    );

    addMessage(
      "system",
      `⚡ Queued improvement task: ${task.title}`,
      "success"
    );
  } catch {
    addMessage(
      "system",
      `❌ Failed to queue task: ${task.title}`,
      "error"
    );
  }
}
    }
  } catch {
    addMessage(
      "agent",
      "Failed to generate self-improvement suggestions."
    );
  } finally {
    setLoading(false);
  }

  return;
}

    addMessage("user", currentMessage);

    setMessage("");
    setLoading(true);

    try {
      addMessage("system", "Creating task and starting agent...");

      const res = await fetch("/api/create-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: currentMessage,
        }),
      });

      const data = await res.json();

      const responseText = [data.message, data.followUp]
        .filter(Boolean)
        .join(" ");

      addMessage(
        "agent",
        responseText || "Task created and queued for execution."
      );

      const taskIds =
        data.tasks?.map((task: { id: string }) => task.id) ??
        (data.task?.id ? [data.task.id] : []);

      if (taskIds.length > 0) {
        addMessage(
          "system",
          `Monitoring execution for ${taskIds.length} task(s)...`
        );

        pollExecution(taskIds);
      }
    } catch (error) {
      addMessage("agent", "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 16,
        padding: 20,
        background: "#0f0f0f",
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        Master Agent
      </div>

      <div
        style={{
          fontSize: 14,
          color: "#888",
          marginBottom: 20,
        }}
      >
        Conversational AI engineering system
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              alignSelf:
                msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              padding: "14px 16px",
              borderRadius: 16,
              background:
  msg.role === "user"
    ? "#2563eb"
    : msg.role === "system"
      ? msg.status === "success"
        ? "#052e16"
        : msg.status === "warning"
          ? "#3f2a04"
          : msg.status === "error"
            ? "#450a0a"
            : "#111"
      : "#111827",

border:
  msg.role === "system"
    ? msg.status === "success"
      ? "1px solid #166534"
      : msg.status === "warning"
        ? "1px solid #a16207"
        : msg.status === "error"
          ? "1px solid #b91c1c"
          : "1px solid #333"
    : msg.role === "agent"
      ? "1px solid #1e3a8a"
      : "none",

color:
  msg.role === "system"
    ? msg.status === "success"
      ? "#bbf7d0"
      : msg.status === "warning"
        ? "#fde68a"
        : msg.status === "error"
          ? "#fecaca"
          : "#aaa"
    : "white",
            }}
          >
            <div
              style={{
                fontSize: 12,
                opacity: 0.7,
                marginBottom: 6,
              }}
            >
              {msg.role === "user"
                ? "You"
                : msg.role === "system"
                  ? "Execution"
                  : "Master Agent"}
            </div>

            {msg.content}
          </div>
        ))}

        {loading && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "12px 14px",
              borderRadius: 16,
              background: "#111827",
              border: "1px solid #1e3a8a",
              color: "#93c5fd",
            }}
          >
            Master Agent is thinking...
          </div>
        )}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Improve dashboard mobile UX..."
        rows={4}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #333",
          background: "#111",
          color: "white",
          resize: "vertical",
          marginBottom: 14,
        }}
      />

      <button
        onClick={handleSend}
        disabled={loading}
        style={{
          padding: "12px 18px",
          borderRadius: 12,
          border: "none",
          background: "#2563eb",
          color: "white",
          fontWeight: 700,
          cursor: "pointer",
          width: "100%",
        }}
      >
        {loading ? "Thinking..." : "Send to Master Agent"}
      </button>
    </div>
  );
}