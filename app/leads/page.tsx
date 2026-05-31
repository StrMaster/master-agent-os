"use client";

import { useState, useEffect } from "react";

type Lead = {
  id: string;
  name: string;
  email?: string;
  company?: string;
  website?: string;
  industry?: string;
  status: "new" | "contacted" | "replied" | "qualified" | "closed";
  outreach_count: number;
  notes?: string;
  created_at: string;
};

const STATUS_COLORS: Record<Lead["status"], string> = {
  new: "bg-blue-500/20 text-blue-300",
  contacted: "bg-yellow-500/20 text-yellow-300",
  replied: "bg-purple-500/20 text-purple-300",
  qualified: "bg-green-500/20 text-green-300",
  closed: "bg-gray-500/20 text-gray-400",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [finding, setFinding] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(data.leads ?? []);
    setLoading(false);
  }

  async function findLeads() {
    if (!niche) return;
    setFinding(true);
    setMessage("");
    const res = await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "find-leads", niche, location }),
    });
    const data = await res.json();
    setMessage(data.ok ? `Found ${data.found} leads, saved ${data.saved}` : data.error);
    setFinding(false);
    if (data.ok) loadLeads();
  }

  async function sendOutreach(lead: Lead) {
    if (!lead.email) return;
    setSending(lead.id);
    const res = await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        leadId: lead.id,
        email: lead.email,
        name: lead.name,
        company: lead.company,
        website: lead.website,
      }),
    });
    const data = await res.json();
    setSending(null);
    if (data.ok) {
      setMessage(`Sent to ${lead.email}: "${data.subject}"`);
      loadLeads();
    } else {
      setMessage(`Error: ${data.error}`);
    }
  }

  async function updateStatus(id: string, status: Lead["status"]) {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadLeads();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Lead Generation</h1>
        <p className="text-white/50 mb-8">Find, contact, and track prospects autonomously.</p>

        {/* Find Leads */}
        <div className="bg-white/5 rounded-xl p-5 mb-6 border border-white/10">
          <h2 className="text-lg font-semibold mb-4">Find Leads by Niche</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-white/30"
              placeholder="Niche (e.g. dental clinics, SaaS startups)"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
            <input
              className="w-40 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-white/30"
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <button
              onClick={findLeads}
              disabled={finding || !niche}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {finding ? "Searching..." : "Find Leads"}
            </button>
          </div>
          {message && (
            <p className="mt-3 text-sm text-white/60">{message}</p>
          )}
        </div>

        {/* Leads Table */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="font-semibold">Leads ({leads.length})</h2>
            <button onClick={loadLeads} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-white/30 text-sm">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No leads yet. Find some above.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 flex items-center gap-4 hover:bg-white/3 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{lead.company ?? lead.name}</div>
                    <div className="text-xs text-white/40 truncate">{lead.email ?? lead.website ?? "No contact"}</div>
                  </div>

                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status]}`}>
                    {lead.status}
                  </span>

                  <span className="text-xs text-white/30">
                    {lead.outreach_count}x contacted
                  </span>

                  <div className="flex gap-2">
                    {lead.email && lead.status === "new" && (
                      <button
                        onClick={() => sendOutreach(lead)}
                        disabled={sending === lead.id}
                        className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {sending === lead.id ? "Sending..." : "Send"}
                      </button>
                    )}
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value as Lead["status"])}
                      className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 outline-none"
                    >
                      <option value="new">new</option>
                      <option value="contacted">contacted</option>
                      <option value="replied">replied</option>
                      <option value="qualified">qualified</option>
                      <option value="closed">closed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
