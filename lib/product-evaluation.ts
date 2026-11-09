export type ProductEvaluationInput = {
  demand: number;
  competition: number;
  quality: number;
  productCost: number;
  shippingCost: number;
  salePrice: number;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function evaluateProduct(input: ProductEvaluationInput) {
  const landedCost = input.productCost + input.shippingCost;
  const profit = input.salePrice - landedCost;
  const marginPercent = input.salePrice > 0 ? (profit / input.salePrice) * 100 : 0;
  const marginScore = clamp(marginPercent * 2.5);
  const score = Math.round(
    clamp(input.demand) * 0.35 +
    (100 - clamp(input.competition)) * 0.2 +
    clamp(input.quality) * 0.25 +
    marginScore * 0.2,
  );

  const verdict = score >= 80 ? "strong_candidate" : score >= 68 ? "continue_review" : "reject_or_improve";

  return {
    score,
    verdict,
    economics: {
      landedCost: Number(landedCost.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      marginPercent: Number(marginPercent.toFixed(1)),
    },
    approval: {
      required: true,
      allowedActions: ["save_report", "request_more_research"],
      blockedUntilApproved: ["order_samples", "launch_product", "start_ad_spend"],
    },
  };
}
