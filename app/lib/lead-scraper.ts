export type ScrapedLead = {
  name: string;
  email?: string;
  company?: string;
  website?: string;
  industry?: string;
  source: string;
};

// Extract leads from a directory/listing page
export async function scrapeLeadsFromPage(url: string): Promise<ScrapedLead[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const leads: ScrapedLead[] = [];

    // Extract emails
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
    const emails = [...new Set(emailMatches)].filter(e =>
      !e.includes("example.com") &&
      !e.includes("sentry.io") &&
      !e.includes("w3.org")
    );

    // Extract company names near emails (simple heuristic)
    for (const email of emails.slice(0, 10)) {
      const domain = email.split("@")[1];
      const company = domain.split(".")[0];
      leads.push({
        name: company,
        email,
        company,
        website: `https://${domain}`,
        source: url,
      });
    }

    return leads;
  } catch {
    return [];
  }
}

// Search for leads by niche using Tavily
export async function findLeadsByNiche(niche: string, location?: string): Promise<ScrapedLead[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return [];

  try {
    const query = `${niche} businesses contact email${location ? ` in ${location}` : ""}`;

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        max_results: 10,
        include_domains: [],
        search_depth: "basic",
      }),
    });

    if (!res.ok) return [];

    const data = await res.json() as {
      results: Array<{ title: string; url: string; content: string }>;
    };

    return data.results.map((r) => ({
      name: r.title,
      website: r.url,
      company: r.title,
      industry: niche,
      source: "tavily-search",
    }));
  } catch {
    return [];
  }
}
