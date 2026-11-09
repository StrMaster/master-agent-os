"use client";

import { useMemo, useState } from "react";
import { agentToolsets, connections, toolsForAgent } from "@/lib/agent-system";
import { nicheProfile } from "@/lib/niche-profile";

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
  verdict: string;
  demand: number;
  competition: number;
  quality: number;
  supplier: string;
  supplierScore: string;
  productCost: string;
  shippingCost: string;
  salePrice: string;
  profit: string;
  trend: string;
  confidence: string;
  sources: number;
  recommendation: string;
  positives: string[];
  risks: string[];
};

const agents: Agent[] = [
  { id: "scout", name: "Nova", role: "Product Hunter", icon: "⌕", status: "working", task: "Scanning 126 product signals", progress: 68, eta: "24 min", room: "Research", accent: "cyan" },
  { id: "supplier", name: "Eli", role: "Supplier Scout", icon: "♢", status: "working", task: "Comparing 8 EU suppliers", progress: 52, eta: "31 min", room: "Sourcing", accent: "blue" },
  { id: "quality", name: "Ari", role: "Quality Analyst", icon: "◇", status: "working", task: "Verifying supplier evidence", progress: 42, eta: "38 min", room: "Quality Lab", accent: "violet" },
  { id: "finance", name: "Milo", role: "Finance Analyst", icon: "₿", status: "review", task: "Calculating landed margin", progress: 84, eta: "7 min", room: "Finance", accent: "amber" },
  { id: "copy", name: "Luna", role: "Copywriter", icon: "✎", status: "working", task: "Writing three product angles", progress: 76, eta: "12 min", room: "Creative", accent: "pink" },
  { id: "ugc", name: "Kai", role: "UGC Producer", icon: "▶", status: "review", task: "Rendering six ad concepts", progress: 61, eta: "18 min", room: "Creative", accent: "violet" },
  { id: "meta", name: "Maya", role: "Meta Ads Buyer", icon: "M", status: "working", task: "Optimizing four live ad sets", progress: 73, eta: "Live", room: "Paid Media", accent: "blue" },
  { id: "google", name: "Theo", role: "Google Ads Buyer", icon: "G", status: "working", task: "Expanding high-intent keywords", progress: 66, eta: "Live", room: "Paid Media", accent: "cyan" },
  { id: "tiktok", name: "Zoe", role: "TikTok Ads Buyer", icon: "T", status: "working", task: "Testing two new hooks", progress: 48, eta: "Live", room: "Paid Media", accent: "pink" },
  { id: "support", name: "Atlas", role: "Customer Support", icon: "◎", status: "idle", task: "Monitoring customer conversations", progress: 0, eta: "On call", room: "Support", accent: "amber" },
];

const products: Product[] = [
  { name: "Grip Strength Sensor", category: "Longevity", score: 86, margin: "31%", delivery: "4–7 days", stage: "Deep review", risk: "Low", verdict: "Strong candidate", demand: 91, competition: 68, quality: 84, supplier: "Nordic Health Devices", supplierScore: "4.8 / 5", productCost: "€21.40", shippingCost: "€4.80", salePrice: "€49.90", profit: "€15.47", trend: "+38% in 90 days", confidence: "89%", sources: 24, recommendation: "Order three samples and start a focused creative test for the 35–55 health audience.", positives: ["Clear longevity use case", "EU supplier with fast delivery", "Healthy contribution margin"], risks: ["Medical claims must be avoided", "Requires a strong education-led ad"] },
  { name: "Circadian Light Bar", category: "Sleep", score: 78, margin: "27%", delivery: "6–9 days", stage: "Quality check", risk: "Medium", verdict: "Continue review", demand: 87, competition: 76, quality: 71, supplier: "LumaWell EU", supplierScore: "4.5 / 5", productCost: "€29.20", shippingCost: "€6.30", salePrice: "€64.90", profit: "€17.52", trend: "+24% in 90 days", confidence: "81%", sources: 19, recommendation: "Complete compliance checks and compare two additional EU suppliers before ordering samples.", positives: ["Growing sleep category", "High perceived product value", "Good visual content potential"], risks: ["Crowded advertising market", "Electrical compliance needs verification"] },
  { name: "Mobility Recovery Kit", category: "Movement", score: 74, margin: "34%", delivery: "3–6 days", stage: "Finance", risk: "Low", verdict: "Promising economics", demand: 74, competition: 59, quality: 79, supplier: "MoveCore Logistics", supplierScore: "4.7 / 5", productCost: "€16.10", shippingCost: "€4.10", salePrice: "€39.90", profit: "€13.57", trend: "+17% in 90 days", confidence: "83%", sources: 17, recommendation: "Approve unit economics and test the product as a bundled recovery solution.", positives: ["Low landed cost", "Bundle supports upsells", "Fast delivery to Norway"], risks: ["Differentiation depends on branding", "Multiple components increase return risk"] },
  { name: "Smart Hydration Cap", category: "Habits", score: 62, margin: "19%", delivery: "10–16 days", stage: "At risk", risk: "High", verdict: "Do not launch yet", demand: 69, competition: 72, quality: 55, supplier: "HydraTech Global", supplierScore: "3.9 / 5", productCost: "€18.80", shippingCost: "€7.40", salePrice: "€34.90", profit: "€6.63", trend: "+8% in 90 days", confidence: "76%", sources: 15, recommendation: "Pause this candidate until a faster supplier and a margin above 25% are found.", positives: ["Easy habit-building message", "Broad customer audience", "Potential recurring accessories"], risks: ["Slow delivery", "Weak margin after returns", "Supplier quality complaints"] },
];

const tabs = ["Office", "Products", "Approvals", "Agents", "Connections"] as const;
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
              <span>{tab === "Office" ? "⌂" : tab === "Products" ? "□" : tab === "Approvals" ? "✓" : tab === "Agents" ? "◉" : "⚙"}</span>
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
            <section className="office-card command-center">
              <div className="office-head">
                <div>
                  <span className="live-pill"><i /> STORE OPERATIONS LIVE</span>
                  <h2>10 AI employees running one online store</h2>
                </div>
                <div className="depth-control">
                  {(["Quick", "Standard", "Deep"] as const).map((mode) => (
                    <button key={mode} className={depth === mode ? "selected" : ""} onClick={() => setDepth(mode)}>{mode}</button>
                  ))}
                </div>
              </div>

              <div className="store-kpis">
                <div><span>REVENUE TODAY</span><strong>€8,640</strong><small>↗ 18.3%</small></div>
                <div><span>BLENDED ROAS</span><strong>3.21×</strong><small>above target</small></div>
                <div><span>NET PROFIT</span><strong>€2,184</strong><small>↗ 22.6%</small></div>
                <div><span>CONVERSION</span><strong>3.8%</strong><small>↗ 0.3 pt</small></div>
              </div>

              <div className="operations-board">
                <aside className="ops-feed">
                  <p>LIVE WORKFLOW</p>
                  <div><i className="green" /><span>New winner found<small>Grip Sensor · 86 score</small></span></div>
                  <div><i className="violet" /><span>Creative approved<small>UGC hook #04</small></span></div>
                  <div><i className="amber" /><span>Budget raised<small>Meta · €100 → €160</small></span></div>
                  <div><i className="cyan" /><span>Supplier verified<small>EU warehouse ready</small></span></div>
                  <button>{pending} approvals waiting →</button>
                </aside>

                <div className="agent-operations">
                  <div className="department-strip"><span>RESEARCH & PRODUCT</span><span>CREATIVE & GROWTH</span><span>LIVE COMMERCE</span></div>
                  <div className="worker-grid">
                    {agents.map((agent, index) => (
                      <button key={agent.id} className={`worker-station ${selectedAgent.id === agent.id ? "selected" : ""}`} onClick={() => setSelectedAgent(agent)}>
                        <div className="worker-monitor"><i /><span>{agent.status === "idle" ? "ON CALL" : `${agent.progress}%`}</span></div>
                        <div className={`worker-character ${agent.accent}`}><b>{agent.icon}</b><i /></div>
                        <div className="worker-desk"><i /><i /></div>
                        <strong>{agent.role}</strong>
                        <small><StatusDot status={agent.status} /> {agent.status === "review" ? "needs review" : agent.status}</small>
                        {index < 9 && <em className="handoff">→</em>}
                      </button>
                    ))}
                  </div>

                  <div className="scanner-panel">
                    <div><span>PRODUCT SCANNER</span><strong>Scanning live demand · 5 signals/sec</strong></div>
                    <div className="scanner-products">
                      {products.map((product) => <span key={product.name}><b>{product.name}</b><i>{product.margin} margin</i><em className={product.score >= 74 ? "test" : "skip"}>{product.score >= 74 ? "TEST" : "SKIP"}</em></span>)}
                    </div>
                  </div>
                </div>
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
                <div><dt>Assigned tools</dt><dd>{toolsForAgent(selectedAgent.id).length}</dd></div>
                <div><dt>Tools ready</dt><dd>{toolsForAgent(selectedAgent.id).filter((tool) => tool.state === "ready").length}</dd></div>
              </dl>
              <div className="mini-tools">{toolsForAgent(selectedAgent.id).map((tool) => <span className={tool.state} key={tool.id}>{tool.name}</span>)}</div>
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
        {activeTab === "Connections" && <ConnectionsView />}
      </section>
    </main>
  );
}

function ProductsView() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  if (selectedProduct) {
    return <ProductReport product={selectedProduct} onBack={() => setSelectedProduct(null)} />;
  }

  return (
    <section className="data-page">
      <div className="niche-profile-card">
        <div className="niche-main">
          <p>ACTIVE NICHE PROFILE</p>
          <h2>{nicheProfile.name}</h2>
          <span>{nicheProfile.positioning}</span>
        </div>
        <div className="niche-rule"><small>PRIMARY MARKET</small><strong>{nicheProfile.markets.primary}</strong><span>＋ {nicheProfile.markets.secondary.length} secondary</span></div>
        <div className="niche-rule"><small>AUDIENCE</small><strong>{nicheProfile.audience.minimumAge}+</strong><span>{nicheProfile.audience.segments.length} segments scored</span></div>
        <div className="niche-rule"><small>GROSS MARGIN</small><strong>{nicheProfile.economics.targetGrossMarginPercent}% target</strong><span>{nicheProfile.economics.minimumGrossMarginPercent}% minimum</span></div>
        <div className="niche-rule"><small>DELIVERY</small><strong>≤ {nicheProfile.delivery.preferredMaximumDays} days</strong><span>{nicheProfile.delivery.absoluteMaximumDays}-day hard limit</span></div>
        <div className="niche-categories">{nicheProfile.categories.map((category) => <span className={"phase" in category ? "later" : ""} key={category.id}>{category.name}{"phase" in category ? " · later" : ""}</span>)}</div>
      </div>
      <div className="metric-grid">
        <Metric label="Scanned today" value="126" detail="+34 since yesterday" />
        <Metric label="In deep review" value="03" detail="2 finish within an hour" />
        <Metric label="Passed filters" value="18" detail="14.3% pass rate" />
        <Metric label="Average score" value="75" detail="Top candidate: 86" />
      </div>
      <div className="table-card">
        <div className="table-title"><div><p>PRODUCT PIPELINE</p><h2>Research candidates</h2></div><button className="secondary-button">Filter products</button></div>
        <div className="product-table">
          <div className="table-row table-header"><span>Product</span><span>Score</span><span>Margin</span><span>Delivery</span><span>Stage</span><span>Risk</span><span>Report</span></div>
          {products.map((product) => (
            <div className="table-row" key={product.name}>
              <span><strong>{product.name}</strong><small>{product.category}</small></span>
              <span><b className="score-ring">{product.score}</b></span><span>{product.margin}</span><span>{product.delivery}</span>
              <span><em>{product.stage}</em></span><span><i className={`risk ${product.risk.toLowerCase()}`}>{product.risk}</i></span>
              <span><button className="report-link" onClick={() => setSelectedProduct(product)}>View report →</button></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductReport({ product, onBack }: { product: Product; onBack: () => void }) {
  const signals = [
    ["Market demand", product.demand],
    ["Competition", product.competition],
    ["Product quality", product.quality],
  ] as const;

  return (
    <section className="data-page report-page">
      <button className="report-back" onClick={onBack}>← Back to products</button>
      <div className="report-hero">
        <div>
          <p className="eyebrow">AI PRODUCT REPORT · {product.category.toUpperCase()}</p>
          <h2>{product.name}</h2>
          <span className="report-verdict">● {product.verdict}</span>
        </div>
        <div className="report-score"><strong>{product.score}</strong><span>OVERALL SCORE</span><small>{product.confidence} confidence</small></div>
      </div>

      <div className="report-grid">
        <article className="report-card signal-card">
          <div className="report-card-title"><p>MARKET SIGNALS</p><span>{product.trend}</span></div>
          {signals.map(([label, value]) => (
            <div className="signal-row" key={label}>
              <div><span>{label}</span><strong>{value}/100</strong></div>
              <div className="signal-track"><i style={{ width: `${value}%` }} /></div>
            </div>
          ))}
        </article>

        <article className="report-card economics-card">
          <div className="report-card-title"><p>UNIT ECONOMICS</p><span>{product.margin} margin</span></div>
          <dl>
            <div><dt>Product cost</dt><dd>{product.productCost}</dd></div>
            <div><dt>Shipping</dt><dd>{product.shippingCost}</dd></div>
            <div><dt>Recommended price</dt><dd>{product.salePrice}</dd></div>
            <div className="profit-line"><dt>Estimated profit</dt><dd>{product.profit}</dd></div>
          </dl>
        </article>

        <article className="report-card supplier-card">
          <div className="report-card-title"><p>SUPPLIER</p><span>Verified</span></div>
          <h3>{product.supplier}</h3>
          <div className="supplier-meta"><span>Rating<strong>{product.supplierScore}</strong></span><span>Delivery<strong>{product.delivery}</strong></span><span>Risk<strong className={`risk-text ${product.risk.toLowerCase()}`}>{product.risk}</strong></span></div>
        </article>

        <article className="report-card evidence-card">
          <div className="report-card-title"><p>RESEARCH EVIDENCE</p><span>{product.sources} sources</span></div>
          <div className="evidence-lists">
            <div><h4>Why it could win</h4>{product.positives.map((item) => <p key={item}><i>✓</i>{item}</p>)}</div>
            <div><h4>Risks to solve</h4>{product.risks.map((item) => <p key={item}><i>!</i>{item}</p>)}</div>
          </div>
        </article>

        <article className="report-card recommendation-card">
          <div><p>CEO RECOMMENDATION</p><h3>{product.recommendation}</h3><span>Generated from market, supplier, quality and financial agent reports.</span></div>
          <button>Send to approval →</button>
        </article>
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
            <div><span><StatusDot status={agent.status} /> {agent.status}</span><h3>{agent.name}</h3><p>{agent.role}</p><small>{agent.task}</small><em>{agentToolsets[agent.id]?.length ?? 0} tools assigned</em></div>
            <b>→</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function ConnectionsView() {
  const ready = connections.filter((connection) => connection.state === "ready").length;
  const waiting = connections.filter((connection) => connection.state === "needs_connection").length;

  return (
    <section className="data-page connections-page">
      <div className="connection-summary">
        <div><p>AGENT TOOL LAYER</p><h2>{ready} tools ready · {waiting} accounts to connect</h2><span>Every agent only receives the tools required for its role.</span></div>
        <div className="connection-health"><strong>{Math.round((ready / connections.length) * 100)}%</strong><span>FOUNDATION READY</span></div>
      </div>
      <div className="connections-grid">
        {connections.map((connection) => (
          <article className="connection-card" key={connection.id}>
            <div className={`connection-icon ${connection.state}`}>{connection.state === "ready" ? "✓" : connection.state === "planned" ? "○" : "+"}</div>
            <div><span>{connection.category}</span><h3>{connection.name}</h3><p>{connection.purpose}</p></div>
            <b className={connection.state}>{connection.state === "ready" ? "READY" : connection.state === "planned" ? "PLANNED" : "CONNECT ACCOUNT"}</b>
          </article>
        ))}
      </div>
      <div className="permission-note"><strong>Human approval remains mandatory</strong><span>Agents can prepare work. Spending, refunds, supplier orders, campaign launches and store launches remain blocked until you approve them.</span></div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="metric"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}
