"use client";

import { useState } from "react";

type ChatMessage = {
  role: "user" | "agent";
  content: string;
};

export default function MasterAgentChat() {
  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  async function handleSend() {
    if (!message.trim()) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setLoading(true);

    const currentMessage = message;

    setMessage("");

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
            prompt: currentMessage,
          }),
        }
      );

      const data = await res.json();

      const agentMessage: ChatMessage = {
        role: "agent",
        content: [
          data.message,
          data.followUp,
        ]
          .filter(Boolean)
          .join(" "),
      };

      setMessages((prev) => [
        ...prev,
        agentMessage,
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content:
            "Unexpected error occurred.",
        },
      ]);
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
        Conversational AI engineering
        system
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
                msg.role === "user"
                  ? "flex-end"
                  : "flex-start",

              maxWidth: "85%",

              padding: "14px 16px",

              borderRadius: 16,

              background:
                msg.role === "user"
                  ? "#2563eb"
                  : "#111827",

              border:
                msg.role === "agent"
                  ? "1px solid #1e3a8a"
                  : "none",

              color: "white",

              lineHeight: 1.7,

              whiteSpace: "pre-wrap",
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
              border:
                "1px solid #1e3a8a",
              color: "#93c5fd",
            }}
          >
            Master Agent is thinking...
          </div>
        )}
      </div>

      <textarea
        value={message}
        onChange={(e) =>
          setMessage(e.target.value)
        }
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
        {loading
          ? "Thinking..."
          : "Send to Master Agent"}
      </button>
    </div>
  );
}