export const nicheProfile = {
  name: "Global Wellness & Better Living",
  positioning: "Products that help adults sleep better, recover faster and stay stronger for longer.",
  markets: {
    primary: "United States",
    secondary: ["Canada", "United Kingdom", "Australia", "European Union", "Norway"],
    currencyMode: "local",
  },
  audience: {
    minimumAge: 18,
    segments: ["18–24", "25–34", "35–44", "45–54", "55+"],
    rule: "Score demand and buying intent separately for every age segment. Never assume one universal buyer.",
  },
  categories: [
    { id: "sleep-recovery", name: "Sleep & Recovery" },
    { id: "strength-mobility", name: "Strength & Mobility" },
    { id: "smart-wellness", name: "Smart Wellness" },
    { id: "stress-focus", name: "Stress & Focus", phase: "later" },
  ],
  economics: {
    targetGrossMarginPercent: 70,
    minimumGrossMarginPercent: 60,
    targetContributionMarginPercent: 20,
    marginDefinition: "Selling price minus landed product and delivery cost, divided by selling price. Advertising is evaluated separately.",
  },
  delivery: {
    preferredMaximumDays: 14,
    absoluteMaximumDays: 21,
    rule: "Penalize products above 14 days and reject products above 21 days.",
  },
  productRules: {
    preferredPriceUsd: { minimum: 35, maximum: 150 },
    mustBeEasyToDemonstrate: true,
    mustSolveClearProblem: true,
    avoidSizingComplexity: true,
    exclusions: [
      "Supplements and ingestible products",
      "Prescription or regulated medical products",
      "Unverified medical claims",
      "Products with high defect or return risk",
      "Products using protected brands or counterfeit designs",
    ],
  },
} as const;
