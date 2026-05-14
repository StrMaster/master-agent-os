import { NextResponse } from "next/server";
import {
  createPipeline,
  getPipelines,
  updatePipelineStage,
  deletePipeline,
  type PipelineStage,
} from "@/app/lib/pipeline-store";
import { analyzeNiche, analyzeCompetitors } from "@/agents/business/research-agent";
import { calculateProductPricing } from "@/agents/business/pricing-engine";

export async function GET() {
  try {
    const pipelines = await getPipelines();
    return NextResponse.json({ ok: true, pipelines });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "create");

    if (action === "create") {
      const pipeline = await createPipeline({
        name: String(body.name ?? "").trim(),
        niche: String(body.niche ?? "").trim(),
        productType: String(body.productType ?? "saas-tool").trim(),
        targetMarket: String(body.targetMarket ?? "").trim(),
      });
      return NextResponse.json({ ok: true, pipeline });
    }

    if (action === "run-stage") {
      const pipelineId = String(body.pipelineId ?? "");
      const stage = String(body.stage ?? "") as PipelineStage;
      const pipelines = await getPipelines();
      const pipeline = pipelines.find((p) => p.id === pipelineId);
      if (!pipeline) return NextResponse.json({ ok: false, error: "Pipeline not found" }, { status: 404 });

      await updatePipelineStage(pipelineId, stage, { status: "running", startedAt: new Date().toISOString() });

      try {
        let result: unknown;

        if (stage === "research") {
          result = await analyzeNiche(pipeline.niche);
        } else if (stage === "competitor") {
          result = await analyzeCompetitors(pipeline.niche);
        } else if (stage === "pricing") {
          const researchStage = pipeline.stages.find((s) => s.stage === "research");
          const competitorStage = pipeline.stages.find((s) => s.stage === "competitor");
          const competitorData = competitorStage?.result as any;
          const competitorPrices = competitorData?.competitors
            ?.map((c: any) => parseFloat(c.priceRange?.replace(/[^0-9.]/g, "") ?? "0"))
            ?.filter(Boolean) ?? [];

          result = await calculateProductPricing({
            productName: pipeline.name,
            productType: pipeline.productType,
            targetMarket: pipeline.targetMarket,
            competitorPrices,
          });
        } else {
          result = { message: `Stage ${stage} not yet implemented` };
        }

        await updatePipelineStage(pipelineId, stage, {
          status: "waiting-approval",
          result,
          completedAt: new Date().toISOString(),
        });

        return NextResponse.json({ ok: true, stage, result });
      } catch (stageError) {
        await updatePipelineStage(pipelineId, stage, {
          status: "failed",
          error: stageError instanceof Error ? stageError.message : "Stage failed",
        });
        return NextResponse.json({ ok: false, error: stageError instanceof Error ? stageError.message : "Stage failed" }, { status: 500 });
      }
    }

    if (action === "approve") {
      const pipelineId = String(body.pipelineId ?? "");
      const stage = String(body.stage ?? "") as PipelineStage;
      const pipeline = await updatePipelineStage(pipelineId, stage, { status: "approved" });
      return NextResponse.json({ ok: true, pipeline });
    }

    if (action === "reject") {
      const pipelineId = String(body.pipelineId ?? "");
      const stage = String(body.stage ?? "") as PipelineStage;
      const pipeline = await updatePipelineStage(pipelineId, stage, { status: "rejected" });
      return NextResponse.json({ ok: true, pipeline });
    }

    if (action === "delete") {
      await deletePipeline(String(body.pipelineId ?? ""));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
