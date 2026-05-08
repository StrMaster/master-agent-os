"use client";

import { useState } from "react";

export default function MasterAgentChat() {
  const [message, setMessage] = useState("");
  const [response, setResponse] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  async function handleSend() {
    if (!message.trim()) {
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch(
        "/api/create-task",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            prompt: message,
          }),
        }
      );

      const data = await res.json();

      setResponse(
        [
          data.message,
          data.followUp,
        ]
          .filter(Boolean)
          .join(" ")
      );

      setMessage("");
    } catch (error) {
      setResponse(
        "Unexpected error occurred."
      );
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
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        Master Agent
      </div>

      <div
        style={{
          fontSize: 14,
          color: "#888",
          marginBottom: 16,
        }}
      >
        Describe what you want the
        agent to improve.
      </div>

      <textarea
        value={message}
        onChange={(e) =>
          setMessage(e.target.value)
        }
        placeholder="Improve dashboard mobile UX..."
        rows={5}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "1px solid #333",
          background: "#111",
          color: "white",
          resize: "vertical",
          marginBottom: 16,
        }}
      />

      <button
        onClick={handleSend}
        disabled={loading}
        style={{
          padding: "12px 18px",
          borderRadius: 10,
          border: "none",
          background: "#2563eb",
          color: "white",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {loading
          ? "Thinking..."
          : "Send to Master Agent"}
      </button>

      {response && (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 10,
            background: "#111827",
            border: "1px solid #1e3a8a",
            color: "#dbeafe",
            lineHeight: 1.6,
          }}
        >
          {response}
        </div>
      )}
    </div>
  );
}