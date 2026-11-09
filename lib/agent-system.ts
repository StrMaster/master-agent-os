export type ConnectionState = "ready" | "needs_connection" | "planned";

export type ToolConnection = {
  id: string;
  name: string;
  category: string;
  state: ConnectionState;
  purpose: string;
};

export const connections: ToolConnection[] = [
  { id: "web-research", name: "Web Research", category: "Research", state: "ready", purpose: "Market, competitor and demand research" },
  { id: "product-score", name: "Product Scoring", category: "Internal", state: "ready", purpose: "Scores demand, margin, risk and delivery" },
  { id: "margin-engine", name: "Margin Engine", category: "Finance", state: "ready", purpose: "Landed cost, MVA, fees and profit calculations" },
  { id: "approval-gate", name: "Human Approval Gate", category: "Safety", state: "ready", purpose: "Blocks spending, refunds and launches until approved" },
  { id: "shopify", name: "Shopify", category: "Store", state: "needs_connection", purpose: "Products, orders, customers and store analytics" },
  { id: "autods", name: "AutoDS", category: "Sourcing", state: "needs_connection", purpose: "Supplier discovery, stock and fulfillment" },
  { id: "meta", name: "Meta Ads", category: "Advertising", state: "needs_connection", purpose: "Campaigns, spend, ROAS and audiences" },
  { id: "google", name: "Google Ads", category: "Advertising", state: "needs_connection", purpose: "Search campaigns, keywords and conversions" },
  { id: "tiktok", name: "TikTok Ads", category: "Advertising", state: "needs_connection", purpose: "Campaigns, creatives and performance" },
  { id: "email", name: "Customer Email", category: "Support", state: "needs_connection", purpose: "Read, draft and send customer replies" },
  { id: "tracking", name: "Shipment Tracking", category: "Support", state: "planned", purpose: "Carrier status and delivery exceptions" },
  { id: "creative", name: "Creative Studio", category: "Creative", state: "planned", purpose: "Images, UGC scripts and ad variations" },
];

export const agentToolsets: Record<string, string[]> = {
  scout: ["web-research", "product-score"],
  supplier: ["web-research", "autods", "product-score"],
  quality: ["web-research", "product-score", "approval-gate"],
  finance: ["margin-engine", "shopify", "approval-gate"],
  copy: ["web-research", "creative", "shopify"],
  ugc: ["creative", "approval-gate"],
  meta: ["meta", "shopify", "approval-gate"],
  google: ["google", "shopify", "approval-gate"],
  tiktok: ["tiktok", "shopify", "approval-gate"],
  support: ["shopify", "email", "tracking", "approval-gate"],
};

export function toolsForAgent(agentId: string) {
  const ids = agentToolsets[agentId] ?? [];
  return ids.map((id) => connections.find((connection) => connection.id === id)).filter(Boolean) as ToolConnection[];
}
