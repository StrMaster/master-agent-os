import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ProductCosts = {
  anthropicApiUsd: number;
  vercelUsd: number;
  supabaseUsd: number;
  tavilyUsd: number;
  otherUsd: number;
};

export type PricingResult = {
  product: string;
  costs: ProductCosts;
  totalCostUsd: number;
  suggestedPrices: {
    minimum: number;
    recommended: number;
    premium: number;
  };
  margins: {
    minimum: number;
    recommended: number;
    premium: number;
  };
  monthlyBreakeven: {
    atMinimum: number;
    atRecommended: number;
    atPremium: number;
  };
  reasoning: string;
  warnings: string[];
};

export type MarketPricing = {
  niche: string;
  averagePrice: number;
  priceRange: { min: number; max: number };
  recommendedPosition: "budget" | "mid" | "premium";
  reasoning: string;
};

const PLATFORM_COSTS = {
  vercelPro: 20,
  supabaseFree: 0,
  supabasePro: 25,
  tavilyPer1000: 1,
  anthropicHaikuPer1MInput: 0.25,
  anthropicHaikuPer1MOutput: 1.25,
};

function calculateApiCosts(estimatedMonthlyUsage: {
  tasksPerMonth: number;
  tokensPerTask: number;
}): number {
  const totalTokens = estimatedMonthlyUsage.tasksPerMonth * estimatedMonthlyUsage.tokensPerTask;
  const inputCost = (totalTokens * 0.7 / 1_000_000) * PLATFORM_COSTS.anthropicHaikuPer1MInput;
  const outputCost = (totalTokens * 0.3 / 1_000_000) * PLATFORM_COSTS.anthropicHaikuPer1MOutput;
  return inputCost + outputCost;
}

export async function calculateProductPricing(context: {
  productName: string;
  productType: string;
  targetMarket: string;
  competitorPrices?: number[];
  estimatedMonthlyTasks?: number;
}): Promise<PricingResult> {
  const apiCost = calculateApiCosts({
    tasksPerMonth: context.estimatedMonthlyTasks ?? 100,
    tokensPerTask: 3000,
  });

  const costs: ProductCosts = {
    anthropicApiUsd: parseFloat(apiCost.toFixed(4)),
    vercelUsd: 0.67,
    supabaseUsd: 0,
    tavilyUsd: 0.10,
    otherUsd: 0.05,
  };

  const totalCostUsd = Object.values(costs).reduce((a, b) => a + b, 0);

  const competitorAvg = context.competitorPrices?.length
    ? context.competitorPrices.reduce((a, b) => a + b, 0) / context.competitorPrices.length
    : null;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `You are a SaaS pricing strategist.
Calculate optimal pricing based on costs, market data, and value.
Respond ONLY valid JSON, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Product: ${context.productName}
Type: ${context.productType}
Target market: ${context.targetMarket}
Monthly infrastructure cost: $${totalCostUsd.toFixed(4)}
Competitor average price: ${competitorAvg ? `$${competitorAvg.toFixed(2)}/month` : "unknown"}
Competitor prices: ${context.competitorPrices?.join(", ") ?? "unknown"}

Calculate pricing. Respond ONLY JSON:
{
  "suggestedPrices": {
    "minimum": 9.99,
    "recommended": 29.99,
    "premium": 79.99
  },
  "reasoning": "explanation of pricing strategy",
  "warnings": ["warning if any pricing concern"]
}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  const aiResult = JSON.parse(clean);

  const prices = aiResult.suggestedPrices;

  return {
    product: context.productName,
    costs,
    totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
    suggestedPrices: prices,
    margins: {
      minimum: parseFloat(((prices.minimum - totalCostUsd) / prices.minimum * 100).toFixed(1)),
      recommended: parseFloat(((prices.recommended - totalCostUsd) / prices.recommended * 100).toFixed(1)),
      premium: parseFloat(((prices.premium - totalCostUsd) / prices.premium * 100).toFixed(1)),
    },
    monthlyBreakeven: {
      atMinimum: Math.ceil(PLATFORM_COSTS.vercelPro / prices.minimum),
      atRecommended: Math.ceil(PLATFORM_COSTS.vercelPro / prices.recommended),
      atPremium: Math.ceil(PLATFORM_COSTS.vercelPro / prices.premium),
    },
    reasoning: aiResult.reasoning,
    warnings: aiResult.warnings ?? [],
  };
}

export async function analyzeMarketPricing(niche: string): Promise<MarketPricing> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 384,
    system: `You are a market pricing analyst.
Analyze typical pricing for digital products in a given niche.
Respond ONLY valid JSON, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Niche: ${niche}

Based on your knowledge of Etsy, Gumroad, and similar platforms, analyze typical pricing.
Respond ONLY JSON:
{
  "niche": "${niche}",
  "averagePrice": 15.00,
  "priceRange": {"min": 5, "max": 50},
  "recommendedPosition": "budget|mid|premium",
  "reasoning": "short explanation"
}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
