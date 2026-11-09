"use client";

import { useMemo, useState } from "react";

type Agent = {
  id: string;
  name: string;
  role: string;
  icon: string;
  status: "working" | "review" | "idle";
  task: string;
  progress: number;
  eta: string;
  room: string;
  accent: string;
};

type Product = {
  name: string;
  category: string;
  score: number;
  margin: string;
  delivery: string;
  stage: string;
  risk: "Low" | "Medium" | "High";
};

const agents: Agent[] = [
  { id: "scout", name: "Nova", role: "Product Scout", icon: "⌕", status: "working", task: "Scanning 126 product signals", progress: 68, eta: "24 min", room: "Research", accent: "cyan" },
  { id: "quality", name: "Ari", role: "Quality Analyst", icon: "◇", status: "working", task: "Verifying supplier evidence", progress: 42, eta: "38 min", room: "Quality Lab", accent: "violet" },
  { id: "finance", name: "Milo", role: "Finance Analyst", icon: "₿", status: "review", task: "Calculating landed margin", progress: 84, eta: "7 min", room: "Finance", accent: "amber" },
  { id: "growth", name: "Iris", role: "Growth Strategist", icon: "↗", status: "working", task: "Reviewing ad saturation", progress: 57, eta: "19 min", room: "Marketing", accent: "pink" },
  { id: "data", name: "Atlas", role: "Performance Analyst", icon: "▥", status: "idle", task: "Waiting for live store data", progress: 0, eta: "Idle", room: "Analytics", accent: "blue" },
];

const products: Product[] = [
  { name: "Grip Strength Sensor", category: "Longevity", score: 86, margin: "31%", delivery: "4–7 days", stage: "Deep review", risk: "Low" },
  { name: "Circadian Light Bar", category: "Sleep", score: 78, margin: "27%", delivery: "6–9 days", stage: "Quality check", risk: "Medium" },
  { name: "Mobility Recovery Kit", category: "Movement", score: 74, margin: "34%", delivery: "3–6 days", stage: "Finance", risk: "Low" },
  { name: "Smart Hydration Cap", category: "Habits", score: 62, margin: "19%", delivery: "10–16 days", stage: "At risk", risk: "High" },
];

const tabs = ["Office", "Products", "Approvals", "Agents"] as const;
type Tab = (typeof tabs)[number];

function StatusDot({ status }: { status: Agent["status"] }) {
  return <span className={`status-dot ${status}`} aria-label={status} />;
}

function AgentAvatar({ agent, small = false }: { agent: Agent; small?: boolean }) {
  return (
    <div className={`agent-avatar ${agent.accent} ${small ? "small" : ""}`}>
      <span>{agent.icon}</span>
      <i />
    </div>
  );
}

export default function OfficeDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Office");
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [depth, setDepth] = useState<"Quick" | "Standard" | "Deep">("Deep");
  const pending = useMemo(() => products.filter((product) => product.score >= 74).length, []);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><span>EO</span></div>
        <nav aria-label="Primary navigation">
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)} title={tab}>
              <span>{tab === "Office" ? "⌂" : tab === "Products" ? "□" : tab === "Approvals" ? "✓" : "◉"}</span>
              <small>{tab}</small>
              {tab === "Approvals" && <b>{pending}</b>}
            </button>
          ))}
        </nav>
        <button className="profile-button" aria-label="Profile">LM</button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">OPERATIONS CENTER</p>
            <h1>{activeTab === "Office" ? "AI Office" : activeTab}</h1>
          </div>
          <div className="top-actions">
            <div className="system-status"><span /> All systems operational</div>
            <button className="secondary-button">View daily brief</button>
            <button className="primary-button">＋ New research</button>
          </div>
        </header>

        {activeTab === "Office" && (
          <div className="office-layout">
            <section className="office-card">
              <div className="office-head">
                <div>
                  <span className="live-pill"><i /> LIVE OFFICE</span>
                  <h2>Night shift in progress</h2>
                </div>
                <div className="depth-control">
                  {(["Quick", "Standard", "Deep"] as const).map((mode) => (
                    <button key={mode} className={depth === mode ? "selected" : ""} onClick={() => setDepth(mode)}>{mode}</button>
                  ))}
                </div>
              </div>

              <div className="office-floor">
                <div className="city-glow" />
                <button className="room research" onClick={() => setSelectedAgent(agents[0])}>
                  <span className="room-label">PRODUCT RESEARCH</span>
                  <div className="screen product-screen"><i /><i /><i /></div>
                  <AgentAvatar agent={agents[0]} />
                  <div className="desk" />
                </button>

                <button className="room quality" onClick={() => setSelectedAgent(agents[1])}>
                  <span className="room-label">QUALITY LAB</span>
                  <div className="lab-boxes"><i /><i /><i /></div>
                  <AgentAvatar agent={agents[1]} />
                  <div className="desk" />
                </button>

                <button className="room finance" onClick={() => setSelectedAgent(agents[2])}>
                  <span className="room-label">FINANCE</span>
                  <div className="screen chart-screen"><i /><i /><i /><i /></div>
                  <AgentAvatar agent={agents[2]} />
                  <div className="desk" />
                </button>

                <button className="room marketing" onClick={() => setSelectedAgent(agents[3])}>
                  <span className="room-label">MARKETING</span>
                  <div className="screen media-screen"><i /><i /></div>
                  <AgentAvatar agent={agents[3]} />
                  <div className="desk" />
                </button>

                <div className="command-hub">
                  <span>CEO ORCHESTRATOR</span>
                  <div className="ceo-core">AI</div>
                  <p>Coordinating {agents.filter((agent) => agent.status !== "idle").length} active specialists</p>
                </div>

                <button className="room analytics" onClick={() => setSelectedAgent(agents[4])}>
                  <span className="room-label">ANALYTICS</span>
                  <div className="screen analytics-screen"><i /><i /><i /></div>
                  <AgentAvatar agent={agents[4]} />
                  <div className="desk" />
                </button>

                <div className="approval-room">
                  <span className="room-label">HUMAN APPROVAL</span>
                  <div className="approval-stack"><i /><i /><i /></div>
                  <strong>{pending} decisions waiting</strong>
                </div>
                <div className="flow-line line-a" /><div className="flow-line line-b" /><div className="flow-line line-c" />
              </div>
            </section>

            <aside className="inspector-card">
              <div className="inspector-title">
                <AgentAvatar agent={selectedAgent} small />
                <div><h3>{selectedAgent.name}</h3><p>{selectedAgent.role}</p></div>
                <StatusDot status={selectedAgent.status} />
              </div>
              <div className="task-panel">
                <p>CURRENT TASK</p>
                <h4>{selectedAgent.task}</h4>
                <div className="progress-meta"><span>{selectedAgent.progress}% complete</span><span>{selectedAgent.eta}</span></div>
                <div className="progress-track"><i style={{ width: `${selectedAgent.progress}%` }} /></div>
              </div>
              <dl className="agent-stats">
                <div><dt>Research depth</dt><dd>{depth}</dd></div>
                <div><dt>Office</dt><dd>{selectedAgent.room}</dd></div>
                <div><dt>Sources checked</dt><dd>{selectedAgent.status === "idle" ? "—" : 14}</dd></div>
                <div><dt>Confidence</dt><dd>{selectedAgent.status === "idle" ? "—" : "82%"}</dd></div>
              </dl>
              <button className="agent-action">Open work log →</button>
              <div className="activity-list">
                <p>LATEST ACTIVITY</p>
                <div><i className="success" /><span>Supplier history verified<small>2 min ago</small></span></div>
                <div><i /><span>Norway delivery checked<small>8 min ago</small></span></div>
                <div><i /><span>Competitor pricing collected<small>15 min ago</small></span></div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === "Products" && <ProductsView />}
        {activeTab === "Approvals" && <ApprovalsView />}
        {activeTab === "Agents" && <AgentsView onSelect={(agent) => { setSelectedAgent(agent); setActiveTab("Office"); }} />}
      </section>
    </main>
  );
}

function ProductsView() {
  return (
    <section className="data-page">
      <div className="metric-grid">
        <Metric label="Scanned today" value="126" detail="+34 since yesterday" />
        <Metric label="In deep review" value="03" detail="2 finish within an hour" />
        <Metric label="Passed filters" value="18" detail="14.3% pass rate" />
        <Metric label="Average score" value="75" detail="Top candidate: 86" />
      </div>
      <div className="table-card">
        <div className="table-title"><div><p>PRODUCT PIPELINE</p><h2>Research candidates</h2></div><button className="secondary-button">Filter products</button></div>
        <div className="product-table">
          <div className="table-row table-header"><span>Product</span><span>Score</span><span>Margin</span><span>Delivery</span><span>Stage</span><span>Risk</span></div>
          {products.map((product) => (
            <div className="table-row" key={product.name}>
              <span><strong>{product.name}</strong><small>{product.category}</small></span>
              <span><b className="score-ring">{product.score}</b></span><span>{product.margin}</span><span>{product.delivery}</span>
              <span><em>{product.stage}</em></span><span><i className={`risk ${product.risk.toLowerCase()}`}>{product.risk}</i></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ApprovalsView() {
  return (
    <section className="data-page approval-page">
      <div className="approval-intro"><p>HUMAN CONTROL</p><h2>Three decisions need your attention</h2><span>AI specialists can prepare the evidence. Only you approve spending, suppliers and store launches.</span></div>
      {products.slice(0, 3).map((product, index) => (
        <article className="approval-card" key={product.name}>
          <div className="product-icon">{index === 0 ? "◎" : index === 1 ? "☼" : "◇"}</div>
          <div className="approval-copy"><span>{product.category} · SCORE {product.score}</span><h3>{product.name}</h3><p>{index === 0 ? "Order three samples from the verified EU supplier." : index === 1 ? "Continue into a 60-minute compliance and quality review." : "Approve the draft unit economics before creative testing."}</p></div>
          <div className="approval-actions"><button>Reject</button><button className="approve">Approve</button></div>
        </article>
      ))}
    </section>
  );
}

function AgentsView({ onSelect }: { onSelect: (agent: Agent) => void }) {
  return (
    <section className="data-page">
      <div className="agent-grid">
        {agents.map((agent) => (
          <button className="agent-card" key={agent.id} onClick={() => onSelect(agent)}>
            <AgentAvatar agent={agent} />
            <div><span><StatusDot status={agent.status} /> {agent.status}</span><h3>{agent.name}</h3><p>{agent.role}</p><small>{agent.task}</small></div>
            <b>→</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="metric"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}
