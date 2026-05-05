"use client";

export default function RunAgentButton() {
  return (
    <button
      onClick={async () => {
        const res = await fetch("/api/agent-runner", {
          method: "POST",
        });

        const data = await res.json();
        alert(JSON.stringify(data, null, 2));
      }}
      style={{
        padding: "10px 16px",
        background: "black",
        color: "white",
        borderRadius: "8px",
        marginTop: "20px",
      }}
    >
      Run Agent
    </button>
  );
}
