const TAVILY_API_URL = "https://api.tavily.com/search";

export type ResearchResult = {
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
  answer?: string;
};

export type NicheAnalysis = {
  niche: string;
  demand: "low" | "medium" | "high";
  competition: "low" | "medium" | "high";
  suggestedProducts: string[];
  topKeywords: string[];
  estimatedPrice: { min: number; max: number };
  reasoning: string;
};

export type CompetitorAnalysis = {
  niche: string;
  competitors: Array<{
    name: string;
    url: string;
    strengths: string[];
    weaknesses: string[];
    priceRange: string;
  }>;
  marketGap: string;
  opportunity: string;
};

async function tavilySearch(query: string, options?: {
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeAnswer?: boolean;
}): Promise<ResearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY environment variable");
  }

  const res = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: options?.searchDepth ?? "basic",
      max_results: options?.maxResults ?? 5,
      include_answer: options?.includeAnswer ?? true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  return {
    query,
    results: (data.results ?? []).map((r: Record<string, unknown>) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      content: String(r.content ?? ""),
      score: Number(r.score ?? 0),
    })),
    answer: data.answer,
  };
}

export async function analyzeNiche(niche: string): Promise<NicheAnalysis> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const [demandData, competitorData, pricingData] = await Promise.all([
    tavilySearch(`${niche} market demand 2025 digital products`, { includeAnswer: true }),
    tavilySearch(`best selling ${niche} templates Etsy Gumroad`, { maxResults: 8 }),
    tavilySearch(`${niche} template price range how much to charge`, { includeAnswer: true }),
  ]);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You are a market research analyst specializing in digital products.
Analyze the research data and provide structured niche analysis.
Respond ONLY valid JSON, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Niche: ${niche}

Demand research: ${demandData.answer ?? demandData.results.map(r => r.content).join("\n").slice(0, 500)}

Competitor data: ${competitorData.results.map(r => `${r.title}: ${r.content}`).join("\n").slice(0, 800)}

Pricing data: ${pricingData.answer ?? pricingData.results.map(r => r.content).join("\n").slice(0, 400)}

Respond ONLY JSON:
{
  "niche": "${niche}",
  "demand": "low|medium|high",
  "competition": "low|medium|high",
  "suggestedProducts": ["product1", "product2", "product3"],
  "topKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "estimatedPrice": {"min": 5, "max": 25},
  "reasoning": "short explanation"
}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function analyzeCompetitors(niche: string): Promise<CompetitorAnalysis> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const searchData = await tavilySearch(
    `top ${niche} digital product sellers Etsy Gumroad Creative Market 2025`,
    { searchDepth: "advanced", maxResults: 8 }
  );

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You are a competitive intelligence analyst.
Analyze competitor data and identify market opportunities.
Respond ONLY valid JSON, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Niche: ${niche}

Competitor data:
${searchData.results.map(r => `${r.title}\n${r.url}\n${r.content}`).join("\n\n").slice(0, 1500)}

Respond ONLY JSON:
{
  "niche": "${niche}",
  "competitors": [
    {
      "name": "...",
      "url": "...",
      "strengths": ["..."],
      "weaknesses": ["..."],
      "priceRange": "$5-$25"
    }
  ],
  "marketGap": "what is missing in the market",
  "opportunity": "specific opportunity to exploit"
}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function detectTrendingNiches(): Promise<string[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const [trending1, trending2] = await Promise.all([
    tavilySearch("trending digital products Etsy bestsellers 2025", { includeAnswer: true }),
    tavilySearch("most profitable digital download niches 2025", { includeAnswer: true }),
  ]);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `Extract trending niche ideas from research data.
Respond ONLY valid JSON array of strings, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Research data:
${trending1.answer ?? ""}
${trending2.answer ?? ""}
${trending1.results.concat(trending2.results).map(r => r.content).join("\n").slice(0, 1000)}

Return ONLY JSON array of 8-10 specific niche ideas:
["niche1", "niche2", ...]`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
